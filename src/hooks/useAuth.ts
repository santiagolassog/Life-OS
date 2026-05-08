import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  /** Nombre preferido guardado en user_metadata */
  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? ''

  /** Actualiza el nombre preferido en Supabase Auth */
  const updateDisplayName = async (name: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: name.trim() },
    })
    if (data.user) setUser(data.user)
    return error?.message ?? null
  }

  const signOut = () => supabase.auth.signOut()

  return { user, authLoading, signOut, displayName, updateDisplayName }
}
