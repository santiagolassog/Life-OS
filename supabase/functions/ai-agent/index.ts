import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'agent'
  content: string
}

interface AgentResponse {
  type: 'text' | 'clarification' | 'error'
  text: string
  chips?: string[]
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Tool definitions (se amplían en cada sesión de módulo) ───────────────────

// Gemini REST API usa snake_case: function_declarations (no camelCase)
const TOOLS = [
  {
    function_declarations: [
      {
        name: 'pedir_aclaracion',
        description: 'Pide aclaración al usuario cuando falta información para ejecutar una acción. Devuelve una pregunta con opciones de selección rápida.',
        parameters: {
          type: 'OBJECT',
          properties: {
            pregunta: { type: 'STRING', description: 'La pregunta a hacer al usuario' },
            opciones: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Lista de opciones de respuesta rápida para el usuario',
            },
          },
          required: ['pregunta', 'opciones'],
        },
      },
      {
        name: 'confirmar_accion',
        description: 'Pide confirmación al usuario antes de ejecutar una acción destructiva (editar, eliminar).',
        parameters: {
          type: 'OBJECT',
          properties: {
            descripcion: { type: 'STRING', description: 'Descripción clara de la acción a confirmar' },
          },
          required: ['descripcion'],
        },
      },
    ],
  },
]

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  moduleActive: string,
  nowStr: string,
  contextData: Record<string, unknown>,
): string {
  const moduleLabels: Record<string, string> = {
    hoy: 'Dashboard Inicio',
    tiempo: 'Gestión del Tiempo',
    lista: 'Lista de Tareas',
    objetivos: 'Objetivos',
    dinero: 'Finanzas',
    revision: 'Revisión',
  }

  const moduleLabel = moduleLabels[moduleActive] ?? moduleActive

  return `Eres el asistente AI de LifeOS — el sistema de vida personal de ${userName}.
Ahora mismo es: ${nowStr}.
El usuario está viendo la sección: "${moduleLabel}".

TU ROL:
Ayudar a ${userName} a gestionar su productividad, tiempo, objetivos, tareas y finanzas
directamente desde el chat, sin que tenga que hacerlo manualmente en la interfaz.

PRINCIPIOS DE COMPORTAMIENTO:
- Responde SIEMPRE en español, de forma breve, directa y cálida
- Cuando te falte información para ejecutar una acción, usa la herramienta "pedir_aclaracion"
  con opciones claras — NUNCA hagas preguntas abiertas en texto
- Antes de editar o eliminar algo, usa "confirmar_accion"
- Confirma acciones exitosas con un mensaje corto y motivador (máx 1 frase)
- Si el usuario hace una pregunta general, respóndela directamente sin usar herramientas
- Infiere el módulo correcto según el contexto del mensaje

MÓDULOS DISPONIBLES:
- Tiempo: bloques de tiempo en la agenda semanal
- Lista: tareas en el tablero kanban (Backlog, Por Hacer, En Progreso, Hechas)
- Objetivos: metas semanales con seguimiento
- Dinero: ingresos, gastos, ahorros, préstamos, presupuestos
- Revisión: análisis y reportes de productividad

CONTEXTO DEL USUARIO:
${JSON.stringify(contextData, null, 2)}

Recuerda: eres una extensión inteligente de ${userName}, actúa como tal.`
}

// ─── Gemini request builder ───────────────────────────────────────────────────

function buildGeminiRequest(
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
) {
  const contents = [
    // Historial previo
    ...history.map((msg) => ({
      role: msg.role === 'agent' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    // Mensaje actual
    { role: 'user', parts: [{ text: message }] },
  ]

  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: TOOLS,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  }
}

// ─── Gemini response parser ───────────────────────────────────────────────────

function parseGeminiResponse(data: Record<string, unknown>): AgentResponse {
  const candidates = data.candidates as Array<Record<string, unknown>>
  if (!candidates || candidates.length === 0) {
    return { type: 'error', text: 'Sin respuesta del modelo.' }
  }

  const content = candidates[0].content as Record<string, unknown>
  const parts = content?.parts as Array<Record<string, unknown>>
  if (!parts || parts.length === 0) {
    return { type: 'error', text: 'Respuesta vacía.' }
  }

  // Check for function call
  const part = parts[0]
  if (part.functionCall) {
    const fc = part.functionCall as Record<string, unknown>
    const name = fc.name as string
    const args = fc.args as Record<string, unknown>

    if (name === 'pedir_aclaracion') {
      return {
        type: 'clarification',
        text: args.pregunta as string,
        chips: args.opciones as string[],
      }
    }

    if (name === 'confirmar_accion') {
      return {
        type: 'clarification',
        text: `¿Confirmas esta acción? ${args.descripcion}`,
        chips: ['Sí, confirmar', 'No, cancelar'],
      }
    }
  }

  // Text response
  if (part.text) {
    return { type: 'text', text: part.text as string }
  }

  return { type: 'error', text: 'No pude procesar la respuesta.' }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Auth validation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // 2. Parse request
    const { message, history = [], moduleActive = 'hoy', context = {} } = await req.json()

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ type: 'error', text: 'Mensaje vacío.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Build prompt & request
    const userName = (user.user_metadata?.display_name as string) ||
      user.email?.split('@')[0] || 'Usuario'

    const nowStr = new Date().toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const systemPrompt = buildSystemPrompt(userName, moduleActive, nowStr, context)
    const geminiRequest = buildGeminiRequest(systemPrompt, history, message)

    // 4. Call Gemini API
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')

    // DEBUG: listar modelos disponibles para esta key
    if (message.trim().toLowerCase() === 'list models') {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      const listData = await listRes.json()
      const names = (listData.models ?? []).map((m: Record<string,unknown>) => m.name).join('\n')
      return new Response(
        JSON.stringify({ type: 'text', text: `Modelos disponibles:\n${names || JSON.stringify(listData)}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiRequest),
      },
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini error ${geminiRes.status}: ${errText}`)
    }

    const geminiData = await geminiRes.json()

    // 5. Parse & return response
    const result = parseGeminiResponse(geminiData)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('ai-agent error:', msg)
    // Retorna 200 para que el cliente vea el mensaje de error real
    return new Response(
      JSON.stringify({ type: 'error', text: `⚠️ ${msg}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
