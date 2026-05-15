import React, { useState, useRef, useEffect } from 'react'
import {
  X, Send, Bot, Sparkles, Loader2,
  CalendarDays, CheckSquare, Target, DollarSign, BarChart3, Home,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  chips?: string[]
  type?: 'text' | 'clarification' | 'error'
}

type SectionKey = 'hoy' | 'tiempo' | 'dinero' | 'objetivos' | 'lista' | 'revision'

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  moduleActive: SectionKey
  userName: string
  context?: Record<string, unknown>
}

// ─── Quick suggestions by module ─────────────────────────────────────────────

const MODULE_SUGGESTIONS: Record<SectionKey, string[]> = {
  hoy:       ['¿Cómo voy esta semana?', 'Agéndame algo para hoy', '¿Qué tengo pendiente?'],
  tiempo:    ['Agenda una reunión mañana de 3 a 4pm', '¿Tengo algo esta tarde?', 'Terminé el bloque de las 9am'],
  lista:     ['Crea una tarea urgente', '¿Qué tengo en progreso?', 'Terminé la tarea de...'],
  objetivos: ['Crea un objetivo para esta semana', '¿Cómo voy con mis objetivos?', 'Logré el objetivo de...'],
  dinero:    ['Gasté 20.000 en comida', '¿Cuánto gasté esta semana?', 'Registra un ingreso'],
  revision:  ['¿Cómo estuvo mi semana?', '¿Cuál es mi actividad más eficiente?', 'Compara esta semana con la anterior'],
}

const MODULE_ICONS: Record<SectionKey, React.FC<{ size?: number; className?: string }>> = {
  hoy:       Home,
  tiempo:    CalendarDays,
  lista:     CheckSquare,
  objetivos: Target,
  dinero:    DollarSign,
  revision:  BarChart3,
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ─── Component ────────────────────────────────────────────────────────────────

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen, onClose, moduleActive, userName, context = {},
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const ModuleIcon = MODULE_ICONS[moduleActive]

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, type: 'text' }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      // Build history for context (last 10 messages)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const { data, error } = await supabase.functions.invoke('ai-agent', {
        body: { message: text, history, moduleActive, context },
      })

      if (error) throw error

      const agentMsg: ChatMessage = {
        id: uid(),
        role: 'agent',
        content: data.text,
        type: data.type,
        chips: data.chips,
      }
      setMessages(prev => [...prev, agentMsg])

    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: uid(), role: 'agent', type: 'error',
          content: 'No pude procesar tu mensaje. Intenta de nuevo.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleChip = (chip: string) => sendMessage(chip)

  const handleSuggestion = (s: string) => sendMessage(s)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[450] bg-slate-900/40 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed z-[460] flex flex-col bg-white shadow-2xl transition-all duration-300 ease-in-out
          bottom-0 left-0 right-0 rounded-t-3xl md:rounded-none
          md:top-0 md:right-0 md:left-auto md:bottom-0 md:w-[380px]
          ${isOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
        `}
        style={{ maxHeight: isOpen ? '85svh' : '0', height: isOpen ? '85svh' : '0',
          ...(typeof window !== 'undefined' && window.innerWidth >= 768
            ? { maxHeight: '100%', height: '100%' }
            : {})
        }}
      >
        {/* Header */}
        <div className="bg-indigo-950 px-5 py-4 flex items-center gap-3 shrink-0 rounded-t-3xl md:rounded-none">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-black leading-none">Agente LifeOS</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ModuleIcon size={10} className="text-indigo-400" />
              <p className="text-indigo-400 text-[10px] font-bold capitalize">{moduleActive}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all text-indigo-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-50">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 flex items-center justify-center">
                <Sparkles size={28} className="text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="text-slate-700 font-black text-sm">Hola, {userName} 👋</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-[220px] mx-auto">
                  Dime qué quieres hacer y lo gestiono por ti
                </p>
              </div>
              {/* Quick suggestions */}
              <div className="flex flex-col gap-2 w-full">
                {MODULE_SUGGESTIONS[moduleActive].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s)}
                    className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-[0.98]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages list */}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-2`}>
                {/* Bubble */}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm font-medium'
                    : msg.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm font-medium'
                    : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-bl-sm font-medium'
                }`}>
                  {msg.content}
                </div>

                {/* Chips for clarification */}
                {msg.chips && msg.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.chips.map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => handleChip(chip)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-black rounded-full hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
        >
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Escríbeme algo..."
              className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-800 font-medium placeholder:text-slate-400 outline-none focus:bg-slate-50 focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shrink-0"
            >
              {isLoading
                ? <Loader2 size={16} className="text-white animate-spin" />
                : <Send size={15} className="text-white" />
              }
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default ChatPanel
