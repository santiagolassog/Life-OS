import React, { useState, useEffect, useCallback } from 'react'
import {
  GraduationCap, BookOpen, Video, FileText, Play, CheckCircle2, Circle,
  ChevronLeft, ChevronRight, ChevronDown, Clock, BarChart3, Layers, ExternalLink,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AcademyCourse, AcademyModule, AcademyLesson, AcademyProgress, ExclusiveVideo, ExclusiveVideoProgress, LessonType } from '../../types'
import { generateId } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return match?.[1] ?? null
}

/** Convierte cualquier link de Google Drive al endpoint /preview para iframe */
function getDriveEmbedUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return null
  return `https://drive.google.com/file/d/${match[1]}/preview`
}

function formatDuration(minutes?: number): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Academia() {
  const { user } = useAuth()

  const [courses, setCourses]         = useState<AcademyCourse[]>([])
  const [modules, setModules]         = useState<AcademyModule[]>([])
  const [lessons, setLessons]         = useState<AcademyLesson[]>([])
  const [progress, setProgress]       = useState<AcademyProgress[]>([])
  const [exclusiveVideos, setExclusiveVideos] = useState<ExclusiveVideo[]>([])
  const [exclusiveProgress, setExclusiveProgress] = useState<ExclusiveVideoProgress[]>([])
  const [companyId, setCompanyId]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [selectedExclusive, setSelectedExclusive] = useState<ExclusiveVideo | null>(null)

  // Navigation
  const [selectedCourse, setSelectedCourse] = useState<AcademyCourse | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<AcademyLesson | null>(null)

  // Módulos expandidos en la vista de curso
  const [expandedMods, setExpandedMods] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: memberRows } = await supabase
        .from('company_members').select('company_id').eq('user_id', user.id)
      const companyIds = (memberRows ?? []).map((r: any) => r.company_id as string)
      if (!companyIds.length) { setLoading(false); return }
      setCompanyId(companyIds[0])

      // Cursos accesibles via company_course_access
      const { data: accessRows } = await supabase
        .from('company_course_access').select('course_id').in('company_id', companyIds)
      const accessibleCourseIds = (accessRows ?? []).map((r: any) => r.course_id as string)

      const [{ data: cors }, { data: mods }, { data: less }, { data: prog }, { data: excl }, { data: exprog }] = await Promise.all([
        accessibleCourseIds.length
          ? supabase.from('academy_courses').select('*').in('id', accessibleCourseIds).eq('published', true).order('sort_order')
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('academy_modules').select('*').order('sort_order'),
        supabase.from('academy_lessons').select('*').order('sort_order'),
        supabase.from('academy_progress').select('*').eq('user_id', user.id),
        supabase.from('company_exclusive_videos').select('*').in('company_id', companyIds).eq('published', true).order('sort_order'),
        supabase.from('exclusive_video_progress').select('*').eq('user_id', user.id),
      ])

      const mappedCourses  = (cors ?? []).map(rowToCourse)
      const courseIds      = mappedCourses.map(c => c.id)
      const mappedModules  = (mods ?? []).map(rowToModule).filter(m => courseIds.includes(m.courseId))
      const mappedLessons  = (less ?? []).map(rowToLesson).filter(l => courseIds.includes(l.courseId))
      const mappedProgress = (prog ?? []).map(rowToProgress)
      const mappedExcl     = (excl ?? []).map((r: any): ExclusiveVideo => ({ id: r.id, companyId: r.company_id, title: r.title, youtubeUrl: r.youtube_url, description: r.description, durationMinutes: r.duration_minutes, sortOrder: r.sort_order, published: r.published, createdAt: r.created_at }))
      const mappedExProg   = (exprog ?? []).map((r: any): ExclusiveVideoProgress => ({ id: r.id, userId: r.user_id, videoId: r.video_id, completed: r.completed, completedAt: r.completed_at }))

      setCourses(mappedCourses)
      setModules(mappedModules)
      setLessons(mappedLessons)
      setProgress(mappedProgress)
      setExclusiveVideos(mappedExcl)
      setExclusiveProgress(mappedExProg)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Row mappers ───────────────────────────────────────────────────────────────
  const rowToCourse  = (r: any): AcademyCourse  => ({ id: r.id, companyId: r.company_id, title: r.title, description: r.description, thumbnailUrl: r.thumbnail_url, sortOrder: r.sort_order, published: r.published, createdAt: r.created_at, updatedAt: r.updated_at })
  const rowToModule  = (r: any): AcademyModule  => ({ id: r.id, courseId: r.course_id, title: r.title, description: r.description, sortOrder: r.sort_order, createdAt: r.created_at })
  const rowToLesson  = (r: any): AcademyLesson  => ({ id: r.id, courseId: r.course_id, moduleId: r.module_id ?? undefined, lessonType: (r.lesson_type ?? 'video') as LessonType, title: r.title, youtubeUrl: r.youtube_url ?? undefined, documentUrl: r.document_url ?? undefined, description: r.description, durationMinutes: r.duration_minutes, sortOrder: r.sort_order, createdAt: r.created_at })
  const rowToProgress= (r: any): AcademyProgress=> ({ id: r.id, userId: r.user_id, lessonId: r.lesson_id, completed: r.completed, completedAt: r.completed_at })

  // ── Progress helpers ──────────────────────────────────────────────────────────
  const isCompleted = (lessonId: string) => progress.some(p => p.lessonId === lessonId && p.completed)

  const toggleComplete = async (lesson: AcademyLesson) => {
    if (!user) return
    const existing     = progress.find(p => p.lessonId === lesson.id)
    const nowCompleted = !isCompleted(lesson.id)
    if (existing) {
      await supabase.from('academy_progress').update({ completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null }).eq('id', existing.id)
      setProgress(prev => prev.map(p => p.id === existing.id ? { ...p, completed: nowCompleted, completedAt: nowCompleted ? new Date().toISOString() : undefined } : p))
    } else {
      const np: AcademyProgress = { id: generateId(), userId: user.id, lessonId: lesson.id, completed: true, completedAt: new Date().toISOString() }
      await supabase.from('academy_progress').insert({ id: np.id, user_id: np.userId, lesson_id: np.lessonId, completed: true, completed_at: np.completedAt })
      setProgress(prev => [...prev, np])
    }
  }

  // Progreso de un curso (todas sus lecciones)
  const getCourseProgress = (courseId: string) => {
    const cls = lessons.filter(l => l.courseId === courseId)
    const done = cls.filter(l => isCompleted(l.id)).length
    return { done, total: cls.length }
  }

  // Progreso de un módulo
  const getModuleProgress = (moduleId: string) => {
    const mls = lessons.filter(l => l.moduleId === moduleId)
    const done = mls.filter(l => isCompleted(l.id)).length
    return { done, total: mls.length }
  }

  // Todas las lecciones ordenadas de un curso (para navegación prev/next)
  const getOrderedLessons = (courseId: string): AcademyLesson[] => {
    const courseMods = modules.filter(m => m.courseId === courseId)
    const ordered: AcademyLesson[] = []
    for (const mod of courseMods) {
      ordered.push(...lessons.filter(l => l.moduleId === mod.id))
    }
    // Lecciones sin módulo al final
    ordered.push(...lessons.filter(l => l.courseId === courseId && !l.moduleId))
    return ordered
  }

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center">
          <GraduationCap size={40} className="mx-auto mb-3 animate-pulse opacity-50" />
          <p className="text-sm font-medium">Cargando Academia...</p>
        </div>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 rounded-3xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={36} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-black text-slate-700 mb-2">Academia</h2>
          <p className="text-slate-400 text-sm leading-relaxed">Aún no hay cursos disponibles. Contáctate con el administrador.</p>
        </div>
      </div>
    )
  }

  // ── PLAYER DE LECCIÓN ─────────────────────────────────────────────────────────
  if (selectedLesson && selectedCourse) {
    const isDoc        = selectedLesson.lessonType === 'document'
    const ytId         = !isDoc ? extractYoutubeId(selectedLesson.youtubeUrl ?? '') : null
    const driveEmbed   = isDoc ? getDriveEmbedUrl(selectedLesson.documentUrl ?? '') : null
    const orderedAll   = getOrderedLessons(selectedCourse.id)
    const currentIndex = orderedAll.findIndex(l => l.id === selectedLesson.id)
    const prevLesson   = currentIndex > 0 ? orderedAll[currentIndex - 1] : null
    const nextLesson   = currentIndex < orderedAll.length - 1 ? orderedAll[currentIndex + 1] : null
    const done         = isCompleted(selectedLesson.id)
    const courseMods   = modules.filter(m => m.courseId === selectedCourse.id)

    // Helper para renderizar lista de lecciones en el outline
    const renderOutlineLesson = (lesson: AcademyLesson, i: number) => {
      const isCurrent   = lesson.id === selectedLesson.id
      const lDone       = isCompleted(lesson.id)
      const lIsDoc      = lesson.lessonType === 'document'
      const lYtId       = !lIsDoc ? extractYoutubeId(lesson.youtubeUrl ?? '') : null
      return (
        <button key={lesson.id} onClick={() => setSelectedLesson(lesson)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${isCurrent ? 'bg-indigo-600' : 'hover:bg-slate-800/60'}`}
        >
          {lIsDoc
            ? <div className="w-12 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center shrink-0"><FileText size={13} className="text-emerald-400" /></div>
            : lYtId
              ? <img src={`https://img.youtube.com/vi/${lYtId}/default.jpg`} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0 opacity-80" />
              : <div className="w-12 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0"><Video size={12} className="text-slate-500" /></div>}
          <div className="min-w-0 flex-1">
            <div className={`text-[11px] font-bold truncate leading-tight ${isCurrent ? 'text-white' : 'text-slate-400'}`}>{i + 1}. {lesson.title}</div>
            {lIsDoc && <div className={`text-[9px] font-black uppercase ${isCurrent ? 'text-emerald-300' : 'text-emerald-500'}`}>PDF</div>}
            {!lIsDoc && lesson.durationMinutes && <div className={`text-[10px] mt-0.5 ${isCurrent ? 'text-indigo-200' : 'text-slate-600'}`}>{formatDuration(lesson.durationMinutes)}</div>}
          </div>
          {lDone ? <CheckCircle2 size={14} className={isCurrent ? 'text-indigo-200' : 'text-emerald-500'} /> : isCurrent ? (lIsDoc ? <FileText size={12} className="text-indigo-200" /> : <Play size={12} className="text-indigo-200" fill="currentColor" />) : null}
        </button>
      )
    }

    const renderOutline = () => (
      <>
        {courseMods.map(mod => {
          const modLessons = lessons.filter(l => l.moduleId === mod.id)
          const { done: mDone, total: mTotal } = getModuleProgress(mod.id)
          const hasActive = modLessons.some(l => l.id === selectedLesson.id)
          return (
            <div key={mod.id} className="border-b border-slate-800/60">
              <div className={`px-4 py-3 ${hasActive ? 'bg-indigo-900/30' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-black text-slate-300 leading-tight">{mod.title}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{mDone}/{mTotal}</span>
                </div>
                <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: mTotal > 0 ? `${Math.round((mDone/mTotal)*100)}%` : '0%' }} />
                </div>
              </div>
              {modLessons.map((l, i) => renderOutlineLesson(l, i))}
            </div>
          )
        })}
        {(() => {
          const orphans = lessons.filter(l => l.courseId === selectedCourse.id && !l.moduleId)
          if (!orphans.length) return null
          return (
            <div className="border-b border-slate-800/60">
              <div className="px-4 py-3"><span className="text-[11px] font-black text-slate-400">Otras lecciones</span></div>
              {orphans.map((l, i) => renderOutlineLesson(l, i))}
            </div>
          )
        })()}
      </>
    )

    return (
      <div className="flex flex-col lg:flex-row h-full bg-slate-900">

        {/* ── Columna principal (video + info + outline en mobile) ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto lg:overflow-hidden custom-scrollbar">

          {/* Top bar — SIEMPRE VISIBLE, pegado arriba */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-10">
            <button
              onClick={() => setSelectedLesson(null)}
              className="flex items-center gap-1.5 text-indigo-300 hover:text-white transition-colors font-bold text-sm"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
              <span className="hidden sm:inline">Volver</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white truncate">{selectedLesson.title}</div>
              <div className="text-[11px] text-slate-500 truncate">{selectedCourse.title}</div>
            </div>
            <button
              onClick={() => toggleComplete(selectedLesson)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              <span className="hidden sm:inline">{done ? 'Listo' : 'Marcar'}</span>
            </button>
          </div>

          {/* Contenido: Video O Visor PDF */}
          {isDoc ? (
            /* ── Visor de documento PDF (Google Drive embed) ── */
            <div className="flex flex-col flex-1 min-h-0 bg-slate-100">
              {driveEmbed ? (
                <iframe
                  className="w-full flex-1 border-0"
                  src={driveEmbed}
                  title={selectedLesson.title}
                  allow="autoplay"
                  style={{ minHeight: '60vh' }}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center">
                    <FileText size={28} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-bold">Link de Drive no válido</p>
                  {selectedLesson.documentUrl && (
                    <a href={selectedLesson.documentUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">
                      <ExternalLink size={14} /> Abrir en Drive
                    </a>
                  )}
                </div>
              )}
              {/* Botón fallback siempre visible */}
              {driveEmbed && selectedLesson.documentUrl && (
                <div className="bg-white border-t border-slate-200 px-4 py-2 shrink-0 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Documento PDF</span>
                  <a href={selectedLesson.documentUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                    <ExternalLink size={12} /> Abrir en Drive
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* ── Video YouTube — aspect-ratio fijo ── */
            <div className="w-full bg-black shrink-0" style={{ aspectRatio: '16/9' }}>
              {ytId ? (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                  title={selectedLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <Video size={36} />
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="bg-white shrink-0">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-800">{selectedLesson.title}</h2>
              {selectedLesson.durationMinutes && (
                <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                  <Clock size={13} /> {formatDuration(selectedLesson.durationMinutes)}
                </div>
              )}
              {selectedLesson.description && (
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{selectedLesson.description}</p>
              )}
            </div>
            {/* Prev / Next */}
            <div className="flex gap-3 p-4">
              <button onClick={() => prevLesson && setSelectedLesson(prevLesson)} disabled={!prevLesson}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button onClick={() => nextLesson && setSelectedLesson(nextLesson)} disabled={!nextLesson}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-30 transition-colors"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Outline del curso — visible en mobile DEBAJO del video, oculto en desktop */}
          <div className="lg:hidden bg-slate-950">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Contenido del curso</p>
            </div>
            {renderOutline()}
          </div>
        </div>

        {/* ── Columna derecha: outline — solo desktop ── */}
        <div className="hidden lg:flex lg:w-80 lg:shrink-0 bg-slate-950 border-l border-slate-800 flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 shrink-0">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Contenido del curso</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {renderOutline()}
          </div>
        </div>
      </div>
    )
  }

  // ── DETALLE DE CURSO (módulos + lecciones) ────────────────────────────────────
  if (selectedCourse) {
    const { done, total } = getCourseProgress(selectedCourse.id)
    const pct       = total > 0 ? Math.round((done / total) * 100) : 0
    const courseMods= modules.filter(m => m.courseId === selectedCourse.id)
    const orphans   = lessons.filter(l => l.courseId === selectedCourse.id && !l.moduleId)

    const toggleMod = (id: string) =>
      setExpandedMods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-indigo-950 px-4 pt-4 pb-6 shrink-0">
          <button onClick={() => { setSelectedCourse(null); setExpandedMods([]) }}
            className="flex items-center gap-1.5 text-indigo-300 text-sm font-bold mb-4 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> Cursos
          </button>
          <h1 className="text-xl font-black text-white mb-1">{selectedCourse.title}</h1>
          {selectedCourse.description && <p className="text-indigo-300 text-sm leading-relaxed mb-3">{selectedCourse.description}</p>}
          <div className="flex items-center justify-between text-xs text-indigo-300 mb-1.5">
            <span>{done} de {total} lecciones completadas</span>
            <span className="font-black text-white">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-indigo-500">
            <div className="flex items-center gap-1"><Layers size={12} /> {courseMods.length} módulo{courseMods.length !== 1 ? 's' : ''}</div>
            <div className="flex items-center gap-1"><Video size={12} /> {total} lección{total !== 1 ? 'es' : ''}</div>
          </div>
        </div>

        {/* Módulos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-2">
          {courseMods.length === 0 && orphans.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Video size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Sin lecciones aún</p>
            </div>
          ) : (
            <>
              {courseMods.map((mod, modIdx) => {
                const modLessons = lessons.filter(l => l.moduleId === mod.id)
                const { done: mDone, total: mTotal } = getModuleProgress(mod.id)
                const mPct   = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0
                const isOpen = expandedMods.includes(mod.id)
                const allDone = mTotal > 0 && mDone === mTotal

                return (
                  <div
                    key={mod.id}
                    className={`rounded-2xl overflow-hidden border transition-all duration-200 ${
                      isOpen
                        ? 'bg-white border-indigo-200 shadow-sm shadow-indigo-100'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Module header — toda el área es clickable */}
                    <button
                      onClick={() => toggleMod(mod.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isOpen ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                    >
                      {/* Badge */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${allDone ? 'bg-emerald-100 text-emerald-600' : isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {allDone ? <CheckCircle2 size={16} /> : modIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-black text-sm leading-tight truncate ${isOpen ? 'text-indigo-900' : 'text-slate-800'}`}>{mod.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] font-medium ${allDone ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {allDone ? '✓ Completado' : `${mDone}/${mTotal} lecciones`}
                          </span>
                          {!allDone && mDone > 0 && (
                            <div className="flex-1 max-w-[80px] h-1 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-400" style={{ width: `${mPct}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Chevron — rota 180° cuando está abierto */}
                      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${isOpen ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                        <ChevronDown size={15} />
                      </div>
                    </button>

                    {/* Lecciones — solo se renderizan cuando está abierto */}
                    {isOpen && (
                      <div className="border-t border-indigo-100">
                        {modLessons.length === 0 ? (
                          <p className="text-xs text-slate-400 px-5 py-4">Sin lecciones en este módulo</p>
                        ) : modLessons.map((lesson, i) => {
                          const lIsDoc = lesson.lessonType === 'document'
                          const ytId   = !lIsDoc ? extractYoutubeId(lesson.youtubeUrl ?? '') : null
                          const lDone  = isCompleted(lesson.id)
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setSelectedLesson(lesson)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left group border-b border-slate-50 last:border-0"
                            >
                              {/* Número o check */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${lDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                {lDone ? <CheckCircle2 size={13} /> : i + 1}
                              </div>
                              {/* Thumbnail o ícono de documento */}
                              {lIsDoc ? (
                                <div className="w-14 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                                  <FileText size={16} className="text-emerald-500" />
                                </div>
                              ) : ytId ? (
                                <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0">
                                  <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play size={12} className="text-white" fill="white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-14 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                  <Video size={12} className="text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className={`font-bold text-sm leading-tight line-clamp-1 ${lDone ? 'text-slate-500' : 'text-slate-800'}`}>{lesson.title}</div>
                                {lesson.durationMinutes && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                    <Clock size={9} /> {formatDuration(lesson.durationMinutes)}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); toggleComplete(lesson) }}
                                className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {lDone ? <CheckCircle2 size={17} className="text-emerald-400" /> : <Circle size={17} className="text-slate-300" />}
                              </button>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Lecciones sin módulo */}
              {orphans.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Otras lecciones</span>
                  </div>
                  {orphans.map((lesson, i) => {
                    const ytId  = extractYoutubeId(lesson.youtubeUrl)
                    const lDone = isCompleted(lesson.id)
                    return (
                      <button key={lesson.id} onClick={() => setSelectedLesson(lesson)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left group border-b border-slate-50 last:border-0"
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${lDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {lDone ? <CheckCircle2 size={13} /> : i + 1}
                        </div>
                        {ytId ? (
                          <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0">
                            <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play size={12} className="text-white" fill="white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Video size={12} className="text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`font-bold text-sm leading-tight line-clamp-1 ${lDone ? 'text-slate-400' : 'text-slate-800'}`}>{lesson.title}</div>
                          {lesson.durationMinutes && <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"><Clock size={9}/>{formatDuration(lesson.durationMinutes)}</div>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); toggleComplete(lesson) }} className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {lDone ? <CheckCircle2 size={17} className="text-emerald-400" /> : <Circle size={17} className="text-slate-300" />}
                        </button>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── LISTA DE CURSOS ───────────────────────────────────────────────────────────
  const totalLessons = lessons.length
  const totalDone    = lessons.filter(l => isCompleted(l.id)).length
  const globalPct    = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Academia</h1>
            <p className="text-xs text-slate-400 font-medium">Tu centro de aprendizaje</p>
          </div>
        </div>
        {totalLessons > 0 && (
          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={15} className="text-indigo-500" />
                <span className="text-sm font-black text-slate-700">Progreso general</span>
              </div>
              <span className="text-lg font-black text-indigo-600">{globalPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-indigo-100 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${globalPct}%` }} />
            </div>
            <div className="text-xs text-slate-500 mt-1.5">{totalDone} de {totalLessons} lecciones completadas</div>
          </div>
        )}
      </div>

      {/* Courses grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => {
            const { done, total }   = getCourseProgress(course.id)
            const pct               = total > 0 ? Math.round((done / total) * 100) : 0
            const courseMods        = modules.filter(m => m.courseId === course.id)
            const courseLessons     = lessons.filter(l => l.courseId === course.id)
            const firstYtId         = courseLessons.map(l => extractYoutubeId(l.youtubeUrl)).find(Boolean) ?? null
            const totalDuration     = courseLessons.reduce((acc, l) => acc + (l.durationMinutes ?? 0), 0)

            return (
              <button
                key={course.id}
                onClick={() => {
                  const firstMod = modules.find(m => m.courseId === course.id)
                  setSelectedCourse(course)
                  setExpandedMods(firstMod ? [firstMod.id] : [])
                }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50 transition-all text-left group flex flex-col"
              >
                {/* Thumbnail */}
                {firstYtId ? (
                  <div className="relative h-36 overflow-hidden shrink-0">
                    <img
                      src={`https://img.youtube.com/vi/${firstYtId}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    {pct === 100 && (
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Completado
                      </div>
                    )}
                    {pct > 0 && pct < 100 && (
                      <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-white/30 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-36 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center shrink-0">
                    <BookOpen size={36} className="text-indigo-300" />
                  </div>
                )}
                {/* Info */}
                <div className="p-3.5 flex flex-col flex-1">
                  <h3 className="text-sm font-black text-slate-800 leading-tight line-clamp-2 mb-1.5">{course.title}</h3>
                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-auto">
                    {courseMods.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Layers size={11} />
                        {courseMods.length} mód.
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Video size={11} />
                      {total} lec.
                    </div>
                    {totalDuration > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDuration(totalDuration)}
                      </div>
                    )}
                  </div>
                  {/* Progress */}
                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>{done}/{total} completadas</span>
                        <span className={`font-bold ${pct === 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Videos exclusivos — carrusel horizontal ── */}
        {exclusiveVideos.length > 0 && (
          <div className="mt-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                <span className="text-white text-[11px] font-black">⭐</span>
              </div>
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide flex-1">Contenido exclusivo</h2>
              <span className="text-[11px] text-slate-400 font-medium">{exclusiveVideos.length} video{exclusiveVideos.length !== 1 ? 's' : ''}</span>
            </div>
            {/* Carrusel */}
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5">
              {exclusiveVideos.map(vid => {
                const ytId = extractYoutubeId(vid.youtubeUrl)
                const done = exclusiveProgress.some(p => p.videoId === vid.id && p.completed)
                return (
                  <button
                    key={vid.id}
                    onClick={() => setSelectedExclusive(vid)}
                    className="shrink-0 w-52 bg-white rounded-2xl border border-amber-200 overflow-hidden hover:border-amber-400 hover:shadow-md hover:shadow-amber-50 transition-all text-left group flex flex-col"
                  >
                    {/* Thumbnail */}
                    {ytId ? (
                      <div className="relative h-[116px] overflow-hidden shrink-0">
                        <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-wide">EXCLUSIVO</div>
                        {done && (
                          <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <CheckCircle2 size={8} /> Visto
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-black/30 backdrop-blur-sm rounded-full p-2.5">
                            <Play size={16} className="text-white" fill="white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[116px] bg-amber-50 flex items-center justify-center shrink-0">
                        <Video size={28} className="text-amber-300" />
                      </div>
                    )}
                    {/* Info */}
                    <div className="p-2.5 flex-1">
                      <div className="text-xs font-black text-slate-800 leading-tight line-clamp-2">{vid.title}</div>
                      {vid.durationMinutes && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                          <Clock size={9} /> {formatDuration(vid.durationMinutes)}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Player de video exclusivo (overlay fixed) ── */}
      {selectedExclusive && (() => {
      const ytId = extractYoutubeId(selectedExclusive.youtubeUrl)
      const done = exclusiveProgress.some(p => p.videoId === selectedExclusive.id && p.completed)
      const toggleExclusiveDone = async () => {
        if (!user) return
        const existing = exclusiveProgress.find(p => p.videoId === selectedExclusive.id)
        const nowDone = !done
        if (existing) {
          await supabase.from('exclusive_video_progress').update({ completed: nowDone, completed_at: nowDone ? new Date().toISOString() : null }).eq('id', existing.id)
          setExclusiveProgress(prev => prev.map(p => p.id === existing.id ? { ...p, completed: nowDone } : p))
        } else {
          const np: ExclusiveVideoProgress = { id: generateId(), userId: user.id, videoId: selectedExclusive.id, completed: true, completedAt: new Date().toISOString() }
          await supabase.from('exclusive_video_progress').insert({ id: np.id, user_id: np.userId, video_id: np.videoId, completed: true, completed_at: np.completedAt })
          setExclusiveProgress(prev => [...prev, np])
        }
      }
      return (
        <div className="fixed inset-0 z-[300] flex flex-col bg-slate-900">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
            <button onClick={() => setSelectedExclusive(null)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white truncate">{selectedExclusive.title}</div>
              <div className="text-[10px] text-amber-400 font-bold uppercase">Contenido Exclusivo</div>
            </div>
            <button onClick={toggleExclusiveDone}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              <span className="hidden sm:inline">{done ? 'Visto' : 'Marcar visto'}</span>
            </button>
          </div>
          {/* Video */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            {ytId ? (
              <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`} title={selectedExclusive.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-500"><Video size={36} /></div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 overflow-y-auto bg-white p-4">
            <h2 className="text-lg font-black text-slate-800">{selectedExclusive.title}</h2>
            {selectedExclusive.durationMinutes && <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-1"><Clock size={14}/>{formatDuration(selectedExclusive.durationMinutes)}</div>}
            {selectedExclusive.description && <p className="text-sm text-slate-600 mt-3 leading-relaxed">{selectedExclusive.description}</p>}
          </div>
        </div>
      )
    })()}
    </div>
  )
}
