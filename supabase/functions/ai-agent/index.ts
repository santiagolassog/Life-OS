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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    function_declarations: [
      // ── Aclaración / confirmación ──────────────────────────────────────────
      {
        name: 'pedir_aclaracion',
        description: 'Pide aclaración al usuario cuando falta información. Devuelve una pregunta con opciones de selección rápida.',
        parameters: {
          type: 'OBJECT',
          properties: {
            pregunta: { type: 'STRING', description: 'La pregunta a hacer al usuario' },
            opciones: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Opciones de respuesta rápida' },
          },
          required: ['pregunta', 'opciones'],
        },
      },
      {
        name: 'confirmar_accion',
        description: 'Pide confirmación antes de editar o eliminar algo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            descripcion: { type: 'STRING', description: 'Qué acción se va a realizar' },
          },
          required: ['descripcion'],
        },
      },

      // ── Módulo TIEMPO ──────────────────────────────────────────────────────
      {
        name: 'crear_evento',
        description: 'Crea un bloque de tiempo en la agenda. Puede ser en uno o varios días a la vez.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dateIds:    { type: 'ARRAY',  items: { type: 'STRING' }, description: 'Lista de fechas YYYY-MM-DD. Si es un solo día, pasa un array con ese día. Si son varios, pasa todos.' },
            startHour:  { type: 'STRING', description: 'Hora inicio HH:MM (00,15,30,45)' },
            endHour:    { type: 'STRING', description: 'Hora fin HH:MM (00,15,30,45)' },
            categoryId: { type: 'STRING', description: 'ID de la categoría/área' },
            taskName:   { type: 'STRING', description: 'Nombre o descripción de la actividad' },
            habitId:    { type: 'STRING', description: 'ID del hábito a asociar (opcional)' },
          },
          required: ['dateIds', 'startHour', 'endHour', 'categoryId', 'taskName'],
        },
      },
      {
        name: 'editar_evento',
        description: 'Edita un bloque de tiempo existente. Solo pasa los campos que cambian.',
        parameters: {
          type: 'OBJECT',
          properties: {
            eventId:    { type: 'STRING', description: 'ID del evento' },
            dateId:     { type: 'STRING', description: 'Fecha actual del evento YYYY-MM-DD' },
            startHour:  { type: 'STRING', description: 'Nueva hora inicio HH:MM (opcional)' },
            endHour:    { type: 'STRING', description: 'Nueva hora fin HH:MM (opcional)' },
            categoryId: { type: 'STRING', description: 'Nuevo ID de categoría (opcional)' },
            taskName:   { type: 'STRING', description: 'Nuevo nombre de actividad (opcional)' },
          },
          required: ['eventId', 'dateId'],
        },
      },
      {
        name: 'eliminar_evento',
        description: 'Elimina un bloque de tiempo de la agenda.',
        parameters: {
          type: 'OBJECT',
          properties: {
            eventId: { type: 'STRING', description: 'ID del evento' },
            dateId:  { type: 'STRING', description: 'Fecha del evento YYYY-MM-DD' },
          },
          required: ['eventId', 'dateId'],
        },
      },
      {
        name: 'completar_evento',
        description: 'Marca o desmarca un evento como completado. Permite registrar energía e impacto.',
        parameters: {
          type: 'OBJECT',
          properties: {
            eventId:   { type: 'STRING' },
            dateId:    { type: 'STRING', description: 'Fecha del evento YYYY-MM-DD' },
            completed: { type: 'BOOLEAN', description: 'true para completar, false para desmarcar' },
            energy:    { type: 'NUMBER', description: 'Energía invertida del 1 al 5 (opcional)' },
            impact:    { type: 'NUMBER', description: 'Impacto generado del 1 al 5 (opcional)' },
          },
          required: ['eventId', 'dateId', 'completed'],
        },
      },
      {
        name: 'duplicar_evento',
        description: 'Duplica un evento a uno o varios días de la semana.',
        parameters: {
          type: 'OBJECT',
          properties: {
            eventId:       { type: 'STRING', description: 'ID del evento origen' },
            sourceDateId:  { type: 'STRING', description: 'Fecha origen YYYY-MM-DD' },
            targetDateIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Lista de fechas destino YYYY-MM-DD' },
          },
          required: ['eventId', 'sourceDateId', 'targetDateIds'],
        },
      },
      {
        name: 'consultar_agenda',
        description: 'Consulta los eventos de un día específico o de hoy.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dateId: { type: 'STRING', description: 'Fecha YYYY-MM-DD. Si no se pasa, usa hoy.' },
          },
          required: [],
        },
      },
      {
        name: 'consultar_disponibilidad',
        description: 'Consulta los huecos libres de un día para saber dónde agendar algo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dateId: { type: 'STRING', description: 'Fecha YYYY-MM-DD' },
          },
          required: ['dateId'],
        },
      },
      {
        name: 'crear_area',
        description: 'Crea una nueva área/categoría de vida del usuario.',
        parameters: {
          type: 'OBJECT',
          properties: {
            label: { type: 'STRING', description: 'Nombre del área' },
            short: { type: 'STRING', description: 'Sigla corta máx 5 caracteres en MAYÚSCULAS' },
            color: { type: 'STRING', description: 'Color hex, ej: #6366f1' },
          },
          required: ['label', 'short', 'color'],
        },
      },
      {
        name: 'editar_area',
        description: 'Edita una área/categoría existente.',
        parameters: {
          type: 'OBJECT',
          properties: {
            areaId: { type: 'STRING', description: 'ID del área a editar' },
            label:  { type: 'STRING', description: 'Nuevo nombre (opcional)' },
            short:  { type: 'STRING', description: 'Nueva sigla (opcional)' },
            color:  { type: 'STRING', description: 'Nuevo color hex (opcional)' },
          },
          required: ['areaId'],
        },
      },
      {
        name: 'eliminar_area',
        description: 'Elimina un área/categoría de vida.',
        parameters: {
          type: 'OBJECT',
          properties: {
            areaId: { type: 'STRING', description: 'ID del área a eliminar' },
          },
          required: ['areaId'],
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
    hoy:      'Dashboard Inicio',
    tiempo:   'Gestión del Tiempo',
    lista:    'Lista de Tareas',
    objetivos:'Objetivos',
    dinero:   'Finanzas',
    revision: 'Revisión',
    habitos:  'Hábitos',
  }

  const cats = contextData.categorias as Array<{id:string;label:string;short:string;color:string;presets:string[]}> ?? []
  const catsStr = cats.length
    ? cats.map(c => {
        const presetsStr = c.presets?.length ? `\n      Sub-actividades: ${c.presets.join(', ')}` : ''
        return `  • ${c.label} (id: ${c.id})${presetsStr}`
      }).join('\n')
    : '  (sin áreas creadas)'

  const habitos = contextData.habitos as Array<{id:string;name:string;target:number}> ?? []
  const habitosStr = habitos.length
    ? habitos.map(h => `  • ${h.name} — ${h.target}d/sem (id: ${h.id})`).join('\n')
    : '  (sin hábitos creados)'

  const eventos = contextData.eventos as Record<string, Array<{id:string;startHour:string;endHour:string;category:string;task:string;completed:boolean}>> ?? {}
  const eventosStr = Object.keys(eventos).length
    ? Object.entries(eventos).map(([date, evs]) =>
        `  ${date}:\n` + evs.map(e => `    - [${e.id}] ${e.startHour}–${e.endHour} | ${e.task} | cat:${e.category} | ${e.completed ? '✓' : '○'}`).join('\n')
      ).join('\n')
    : '  (sin eventos en el rango)'

  // Fechas exactas de cada día de la semana (calculadas en la zona horaria del usuario)
  const hoy = (contextData.fechaLocal as string | undefined) ?? todayStr()
  const diasSemana = contextData.diasSemana as Record<string, string> ?? {}
  const diasSemanaStr = Object.entries(diasSemana)
    .map(([nombre, fecha]) => `  ${nombre}: ${fecha}`)
    .join('\n')

  return `Eres el asistente AI de LifeOS — el sistema de vida personal de ${userName}.
Ahora mismo es: ${nowStr}.
El usuario está en: "${moduleLabels[moduleActive] ?? moduleActive}".

TU ROL:
Ejecutar acciones en LifeOS con lenguaje natural. Interpreta fechas relativas (mañana, el lunes, etc.)
usando SIEMPRE la fecha HOY indicada abajo. NUNCA uses otra referencia de fecha.

FORMATO DE HORAS: HH:MM en múltiplos de 15 minutos (00, 15, 30, 45). Redondea al más cercano.

PRINCIPIOS GENERALES:
- Responde SIEMPRE en español, breve y directo
- Cuando necesites información del usuario: SIEMPRE usa pedir_aclaracion con opciones como botones.
  NUNCA listes opciones en texto plano (ej: no hagas ["opcion1", "opcion2"] en texto).
- Antes de eliminar usa confirmar_accion
- Tras ejecutar confirma con ✅

════════════════════════════════════════
FLUJO PARA CREAR UN EVENTO EN TIEMPO
(sigue SIEMPRE este orden, paso a paso)
════════════════════════════════════════

PASO 1 — DÍAS:
  Si el usuario no especificó en qué día(s), pregunta con pedir_aclaracion.
  Ofrece opciones útiles según el contexto, por ejemplo:
  ["Solo hoy", "Mañana", "Lunes a Viernes (esta semana)", "Lun, Mié, Vie", "Toda la semana", "Otro día..."]
  Si el usuario ya indicó el/los días, omite este paso.
  IMPORTANTE: crear_evento ahora recibe dateIds (array) — siempre pasa un array, incluso para un solo día.
  Para "Lunes a Viernes esta semana" calcula las fechas exactas de esos días.

PASO 2 — ÁREA:
  Si el usuario no especificó el área, usa pedir_aclaracion con las áreas disponibles como opciones.
  Ejemplo de opciones: ["Personal", "Mentalidad Campeona", "NPL", ...]

PASO 3 — ACTIVIDAD ESPECÍFICA:
  Una vez tengas el área, usa pedir_aclaracion mostrando las sub-actividades preset de ESA área.
  Siempre incluye "Otra actividad..." al final para que el usuario pueda escribir la suya.
  Ejemplo: ["Hacer ejercicio", "Desayuno", "Almuerzo", "Otra actividad..."]

PASO 4 — HÁBITO (solo si hay hábitos creados):
  OBLIGATORIO: usa pedir_aclaracion (NUNCA texto plano) con opciones:
  [nombre_habito_1, nombre_habito_2, ..., "No asociar"]
  Si el usuario ya especificó el hábito o no hay hábitos, omite este paso.

PASO 5 — CREAR:
  Con toda la información, llama a crear_evento con dateIds (array de fechas).
  Si el usuario dijo "otra actividad", pide el nombre con pedir_aclaracion de texto libre.

REGLAS IMPORTANTES:
- Haz UN paso a la vez, no preguntes todo junto
- Si el usuario ya dio toda la info en un mensaje, crea directamente sin preguntar

════════════════════════════════════════

ÁREAS Y SUS SUB-ACTIVIDADES:
${catsStr}

HÁBITOS DEL USUARIO:
${habitosStr}

EVENTOS (próximos 14 días):
${eventosStr}

HOY (fecha local del usuario): ${hoy}

DÍAS DE ESTA SEMANA (usa SIEMPRE estas fechas exactas, no calcules):
${diasSemanaStr}

REGLA CRÍTICA DE FECHAS: Cuando el usuario diga "el lunes", "el martes", etc.,
busca la fecha en el mapa de arriba. NO calcules fechas tú mismo.
"Mañana" = día siguiente a HOY en el mapa.
Para semanas futuras, suma 7 días a la fecha del mapa.`
}

