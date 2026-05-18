import React, { useState, useEffect, useCallback } from 'react'
import {
  GraduationCap, BookOpen, Video, Play, CheckCircle2, Circle,
  ChevronLeft, Clock, BarChart3, Lock, ChevronRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AcademyCourse, AcademyLesson, AcademyProgress } from '../../types'
import { generateId } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return match?.[1] ?? null
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

  const [courses, setCourses]     = useState<AcademyCourse[]>([])
  const [lessons, setLessons]     = useState<AcademyLesson[]>([])
  const [progress, setProgress]   = useState<AcademyProgress[]>([])
  const [loading, setLoading]     = useState(true)

  // Navigation state
  const [selectedCourse, setSelectedCourse] = useState<AcademyCourse | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<AcademyLesson | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Get user's companies
    const { data: memberRows } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)

    const companyIds = (memberRows ?? []).map((r: any) => r.company_id)

    if (!companyIds.length) {
      setLoading(false)
      return
    }

    const [{ data: cors }, { data: less }, { data: prog }] = await Promise.all([
      supabase
        .from('academy_courses')
        .select('*')
        .in('company_id', companyIds)
        .eq('published', true)
        .order('sort_order'),
      supabase
        .from('academy_lessons')
        .select('*')
        .order('sort_order'),
      supabase
        .from('academy_progress')
        .select('*')
        .eq('user_id', user.id),
    ])

    const mappedCourses = (cors ?? []).map(rowToCourse)
    const mappedLessons = (less ?? []).map(rowToLesson)
    const mappedProgress = (prog ?? []).map(rowToProgress)

    // Filter lessons to only those in visible courses
    const courseIds = mappedCourses.map(c => c.id)
    const filteredLessons = mappedLessons.filter(l => courseIds.includes(l.courseId))

    setCourses(mappedCourses)
    setLessons(filteredLessons)
    setProgress(mappedProgress)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Row mappers ───────────────────────────────────────────────────────────────
  const rowToCourse = (r: any): AcademyCourse => ({
    id: r.id, companyId: r.company_id, title: r.title, description: r.description,
    thumbnailUrl: r.thumbnail_url, sortOrder: r.sort_order, published: r.published,
    createdAt: r.created_at, updatedAt: r.updated_at,
  })
  const rowToLesson = (r: any): AcademyLesson => ({
    id: r.id, courseId: r.course_id, title: r.title, youtubeUrl: r.youtube_url,
    description: r.description, durationMinutes: r.duration_minutes,
    sortOrder: r.sort_order, createdAt: r.created_at,
  })
  const rowToProgress = (r: any): AcademyProgress => ({
    id: r.id, userId: r.user_id, lessonId: r.lesson_id,
    completed: r.completed, completedAt: r.completed_at,
  })

  // ── Progress helpers ──────────────────────────────────────────────────────────
  const isCompleted = (lessonId: string) =>
    progress.some(p => p.lessonId === lessonId && p.completed)

  const getCourseProgress = (courseId: string) => {
    const courseLessons = lessons.filter(l => l.courseId === courseId)
    const done = courseLessons.filter(l => isCompleted(l.id)).length
    return { done, total: courseLessons.length }
  }

  const toggleComplete = async (lesson: AcademyLesson) => {
    if (!user) return
    const existing = progress.find(p => p.lessonId === lesson.id)
    const nowCompleted = !isCompleted(lesson.id)

    if (existing) {
      await supabase
        .from('academy_progress')
        .update({ completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null })
        .eq('id', existing.id)
      setProgress(prev => prev.map(p =>
        p.id === existing.id ? { ...p, completed: nowCompleted, completedAt: nowCompleted ? new Date().toISOString() : undefined } : p
      ))
    } else {
      const newProg: AcademyProgress = {
        id: generateId(), userId: user.id, lessonId: lesson.id,
        completed: true, completedAt: new Date().toISOString(),
      }
      await supabase.from('academy_progress').insert({
        id: newProg.id, user_id: newProg.userId, lesson_id: newProg.lessonId,
        completed: true, completed_at: newProg.completedAt,
      })
      setProgress(prev => [...prev, newProg])
    }
  }

  // ── Course list view ──────────────────────────────────────────────────────────
  const totalLessons = lessons.length
  const totalDone = lessons.filter(l => isCompleted(l.id)).length
  const globalPct = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0

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
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={36} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-black text-slate-700 mb-2">Academia</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Aún no hay cursos disponibles para tu empresa. Contáctate con el administrador.
          </p>
        </div>
      </div>
    )
  }

  // ── Lesson player view ────────────────────────────────────────────────────────
  if (selectedLesson) {
    const ytId = extractYoutubeId(selectedLesson.youtubeUrl)
    const courseLessons = selectedLesson
      ? lessons.filter(l => l.courseId === selectedLesson.courseId)
      : []
    const currentIndex = courseLessons.findIndex(l => l.id === selectedLesson.id)
    const prevLesson = currentIndex > 0 ? courseLessons[currentIndex - 1] : null
    const nextLesson = currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null
    const done = isCompleted(selectedLesson.id)

    return (
      <div className="flex flex-col h-full bg-slate-900">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => setSelectedLesson(null)}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white truncate">{selectedLesson.title}</div>
            <div className="text-xs text-slate-500">{selectedCourse?.title}</div>
          </div>
          <button
            onClick={() => toggleComplete(selectedLesson)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              done
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {done ? 'Completado' : 'Marcar'}
          </button>
        </div>

        {/* Video */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {ytId ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
              title={selectedLesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-500">
              <Video size={36} />
            </div>
          )}
        </div>

        {/* Lesson info + description */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="p-4">
            <h2 className="text-lg font-black text-slate-800">{selectedLesson.title}</h2>
            {selectedLesson.durationMinutes && (
              <div className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                <Clock size={14} />
                {formatDuration(selectedLesson.durationMinutes)}
              </div>
            )}
            {selectedLesson.description && (
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{selectedLesson.description}</p>
            )}
          </div>

          {/* Navigation between lessons */}
          <div className="flex gap-3 px-4 pb-4">
            <button
              onClick={() => prevLesson && setSelectedLesson(prevLesson)}
              disabled={!prevLesson}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              onClick={() => nextLesson && setSelectedLesson(nextLesson)}
              disabled={!nextLesson}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-30 transition-colors"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>

          {/* Other lessons in course */}
          <div className="px-4 pb-6">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Más lecciones — {selectedCourse?.title}
            </div>
            <div className="space-y-2">
              {courseLessons.map((l, i) => {
                const lYtId = extractYoutubeId(l.youtubeUrl)
                const lDone = isCompleted(l.id)
                const isCurrent = l.id === selectedLesson.id
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLesson(l)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      isCurrent ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    {lYtId ? (
                      <img
                        src={`https://img.youtube.com/vi/${lYtId}/default.jpg`}
                        alt=""
                        className="w-16 h-11 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-11 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Video size={14} className="text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold truncate ${isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {i + 1}. {l.title}
                      </div>
                      {l.durationMinutes && (
                        <div className="text-[11px] text-slate-400">{formatDuration(l.durationMinutes)}</div>
                      )}
                    </div>
                    {lDone ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <Play size={16} className="text-indigo-500 shrink-0" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Course detail view ────────────────────────────────────────────────────────
  if (selectedCourse) {
    const courseLessons = lessons.filter(l => l.courseId === selectedCourse.id)
    const { done, total } = getCourseProgress(selectedCourse.id)
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 px-4 pt-4 pb-6">
          <button
            onClick={() => setSelectedCourse(null)}
            className="flex items-center gap-1.5 text-indigo-200 text-sm font-bold mb-4 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> Cursos
          </button>
          <h1 className="text-xl font-black text-white mb-1">{selectedCourse.title}</h1>
          {selectedCourse.description && (
            <p className="text-indigo-200 text-sm leading-relaxed">{selectedCourse.description}</p>
          )}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-indigo-200 mb-1.5">
              <span>{done} de {total} lecciones completadas</span>
              <span className="font-bold">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lessons list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-2">
            {courseLessons.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Video size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Sin lecciones aún</p>
              </div>
            ) : courseLessons.map((lesson, i) => {
              const ytId = extractYoutubeId(lesson.youtubeUrl)
              const done = isCompleted(lesson.id)
              return (
                <button
                  key={lesson.id}
                  onClick={() => { setSelectedLesson(lesson) }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-left group"
                >
                  {/* Thumbnail */}
                  {ytId ? (
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0">
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={18} className="text-white" fill="white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Video size={18} className="text-slate-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase">{i + 1}</span>
                      {done && <CheckCircle2 size={12} className="text-emerald-500" />}
                    </div>
                    <div className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{lesson.title}</div>
                    {lesson.durationMinutes && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                        <Clock size={10} />
                        {formatDuration(lesson.durationMinutes)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); toggleComplete(lesson) }}
                    className="shrink-0 p-1"
                  >
                    {done ? (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    ) : (
                      <Circle size={20} className="text-slate-300 hover:text-slate-400" />
                    )}
                  </button>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Course list (home) ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Academia</h1>
            <p className="text-xs text-slate-400 font-medium">Tu centro de aprendizaje</p>
          </div>
        </div>

        {/* Global progress */}
        {totalLessons > 0 && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={15} className="text-indigo-500" />
                <span className="text-sm font-black text-slate-700">Progreso general</span>
              </div>
              <span className="text-lg font-black text-indigo-600">{globalPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-indigo-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                style={{ width: `${globalPct}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {totalDone} de {totalLessons} lecciones completadas
            </div>
          </div>
        )}
      </div>

      {/* Courses grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="space-y-4">
          {courses.map(course => {
            const { done, total } = getCourseProgress(course.id)
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const courseLessons = lessons.filter(l => l.courseId === course.id)
            const firstLesson = courseLessons[0]
            const firstYtId = firstLesson ? extractYoutubeId(firstLesson.youtubeUrl) : null
            const totalDuration = courseLessons.reduce((acc, l) => acc + (l.durationMinutes ?? 0), 0)

            return (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course)}
                className="w-full bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all text-left group"
              >
                {/* Thumbnail */}
                {firstYtId ? (
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={`https://img.youtube.com/vi/${firstYtId}/maxresdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${firstYtId}/mqdefault.jpg`
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {pct === 100 && (
                      <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={11} /> Completado
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-44 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <BookOpen size={48} className="text-indigo-300" />
                  </div>
                )}

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-base font-black text-slate-800 mb-1">{course.title}</h3>
                  {course.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3 leading-relaxed">{course.description}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Video size={12} />
                      {total} lección{total !== 1 ? 'es' : ''}
                    </div>
                    {totalDuration > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDuration(totalDuration)}
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {total > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>{done} de {total} completadas</span>
                        <span className="font-bold text-indigo-500">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
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
      </div>
    </div>
  )
}
