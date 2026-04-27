import React, { useState } from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, UserPlus, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'

type AuthMode = 'signin' | 'signup'

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccessMsg('¡Cuenta creada! Revisa tu correo para confirmar tu cuenta.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(translateError(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-4">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
            <Zap size={28} className="text-white" fill="white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tight leading-none">
              LifeOS
            </h1>
            <p className="text-indigo-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-1">
              Tu sistema de vida
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-2xl">

          {/* Tabs */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-6 border border-white/5">
            <button
              onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                mode === 'signin'
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                  : 'text-indigo-400 hover:text-white'
              }`}
            >
              <LogIn size={13} />
              Iniciar sesión
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                mode === 'signup'
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                  : 'text-indigo-400 hover:text-white'
              }`}
            >
              <UserPlus size={13} />
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] block">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-indigo-600 outline-none focus:border-indigo-500 focus:bg-white/8 transition-all font-medium"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] block">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-indigo-600 outline-none focus:border-indigo-500 focus:bg-white/8 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-[11px] font-bold animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            {/* Éxito */}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-[11px] font-bold animate-in fade-in slide-in-from-top-1">
                {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Entrar a LifeOS' : 'Crear mi cuenta'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-indigo-600 text-[10px] font-bold uppercase tracking-widest mt-6">
          Tu información es privada y segura
        </p>
      </div>
    </div>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))       return 'Confirma tu correo antes de iniciar sesión.'
  if (msg.includes('User already registered'))  return 'Ya existe una cuenta con ese correo.'
  if (msg.includes('Password should be'))       return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('Unable to validate'))       return 'Correo electrónico inválido.'
  if (msg.includes('rate limit'))               return 'Demasiados intentos. Espera unos minutos.'
  return msg
}

export default AuthPage
