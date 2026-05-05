import React, { useState, useMemo } from 'react';
import { Plus, X, CheckCircle2, Circle, Trash2, Target, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import type { Goal, Categories, Task, TaskPriority } from '../../types';
import { generateId, getWeekId, getWeekDays, PRIORITY_CONFIG as PRIORITY, getLocalISODate } from '../../lib/utils';

interface ObjetivosProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  categories: Categories;
  currentDate: Date;
  events: Record<string, any[]>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

const Objetivos: React.FC<ObjetivosProps> = ({ goals, setGoals, categories, currentDate, tasks, setTasks }) => {
  const [viewDate, setViewDate] = useState(new Date(currentDate));
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Partial<Goal> | null>(null);
  const [pendingTasks, setPendingTasks] = useState<{ id: string; title: string; priority: TaskPriority }[]>([]);

  const weekId  = useMemo(() => getWeekId(viewDate), [viewDate]);
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
    setGoals(prev => prev.map(g =>
      g.id === id
        ? { ...g, completed: !g.completed, completedAt: !g.completed ? new Date().toISOString() : undefined }
        : g
    ));
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
      completed:   editGoal.completed ?? false,
      completedAt: editGoal.completedAt,
      createdAt:   editGoal.createdAt || new Date().toISOString(),
    };
    setGoals(prev => [...prev.filter(g => g.id !== goal.id), goal]);

    // Crear actividades pendientes enlazadas a este objetivo
    const today       = getLocalISODate();
    const validPending = pendingTasks.filter(pt => pt.title.trim());
    if (validPending.length > 0) {
      const newTasks: Task[] = validPending.map(pt => ({
        id:        generateId(),
        title:     pt.title.trim(),
        priority:  pt.priority,
        status:    'todo' as const,
        goalId:    goalId,
        createdAt: today,
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
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">

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
                    const cat       = goal.category ? categories[goal.category] : null;
                    const goalTasks = tasks.filter(t => t.goalId === goal.id);
                    const doneTasks = goalTasks.filter(t => t.status === 'done').length;
                    return (
                      <div
                        key={goal.id}
                        className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all ${goal.completed ? 'bg-slate-50 border-slate-100 opacity-60' : `${cfg.bg} ${cfg.border}`}`}
                      >
                        <button
                          onClick={() => toggleGoal(goal.id)}
                          className="shrink-0 mt-0.5 transition-transform active:scale-90"
                        >
                          {goal.completed
                            ? <CheckCircle2 size={20} className="text-emerald-500" />
                            : <Circle size={20} className={cfg.color} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black leading-snug ${goal.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {goal.title}
                          </p>
                          {goal.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{goal.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {cat && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                <span className="text-[9px] font-black text-slate-400 uppercase">{cat.label}</span>
                              </div>
                            )}
                            <span className="text-[9px] font-bold text-slate-300 uppercase">
                              {goal.scope === 'weekly' ? 'Semanal' : 'Diario'}
                            </span>
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

      {/* Modal */}
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
                  <input type="text" value={editGoal.title || ''} onChange={e => setEditGoal({ ...editGoal, title: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl p-4 font-bold text-base outline-none transition-all"
                    placeholder="Escribe tu objetivo..." autoFocus />
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción (opcional)</label>
                  <textarea value={editGoal.description || ''} onChange={e => setEditGoal({ ...editGoal, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl p-4 font-bold text-sm outline-none resize-none h-20 transition-all"
                    placeholder="¿Cómo lo vas a lograr?" />
                </div>

                {/* Prioridad */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Prioridad</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['high', 'medium', 'low'] as const).map(p => {
                      const cfg = PRIORITY[p];
                      return (
                        <button key={p} onClick={() => setEditGoal({ ...editGoal, priority: p })}
                          className={`py-3.5 rounded-xl text-[10px] font-black uppercase transition-all border-2 active:scale-[0.97] ${editGoal.priority === p ? `${cfg.bg} ${cfg.border} ${cfg.color} shadow-sm` : 'bg-slate-50 border-transparent text-slate-400 hover:text-slate-600'}`}>
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
                      <button key={s} onClick={() => setEditGoal({ ...editGoal, scope: s })}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all active:scale-[0.98] ${editGoal.scope === s ? 'bg-violet-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        {s === 'weekly' ? 'Semanal' : 'Diario'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Área */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Área (opcional)</label>
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => setEditGoal({ ...editGoal, category: undefined })}
                      className={`py-3 rounded-xl text-[9px] font-black border-2 transition-all active:scale-95 ${!editGoal.category ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-slate-50 border-transparent text-slate-300'}`}>
                      Ninguna
                    </button>
                    {Object.values(categories).map(cat => (
                      <button key={cat.id} onClick={() => setEditGoal({ ...editGoal, category: cat.id })}
                        className={`py-3 rounded-xl text-[9px] font-black border-2 transition-all flex flex-col items-center gap-1.5 active:scale-95 ${editGoal.category === cat.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.short}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Actividades ── */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Actividades <span className="normal-case font-bold text-slate-300">(opcional)</span>
                  </label>

                  {/* Actividades ya existentes (modo edición) */}
                  {isEditing && (() => {
                    const linkedTasks = tasks.filter(t => t.goalId === editGoal?.id);
                    if (linkedTasks.length === 0) return null;
                    return (
                      <div className="mb-3 bg-slate-50 rounded-2xl p-3 space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ya en lista</p>
                        {linkedTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full shrink-0 border-2 ${
                              t.status === 'done' ? 'bg-emerald-500 border-emerald-500' :
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

                  {/* Actividades nuevas a crear */}
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
                          {/* Selector de prioridad compacto */}
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
              <button onClick={saveGoal} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-violet-700 transition-all active:scale-[0.98]">
                {isEditing ? 'Guardar cambios' : 'Guardar objetivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Objetivos;
