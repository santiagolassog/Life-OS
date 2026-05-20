import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, LayoutGrid, GraduationCap, Plus, Edit2, Trash2,
  Check, X, ChevronDown, ChevronRight, ChevronUp, Shield, UserCheck, UserX,
  BookOpen, Video, FileText, ToggleLeft, ToggleRight, Search, Crown, Star,
  RefreshCw, Eye, EyeOff, ExternalLink, ArrowUpDown, Link,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  Company, CompanyMember, CompanyModule, UserProfile,
  AcademyCourse, AcademyModule, AcademyLesson, CompanyCourseAccess,
  ExclusiveContent, ExclusiveModule, ExclusiveLesson,
  CompanyPlan, ModuleKey, CompanyMemberRole, LessonType,
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

function formatAdminDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

function extractYoutubeId(url: string | undefined | null): string | null {
  if (!url) return null
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
  const [courseAccess, setCourseAccess]             = useState<CompanyCourseAccess[]>([])
  const [exclusiveContents, setExclusiveContents]   = useState<ExclusiveContent[]>([])
  const [exclusiveMods, setExclusiveMods]           = useState<ExclusiveModule[]>([])
  const [exclusiveLessons, setExclusiveLessons]     = useState<ExclusiveLesson[]>([])

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
        { data: exContents },
        { data: exMods },
        { data: exLess },
      ] = await Promise.all([
        supabase.from('companies').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('company_members').select('*'),
        supabase.from('company_modules').select('*'),
        supabase.from('academy_courses').select('*').order('sort_order'),
        supabase.from('academy_modules').select('*').order('sort_order'),
        supabase.from('academy_lessons').select('*').order('sort_order'),
        supabase.from('company_course_access').select('*'),
        supabase.from('exclusive_content').select('*').order('sort_order'),
        supabase.from('exclusive_modules').select('*').order('sort_order'),
        supabase.from('exclusive_lessons').select('*').order('sort_order'),
      ])

      setCompanies((comp ?? []).map(rowToCompany))
      setUsers((prof ?? []).map(rowToUserProfile))
      setMembers((memb ?? []).map(rowToMember))
      setModules((mods ?? []).map(rowToModule))
      setCourses((cors ?? []).map(rowToCourse))
      setAcademyModules(((amodsResult?.data) ?? []).map(rowToAcademyModule))
      setLessons((less ?? []).map(rowToLesson))
      setCourseAccess((access ?? []).map((r: any): CompanyCourseAccess => ({ id: r.id, companyId: r.company_id, courseId: r.course_id, grantedAt: r.granted_at })))
      setExclusiveContents((exContents ?? []).map((r: any): ExclusiveContent => ({ id: r.id, companyId: r.company_id, title: r.title, description: r.description, sortOrder: r.sort_order, published: r.published, createdAt: r.created_at })))
      setExclusiveMods((exMods ?? []).map((r: any): ExclusiveModule => ({ id: r.id, contentId: r.content_id, title: r.title, description: r.description, sortOrder: r.sort_order, createdAt: r.created_at })))
      setExclusiveLessons((exLess ?? []).map((r: any): ExclusiveLesson => ({ id: r.id, contentId: r.content_id, moduleId: r.module_id ?? undefined, lessonType: (r.lesson_type ?? 'video') as LessonType, title: r.title, youtubeUrl: r.youtube_url ?? undefined, documentUrl: r.document_url ?? undefined, description: r.description, durationMinutes: r.duration_minutes, sortOrder: r.sort_order, createdAt: r.created_at })))
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
    lessonType: (r.lesson_type ?? 'video') as 'video' | 'document',
    title: r.title, youtubeUrl: r.youtube_url ?? undefined,
    documentUrl: r.document_url ?? undefined,
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
            exclusiveContents={exclusiveContents}
            exclusiveMods={exclusiveMods}
            exclusiveLessons={exclusiveLessons}
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
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: 'min(92svh, 680px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-black text-slate-800">{editing ? 'Editar empresa' : 'Nueva empresa'}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre *</label>
                <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej. Acme Corp" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Slug (URL)</label>
                <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="acme-corp (auto si se deja vacío)" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" placeholder="Descripción de la empresa..." />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</label>
                <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value as CompanyPlan }))} className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                  <option value="basic">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(p => ({ ...p, active: !p.active }))} className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-semibold text-slate-700">Empresa activa</span>
              </label>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all">
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
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAssign(null)}>
          <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: 'min(92svh, 560px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-800">Asociar a empresa</h2>
                <p className="text-sm text-slate-400 mt-0.5">{showAssign.displayName || showAssign.email}</p>
              </div>
              <button onClick={() => setShowAssign(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
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
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={() => setShowAssign(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">Cancelar</button>
              <button onClick={handleAssign} disabled={saving || !assignCompany} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all">
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
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(92svh, 680px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-black text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
          {children}
        </div>

        {/* Botones fijos al fondo */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || disabled}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all"
          >
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
  companies, courses, academyModules, lessons, courseAccess,
  exclusiveContents, exclusiveMods, exclusiveLessons, onRefresh,
}: {
  companies: Company[]
  courses: AcademyCourse[]
  academyModules: AcademyModule[]
  lessons: AcademyLesson[]
  courseAccess: CompanyCourseAccess[]
  exclusiveContents: ExclusiveContent[]
  exclusiveMods: ExclusiveModule[]
  exclusiveLessons: ExclusiveLesson[]
  onRefresh: () => void
}) {
  const [academiaTab, setAcademiaTab] = useState<'cursos' | 'acceso' | 'exclusivo'>('cursos')
  const [selectedCompany, setSelectedCompany] = useState(companies[0]?.id ?? '')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!selectedCompany && companies.length) setSelectedCompany(companies[0].id)
  }, [companies, selectedCompany])

  const toggleItem = (id: string) => setExpandedItems(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Form state ────────────────────────────────────────────────────────────────
  type FormType = 'course' | 'courseLesson' |  // cursos globales
                  'module' | 'lesson' |          // cursos globales módulos/lecciones
                  'excContent' | 'excModule' | 'excLesson' | null  // exclusivo

  const [formType, setFormType]       = useState<FormType>(null)
  const [formContext, setFormContext]  = useState<{ courseId?: string; moduleId?: string; contentId?: string; excModuleId?: string }>({})
  const [editingItem, setEditingItem] = useState<any>(null)
  const [courseForm, setCourseForm]   = useState({ title: '', description: '', published: true })
  const [moduleForm, setModuleForm]   = useState({ title: '', description: '' })
  const [lessonForm, setLessonForm]   = useState({ title: '', lessonType: 'video' as LessonType, youtubeUrl: '', documentUrl: '', description: '', durationMinutes: '' })
  const [excContentForm, setExcContentForm] = useState({ title: '', description: '', published: true })

  const closeForm = () => { setFormType(null); setEditingItem(null); setFormContext({}) }

  // ── Lesson form shared opener ─────────────────────────────────────────────────
  const openLessonForm = (type: 'lesson' | 'courseLesson' | 'excLesson', ctx: typeof formContext, editing?: AcademyLesson | ExclusiveLesson) => {
    setEditingItem(editing ?? null)
    setFormContext(ctx)
    setLessonForm({ title: editing?.title ?? '', lessonType: editing?.lessonType ?? 'video', youtubeUrl: editing?.youtubeUrl ?? '', documentUrl: editing?.documentUrl ?? '', description: editing?.description ?? '', durationMinutes: editing?.durationMinutes?.toString() ?? '' })
    setFormType(type)
  }

  // ── CURSOS GLOBALES handlers ──────────────────────────────────────────────────
  const saveCourse = async () => {
    if (!courseForm.title.trim()) return; setSaving(true)
    const payload = { title: courseForm.title.trim(), description: courseForm.description.trim() || null, published: courseForm.published, sort_order: editingItem?.sortOrder ?? courses.length, updated_at: new Date().toISOString() }
    if (editingItem) await supabase.from('academy_courses').update(payload).eq('id', editingItem.id)
    else await supabase.from('academy_courses').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }
  const deleteCourse = async (id: string) => {
    if (!confirm('¿Eliminar este curso? Se borrarán todos sus módulos y lecciones.')) return
    await supabase.from('academy_courses').delete().eq('id', id); onRefresh()
  }
  const saveModule = async () => {
    if (!moduleForm.title.trim() || !formContext.courseId) return; setSaving(true)
    const mods = academyModules.filter(m => m.courseId === formContext.courseId)
    const payload = { title: moduleForm.title.trim(), description: moduleForm.description.trim() || null, course_id: formContext.courseId, sort_order: editingItem?.sortOrder ?? mods.length }
    if (editingItem) await supabase.from('academy_modules').update(payload).eq('id', editingItem.id)
    else await supabase.from('academy_modules').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }
  const deleteModule = async (id: string) => {
    if (!confirm('¿Eliminar este módulo?')) return
    await supabase.from('academy_modules').delete().eq('id', id); onRefresh()
  }
  const saveLesson = async () => {
    const isVideo = lessonForm.lessonType === 'video'; const isDoc = !isVideo
    if (!lessonForm.title.trim() || (isVideo && !lessonForm.youtubeUrl.trim()) || (isDoc && !lessonForm.documentUrl.trim())) return
    setSaving(true)
    const payload = { title: lessonForm.title.trim(), lesson_type: lessonForm.lessonType, youtube_url: isVideo ? lessonForm.youtubeUrl.trim() : null, document_url: isDoc ? lessonForm.documentUrl.trim() : null, description: lessonForm.description.trim() || null, duration_minutes: lessonForm.durationMinutes ? parseInt(lessonForm.durationMinutes) : null, course_id: formContext.courseId, module_id: formContext.moduleId ?? null, sort_order: editingItem?.sortOrder ?? lessons.filter(l => l.moduleId === (formContext.moduleId ?? undefined) && l.courseId === formContext.courseId).length }
    if (editingItem) await supabase.from('academy_lessons').update(payload).eq('id', editingItem.id)
    else await supabase.from('academy_lessons').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }
  const deleteLesson = async (id: string) => {
    if (!confirm('¿Eliminar esta lección?')) return
    await supabase.from('academy_lessons').delete().eq('id', id); onRefresh()
  }
  const moveModule = async (mods: AcademyModule[], idx: number, dir: -1 | 1) => {
    const t = mods[idx + dir]; if (!t) return; const c = mods[idx]
    await Promise.all([supabase.from('academy_modules').update({ sort_order: t.sortOrder }).eq('id', c.id), supabase.from('academy_modules').update({ sort_order: c.sortOrder }).eq('id', t.id)]); onRefresh()
  }
  const moveLesson = async (list: AcademyLesson[], idx: number, dir: -1 | 1) => {
    const t = list[idx + dir]; if (!t) return; const c = list[idx]
    await Promise.all([supabase.from('academy_lessons').update({ sort_order: t.sortOrder }).eq('id', c.id), supabase.from('academy_lessons').update({ sort_order: c.sortOrder }).eq('id', t.id)]); onRefresh()
  }
  const assignLesson = async (lessonId: string, moduleId: string) => {
    await supabase.from('academy_lessons').update({ module_id: moduleId }).eq('id', lessonId); onRefresh()
  }

  // ── ACCESO handlers ───────────────────────────────────────────────────────────
  const hasAccess = (cid: string, courseId: string) => courseAccess.some(a => a.companyId === cid && a.courseId === courseId)
  const toggleAccess = async (cid: string, courseId: string) => {
    const ex = courseAccess.find(a => a.companyId === cid && a.courseId === courseId)
    if (ex) await supabase.from('company_course_access').delete().eq('id', ex.id)
    else await supabase.from('company_course_access').insert({ id: generateId(), company_id: cid, course_id: courseId })
    onRefresh()
  }
  const grantAll = async (cid: string) => {
    await Promise.all(courses.filter(c => !hasAccess(cid, c.id)).map(c => supabase.from('company_course_access').insert({ id: generateId(), company_id: cid, course_id: c.id }))); onRefresh()
  }
  const revokeAll = async (cid: string) => {
    await supabase.from('company_course_access').delete().eq('company_id', cid); onRefresh()
  }

  // ── EXCLUSIVO handlers ────────────────────────────────────────────────────────
  const saveExcContent = async () => {
    if (!excContentForm.title.trim()) return; setSaving(true)
    const payload = { title: excContentForm.title.trim(), description: excContentForm.description.trim() || null, published: excContentForm.published, company_id: selectedCompany, sort_order: editingItem?.sortOrder ?? exclusiveContents.filter(c => c.companyId === selectedCompany).length }
    if (editingItem) await supabase.from('exclusive_content').update(payload).eq('id', editingItem.id)
    else await supabase.from('exclusive_content').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }
  const deleteExcContent = async (id: string) => {
    if (!confirm('¿Eliminar este material exclusivo? Se borrarán todos sus módulos y lecciones.')) return
    await supabase.from('exclusive_content').delete().eq('id', id); onRefresh()
  }
  const saveExcModule = async () => {
    if (!moduleForm.title.trim() || !formContext.contentId) return; setSaving(true)
    const mods = exclusiveMods.filter(m => m.contentId === formContext.contentId)
    const payload = { title: moduleForm.title.trim(), description: moduleForm.description.trim() || null, content_id: formContext.contentId, sort_order: editingItem?.sortOrder ?? mods.length }
    if (editingItem) await supabase.from('exclusive_modules').update(payload).eq('id', editingItem.id)
    else await supabase.from('exclusive_modules').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }
  const deleteExcModule = async (id: string) => {
    if (!confirm('¿Eliminar este módulo?')) return
    await supabase.from('exclusive_modules').delete().eq('id', id); onRefresh()
  }
  const saveExcLesson = async () => {
    const isVideo = lessonForm.lessonType === 'video'; const isDoc = !isVideo
    if (!lessonForm.title.trim() || (isVideo && !lessonForm.youtubeUrl.trim()) || (isDoc && !lessonForm.documentUrl.trim())) return
    setSaving(true)
    const payload = { title: lessonForm.title.trim(), lesson_type: lessonForm.lessonType, youtube_url: isVideo ? lessonForm.youtubeUrl.trim() : null, document_url: isDoc ? lessonForm.documentUrl.trim() : null, description: lessonForm.description.trim() || null, duration_minutes: lessonForm.durationMinutes ? parseInt(lessonForm.durationMinutes) : null, content_id: formContext.contentId, module_id: formContext.excModuleId ?? null, sort_order: editingItem?.sortOrder ?? exclusiveLessons.filter(l => l.moduleId === (formContext.excModuleId ?? undefined) && l.contentId === formContext.contentId).length }
    if (editingItem) await supabase.from('exclusive_lessons').update(payload).eq('id', editingItem.id)
    else await supabase.from('exclusive_lessons').insert({ ...payload, id: generateId() })
    setSaving(false); closeForm(); onRefresh()
  }
  const deleteExcLesson = async (id: string) => {
    if (!confirm('¿Eliminar esta lección?')) return
    await supabase.from('exclusive_lessons').delete().eq('id', id); onRefresh()
  }
  const moveExcModule = async (mods: ExclusiveModule[], idx: number, dir: -1 | 1) => {
    const t = mods[idx + dir]; if (!t) return; const c = mods[idx]
    await Promise.all([supabase.from('exclusive_modules').update({ sort_order: t.sortOrder }).eq('id', c.id), supabase.from('exclusive_modules').update({ sort_order: c.sortOrder }).eq('id', t.id)]); onRefresh()
  }
  const moveExcLesson = async (list: ExclusiveLesson[], idx: number, dir: -1 | 1) => {
    const t = list[idx + dir]; if (!t) return; const c = list[idx]
    await Promise.all([supabase.from('exclusive_lessons').update({ sort_order: t.sortOrder }).eq('id', c.id), supabase.from('exclusive_lessons').update({ sort_order: c.sortOrder }).eq('id', t.id)]); onRefresh()
  }
  const assignExcLesson = async (lessonId: string, moduleId: string) => {
    await supabase.from('exclusive_lessons').update({ module_id: moduleId }).eq('id', lessonId); onRefresh()
  }

  // ── Shared lesson form modal ──────────────────────────────────────────────────
  const isLessonFormOpen = formType === 'lesson' || formType === 'courseLesson' || formType === 'excLesson'
  const lessonSaveHandler = formType === 'excLesson' ? saveExcLesson : saveLesson
  const lessonFormDisabled = !lessonForm.title.trim() || (lessonForm.lessonType === 'video' && !lessonForm.youtubeUrl.trim()) || (lessonForm.lessonType === 'document' && !lessonForm.documentUrl.trim())

  // ── Shared lesson form JSX ────────────────────────────────────────────────────
  // LessonFormModal se renderiza inline (no como componente) para evitar
  // que React lo desmonte/remonte en cada render y robe el foco de los inputs
  const lessonFormJSX = isLessonFormOpen ? (
    <Modal title={editingItem ? 'Editar lección' : 'Nueva lección'} onClose={closeForm} onSave={lessonSaveHandler} saving={saving} disabled={lessonFormDisabled}>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de lección</label>
        <div className="flex gap-2 mt-2">
          {(['video', 'document'] as const).map(type => (
            <button key={type} type="button" onClick={() => setLessonForm(p => ({ ...p, lessonType: type }))}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${lessonForm.lessonType === type ? type === 'video' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              {type === 'video' ? <Video size={15} /> : <FileText size={15} />}
              {type === 'video' ? 'Video' : 'Documento PDF'}
            </button>
          ))}
        </div>
      </div>
      <FormField label="Título *">
        <input value={lessonForm.title} onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder={lessonForm.lessonType === 'video' ? 'Ej. Introducción' : 'Ej. Guía práctica'} />
      </FormField>
      {lessonForm.lessonType === 'video' ? (
        <FormField label="URL de YouTube *">
          <input value={lessonForm.youtubeUrl} onChange={e => setLessonForm(p => ({ ...p, youtubeUrl: e.target.value }))} className={inputCls} placeholder="https://youtu.be/..." />
          {lessonForm.youtubeUrl && extractYoutubeId(lessonForm.youtubeUrl) && <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ Video detectado</p>}
        </FormField>
      ) : (
        <FormField label="Link de Google Drive *">
          <input value={lessonForm.documentUrl} onChange={e => setLessonForm(p => ({ ...p, documentUrl: e.target.value }))} className={inputCls} placeholder="https://drive.google.com/file/d/.../view" />
          {lessonForm.documentUrl.includes('drive.google.com') && <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ Link de Drive detectado — asegúrate que sea público</p>}
        </FormField>
      )}
      <FormField label="Descripción">
        <textarea value={lessonForm.description} onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción opcional..." />
      </FormField>
      {lessonForm.lessonType === 'video' && (
        <FormField label="Duración (segundos)">
          <input type="number" value={lessonForm.durationMinutes} onChange={e => setLessonForm(p => ({ ...p, durationMinutes: e.target.value }))} className={inputCls} placeholder="Ej. 275 (= 4m 35s)" />
        </FormField>
      )}
    </Modal>
  ) : null

  // ── Render de árbol de lecciones (reutilizable) ───────────────────────────────
  const renderLessonRow = (lesson: AcademyLesson | ExclusiveLesson, idx: number, list: any[], isExc: boolean, onEdit: () => void, onDel: () => void, onMoveUp: () => void, onMoveDown: () => void) => {
    const isDoc = lesson.lessonType === 'document'
    const ytId = !isDoc ? extractYoutubeId((lesson as any).youtubeUrl) : null
    return (
      <div key={lesson.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
        {isDoc ? (
          <div className="w-12 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><FileText size={13} className="text-emerald-600" /></div>
        ) : ytId ? (
          <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-12 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Video size={12} className="text-slate-400" /></div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="text-[11px] font-bold text-slate-700 truncate">{idx + 1}. {lesson.title}</div>
            {isDoc && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded shrink-0">PDF</span>}
          </div>
          {lesson.durationMinutes && <div className="text-[10px] text-slate-400">{formatAdminDuration(lesson.durationMinutes)}</div>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveUp} disabled={idx === 0} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronUp size={10} /></button>
            <button onClick={onMoveDown} disabled={idx === list.length - 1} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronDown size={10} /></button>
          </div>
          <button onClick={onEdit} className="p-1 rounded hover:bg-indigo-50 text-indigo-400"><Edit2 size={11} /></button>
          <button onClick={onDel} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
        </div>
      </div>
    )
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
  const companyExcContents = exclusiveContents.filter(c => c.companyId === selectedCompany)

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex gap-1">
          {([
            { key: 'cursos',    label: '📚 Cursos',    desc: 'Catálogo global' },
            { key: 'acceso',    label: '🔑 Acceso',    desc: 'Asignar a empresas' },
            { key: 'exclusivo', label: '⭐ Exclusivo', desc: 'Contenido privado' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setAcademiaTab(t.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${academiaTab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-4">

      {/* ── Modals compartidos ── */}
      {(formType === 'course') && (
        <Modal title={editingItem ? 'Editar curso' : 'Nuevo curso'} onClose={closeForm} onSave={saveCourse} saving={saving} disabled={!courseForm.title.trim()}>
          <FormField label="Título *"><input autoFocus value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Liderazgo Efectivo" /></FormField>
          <FormField label="Descripción"><textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="¿De qué trata?" /></FormField>
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <div onClick={() => setCourseForm(p => ({ ...p, published: !p.published }))} className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${courseForm.published ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${courseForm.published ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-semibold text-slate-700">Publicado</span>
          </label>
        </Modal>
      )}
      {(formType === 'module') && (
        <Modal title={editingItem ? 'Editar módulo' : 'Nuevo módulo'} onClose={closeForm} onSave={saveModule} saving={saving} disabled={!moduleForm.title.trim()}>
          <FormField label="Título del módulo *"><input autoFocus value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Módulo 1: Fundamentos" /></FormField>
          <FormField label="Descripción"><textarea value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción opcional..." /></FormField>
        </Modal>
      )}
      {(formType === 'excContent') && (
        <Modal title={editingItem ? 'Editar material' : 'Nuevo material exclusivo'} onClose={closeForm} onSave={saveExcContent} saving={saving} disabled={!excContentForm.title.trim()}>
          <FormField label="Nombre del material *"><input autoFocus value={excContentForm.title} onChange={e => setExcContentForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Programa Mayo 2026" /></FormField>
          <FormField label="Descripción"><textarea value={excContentForm.description} onChange={e => setExcContentForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción opcional..." /></FormField>
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <div onClick={() => setExcContentForm(p => ({ ...p, published: !p.published }))} className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${excContentForm.published ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${excContentForm.published ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-semibold text-slate-700">Publicado</span>
          </label>
        </Modal>
      )}
      {(formType === 'excModule') && (
        <Modal title={editingItem ? 'Editar módulo' : 'Nuevo módulo'} onClose={closeForm} onSave={saveExcModule} saving={saving} disabled={!moduleForm.title.trim()}>
          <FormField label="Título del módulo *"><input autoFocus value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} className={inputCls} placeholder="Ej. Módulo 1: Fundamentos" /></FormField>
          <FormField label="Descripción"><textarea value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></FormField>
        </Modal>
      )}
      {lessonFormJSX}

      {/* ══════════════════════════════════════════════
          SUB-TAB: CURSOS GLOBALES
      ══════════════════════════════════════════════ */}
      {academiaTab === 'cursos' && (
        <>
          <button onClick={() => { setEditingItem(null); setCourseForm({ title: '', description: '', published: true }); setFormType('course') }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Nuevo curso
          </button>
          {courses.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><BookOpen size={36} className="mx-auto mb-3 opacity-30" /><p className="font-semibold">Sin cursos</p></div>
          ) : (
            <div className="space-y-2">
              {courses.map(course => {
                const courseModules = academyModules.filter(m => m.courseId === course.id)
                const totalLessons  = lessons.filter(l => l.courseId === course.id).length
                const isCourseOpen  = expandedItems.has(course.id)
                const unassigned    = lessons.filter(l => l.courseId === course.id && !l.moduleId)
                return (
                  <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Curso header */}
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button onClick={() => toggleItem(course.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0"><BookOpen size={14} className="text-white" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-800 text-sm truncate">{course.title}</div>
                          <div className="text-[11px] text-slate-400">{courseModules.length} mód. · {totalLessons} lecc.{!course.published ? ' · Borrador' : ''}</div>
                        </div>
                        <ChevronRight size={15} className={`text-slate-400 shrink-0 transition-transform ${isCourseOpen ? 'rotate-90' : ''}`} />
                      </button>
                      <button onClick={() => { setEditingItem(course); setCourseForm({ title: course.title, description: course.description ?? '', published: course.published }); setFormType('course') }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 shrink-0"><Edit2 size={13} /></button>
                      <button onClick={() => deleteCourse(course.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={13} /></button>
                    </div>

                    {/* Contenido expandido */}
                    {isCourseOpen && (
                      <div className="border-t border-slate-100">
                        {courseModules.map((mod, modIdx) => {
                          const modLessons = lessons.filter(l => l.moduleId === mod.id)
                          const isModOpen  = expandedItems.has(mod.id)
                          return (
                            <div key={mod.id} className="border-b border-slate-50 last:border-0">
                              <div className="flex items-center gap-1 pl-10 pr-3 py-2.5 bg-slate-50/70">
                                <button onClick={() => toggleItem(mod.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                    <ChevronRight size={12} className={`text-indigo-500 transition-transform ${isModOpen ? 'rotate-90' : ''}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-700 text-xs truncate">{mod.title}</div>
                                    <div className="text-[10px] text-slate-400">{modLessons.length} lección{modLessons.length !== 1 ? 'es' : ''}</div>
                                  </div>
                                </button>
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button onClick={() => moveModule(courseModules, modIdx, -1)} disabled={modIdx === 0} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronUp size={11} /></button>
                                  <button onClick={() => moveModule(courseModules, modIdx, 1)} disabled={modIdx === courseModules.length - 1} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronDown size={11} /></button>
                                </div>
                                <button onClick={() => { setEditingItem(mod); setModuleForm({ title: mod.title, description: mod.description ?? '' }); setFormContext({ courseId: course.id }); setFormType('module') }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400"><Edit2 size={11} /></button>
                                <button onClick={() => deleteModule(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                              </div>
                              {isModOpen && (
                                <div className="pl-16 pr-3 py-2 space-y-1.5 bg-white">
                                  {modLessons.map((lesson, li) => renderLessonRow(lesson, li, modLessons, false,
                                    () => openLessonForm('lesson', { courseId: course.id, moduleId: mod.id }, lesson),
                                    () => deleteLesson(lesson.id),
                                    () => moveLesson(modLessons, li, -1),
                                    () => moveLesson(modLessons, li, 1)
                                  ))}
                                  <button onClick={() => openLessonForm('lesson', { courseId: course.id, moduleId: mod.id })}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[11px] font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                                    <Plus size={11} /> Nueva lección
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Lecciones sueltas sin módulo */}
                        {unassigned.length > 0 && (
                          <div className="border-t-2 border-dashed border-amber-200 bg-amber-50/50">
                            <div className="flex items-center gap-2 px-10 py-2">
                              <Link size={12} className="text-amber-500 shrink-0" />
                              <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">{unassigned.length} lección{unassigned.length !== 1 ? 'es' : ''} sin módulo</span>
                            </div>
                            {unassigned.map(lesson => {
                              const ytId = lesson.lessonType !== 'document' ? extractYoutubeId(lesson.youtubeUrl ?? '') : null
                              return (
                                <div key={lesson.id} className="flex items-center gap-2.5 pl-12 pr-3 py-2 border-t border-amber-100">
                                  {lesson.lessonType === 'document' ? (
                                    <div className="w-10 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><FileText size={11} className="text-emerald-600" /></div>
                                  ) : ytId ? (
                                    <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="" className="w-10 h-7 rounded-lg object-cover shrink-0" />
                                  ) : (
                                    <div className="w-10 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><Video size={11} className="text-amber-400" /></div>
                                  )}
                                  <div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-slate-700 truncate">{lesson.title}</div></div>
                                  {courseModules.length > 0 ? (
                                    <select defaultValue="" onChange={e => { if (e.target.value) assignLesson(lesson.id, e.target.value) }}
                                      className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer shrink-0">
                                      <option value="" disabled>Asignar módulo…</option>
                                      {courseModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                    </select>
                                  ) : <span className="text-[10px] text-amber-500 shrink-0">Sin módulos</span>}
                                  <button onClick={() => openLessonForm('lesson', { courseId: course.id }, lesson)} className="p-1 rounded hover:bg-indigo-50 text-indigo-400 shrink-0"><Edit2 size={11} /></button>
                                  <button onClick={() => deleteLesson(lesson.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={11} /></button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Acciones del curso */}
                        <div className="flex border-t border-slate-100">
                          <button onClick={() => { setEditingItem(null); setModuleForm({ title: '', description: '' }); setFormContext({ courseId: course.id }); setFormType('module') }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-indigo-500 text-xs font-bold hover:bg-indigo-50 transition-colors">
                            <Plus size={12} /> Agregar módulo
                          </button>
                          <div className="w-px bg-slate-100" />
                          <button onClick={() => openLessonForm('courseLesson', { courseId: course.id })}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors">
                            <Plus size={12} /> Lección suelta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
          SUB-TAB: ACCESO
      ══════════════════════════════════════════════ */}
      {academiaTab === 'acceso' && (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><GraduationCap size={36} className="mx-auto mb-3 opacity-30" /><p className="font-semibold">No hay empresas</p></div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><BookOpen size={36} className="mx-auto mb-3 opacity-30" /><p className="font-semibold">No hay cursos</p><p className="text-sm mt-1">Crea cursos en la pestaña "Cursos" primero</p></div>
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
                  return (
                    <div key={course.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${granted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 text-sm">{course.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{lessons.filter(l => l.courseId === course.id).length} lecciones</div>
                      </div>
                      <button onClick={() => toggleAccess(selectedCompany, course.id)}
                        className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${granted ? 'bg-emerald-500' : 'bg-slate-300'}`}>
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

      {/* ══════════════════════════════════════════════
          SUB-TAB: EXCLUSIVO
      ══════════════════════════════════════════════ */}
      {academiaTab === 'exclusivo' && (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><GraduationCap size={36} className="mx-auto mb-3 opacity-30" /><p className="font-semibold">No hay empresas</p></div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</label>
                <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={`${inputCls} mt-1`}>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button onClick={() => { setEditingItem(null); setExcContentForm({ title: '', description: '', published: true }); setFormType('excContent') }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 text-white font-bold text-sm shadow-md shadow-amber-100 hover:bg-amber-600 transition-colors">
                <Plus size={16} /> Nuevo material exclusivo
              </button>
              {companyExcContents.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Star size={32} className="mx-auto mb-3 opacity-30" /><p className="font-semibold text-sm">Sin material exclusivo</p><p className="text-xs mt-1">Crea el primer material para esta empresa</p></div>
              ) : (
                <div className="space-y-2">
                  {companyExcContents.map(content => {
                    const contentMods   = exclusiveMods.filter(m => m.contentId === content.id)
                    const totalLessons  = exclusiveLessons.filter(l => l.contentId === content.id).length
                    const isOpen        = expandedItems.has(content.id)
                    const unassigned    = exclusiveLessons.filter(l => l.contentId === content.id && !l.moduleId)
                    return (
                      <div key={content.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        {/* Material header */}
                        <div className="flex items-center gap-2 px-4 py-3">
                          <button onClick={() => toggleItem(content.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shrink-0"><Star size={14} className="text-white" /></div>
                            <div className="min-w-0 flex-1">
                              <div className="font-black text-slate-800 text-sm truncate">{content.title}</div>
                              <div className="text-[11px] text-slate-400">{contentMods.length} mód. · {totalLessons} lecc.{!content.published ? ' · Borrador' : ''}</div>
                            </div>
                            <ChevronRight size={15} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </button>
                          <button onClick={() => { setEditingItem(content); setExcContentForm({ title: content.title, description: content.description ?? '', published: content.published }); setFormType('excContent') }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 shrink-0"><Edit2 size={13} /></button>
                          <button onClick={() => deleteExcContent(content.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={13} /></button>
                        </div>

                        {/* Contenido expandido */}
                        {isOpen && (
                          <div className="border-t border-slate-100">
                            {contentMods.map((mod, modIdx) => {
                              const modLessons = exclusiveLessons.filter(l => l.moduleId === mod.id)
                              const isModOpen  = expandedItems.has(mod.id)
                              return (
                                <div key={mod.id} className="border-b border-slate-50 last:border-0">
                                  <div className="flex items-center gap-1 pl-10 pr-3 py-2.5 bg-slate-50/70">
                                    <button onClick={() => toggleItem(mod.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                      <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                        <ChevronRight size={12} className={`text-amber-600 transition-transform ${isModOpen ? 'rotate-90' : ''}`} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-700 text-xs truncate">{mod.title}</div>
                                        <div className="text-[10px] text-slate-400">{modLessons.length} lección{modLessons.length !== 1 ? 'es' : ''}</div>
                                      </div>
                                    </button>
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                      <button onClick={() => moveExcModule(contentMods, modIdx, -1)} disabled={modIdx === 0} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronUp size={11} /></button>
                                      <button onClick={() => moveExcModule(contentMods, modIdx, 1)} disabled={modIdx === contentMods.length - 1} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20"><ChevronDown size={11} /></button>
                                    </div>
                                    <button onClick={() => { setEditingItem(mod); setModuleForm({ title: mod.title, description: mod.description ?? '' }); setFormContext({ contentId: content.id }); setFormType('excModule') }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400"><Edit2 size={11} /></button>
                                    <button onClick={() => deleteExcModule(mod.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                                  </div>
                                  {isModOpen && (
                                    <div className="pl-16 pr-3 py-2 space-y-1.5 bg-white">
                                      {modLessons.map((lesson, li) => renderLessonRow(lesson, li, modLessons, true,
                                        () => openLessonForm('excLesson', { contentId: content.id, excModuleId: mod.id }, lesson),
                                        () => deleteExcLesson(lesson.id),
                                        () => moveExcLesson(modLessons, li, -1),
                                        () => moveExcLesson(modLessons, li, 1)
                                      ))}
                                      <button onClick={() => openLessonForm('excLesson', { contentId: content.id, excModuleId: mod.id })}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[11px] font-bold hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                                        <Plus size={11} /> Nueva lección
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {/* Lecciones sueltas */}
                            {unassigned.length > 0 && (
                              <div className="border-t-2 border-dashed border-amber-200 bg-amber-50/50">
                                <div className="flex items-center gap-2 px-10 py-2">
                                  <Link size={12} className="text-amber-500 shrink-0" />
                                  <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">{unassigned.length} lección{unassigned.length !== 1 ? 'es' : ''} sin módulo</span>
                                </div>
                                {unassigned.map((lesson, li) => {
                                  const ytId = lesson.lessonType !== 'document' ? extractYoutubeId(lesson.youtubeUrl ?? '') : null
                                  return (
                                    <div key={lesson.id} className="flex items-center gap-2.5 pl-12 pr-3 py-2 border-t border-amber-100">
                                      {lesson.lessonType === 'document' ? (
                                        <div className="w-10 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><FileText size={11} className="text-emerald-600" /></div>
                                      ) : ytId ? (
                                        <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="" className="w-10 h-7 rounded-lg object-cover shrink-0" />
                                      ) : (
                                        <div className="w-10 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><Video size={11} className="text-amber-400" /></div>
                                      )}
                                      <div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-slate-700 truncate">{lesson.title}</div></div>
                                      {contentMods.length > 0 ? (
                                        <select defaultValue="" onChange={e => { if (e.target.value) assignExcLesson(lesson.id, e.target.value) }}
                                          className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer shrink-0">
                                          <option value="" disabled>Asignar módulo…</option>
                                          {contentMods.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                        </select>
                                      ) : <span className="text-[10px] text-amber-500 shrink-0">Sin módulos</span>}
                                      <button onClick={() => openLessonForm('excLesson', { contentId: content.id }, lesson)} className="p-1 rounded hover:bg-indigo-50 text-indigo-400 shrink-0"><Edit2 size={11} /></button>
                                      <button onClick={() => deleteExcLesson(lesson.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={11} /></button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Acciones del material */}
                            <div className="flex border-t border-slate-100">
                              <button onClick={() => { setEditingItem(null); setModuleForm({ title: '', description: '' }); setFormContext({ contentId: content.id }); setFormType('excModule') }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-amber-600 text-xs font-bold hover:bg-amber-50 transition-colors">
                                <Plus size={12} /> Agregar módulo
                              </button>
                              <div className="w-px bg-slate-100" />
                              <button onClick={() => openLessonForm('excLesson', { contentId: content.id })}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors">
                                <Plus size={12} /> Lección suelta
                              </button>
                            </div>
                          </div>
                        )}
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
