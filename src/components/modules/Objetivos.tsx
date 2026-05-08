import React, { useState, useMemo } from 'react';
import { Plus, X, CheckCircle2, Circle, Trash2, Target, ChevronLeft, ChevronRight, Edit2, Calendar, Clock, Settings2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import type { Goal, Categories, Category, Task, TaskPriority } from '../../types';
import { generateId, getWeekId, getWeekDays, PRIORITY_CONFIG as PRIORITY, getLocalISODate } from '../../lib/utils';

const CAT_COLORS = [
  '#6366f1','#f59e0b','#ec4899','#3b82f6','#10b981',
  '#ef4444','#8b5cf6','#f97316','#14b8a6','#94a3b8',
  '#06b6d4','#84cc16',
];
type CatEdit = { id: string; label: string; short: string; color: string; isNew: boolean } | null;

const GOAL_DONE_MSGS = [
  'Estás construyendo hábitos ganadores. 🔥',
  'Un objetivo más en tu historial de victorias.',
  'La disciplina de hoy es el éxito de mañana.',
  '¡Mentalidad campeona en acción!',
];
const WEEK_PERFECT_MSGS = [
  '¡Semana perfecta! Lograste el 100% de tus objetivos. 🏆',
  '¡100% de objetivos cumplidos! Eso es mentalidad ganadora.',
  '¡Semana ganada! Cerraste todos tus objetivos.',
];
const pickRnd = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

interface ObjetivosProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  categories: Categories;
  setCategories: React.Dispatch<React.SetStateAction<Categories>>;
  currentDate: Date;
  events: Record<string, any[]>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to);   b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

type DeadlineStatus = 'overdue' | 'today' | 'soon' | 'normal';

function getDeadlineStatus(deadline: string): DeadlineStatus {
  const today = getLocalISODate();
  if (deadline < today) return 'overdue';
  if (deadline === today) return 'today';
  const days = daysBetween(today, deadline);
  if (days <= 3) return 'soon';
  return 'normal';
}

