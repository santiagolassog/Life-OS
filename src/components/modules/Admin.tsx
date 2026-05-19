import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, LayoutGrid, GraduationCap, Plus, Edit2, Trash2,
  Check, X, ChevronDown, ChevronRight, ChevronUp, Shield, UserCheck, UserX,
  BookOpen, Video, ToggleLeft, ToggleRight, Search, Crown, Star,
  RefreshCw, Eye, EyeOff, ExternalLink, ArrowUpDown, Link,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  Company, CompanyMember, CompanyModule, UserProfile,
  AcademyCourse, AcademyModule, AcademyLesson, CompanyCourseAccess, ExclusiveVideo,
  CompanyPlan, ModuleKey, CompanyMemberRole,
} from '../../types'
import { generateId } from '../../lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<CompanyPlan, string> = {
  basic: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_COLORS: Record<CompanyPlan, string> = {
  basic: 'bg-slate-100 text-slate-600',
  pro: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

const ALL_MODULES: { key: ModuleKey; label: string; icon: string }[] = [
  { key: 'tiempo',    label: 'Agenda',    icon: '🕐' },
  { key: 'dinero',    label: 'Dinero',    icon: '💰' },
  { key: 'lista',     label: 'Tareas',    icon: '✅' },
  { key: 'objetivos', label: 'Objetivos', icon: '🎯' },
  { key: 'habitos',   label: 'Hábitos',   icon: '🔥' },
  { key: 'revision',  label: 'Revisión',  icon: '📊' },
  { key: 'academia',  label: 'Academia',  icon: '🎓' },
]

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

// ── Sub-components ────────────────────────────────────────────────────────────

type TabKey = 'companies' | 'users' | 'modules' | 'academia'

const TabButton = ({
  active, icon: Icon, label, onClick,
}: {
  active: boolean; icon: React.FC<{ size?: number; className?: string }>; label: string; onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
      active
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
    }`}
  >
    <Icon size={16} />
    <span className="hidden sm:inline">{label}</span>
  </button>
)

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState<TabKey>('companies')
  const [loading, setLoading] = useState(false)

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [companies, setCompanies]   = useState<Company[]>([])
  const [users, setUsers]           = useState<UserProfile[]>([])
  const [members, setMembers]       = useState<CompanyMember[]>([])
  const [modules, setModules]       = useState<CompanyModule[]>([])
  const [courses, setCourses]                   = useState<AcademyCourse[]>([])
  const [academyModules, setAcademyModules]     = useState<AcademyModule[]>([])
  const [lessons, setLessons]                   = useState<AcademyLesson[]>([])
  const [courseAccess, setCourseAccess]         = useState<CompanyCourseAccess[]>([])
  const [exclusiveVideos, setExclusiveVideos]   = useState<ExclusiveVideo[]>([])

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: comp },
        { data: prof },
        { data: memb },
        { data: mods },
        { data: cors },
        amodsResult,
        { data: less },
        { data: access },
        { data: excl },
      ] = await Promise.all([
        supabase.from('companies').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('company_members').select('*'),
        supabase.from('company_modules').select('*'),
        supabase.from('academy_courses').select('*').order('sort_order'),
        supabase.from('academy_modules').select('*').order('sort_order'),
        supabase.from('academy_lessons').select('*').order('sort_order'),
        supabase.from('company_course_access').select('*'),
        supabase.from('company_exclusive_videos').select('*').order('sort_order'),
      ])

      setCompanies((comp ?? []).map(rowToCompany))
      setUsers((prof ?? []).map(rowToUserProfile))
      setMembers((memb ?? []).map(rowToMember))
      setModules((mods ?? []).map(rowToModule))
      setCourses((cors ?? []).map(rowToCourse))
      setAcademyModules(((amodsResult?.data) ?? []).map(rowToAcademyModule))
      setLessons((less ?? []).map(rowToLesson))
      setCourseAccess((access ?? []).map((r: any): CompanyCourseAccess => ({ id: r.id, companyId: r.company_id, courseId: r.course_id, grantedAt: r.granted_at })))
      setExclusiveVideos((excl ?? []).map((r: any): ExclusiveVideo => ({ id: r.id, companyId: r.company_id, title: r.title, youtubeUrl: r.youtube_url, description: r.description, durationMinutes: r.duration_minutes, sortOrder: r.sort_order, published: r.published, createdAt: r.created_at })))
    } catch (e) {
      console.error('Admin fetchAll error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Row mappers ───────────────────────────────────────────────────────────────
  const rowToCompany = (r: any): Company => ({
    id: r.id, name: r.name, slug: r.slug, description: r.description,
    logoUrl: r.logo_url, plan: r.plan, active: r.active,
    createdAt: r.created_at, updatedAt: r.updated_at,
  })
  const rowToUserProfile = (r: any): UserProfile => ({
    id: r.id, displayName: r.display_name ?? '', email: r.email ?? '',
    role: r.role, createdAt: r.created_at,
  })
  const rowToMember = (r: any): CompanyMember => ({
    id: r.id, companyId: r.company_id, userId: r.user_id,
    role: r.role, joinedAt: r.joined_at,
  })
  const rowToModule = (r: any): CompanyModule => ({
    id: r.id, companyId: r.company_id, moduleKey: r.module_key, enabled: r.enabled,
  })
  const rowToCourse = (r: any): AcademyCourse => ({
    id: r.id, companyId: r.company_id, title: r.title, description: r.description,
    thumbnailUrl: r.thumbnail_url, sortOrder: r.sort_order, published: r.published,
    createdAt: r.created_at, updatedAt: r.updated_at,
  })
  const rowToAcademyModule = (r: any): AcademyModule => ({
    id: r.id, courseId: r.course_id, title: r.title, description: r.description,
    sortOrder: r.sort_order, createdAt: r.created_at,
  })
  const rowToLesson = (r: any): AcademyLesson => ({
    id: r.id, courseId: r.course_id, moduleId: r.module_id ?? undefined,
    title: r.title, youtubeUrl: r.youtube_url,
    description: r.description, durationMinutes: r.duration_minutes,
    sortOrder: r.sort_order, createdAt: r.created_at,
  })

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">Panel Admin</h1>
              <p className="text-xs text-slate-400 font-medium">LifeOS Enterprise</p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <TabButton active={tab === 'companies'} icon={Building2} label="Empresas"  onClick={() => setTab('companies')} />
          <TabButton active={tab === 'users'}     icon={Users}      label="Usuarios"  onClick={() => setTab('users')} />
          <TabButton active={tab === 'modules'}   icon={LayoutGrid} label="Módulos"   onClick={() => setTab('modules')} />
          <TabButton active={tab === 'academia'}  icon={GraduationCap} label="Academia" onClick={() => setTab('academia')} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tab === 'companies' && (
          <CompaniesTab
            companies={companies}
            onRefresh={fetchAll}
            onSelect={setSelectedCompany}
            selectedId={selectedCompany}
          />
        )}
        {tab === 'users' && (
          <UsersTab
            users={users}
            companies={companies}
            members={members}
            onRefresh={fetchAll}
          />
        )}
        {tab === 'modules' && (
          <ModulesTab
            companies={companies}
            modules={modules}
            onRefresh={fetchAll}
          />
        )}
        {tab === 'academia' && (
          <AcademiaTab
            companies={companies}
            courses={courses}
            academyModules={academyModules}
            lessons={lessons}
            courseAccess={courseAccess}
            exclusiveVideos={exclusiveVideos}
            onRefresh={fetchAll}
          />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EMPRESAS
// ══════════════════════════════════════════════════════════════════════════════

function CompaniesTab({
  companies, onRefresh, onSelect, selectedId,
}: {
  companies: Company[]
  onRefresh: () => void
  onSelect: (id: string | null) => void
  selectedId: string | null
}) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Company | null>(null)
  const [saving, setSaving]     = useState(false)

  const [form, setForm] = useState({
    name: '', slug: '', description: '', plan: 'basic' as CompanyPlan, active: true,
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', slug: '', description: '', plan: 'basic', active: true })
    setShowForm(true)
  }

  const openEdit = (c: Company) => {
    setEditing(c)
    setForm({ name: c.name, slug: c.slug ?? '', description: c.description ?? '', plan: c.plan, active: c.active })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || form.name.toLowerCase().replace(/\s+/g, '-'),
      description: form.description.trim() || null,
      plan: form.plan,
      active: form.active,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('companies').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('companies').insert({ ...payload, id: generateId() })
    }
    setSaving(false)
    setShowForm(false)
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta empresa? Se borrarán todos sus datos.')) return
    await supabase.from('companies').delete().eq('id', id)
    onRefresh()
  }

  const toggleActive = async (c: Company) => {
    await supabase.from('companies').update({ active: !c.active }).eq('id', c.id)
    onRefresh()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <div className="text-2xl font-black text-slate-800">{companies.length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Total</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <div className="text-2xl font-black text-emerald-600">{companies.filter(c => c.active).length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Activas</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <div className="text-2xl font-black text-slate-400">{companies.filter(c => !c.active).length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Inactivas</div>
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={openCreate}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
      >
        <Plus size={16} /> Nueva empresa
      </button>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-800 mb-5">
              {editing ? 'Editar empresa' : 'Nueva empresa'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Ej. Acme Corp"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="acme-corp (auto si se deja vacío)"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  placeholder="Descripción de la empresa..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</label>
                <select
                  value={form.plan}
                  onChange={e => setForm(p => ({ ...p, plan: e.target.value as CompanyPlan }))}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="basic">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-semibold text-slate-700">Empresa activa</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Companies list */}
      <div className="space-y-3">
        {companies.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No hay empresas registradas</p>
            <p className="text-sm mt-1">Crea la primera empresa para comenzar</p>
          </div>
        ) : companies.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-slate-800 truncate">{c.name}</div>
                    {c.slug && <div className="text-xs text-slate-400 font-mono">/{c.slug}</div>}
                    {c.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[c.plan]}`}>
                    {PLAN_LABELS[c.plan]}
                  </span>
                  <button
                    onClick={() => toggleActive(c)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.active ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => openEdit(c)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <Edit2 size={12} /> Editar
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: USUARIOS
// ══════════════════════════════════════════════════════════════════════════════

function UsersTab({
  users, companies, members, onRefresh,
}: {
  users: UserProfile[]
  companies: Company[]
  members: CompanyMember[]
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [showAssign, setShowAssign] = useState<UserProfile | null>(null)
  const [assignCompany, setAssignCompany] = useState('')
  const [assignRole, setAssignRole] = useState<CompanyMemberRole>('member')
  const [saving, setSaving] = useState(false)

  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const getUserCompanies = (userId: string) => {
    const userMemberIds = members.filter(m => m.userId === userId).map(m => m.companyId)
    return companies.filter(c => userMemberIds.includes(c.id))
  }

  const toggleSuperAdmin = async (u: UserProfile) => {
    const newRole = u.role === 'super_admin' ? 'user' : 'super_admin'
    if (!confirm(`¿${newRole === 'super_admin' ? 'Hacer super admin' : 'Quitar super admin'} a ${u.displayName || u.email}?`)) return
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', u.id)
    onRefresh()
  }

  const removeMember = async (userId: string, companyId: string) => {
    await supabase.from('company_members').delete().eq('user_id', userId).eq('company_id', companyId)
    onRefresh()
  }

  const handleAssign = async () => {
    if (!showAssign || !assignCompany) return
    setSaving(true)
    await supabase.from('company_members').upsert({
      id: generateId(),
      user_id: showAssign.id,
      company_id: assignCompany,
      role: assignRole,
    }, { onConflict: 'company_id,user_id' })
    setSaving(false)
    setShowAssign(null)
    onRefresh()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <div className="text-2xl font-black text-slate-800">{users.length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Usuarios</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          <div className="text-2xl font-black text-amber-500">{users.filter(u => u.role === 'super_admin').length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Super Admins</div>
        </div>
      </div>

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-800 mb-1">Asociar a empresa</h2>
            <p className="text-sm text-slate-500 mb-5">{showAssign.displayName || showAssign.email}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</label>
                <select
                  value={assignCompany}
                  onChange={e => setAssignCompany(e.target.value)}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Seleccionar empresa...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rol en la empresa</label>
                <select
                  value={assignRole}
                  onChange={e => setAssignRole(e.target.value as CompanyMemberRole)}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Dueño</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssign(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleAssign}
                disabled={saving || !assignCompany}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Asociar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-3">
        {filtered.map(u => {
          const userCompanies = getUserCompanies(u.id)
          return (
            <div key={u.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-black text-slate-600 text-sm shrink-0">
                    {(u.displayName || u.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 truncate">{u.displayName || '—'}</span>
                      {u.role === 'super_admin' && (
                        <Crown size={13} className="text-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setShowAssign(u); setAssignCompany(''); setAssignRole('member') }}
                    className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                    title="Asociar a empresa"
                  >
                    <Building2 size={14} />
                  </button>
                  <button
                    onClick={() => toggleSuperAdmin(u)}
                    className={`p-2 rounded-lg transition-colors ${
                      u.role === 'super_admin'
                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title={u.role === 'super_admin' ? 'Quitar super admin' : 'Hacer super admin'}
                  >
                    <Shield size={14} />
                  </button>
                </div>
              </div>

              {/* Companies of this user */}
              {userCompanies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {userCompanies.map(c => {
                    const mem = members.find(m => m.userId === u.id && m.companyId === c.id)
                    return (
                      <div key={c.id} className="flex items-center gap-1.5 bg-indigo-50 rounded-lg px-2.5 py-1">
                        <span className="text-xs font-bold text-indigo-700">{c.name}</span>
                        <span className="text-[10px] text-indigo-400">{mem?.role}</span>
                        <button
                          onClick={() => removeMember(u.id, c.id)}
                          className="ml-1 text-indigo-300 hover:text-red-400 transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MÓDULOS
// ══════════════════════════════════════════════════════════════════════════════

function ModulesTab({
  companies, modules, onRefresh,
}: {
  companies: Company[]
  modules: CompanyModule[]
  onRefresh: () => void
}) {
  const [selected, setSelected] = useState<string>(companies[0]?.id ?? '')

  useEffect(() => {
    if (!selected && companies.length) setSelected(companies[0].id)
  }, [companies, selected])

  const getModuleEnabled = (companyId: string, key: ModuleKey) => {
    const mod = modules.find(m => m.companyId === companyId && m.moduleKey === key)
    // Si no existe registro, está habilitado por defecto
    return mod?.enabled ?? true
  }

  const toggleModule = async (companyId: string, key: ModuleKey) => {
    const current = getModuleEnabled(companyId, key)
    const existing = modules.find(m => m.companyId === companyId && m.moduleKey === key)
    if (existing) {
      await supabase.from('company_modules').update({ enabled: !current }).eq('id', existing.id)
    } else {
      await supabase.from('company_modules').insert({
        id: generateId(), company_id: companyId, module_key: key, enabled: !current,
      })
    }
    onRefresh()
  }

  const toggleAll = async (companyId: string, enable: boolean) => {
    const ops = ALL_MODULES.map(m => {
      const existing = modules.find(x => x.companyId === companyId && x.moduleKey === m.key)
      if (existing) {
        return supabase.from('company_modules').update({ enabled: enable }).eq('id', existing.id)
      } else {
        return supabase.from('company_modules').insert({
          id: generateId(), company_id: companyId, module_key: m.key, enabled: enable,
        })
      }
    })
    await Promise.all(ops)
    onRefresh()
  }

  const selectedCompany = companies.find(c => c.id === selected)

  return (
    <div className="p-4 space-y-4">
      {companies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <LayoutGrid size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No hay empresas</p>
          <p className="text-sm mt-1">Crea una empresa primero</p>
        </div>
      ) : (
        <>
          {/* Company selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              {/* Quick actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAll(selected, true)}
                  className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors"
                >
                  Habilitar todos
                </button>
                <button
                  onClick={() => toggleAll(selected, false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Deshabilitar todos
                </button>
              </div>

              {/* Modules list */}
              <div className="space-y-2">
                {ALL_MODULES.map(m => {
                  const enabled = getModuleEnabled(selected, m.key)
                  return (
                    <div
                      key={m.key}
                      className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{m.icon}</span>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{m.label}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{m.key}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleModule(selected, m.key)}
                        className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                          enabled ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ACADEMIA
// ══════════════════════════════════════════════════════════════════════════════

// ── Modal genérico reutilizable ────────────────────────────────────────────────
function Modal({ title, onClose, onSave, saving, disabled, children }: {
  title: string; onClose: () => void; onSave: () => void
  saving: boolean; disabled: boolean; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-lg font-black text-slate-800 mb-5">{title}</h2>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={onSave} disabled={saving || disabled} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"

function AcademiaTab({
  companies, courses, academyModules, lessons, courseAccess, exclusiveVideos, onRefresh,
}: {
  companies: Company[]
  courses: AcademyCourse[]
  academyModules: AcademyModule[]
  lessons: AcademyLesson[]
  courseAccess: CompanyCourseAccess[]
  exclusiveVideos: ExclusiveVideo[]
  onRefresh: () => void
}) {
  // Sub-tabs: 'cursos' | 'acceso' | 'exclusivo'
  const [academiaTab, setAcademiaTab] = useState<'cursos' | 'acceso' | 'exclusivo'>('cursos')
  const [selectedCompany, setSelectedCompany] = useState(companies[0]?.id ?? '')
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // ── Forms ─────────────────────────────────────────────────────────────────────
  type FormType = 'course' | 'module' | 'lesson' | null
  const [formType, setFormType]       = useState<FormType>(null)
  const [formContext, setFormContext]  = useState<{ courseId?: string; moduleId?: string }>({})
  const [editingItem, setEditingItem] = useState<AcademyCourse | AcademyModule | AcademyLesson | null>(null)

  const [courseForm, setCourseForm] = useState({ title: '', description: '', published: true })
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' })
  const [lessonForm, setLessonForm] = useState({ title: '', youtubeUrl: '', description: '', durationMinutes: '' })

  useEffect(() => {
    if (!selectedCompany && companies.length) setSelectedCompany(companies[0].id)
  }, [companies, selectedCompany])

  const toggleCourse  = (id: string) => setExpandedCourses(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleModule  = (id: string) => setExpandedModules(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Open forms ────────────────────────────────────────────────────────────────
  const openCourseForm = (editing?: AcademyCourse) => {
    setEditingItem(editing ?? null)
    setCourseForm({ title: editing?.title ?? '', description: editing?.description ?? '', published: editing?.published ?? true })
    setFormType('course')
  }
  const openModuleForm = (courseId: string, editing?: AcademyModule) => {
    setEditingItem(editing ?? null)
    setFormContext({ courseId })
    setModuleForm({ title: editing?.title ?? '', description: editing?.description ?? '' })
    setFormType('module')
  }
  const openLessonForm = (courseId: string, moduleId: string, editing?: AcademyLesson) => {
    setEditingItem(editing ?? null)
    setFormContext({ courseId, moduleId })
    setLessonForm({ title: editing?.title ?? '', youtubeUrl: editing?.youtubeUrl ?? '', description: editing?.description ?? '', durationMinutes: editing?.durationMinutes?.toString() ?? '' })
    setFormType('lesson')
  }
  const closeForm = () => { setFormType(null); setEditingItem(null); setFormContext({}) }

  // ── Save handlers ─────────────────────────────────────────────────────────────
  const saveCourse = async () => {
    if (!courseForm.title.trim()) return
    setSaving(true)
    const companyCourses = courses.filter(c => c.companyId === selectedCompany)
    const payload = {
      title: courseForm.title.trim(), description: courseForm.description.trim() || null,
      published: courseForm.published, company_id: selectedCompany,
      sort_order: (editingItem as AcademyCourse)?.sortOrder ?? companyCourses.length,
      updated_at: new Date().toISOString(),
    }
    if (editingItem) await supabase.from('academy_courses').update(payload).eq('id', editingItem.id)
    else await supabase.from('academy_courses').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }

  const saveModule = async () => {
    if (!moduleForm.title.trim() || !formContext.courseId) return
    setSaving(true)
    const courseMods = academyModules.filter(m => m.courseId === formContext.courseId)
    const payload = {
      title: moduleForm.title.trim(), description: moduleForm.description.trim() || null,
      course_id: formContext.courseId,
      sort_order: (editingItem as AcademyModule)?.sortOrder ?? courseMods.length,
    }
    if (editingItem) await supabase.from('academy_modules').update(payload).eq('id', editingItem.id)
    else {
      const newId = generateId()
      await supabase.from('academy_modules').insert({ ...payload, id: newId })
      setExpandedModules(s => new Set([...s, newId]))
    }
    setSaving(false); closeForm(); onRefresh()
  }

  const saveLesson = async () => {
    if (!lessonForm.title.trim() || !lessonForm.youtubeUrl.trim() || !formContext.moduleId) return
    setSaving(true)
    const modLessons = lessons.filter(l => l.moduleId === formContext.moduleId)
    const payload = {
      title: lessonForm.title.trim(), youtube_url: lessonForm.youtubeUrl.trim(),
      description: lessonForm.description.trim() || null,
      duration_minutes: lessonForm.durationMinutes ? parseInt(lessonForm.durationMinutes) : null,
      course_id: formContext.courseId, module_id: formContext.moduleId,
      sort_order: (editingItem as AcademyLesson)?.sortOrder ?? modLessons.length,
    }
    if (editingItem) await supabase.from('academy_lessons').update(payload).eq('id', editingItem.id)
    else await supabase.from('academy_lessons').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }

  const deleteCourse = async (id: string) => {
    if (!confirm('¿Eliminar este curso? Se borrarán todos sus módulos y lecciones.')) return
    await supabase.from('academy_courses').delete().eq('id', id); onRefresh()
  }
  const deleteModule = async (id: string) => {
    if (!confirm('¿Eliminar este módulo? Se borrarán todas sus lecciones.')) return
    await supabase.from('academy_modules').delete().eq('id', id); onRefresh()
  }
  const deleteLesson = async (id: string) => {
    if (!confirm('¿Eliminar esta lección?')) return
    await supabase.from('academy_lessons').delete().eq('id', id); onRefresh()
  }

  // ── Reordenamiento ───────────────────────────────────────────────────────────
  const moveModule = async (mods: AcademyModule[], idx: number, dir: -1 | 1) => {
    const target = mods[idx + dir]
    if (!target) return
    const current = mods[idx]
    await Promise.all([
      supabase.from('academy_modules').update({ sort_order: target.sortOrder }).eq('id', current.id),
      supabase.from('academy_modules').update({ sort_order: current.sortOrder }).eq('id', target.id),
    ])
    onRefresh()
  }

  const moveLesson = async (lessList: AcademyLesson[], idx: number, dir: -1 | 1) => {
    const target = lessList[idx + dir]
    if (!target) return
    const current = lessList[idx]
    await Promise.all([
      supabase.from('academy_lessons').update({ sort_order: target.sortOrder }).eq('id', current.id),
      supabase.from('academy_lessons').update({ sort_order: current.sortOrder }).eq('id', target.id),
    ])
    onRefresh()
  }

  // ── Asignar lección existente a módulo ───────────────────────────────────────
  const assignLesson = async (lessonId: string, moduleId: string) => {
    await supabase.from('academy_lessons').update({ module_id: moduleId }).eq('id', lessonId)
    onRefresh()
  }

  // ── Acceso empresa-curso ─────────────────────────────────────────────────────
  const hasAccess = (companyId: string, courseId: string) =>
    courseAccess.some(a => a.companyId === companyId && a.courseId === courseId)

  const toggleAccess = async (companyId: string, courseId: string) => {
    const existing = courseAccess.find(a => a.companyId === companyId && a.courseId === courseId)
    if (existing) {
      await supabase.from('company_course_access').delete().eq('id', existing.id)
    } else {
      await supabase.from('company_course_access').insert({ id: generateId(), company_id: companyId, course_id: courseId })
    }
    onRefresh()
  }

  const grantAll = async (companyId: string) => {
    const ops = courses
      .filter(c => !hasAccess(companyId, c.id))
      .map(c => supabase.from('company_course_access').insert({ id: generateId(), company_id: companyId, course_id: c.id }))
    await Promise.all(ops); onRefresh()
  }

  const revokeAll = async (companyId: string) => {
    await supabase.from('company_course_access').delete().eq('company_id', companyId); onRefresh()
  }

  // ── Videos exclusivos ────────────────────────────────────────────────────────
  const [showVideoForm, setShowVideoForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState<ExclusiveVideo | null>(null)
  const [videoForm, setVideoForm] = useState({ title: '', youtubeUrl: '', description: '', durationMinutes: '', published: true })

  const openVideoForm = (v?: ExclusiveVideo) => {
    setEditingVideo(v ?? null)
    setVideoForm({ title: v?.title ?? '', youtubeUrl: v?.youtubeUrl ?? '', description: v?.description ?? '', durationMinutes: v?.durationMinutes?.toString() ?? '', published: v?.published ?? true })
    setShowVideoForm(true)
  }

  const saveVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.youtubeUrl.trim()) return
    setSaving(true)
    const companyVideos = exclusiveVideos.filter(v => v.companyId === selectedCompany)
    const payload = {
      title: videoForm.title.trim(), youtube_url: videoForm.youtubeUrl.trim(),
      description: videoForm.description.trim() || null,
      duration_minutes: videoForm.durationMinutes ? parseInt(videoForm.durationMinutes) : null,
      published: videoForm.published, company_id: selectedCompany,
      sort_order: editingVideo?.sortOrder ?? companyVideos.length,
    }
    if (editingVideo) await supabase.from('company_exclusive_videos').update(payload).eq('id', editingVideo.id)
    else await supabase.from('company_exclusive_videos').insert({ ...payload, id: generateId() })
    setSaving(false); setShowVideoForm(false); setEditingVideo(null); onRefresh()
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('¿Eliminar este video exclusivo?')) return
    await supabase.from('company_exclusive_videos').delete().eq('id', id); onRefresh()
  }

  const moveVideo = async (vids: ExclusiveVideo[], idx: number, dir: -1 | 1) => {
    const target = vids[idx + dir]; if (!target) return
    const current = vids[idx]
    await Promise.all([
      supabase.from('company_exclusive_videos').update({ sort_order: target.sortOrder }).eq('id', current.id),
      supabase.from('company_exclusive_videos').update({ sort_order: current.sortOrder }).eq('id', target.id),
    ]); onRefresh()
  }

  // ── Datos derivados ───────────────────────────────────────────────────────────
  const companyCourses = courses.filter(c => c.companyId === selectedCompany)

  const companyVideos = exclusiveVideos.filter(v => v.companyId === selectedCompany)

  return (
    <div className="flex flex-col h-full">

      {/* Sub-tabs de Academia */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex gap-1">
          {([
            { key: 'cursos',   label: '📚 Cursos',   desc: 'Gestionar catálogo global' },
            { key: 'acceso',   label: '🔑 Acceso',   desc: 'Asignar cursos a empresas' },
            { key: 'exclusivo',label: '⭐ Exclusivo', desc: 'Contenido privado por empresa' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setAcademiaTab(t.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                academiaTab === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-4">

      {/* ── Modals ── */}
      {/* Video exclusivo form */}
      {showVideoForm && (
        <Modal title={editingVideo ? 'Editar video' : 'Nuevo video exclusivo'} onClose={() => { setShowVideoForm(false); setEditingVideo(null) }} onSave={saveVideo} saving={saving} disabled={!videoForm.title.trim() || !videoForm.youtubeUrl.trim()}>
          <FormField label="Título *">
            <input autoFocus value={videoForm.title} onChange={e => setVideoForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Sesión especial de liderazgo" />
          </FormField>
          <FormField label="URL de YouTube *">
            <input value={videoForm.youtubeUrl} onChange={e => setVideoForm(p => ({ ...p, youtubeUrl: e.target.value }))} className={inputCls} placeholder="https://youtu.be/..." />
            {videoForm.youtubeUrl && extractYoutubeId(videoForm.youtubeUrl) && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ ID: {extractYoutubeId(videoForm.youtubeUrl)}</p>
            )}
          </FormField>
          <FormField label="Descripción">
            <textarea value={videoForm.description} onChange={e => setVideoForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción del video..." />
          </FormField>
          <FormField label="Duración (minutos)">
            <input type="number" value={videoForm.durationMinutes} onChange={e => setVideoForm(p => ({ ...p, durationMinutes: e.target.value }))} className={inputCls} placeholder="Ej. 15" />
          </FormField>
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <div onClick={() => setVideoForm(p => ({ ...p, published: !p.published }))} className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${videoForm.published ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${videoForm.published ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-semibold text-slate-700">Publicado</span>
          </label>
        </Modal>
      )}

      {formType === 'course' && (
        <Modal title={editingItem ? 'Editar curso' : 'Nuevo curso'} onClose={closeForm} onSave={saveCourse} saving={saving} disabled={!courseForm.title.trim()}>
          <FormField label="Título *">
            <input autoFocus value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Liderazgo Efectivo" />
          </FormField>
          <FormField label="Descripción">
            <textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="¿De qué trata este curso?" />
          </FormField>
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <div onClick={() => setCourseForm(p => ({ ...p, published: !p.published }))} className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${courseForm.published ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${courseForm.published ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-semibold text-slate-700">Publicado</span>
          </label>
        </Modal>
      )}

      {formType === 'module' && (
        <Modal title={editingItem ? 'Editar módulo' : 'Nuevo módulo'} onClose={closeForm} onSave={saveModule} saving={saving} disabled={!moduleForm.title.trim()}>
          <FormField label="Título del módulo *">
            <input autoFocus value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Módulo 1: Fundamentos" />
          </FormField>
          <FormField label="Descripción">
            <textarea value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción del módulo..." />
          </FormField>
        </Modal>
      )}

      {formType === 'lesson' && (
        <Modal title={editingItem ? 'Editar lección' : 'Nueva lección'} onClose={closeForm} onSave={saveLesson} saving={saving} disabled={!lessonForm.title.trim() || !lessonForm.youtubeUrl.trim()}>
          <FormField label="Título *">
            <input autoFocus value={lessonForm.title} onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Introducción al liderazgo" />
          </FormField>
          <FormField label="URL de YouTube *">
            <input value={lessonForm.youtubeUrl} onChange={e => setLessonForm(p => ({ ...p, youtubeUrl: e.target.value }))} className={inputCls} placeholder="https://youtu.be/..." />
            {lessonForm.youtubeUrl && extractYoutubeId(lessonForm.youtubeUrl) && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1.5">✓ Video detectado: {extractYoutubeId(lessonForm.youtubeUrl)}</p>
            )}
          </FormField>
          <FormField label="Descripción">
            <textarea value={lessonForm.description} onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción de la lección..." />
          </FormField>
          <FormField label="Duración (minutos)">
            <input type="number" value={lessonForm.durationMinutes} onChange={e => setLessonForm(p => ({ ...p, durationMinutes: e.target.value }))} className={inputCls} placeholder="Ej. 12" />
          </FormField>
        </Modal>
      )}

      {/* ── SUB-TAB: CURSOS (global) ── */}
      {academiaTab === 'cursos' && (
        <>

          {/* Nuevo curso */}
          <button onClick={() => openCourseForm()} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Nuevo curso
          </button>

          {/* ── Lista de cursos ── */}
          {companyCourses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Sin cursos</p>
              <p className="text-sm mt-1">Crea el primer curso para esta empresa</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companyCourses.map(course => {
                const courseModules = academyModules.filter(m => m.courseId === course.id)
                const totalLessons  = lessons.filter(l => l.courseId === course.id).length
                const isCourseOpen  = expandedCourses.has(course.id)

                return (
                  <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

                    {/* ── NIVEL 1: Curso ── */}
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button onClick={() => toggleCourse(course.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                          <BookOpen size={14} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-800 text-sm truncate">{course.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {courseModules.length} módulo{courseModules.length !== 1 ? 's' : ''} · {totalLessons} lección{totalLessons !== 1 ? 'es' : ''}
                            {!course.published && <span className="ml-2 text-amber-500">· Borrador</span>}
                          </div>
                        </div>
                        <ChevronRight size={15} className={`text-slate-400 shrink-0 transition-transform ${isCourseOpen ? 'rotate-90' : ''}`} />
                      </button>
                      <button onClick={() => openCourseForm(course)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 shrink-0"><Edit2 size={13} /></button>
                      <button onClick={() => deleteCourse(course.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={13} /></button>
                    </div>

                    {/* ── NIVEL 2: Módulos ── */}
                    {isCourseOpen && (() => {
                      const unassigned = lessons.filter(l => l.courseId === course.id && !l.moduleId)
                      return (
                        <div className="border-t border-slate-100">
                          {courseModules.length === 0 && (
                            <p className="text-xs text-slate-400 px-12 py-3">Sin módulos todavía — crea uno para organizar las lecciones</p>
                          )}

                          {courseModules.map((mod, modIdx) => {
                            const modLessons = lessons.filter(l => l.moduleId === mod.id)
                            const isModOpen  = expandedModules.has(mod.id)

                            return (
                              <div key={mod.id} className="border-b border-slate-50 last:border-0">
                                {/* Módulo row */}
                                <div className="flex items-center gap-1 pl-10 pr-3 py-2.5 bg-slate-50/70">
                                  <button onClick={() => toggleModule(mod.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                      <ChevronRight size={12} className={`text-indigo-500 transition-transform ${isModOpen ? 'rotate-90' : ''}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-slate-700 text-xs truncate">{mod.title}</div>
                                      <div className="text-[10px] text-slate-400">{modLessons.length} lección{modLessons.length !== 1 ? 'es' : ''}</div>
                                    </div>
                                  </button>
                                  {/* Reordenar módulo */}
                                  <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveModule(courseModules, modIdx, -1)} disabled={modIdx === 0} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronUp size={11} /></button>
                                    <button onClick={() => moveModule(courseModules, modIdx, 1)} disabled={modIdx === courseModules.length - 1} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronDown size={11} /></button>
                                  </div>
                                  <button onClick={() => openModuleForm(course.id, mod)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400"><Edit2 size={11} /></button>
                                  <button onClick={() => deleteModule(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                                </div>

                                {/* ── NIVEL 3: Lecciones ── */}
                                {isModOpen && (
                                  <div className="pl-16 pr-3 py-2 space-y-1.5 bg-white">
                                    {modLessons.map((lesson, lessonIdx) => {
                                      const ytId = extractYoutubeId(lesson.youtubeUrl)
                                      return (
                                        <div key={lesson.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
                                          {ytId ? (
                                            <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0" />
                                          ) : (
                                            <div className="w-12 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                              <Video size={12} className="text-slate-400" />
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="text-[11px] font-bold text-slate-700 truncate">{lessonIdx + 1}. {lesson.title}</div>
                                            {lesson.durationMinutes && <div className="text-[10px] text-slate-400">{lesson.durationMinutes} min</div>}
                                          </div>
                                          <div className="flex items-center gap-0.5 shrink-0">
                                            {/* Reordenar lección */}
                                            <div className="flex flex-col gap-0.5">
                                              <button onClick={() => moveLesson(modLessons, lessonIdx, -1)} disabled={lessonIdx === 0} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronUp size={10} /></button>
                                              <button onClick={() => moveLesson(modLessons, lessonIdx, 1)} disabled={lessonIdx === modLessons.length - 1} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronDown size={10} /></button>
                                            </div>
                                            <button onClick={() => openLessonForm(course.id, mod.id, lesson)} className="p-1 rounded hover:bg-indigo-50 text-indigo-400"><Edit2 size={11} /></button>
                                            <button onClick={() => deleteLesson(lesson.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                                            {ytId && <a href={lesson.youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-100 text-slate-400"><ExternalLink size={11} /></a>}
                                          </div>
                                        </div>
                                      )
                                    })}
                                    <button
                                      onClick={() => openLessonForm(course.id, mod.id)}
                                      className="w-full flex items-center gap-2 py-2 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[11px] font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors justify-center"
                                    >
                                      <Plus size={11} /> Nueva lección
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {/* ── Lecciones sin módulo ── */}
                          {unassigned.length > 0 && (
                            <div className="border-t-2 border-dashed border-amber-200 bg-amber-50/50">
                              <div className="flex items-center gap-2 px-10 py-2">
                                <Link size={12} className="text-amber-500 shrink-0" />
                                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">
                                  {unassigned.length} lección{unassigned.length !== 1 ? 'es' : ''} sin módulo
                                </span>
                              </div>
                              {unassigned.map(lesson => {
                                const ytId = extractYoutubeId(lesson.youtubeUrl)
                                return (
                                  <div key={lesson.id} className="flex items-center gap-2.5 pl-12 pr-3 py-2 border-t border-amber-100">
                                    {ytId ? (
                                      <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="" className="w-10 h-7 rounded-lg object-cover shrink-0" />
                                    ) : (
                                      <div className="w-10 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                        <Video size={11} className="text-amber-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[11px] font-bold text-slate-700 truncate">{lesson.title}</div>
                                    </div>
                                    {/* Selector de módulo */}
                                    {courseModules.length > 0 ? (
                                      <select
                                        defaultValue=""
                                        onChange={e => { if (e.target.value) assignLesson(lesson.id, e.target.value) }}
                                        className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shrink-0"
                                      >
                                        <option value="" disabled>Asignar módulo…</option>
                                        {courseModules.map(m => (
                                          <option key={m.id} value={m.id}>{m.title}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-[10px] text-amber-500 shrink-0">Crea un módulo primero</span>
                                    )}
                                    <button onClick={() => deleteLesson(lesson.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={11} /></button>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Agregar módulo */}
                          <button
                            onClick={() => openModuleForm(course.id)}
                            className="w-full flex items-center gap-2 px-10 py-2.5 text-indigo-500 text-xs font-bold hover:bg-indigo-50 transition-colors border-t border-slate-100"
                          >
                            <Plus size={12} /> Agregar módulo
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── SUB-TAB: ACCESO empresa-curso ── */}
      {academiaTab === 'acceso' && (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <GraduationCap size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No hay empresas</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No hay cursos</p>
              <p className="text-sm mt-1">Crea cursos en la pestaña "Cursos" primero</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</label>
                <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={`${inputCls} mt-1`}>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => grantAll(selectedCompany)} className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors">Dar acceso a todos</button>
                <button onClick={() => revokeAll(selectedCompany)} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">Quitar todo acceso</button>
              </div>
              <div className="space-y-2">
                {courses.map(course => {
                  const granted = hasAccess(selectedCompany, course.id)
                  const mods = academyModules.filter(m => m.courseId === course.id)
                  const lecs = lessons.filter(l => l.courseId === course.id)
                  return (
                    <div key={course.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${granted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 text-sm">{course.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{mods.length} módulo{mods.length !== 1 ? 's' : ''} · {lecs.length} lección{lecs.length !== 1 ? 'es' : ''}</div>
                      </div>
                      <button onClick={() => toggleAccess(selectedCompany, course.id)}
                        className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${granted ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${granted ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SUB-TAB: EXCLUSIVO por empresa ── */}
      {academiaTab === 'exclusivo' && (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <GraduationCap size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No hay empresas</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</label>
                <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={`${inputCls} mt-1`}>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button onClick={() => openVideoForm()} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">
                <Plus size={16} /> Nuevo video exclusivo
              </button>
              {companyVideos.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Video size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">Sin contenido exclusivo</p>
                  <p className="text-xs mt-1">Agrega videos exclusivos para esta empresa</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {companyVideos.map((vid, idx) => {
                    const ytId = extractYoutubeId(vid.youtubeUrl)
                    return (
                      <div key={vid.id} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-3">
                        {ytId ? (
                          <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="" className="w-14 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-14 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Video size={14} className="text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-800 text-sm truncate">{vid.title}</div>
                          <div className="text-[10px] text-slate-400">{vid.durationMinutes ? `${vid.durationMinutes} min · ` : ''}{!vid.published ? 'Borrador' : 'Publicado'}</div>
                        </div>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveVideo(companyVideos, idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronUp size={11} /></button>
                          <button onClick={() => moveVideo(companyVideos, idx, 1)} disabled={idx === companyVideos.length - 1} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronDown size={11} /></button>
                        </div>
                        <button onClick={() => openVideoForm(vid)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 shrink-0"><Edit2 size={13} /></button>
                        <button onClick={() => deleteVideo(vid.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
    </div>
    </div>
  )
}
