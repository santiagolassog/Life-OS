import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

export function useAuth() {
  const [user, setUser]           = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [userRole, setUserRole]   = useState<UserRole>('user')
  const [roleLoading, setRoleLoading] = useState(false)

  /** Carga el rol desde user_profiles */
  const loadRole = async (uid: string) => {
    setRoleLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', uid)
      .single()
    if (data?.role) setUserRole(data.role as UserRole)
    setRoleLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadRole(session.user.id)
      else setAuthLoading(false)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadRole(session.user.id)
      else setUserRole('user')
    })

    return () => subscription.unsubscribe()
  }, [])

  /** true si el usuario es super_admin */
  const isSuperAdmin = userRole === 'super_admin'

  /** Nombre preferido guardado en user_metadata */
  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? ''

  /** Actualiza el nombre preferido en Supabase Auth + user_profiles */
  const updateDisplayName = async (name: string): Promise<string | null> => {
    const trimmed = name.trim()
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    })
    if (data.user) {
      setUser(data.user)
      // Sync display_name to user_profiles too
      await supabase
        .from('user_profiles')
        .update({ display_name: trimmed })
        .eq('id', data.user.id)
    }
    return error?.message ?? null
  }

  const signOut = () => supabase.auth.signOut()

  return { user, authLoading, roleLoading, signOut, displayName, updateDisplayName, userRole, isSuperAdmin }
}