function formatDeadlineLabel(deadline: string): string {
  return new Date(deadline + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

const Objetivos: React.FC<ObjetivosProps> = ({ goals, setGoals, categories, setCategories, currentDate, tasks, setTasks }) => {
  const [viewDate, setViewDate] = useState(new Date(currentDate));
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Partial<Goal> | null>(null);
  const [pendingTasks, setPendingTasks] = useState<{ id: string; title: string; priority: TaskPriority }[]>([]);

  // ── Gestión de áreas ─────────────────────────────────────────────────────────
  const [showCatManager, setShowCatManager] = useState(false);
  const [catEdit, setCatEdit] = useState<CatEdit>(null);

  const openCreateCat = () => setCatEdit({ id: generateId(), label: '', short: '', color: CAT_COLORS[0], isNew: true });
  const openEditCat   = (cat: Category) => setCatEdit({ id: cat.id, label: cat.label, short: cat.short, color: cat.color, isNew: false });
  const closeCatEdit  = () => setCatEdit(null);

  const saveCat = () => {
    if (!catEdit || !catEdit.label.trim() || !catEdit.short.trim()) return;
    setCategories(prev => ({
      ...prev,
      [catEdit.id]: { id: catEdit.id, label: catEdit.label.trim(), short: catEdit.short.toUpperCase().slice(0, 5).trim(), color: catEdit.color, presets: prev[catEdit.id]?.presets ?? [] },
    }));
    setCatEdit(null);
  };

  const deleteCat = (id: string) => {
    setCategories(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (editGoal?.category === id) setEditGoal(g => g ? { ...g, category: undefined } : g);
    setCatEdit(null);
  };

  const weekId   = useMemo(() => getWeekId(viewDate), [viewDate]);
  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);

  const weekGoals = useMemo(() => goals.filter(g => g.weekId === weekId), [goals, weekId]);

  const stats = useMemo(() => {
    const total     = weekGoals.length;
    const completed = weekGoals.filter(g => g.completed).length;
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;
    const byPriority = (['high', 'medium', 'low'] as const).reduce((acc, p) => {
      const pGoals = weekGoals.filter(g => g.priority === p);
      acc[p] = { total: pGoals.length, completed: pGoals.filter(g => g.completed).length };
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);
    return { total, completed, rate, byPriority };
  }, [weekGoals]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const toggleGoal = (id: string) => {
    setGoals(prev => {
      const updated = prev.map(g =>
        g.id === id
          ? { ...g, completed: !g.completed, completedAt: !g.completed ? new Date().toISOString() : undefined }
          : g
      );
      const goal = prev.find(g => g.id === id);
      if (goal && !goal.completed) {
        // Completando el objetivo
        const weekGoals = updated.filter(g => g.weekId === weekId);
        const allDone = weekGoals.length > 0 && weekGoals.every(g => g.completed);
        if (allDone) {
          setTimeout(() => toast.success(pickRnd(WEEK_PERFECT_MSGS), { duration: 5000 }), 300);
        } else {
          toast.success('¡Objetivo logrado! 🎯', {
            description: pickRnd(GOAL_DONE_MSGS),
            duration: 3500,
          });
        }
      }
      return updated;
    });
  };

  const openCreate = () => {
    setEditGoal({ priority: 'medium', scope: 'weekly' });
    setPendingTasks([]);
    setModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditGoal({ ...goal });
    setPendingTasks([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditGoal(null);
    setPendingTasks([]);
    setModalOpen(false);
  };

  const saveGoal = () => {
    if (!editGoal?.title?.trim()) return;
    const goalId = editGoal.id || generateId();
    const goal: Goal = {
      id:          goalId,
      title:       editGoal.title.trim(),
      description: editGoal.description,
      priority:    (editGoal.priority as 'high' | 'medium' | 'low') || 'medium',
      scope:       (editGoal.scope as 'weekly' | 'daily') || 'weekly',
      weekId,
      dateId:      editGoal.dateId,
      category:    editGoal.category,
      deadline:    editGoal.deadline || undefined,
      completed:   editGoal.completed ?? false,
      completedAt: editGoal.completedAt,
      createdAt:   editGoal.createdAt || new Date().toISOString(),
    };
    setGoals(prev => [...prev.filter(g => g.id !== goal.id), goal]);

    const today        = getLocalISODate();
    const validPending = pendingTasks.filter(pt => pt.title.trim());
    if (validPending.length > 0) {
      const newTasks: Task[] = validPending.map(pt => ({
        id:         generateId(),
        title:      pt.title.trim(),
        priority:   pt.priority,
        status:     'backlog' as const,
        goalId:     goalId,
        categoryId: goal.category,
        sortOrder:  Date.now(),
        createdAt:  today,
      }));
      setTasks(prev => [...prev, ...newTasks]);
    }

    closeModal();
  };

  const addPendingTask = () => {
    setPendingTasks(prev => [...prev, { id: generateId(), title: '', priority: 'medium' }]);
  };

  const prevWeek = () => { const d = new Date(viewDate); d.setDate(d.getDate() - 7); setViewDate(d); };
  const nextWeek = () => { const d = new Date(viewDate); d.setDate(d.getDate() + 7); setViewDate(d); };

  const isEditing = !!editGoal?.id;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-violet-500 p-2 rounded-xl shadow-lg">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Objetivos</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Planificación semanal</p>
            </div>
          </div>
          <div className="flex items-center bg-slate-100 rounded-full p-1">
            <button onClick={prevWeek} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronLeft size={16} /></button>
            <span className="px-3 text-xs font-bold min-w-[150px] text-center text-slate-600">
              {weekDays[0]?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — {weekDays[6]?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={nextWeek} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Progress panel */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-black text-slate-700">Progreso semanal</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-violet-600">{stats.rate}%</span>
              <span className="text-xs text-slate-400 font-bold">{stats.completed}/{stats.total}</span>
            </div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-700"
              style={{ width: `${stats.rate}%` }}
            />
          </div>
          <div className="flex gap-5 mt-3">
            {(['high', 'medium', 'low'] as const).map(p => {
              const cfg = PRIORITY[p];
              const s   = stats.byPriority[p] || { total: 0, completed: 0 };
              return (
                <div key={p} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{cfg.label} {s.completed}/{s.total}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goals list */}
        <div className="space-y-6">
          {(['high', 'medium', 'low'] as const).map(priority => {
            const cfg    = PRIORITY[priority];
            const pGoals = weekGoals.filter(g => g.priority === priority);
            if (pGoals.length === 0) return null;
            return (
              <div key={priority}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-[9px] text-slate-400 font-bold">
                    ({pGoals.filter(g => g.completed).length}/{pGoals.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {pGoals.map(goal => {
                    const cat        = goal.category ? categories[goal.category] : null;
                    const goalTasks  = tasks.filter(t => t.goalId === goal.id);
                    const doneTasks  = goalTasks.filter(t => t.status === 'done').length;

                    // Deadline state
                    const dlStatus   = goal.deadline && !goal.completed ? getDeadlineStatus(goal.deadline) : null;
                    const dlOverdue  = dlStatus === 'overdue';
                    const dlToday    = dlStatus === 'today';
                    const dlSoon     = dlStatus === 'soon';

                    // Completion time (days from createdAt to completedAt)
                    const daysToComplete = goal.completed && goal.completedAt
                      ? daysBetween(goal.createdAt, goal.completedAt)
                      : null;

                    // Met deadline?
                    const metDeadline = goal.completed && goal.deadline && goal.completedAt
                      ? goal.completedAt.split('T')[0] <= goal.deadline
                      : null;

                    return (
                      <div
                        key={goal.id}
                        className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                          goal.completed
                            ? 'bg-slate-50 border-slate-100 opacity-70'
                            : dlOverdue
                            ? 'bg-red-50 border-red-200'
                            : `${cfg.bg} ${cfg.border}`
                        }`}
                      >
                        <button
                          onClick={() => toggleGoal(goal.id)}
                          className="shrink-0 mt-0.5 transition-transform active:scale-90"
                        >
                          {goal.completed
                            ? <CheckCircle2 size={20} className="text-emerald-500" />
                            : <Circle size={20} className={dlOverdue ? 'text-red-400' : cfg.color} />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black leading-snug ${goal.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {goal.title}
                          </p>
                          {goal.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{goal.description}</p>
                          )}

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {cat && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                <span className="text-[9px] font-black text-slate-400 uppercase">{cat.label}</span>
                              </div>
                            )}
                            <span className="text-[9px] font-bold text-slate-300 uppercase">
                              {goal.scope === 'weekly' ? 'Semanal' : 'Diario'}
                            </span>

                            {/* Deadline badge — objetivo pendiente */}
                            {goal.deadline && !goal.completed && (
                              <div className={`flex items-center gap-1 text-[9px] font-black rounded-full px-2 py-0.5 ${
                                dlOverdue ? 'bg-red-100 text-red-600'
                                : dlToday  ? 'bg-orange-100 text-orange-600'
                                : dlSoon   ? 'bg-amber-100 text-amber-600'
                                : 'bg-slate-100 text-slate-500'
                              }`}>
                                <Calendar size={9} />
                                {dlOverdue ? 'Vencida · ' : dlToday ? 'Hoy · ' : dlSoon ? 'Pronto · ' : ''}
                                {formatDeadlineLabel(goal.deadline)}
                              </div>
                            )}

                            {/* Completion badge — objetivo logrado */}
                            {goal.completed && daysToComplete !== null && (
                              <div className={`flex items-center gap-1 text-[9px] font-black rounded-full px-2 py-0.5 ${
                                metDeadline === true  ? 'bg-emerald-100 text-emerald-600'
                                : metDeadline === false ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                              }`}>
                                <Clock size={9} />
                                Logrado en {daysToComplete}d
                                {metDeadline === true && ' · A tiempo'}
                                {metDeadline === false && ' · Fuera de fecha'}
                              </div>
                            )}
                          </div>

                          {/* Task progress mini-bar */}
                          {goalTasks.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[9px] font-bold text-violet-500 shrink-0">
                                {doneTasks}/{goalTasks.length} actividades
                              </span>
                              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-violet-400 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.round((doneTasks / goalTasks.length) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                          <button
                            onClick={() => openEdit(goal)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-violet-500 transition-all"
                            title="Editar objetivo"
                          ><Edit2 size={13} /></button>
                          <button
                            onClick={() => setGoals(prev => prev.filter(g => g.id !== goal.id))}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                            title="Eliminar objetivo"
                          ><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {weekGoals.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
              <Target size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-400">Sin objetivos esta semana</p>
              <p className="text-xs text-slate-300 mt-1">Define qué quieres lograr esta semana</p>
              <button
                onClick={openCreate}
                className="mt-5 bg-violet-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-violet-600 transition-all"
              >
                <Plus size={12} className="inline mr-1" /> Crear primer objetivo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={openCreate}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-violet-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30 hover:bg-violet-600 hover:scale-105 active:scale-95 transition-all z-[100]"
      >
        <Plus size={24} />
      </button>

      {/* ── Modal ── */}
      {modalOpen && editGoal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase italic">
                {isEditing ? 'Editar objetivo' : 'Nuevo objetivo'}
              </h3>
              <button onClick={closeModal} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-5">

                {/* Título */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">¿Qué quieres lograr?</label>
                  <input
                    type="text"
                    value={editGoal.title || ''}
                    onChange={e => setEditGoal({ ...editGoal, title: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl p-4 font-bold text-base outline-none transition-all"
                    placeholder="Escribe tu objetivo..."
                    autoFocus
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción (opcional)</label>
                  <textarea
                    value={editGoal.description || ''}
                    onChange={e => setEditGoal({ ...editGoal, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl p-4 font-bold text-sm outline-none resize-none h-20 transition-all"
                    placeholder="¿Cómo lo vas a lograr?"
                  />
                </div>

                {/* Fecha límite */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-1.5">
                    <Calendar size={11} />
                    Fecha límite (opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={editGoal.deadline ?? ''}
                      onChange={e => setEditGoal({ ...editGoal, deadline: e.target.value || undefined })}
                      className="flex-1 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl px-4 py-3 font-bold text-sm text-slate-700 outline-none transition-all"
                    />
                    {editGoal.deadline && (
                      <button
                        onClick={() => setEditGoal({ ...editGoal, deadline: undefined })}
                        className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all shrink-0"
                        title="Quitar fecha"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {editGoal.deadline && (
                    <p className="text-[10px] text-violet-500 font-bold mt-1.5 px-1">
                      El sistema contabilizará cuántos días tomó conquistar este objetivo.
                    </p>
                  )}
                </div>

                {/* Prioridad */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Prioridad</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['high', 'medium', 'low'] as const).map(p => {
                      const cfg = PRIORITY[p];
                      return (
                        <button
                          key={p}
                          onClick={() => setEditGoal({ ...editGoal, priority: p })}
                          className={`py-3.5 rounded-xl text-[10px] font-black uppercase transition-all border-2 active:scale-[0.97] ${editGoal.priority === p ? `${cfg.bg} ${cfg.border} ${cfg.color} shadow-sm` : 'bg-slate-50 border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Alcance */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Alcance</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                    {(['weekly', 'daily'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setEditGoal({ ...editGoal, scope: s })}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all active:scale-[0.98] ${editGoal.scope === s ? 'bg-violet-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {s === 'weekly' ? 'Semanal' : 'Diario'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Área */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área (opcional)</label>
                    <button
                      onClick={() => setShowCatManager(true)}
                      className="flex items-center gap-1 text-[10px] font-black text-violet-400 hover:text-violet-600 uppercase tracking-widest transition-all"
                    >
                      <Plus size={10} /> Nueva área
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setEditGoal({ ...editGoal, category: undefined })}
                      className={`py-3 rounded-xl text-[9px] font-black border-2 transition-all active:scale-95 ${!editGoal.category ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-slate-50 border-transparent text-slate-300'}`}
                    >
                      Ninguna
                    </button>
                    {Object.values(categories).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setEditGoal({ ...editGoal, category: cat.id })}
                        className={`py-3 rounded-xl text-[9px] font-black border-2 transition-all flex flex-col items-center gap-1.5 active:scale-95 ${editGoal.category === cat.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400'}`}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.short}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actividades */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Actividades <span className="normal-case font-bold text-slate-300">(opcional)</span>
                  </label>

                  {isEditing && (() => {
                    const linkedTasks = tasks.filter(t => t.goalId === editGoal?.id);
                    if (linkedTasks.length === 0) return null;
                    return (
                      <div className="mb-3 bg-slate-50 rounded-2xl p-3 space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ya en lista</p>
                        {linkedTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full shrink-0 border-2 ${
                              t.status === 'done'       ? 'bg-emerald-500 border-emerald-500' :
                              t.status === 'inprogress' ? 'bg-blue-400 border-blue-400' :
                              'border-slate-300 bg-white'
                            }`} />
                            <span className={`text-xs flex-1 truncate ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                              {t.title}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">
                              {t.status === 'done' ? 'Hecho' : t.status === 'inprogress' ? 'En curso' : 'Pendiente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {pendingTasks.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {pendingTasks.map((pt, i) => (
                        <div key={pt.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pt.title}
                            onChange={e => setPendingTasks(prev => prev.map((t, idx) => idx === i ? { ...t, title: e.target.value } : t))}
                            placeholder="Nombre de la actividad..."
                            className="flex-1 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none transition-all min-w-0"
                          />
                          <div className="flex gap-1 shrink-0">
                            {(['high', 'medium', 'low'] as const).map(p => {
                              const pc = PRIORITY[p];
                              return (
                                <button
                                  key={p}
                                  onClick={() => setPendingTasks(prev => prev.map((t, idx) => idx === i ? { ...t, priority: p } : t))}
                                  className={`w-6 h-6 rounded-full transition-all border-2 ${pt.priority === p ? `${pc.dot} border-transparent` : 'bg-white border-slate-200'}`}
                                  title={pc.label}
                                />
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setPendingTasks(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 text-slate-300 hover:text-red-400 transition-all shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={addPendingTask}
                    className="flex items-center gap-1.5 text-[10px] font-black text-violet-400 hover:text-violet-600 uppercase tracking-widest transition-all py-1"
                  >
                    <Plus size={11} />
                    Añadir actividad
                  </button>
                </div>

              </div>
            </div>

            <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2.5rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button
                onClick={saveGoal}
                className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-violet-700 transition-all active:scale-[0.98]"
              >
                {isEditing ? 'Guardar cambios' : 'Guardar objetivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Gestión de Áreas ── */}
      {showCatManager && (
        <div
          className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8"
          onClick={() => { setShowCatManager(false); setCatEdit(null); }}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col"
            style={{ maxHeight: 'min(85svh, calc(100vh - env(safe-area-inset-top,0px)))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                {catEdit && (
                  <button onClick={closeCatEdit} className="p-1.5 hover:bg-slate-100 rounded-full mr-1">
                    <ChevronLeft size={16} className="text-slate-400" />
                  </button>
                )}
                <Palette size={16} className="text-violet-500" />
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">
                  {catEdit ? (catEdit.isNew ? 'Nueva área' : 'Editar área') : 'Mis áreas'}
                </h3>
              </div>
              <button onClick={() => { setShowCatManager(false); setCatEdit(null); }} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {!catEdit ? (
                <div className="p-5 space-y-2">
                  {Object.values(categories).map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{cat.label}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat.short}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditCat(cat)} className="p-1.5 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-violet-500"><Edit2 size={13} /></button>
                        <button onClick={() => deleteCat(cat.id)} className="p-1.5 hover:bg-red-50 rounded-xl transition-all text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={openCreateCat}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-violet-200 text-violet-500 font-black text-xs uppercase tracking-widest hover:bg-violet-50 transition-all mt-2"
                  >
                    <Plus size={14} /> Nueva área
                  </button>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Nombre del área *</label>
                    <input type="text" value={catEdit.label} onChange={e => setCatEdit(c => c && ({ ...c, label: e.target.value }))} placeholder="Ej: Trabajo, Personal, Estudio..." autoFocus className="w-full px-4 py-3 border-2 border-slate-200 focus:border-violet-400 rounded-xl text-slate-800 font-bold text-sm outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Sigla (máx. 5 caracteres) *</label>
                    <input type="text" value={catEdit.short} onChange={e => setCatEdit(c => c && ({ ...c, short: e.target.value.toUpperCase().slice(0, 5) }))} placeholder="Ej: TRB, PER, EST" maxLength={5} className="w-full px-4 py-3 border-2 border-slate-200 focus:border-violet-400 rounded-xl text-slate-800 font-black text-sm outline-none transition-all uppercase tracking-widest" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {CAT_COLORS.map(color => (
                        <button key={color} onClick={() => setCatEdit(c => c && ({ ...c, color }))} className={`w-8 h-8 rounded-full transition-all ${catEdit.color === color ? 'scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: color, boxShadow: catEdit.color === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none' }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {catEdit && (
              <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom,1rem))' }}>
                <button onClick={saveCat} disabled={!catEdit.label.trim() || !catEdit.short.trim()} className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all">
                  {catEdit.isNew ? 'Crear área' : 'Guardar cambios'}
                </button>
                {!catEdit.isNew && (
                  <button onClick={() => deleteCat(catEdit.id)} className="w-full text-red-500 hover:bg-red-50 font-black text-xs uppercase tracking-widest py-2.5 rounded-2xl transition-all">
                    Eliminar área
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Objetivos;