// ─── Gemini request builder ───────────────────────────────────────────────────

function buildGeminiContents(history: ChatMessage[], message: string) {
  return [
    ...history.map(msg => ({
      role: msg.role === 'agent' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]
}

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  contextData: Record<string, unknown>,
): Promise<string> {

  // ── Aclaración / confirmación (manejadas por el cliente, no el server)
  if (name === 'pedir_aclaracion') {
    return `__CLARIFICATION__:${JSON.stringify({ pregunta: args.pregunta, opciones: args.opciones })}`
  }
  if (name === 'confirmar_accion') {
    return `__CONFIRM__:${args.descripcion}`
  }

  // ── Módulo TIEMPO ─────────────────────────────────────────────────────────

  if (name === 'crear_evento') {
    const dates = (args.dateIds as string[]) ?? []
    if (dates.length === 0) throw new Error('crear_evento: se requiere al menos una fecha en dateIds')
    const rows = dates.map(dateId => {
      const row: Record<string, unknown> = {
        id: crypto.randomUUID(), user_id: userId,
        date_id:     dateId,
        start_hour:  args.startHour,
        end_hour:    args.endHour,
        category_id: args.categoryId,
        task:        args.taskName,
        completed:   false,
      }
      if (args.habitId) row['habit_id'] = args.habitId
      return row
    })
    const { error } = await supabase.from('events').insert(rows)
    if (error) throw new Error(`crear_evento: ${error.message}`)
    const habitNote = args.habitId ? ' (asociado a hábito)' : ''
    if (dates.length === 1) {
      return `Evento "${args.taskName}" creado el ${dates[0]} de ${args.startHour} a ${args.endHour}${habitNote}.`
    }
    return `Evento "${args.taskName}" creado en ${dates.length} días (${dates.join(', ')}) de ${args.startHour} a ${args.endHour}${habitNote}.`
  }

  if (name === 'editar_evento') {
    const updates: Record<string, unknown> = {}
    if (args.startHour)  updates['start_hour']  = args.startHour
    if (args.endHour)    updates['end_hour']     = args.endHour
    if (args.categoryId) updates['category_id']  = args.categoryId
    if (args.taskName)   updates['task']         = args.taskName
    const { error } = await supabase.from('events').update(updates).eq('id', args.eventId)
    if (error) throw new Error(`editar_evento: ${error.message}`)
    return `Evento actualizado correctamente.`
  }

  if (name === 'eliminar_evento') {
    const { error } = await supabase.from('events').delete().eq('id', args.eventId)
    if (error) throw new Error(`eliminar_evento: ${error.message}`)
    return `Evento eliminado de la agenda.`
  }

  if (name === 'completar_evento') {
    const updates: Record<string, unknown> = { completed: args.completed }
    if (args.energy != null) updates['energy'] = args.energy
    if (args.impact != null) updates['impact'] = args.impact
    const { error } = await supabase.from('events').update(updates).eq('id', args.eventId)
    if (error) throw new Error(`completar_evento: ${error.message}`)
    return args.completed
      ? `Evento marcado como completado${args.energy ? ` (energía: ${args.energy}/5, impacto: ${args.impact}/5)` : ''}.`
      : `Evento desmarcado.`
  }

  if (name === 'duplicar_evento') {
    const { data: src, error: fetchErr } = await supabase.from('events').select('*').eq('id', args.eventId).single()
    if (fetchErr || !src) throw new Error(`duplicar_evento: evento no encontrado`)
    const targets = args.targetDateIds as string[]
    const inserts = targets.map(dateId => ({
      id: crypto.randomUUID(), user_id: userId,
      date_id: dateId, start_hour: src.start_hour, end_hour: src.end_hour,
      category_id: src.category_id, task: src.task, completed: false,
    }))
    const { error } = await supabase.from('events').insert(inserts)
    if (error) throw new Error(`duplicar_evento: ${error.message}`)
    return `Evento duplicado a ${targets.length} día(s): ${targets.join(', ')}.`
  }

  if (name === 'consultar_agenda') {
    const date = (args.dateId as string | undefined) ?? todayStr()
    const eventos = (contextData.eventos as Record<string, unknown[]>) ?? {}
    const evs = eventos[date] as Array<{startHour:string;endHour:string;task:string;completed:boolean}> | undefined
    if (!evs || evs.length === 0) return `No hay eventos agendados para el ${date}.`
    const lista = evs.map(e => `• ${e.startHour}–${e.endHour}: ${e.task} ${e.completed ? '✓' : '○'}`).join('\n')
    return `Agenda del ${date}:\n${lista}`
  }

  if (name === 'consultar_disponibilidad') {
    const date = args.dateId as string
    const eventos = (contextData.eventos as Record<string, Array<{startHour:string;endHour:string}>> ) ?? {}
    const evs = eventos[date] ?? []
    const occupiedSlots = new Set(evs.flatMap(e => {
      const slots: string[] = []
      const [sh, sm] = e.startHour.split(':').map(Number)
      const [eh, em] = e.endHour.split(':').map(Number)
      let mins = sh * 60 + sm
      const endMins = eh * 60 + em
      while (mins < endMins) {
        const h = String(Math.floor(mins/60)).padStart(2,'0')
        const m = String(mins%60).padStart(2,'0')
        slots.push(`${h}:${m}`)
        mins += 15
      }
      return slots
    }))
    const free: string[] = []
    for (let h = 6; h < 22; h++) {
      for (const m of ['00','15','30','45']) {
        const slot = `${String(h).padStart(2,'0')}:${m}`
        if (!occupiedSlots.has(slot)) free.push(slot)
      }
    }
    if (free.length === 0) return `El ${date} está completamente ocupado.`
    const blocks: string[] = []
    let blockStart = free[0]
    for (let i = 1; i <= free.length; i++) {
      const prev = free[i-1]
      const curr = free[i]
      const prevMins = parseInt(prev.split(':')[0])*60 + parseInt(prev.split(':')[1])
      const currMins = curr ? parseInt(curr.split(':')[0])*60 + parseInt(curr.split(':')[1]) : -1
      if (currMins - prevMins > 15) { blocks.push(`${blockStart}–${prev}`); blockStart = curr }
    }
    return `Huecos libres el ${date}:\n${blocks.slice(0,8).map(b => `• ${b}`).join('\n')}`
  }

  if (name === 'crear_area') {
    const id = crypto.randomUUID()
    const { error } = await supabase.from('categories').insert({
      id, user_id: userId,
      label:   args.label,
      short:   (args.short as string).toUpperCase().slice(0,5),
      color:   args.color,
      presets: [],
    })
    if (error) throw new Error(`crear_area: ${error.message}`)
    return `Área "${args.label}" (${(args.short as string).toUpperCase()}) creada con éxito.`
  }

  if (name === 'editar_area') {
    const updates: Record<string, unknown> = {}
    if (args.label) updates['label'] = args.label
    if (args.short) updates['short'] = (args.short as string).toUpperCase().slice(0,5)
    if (args.color) updates['color'] = args.color
    const { error } = await supabase.from('categories').update(updates).eq('id', args.areaId)
    if (error) throw new Error(`editar_area: ${error.message}`)
    return `Área actualizada correctamente.`
  }

  if (name === 'eliminar_area') {
    const { error } = await supabase.from('categories').delete().eq('id', args.areaId)
    if (error) throw new Error(`eliminar_area: ${error.message}`)
    return `Área eliminada.`
  }

  return `Herramienta "${name}" no reconocida.`
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // 2. Parse request
    const { message, history = [], moduleActive = 'hoy', context = {} } = await req.json()
    if (!message?.trim()) {
      return new Response(JSON.stringify({ type: 'error', text: 'Mensaje vacío.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Build prompt & request
    const userName = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'Usuario'
    // Construir nowStr desde la fecha LOCAL del usuario (no UTC del servidor)
    const fechaLocal = (context as Record<string, unknown>).fechaLocal as string | undefined
    const [y, m, d] = (fechaLocal ?? todayStr()).split('-').map(Number)
    const localDate = new Date(y, m - 1, d)
    const nowStr = localDate.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const systemPrompt = buildSystemPrompt(userName, moduleActive, nowStr, context)
    const contents = buildGeminiContents(history, message)

    // 4. Call Gemini
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: TOOLS,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    })

    if (!geminiRes.ok) throw new Error(`Gemini error ${geminiRes.status}: ${await geminiRes.text()}`)
    const geminiData = await geminiRes.json()

    const candidates = geminiData.candidates as Array<Record<string, unknown>>
    if (!candidates?.length) throw new Error('Sin respuesta del modelo. Intenta de nuevo.')

    const finishReason = candidates[0].finishReason as string
    const parts = (candidates[0].content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>

    if (!parts?.length) {
      if (finishReason === 'SAFETY')     throw new Error('Respuesta filtrada. Intenta reformular el mensaje.')
      if (finishReason === 'MAX_TOKENS') throw new Error('El contexto es demasiado largo. Intenta un mensaje más corto.')
      // Respuesta vacía transiente — pedir al usuario que reintente
      return new Response(
        JSON.stringify({ type: 'text', text: '🔄 No recibí respuesta completa. ¿Puedes repetir lo que querías hacer?' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const part = parts[0]

    // 5. Handle function call
    if (part.functionCall) {
      const fc = part.functionCall as { name: string; args: Record<string, unknown> }

      // Execute tool
      const toolResult = await executeTool(fc.name, fc.args, supabase, user.id, context)

      // Special cases: clarification & confirmation
      if (toolResult.startsWith('__CLARIFICATION__:')) {
        const payload = JSON.parse(toolResult.replace('__CLARIFICATION__:', ''))
        return new Response(JSON.stringify({ type: 'clarification', text: payload.pregunta, chips: payload.opciones }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (toolResult.startsWith('__CONFIRM__:')) {
        const desc = toolResult.replace('__CONFIRM__:', '')
        return new Response(JSON.stringify({ type: 'clarification', text: `¿Confirmas esta acción?\n${desc}`, chips: ['Sí, confirmar', 'No, cancelar'] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Send tool result back to Gemini for natural language response
      const followUpRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...contents,
            { role: 'model', parts: [{ functionCall: { name: fc.name, args: fc.args } }] },
            { role: 'user', parts: [{ functionResponse: { name: fc.name, response: { result: toolResult } } }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
      })

      if (!followUpRes.ok) {
        // Gemini failed on follow-up, return tool result directly
        return new Response(JSON.stringify({ type: 'text', text: `✅ ${toolResult}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const followUpData = await followUpRes.json()
      const finalText = (followUpData.candidates?.[0]?.content?.parts?.[0] as Record<string,unknown>)?.text as string ?? `✅ ${toolResult}`
      return new Response(JSON.stringify({ type: 'text', text: finalText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 6. Text response
    if (part.text) {
      return new Response(JSON.stringify({ type: 'text', text: part.text as string }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Respuesta inesperada del modelo.')

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('ai-agent error:', msg)
    return new Response(JSON.stringify({ type: 'error', text: `⚠️ ${msg}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
