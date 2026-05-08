import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, pointerWithin, rectIntersection,
  useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, X, Trash2, Edit2, ChevronDown, ChevronUp,
  CheckSquare, Square, Calendar, Clock, BarChart3, List,
  Circle, Loader, CheckCircle2, Inbox, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Task, ChecklistItem, Categories, Goal } from '../../types';
import { generateId, getLocalISODate } from '../../lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const TASK_DONE_MSGS = [
  'Cada tarea completada te acerca más a tus metas.',
  '¡Excelente ejecución! Sigue imparable.',
  '¡Así se construye el éxito, paso a paso!',
  'Un paso más hacia tu mejor versión.',
  'La consistencia es tu superpoder.',
];
const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const STATUS_CONFIG = {
  backlog:    { label: 'Por definir',  color: '#8b5cf6', bg: 'bg-violet-50',   text: 'text-violet-600',  Icon: Inbox },
  todo:       { label: 'Por Hacer',   color: '#94a3b8', bg: 'bg-slate-100',   text: 'text-slate-600',   Icon: Circle },
  inprogress: { label: 'En Progreso', color: '#3b82f6', bg: 'bg-blue-100',    text: 'text-blue-600',    Icon: Loader },
  done:       { label: 'Hechas',      color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700', Icon: CheckCircle2 },
} as const;

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  color: '#ef4444', dot: 'bg-red-400',   text: 'text-red-500' },
  medium: { label: 'Media', color: '#f59e0b', dot: 'bg-amber-400', text: 'text-amber-500' },
  low:    { label: 'Baja',  color: '#94a3b8', dot: 'bg-slate-300', text: 'text-slate-400' },
} as const;

type ListaSubView = 'tablero' | 'resumen';
type ResumeRange = 'week' | 'month' | 'year';

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

/**
 * Parsea un deadline "YYYY-MM-DD" como mediodía local para evitar que
 * la interpretación UTC-midnight produzca "ayer" en zonas UTC negativas.
 */
function parseDeadlineLocal(deadline: string): Date {
  return new Date(deadline + 'T12:00:00');
}

type DeadlineStatus = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal';

function getDeadlineStatus(deadline: string): DeadlineStatus {
  const d     = parseDeadlineLocal(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = (d.getTime() - today.getTime()) / 86400000; // días desde hoy-midnight hasta deadline-noon
  if (days < 0) return 'overdue';
  if (days < 1) return 'today';
  if (days < 2) return 'tomorrow';
  if (days < 4) return 'soon';
  return 'normal';
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ListaProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  checklistItems: ChecklistItem[];
  setChecklistItems: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  categories: Categories;
  goals: Goal[];
  currentDate: Date;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const Lista: React.FC<ListaProps> = ({
  tasks, setTasks, checklistItems, setChecklistItems, categories, goals, currentDate,
}) => {
  const [subView, setSubView] = useState<ListaSubView>('tablero');
  const [filterCat, setFilterCat]     = useState('');
  const [filterStatus, setFilterStatus] = useState<Task['status'] | ''>('');
  const [modalTask, setModalTask]     = useState<Task | null>(null);
  const [isCreating, setIsCreating]   = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<Task['status'] | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 0, tolerance: 10 } }),
  );

  // Detección de colisión: el puntero manda (donde está el cursor/dedo, ahí cae).
  // Si el puntero no está dentro de ningún droppable, cae al que más se intersecte.
  const collisionDetection: CollisionDetection = (args) => {
    const pw = pointerWithin(args);
    return pw.length > 0 ? pw : rectIntersection(args);
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const catList = useMemo(() => Object.values(categories), [categories]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterCat && t.categoryId !== filterCat) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, filterCat, filterStatus]);

  const orderSort = (a: Task, b: Task) =>
    (a.sortOrder - b.sortOrder) || a.createdAt.localeCompare(b.createdAt);

  const tasksByStatus = useMemo(() => ({
    backlog:    filteredTasks.filter(t => t.status === 'backlog').sort(orderSort),
    todo:       filteredTasks.filter(t => t.status === 'todo').sort(orderSort),
    inprogress: filteredTasks.filter(t => t.status === 'inprogress').sort(orderSort),
    done:       filteredTasks.filter(t => t.status === 'done').sort(orderSort),
  }), [filteredTasks]);

  const itemsByTask = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    checklistItems.forEach(ci => {
      if (!map[ci.taskId]) map[ci.taskId] = [];
      map[ci.taskId].push(ci);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [checklistItems]);

  // ── Status change ─────────────────────────────────────────────────────────

  function changeStatus(task: Task, newStatus: Task['status']) {
    const today = getLocalISODate();
    setTasks(prev => prev.map(t => {
      if (t.id !== task.id) return t;
      return {
        ...t,
        status: newStatus,
        startedAt:   newStatus === 'inprogress' && !t.startedAt ? today : t.startedAt,
        completedAt: newStatus === 'done'        ? today : (newStatus !== 'done' ? undefined : t.completedAt),
      };
    }));
    if (newStatus === 'done') {
      toast.success('¡Tarea completada! ✅', {
        description: pickRandom(TASK_DONE_MSGS),
        duration: 3500,
      });
    }
  }

  function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setChecklistItems(prev => prev.filter(ci => ci.taskId !== id));
    if (expandedTask === id) setExpandedTask(null);
  }

  function toggleChecklistItem(item: ChecklistItem) {
    setChecklistItems(prev => prev.map(ci =>
      ci.id === item.id ? { ...ci, done: !ci.done } : ci
    ));
  }

  // ── Open modal ────────────────────────────────────────────────────────────

  function openCreate() {
    setModalTask({
      id:        generateId(),
      title:     '',
      status:    'backlog',
      priority:  'medium',
      sortOrder: Date.now(),
      createdAt: getLocalISODate(),
    });
    setIsCreating(true);
  }

  function openEdit(task: Task) {
    setModalTask({ ...task });
    setIsCreating(false);
  }

  function closeModal() {
    setModalTask(null);
  }

  function saveTask(task: Task, newItems: ChecklistItem[]) {
    if (isCreating) {
      setTasks(prev => [...prev, task]);
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
    // Replace checklist items for this task
    setChecklistItems(prev => [
      ...prev.filter(ci => ci.taskId !== task.id),
      ...newItems,
    ]);
    closeModal();
  }

  // ── Drag & Drop (dnd-kit — mobile + tablet + desktop) ────────────────────
  const STATUSES: Task['status'][] = ['backlog', 'todo', 'inprogress', 'done'];

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(active.id as string);
  }

  function handleDragOver({ over }: DragOverEvent) {
    if (!over) { setOverColumnId(null); return; }
    if (STATUSES.includes(over.id as Task['status'])) {
      setOverColumnId(over.id as Task['status']);
    } else {
      const t = tasks.find(t => t.id === over.id);
      setOverColumnId(t?.status ?? null);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    setOverColumnId(null);
    // No salir de reorderMode automáticamente — el usuario elige cuándo terminar
    if (!over || active.id === over.id) return;

    const activeTask = tasks.find(t => t.id === (active.id as string));
    if (!activeTask) return;

    const overIsColumn = STATUSES.includes(over.id as Task['status']);
    const overTask     = overIsColumn ? null : tasks.find(t => t.id === (over.id as string));
    const targetStatus: Task['status'] = overIsColumn
      ? (over.id as Task['status'])
      : (overTask?.status ?? activeTask.status);

    setTasks(prev => {
      let updated = prev.map(t =>
        t.id === activeTask.id ? { ...t, status: targetStatus } : t
      );

      if (overTask) {
        const col     = updated.filter(t => t.status === targetStatus).sort(orderSort);
        const fromIdx = col.findIndex(t => t.id === activeTask.id);
        const toIdx   = col.findIndex(t => t.id === overTask.id);
        if (fromIdx !== -1 && toIdx !== -1) {
          const reordered = arrayMove(col, fromIdx, toIdx);
          const rest = updated.filter(t => t.status !== targetStatus);
          updated = [...rest, ...reordered];
        }
      }

      // Reasignar sortOrder en columnas afectadas
      const affected = new Set<Task['status']>([activeTask.status, targetStatus]);
      affected.forEach(s => {
        const col = updated.filter(t => t.status === s);
        col.forEach((t, i) => {
          const idx = updated.findIndex(u => u.id === t.id);
          if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: (i + 1) * 1000 };
        });
      });

      return [...updated];
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5 pb-28 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600 p-2 rounded-xl shadow-lg">
              <CheckSquare size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Lista</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestión de tareas</p>
            </div>
          </div>
        </div>

        {/* ── Sub-view tabs ── */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          {([
            { key: 'tablero' as ListaSubView, label: 'Tablero', Icon: List },
            { key: 'resumen' as ListaSubView, label: 'Resumen', Icon: BarChart3 },
          ]).map(({ key, label, Icon }) => {
            const active = subView === key;
            return (
              <button
                key={key}
                onClick={() => setSubView(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                  active ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ═══ TABLERO ═══ */}
        {subView === 'tablero' && (
          <>
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
                <button
                  onClick={() => setFilterCat('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all ${!filterCat ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >Todas</button>
                {catList.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCat(filterCat === cat.id ? '' : cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all flex items-center gap-1.5 ${filterCat === cat.id ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    style={filterCat === cat.id ? { backgroundColor: cat.color } : {}}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: filterCat === cat.id ? 'rgba(255,255,255,0.8)' : cat.color }} />
                    {cat.short}
                  </button>
                ))}
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {/* ── Mobile: Status pill tabs + flat sortable list ── */}
              <div className="md:hidden">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1">
                    {([['', 'Todas'], ['backlog', 'Por definir'], ['todo', 'Por Hacer'], ['inprogress', 'En Progreso'], ['done', 'Hechas']] as const).map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => { setFilterStatus(status as Task['status'] | ''); setIsReorderMode(false); }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all shrink-0 ${
                          filterStatus === status
                            ? status === ''          ? 'bg-slate-700 text-white'
                              : status === 'backlog'    ? 'bg-violet-500 text-white'
                              : status === 'todo'       ? 'bg-slate-500 text-white'
                              : status === 'inprogress' ? 'bg-blue-500 text-white'
                              : 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {label} {status && `(${(tasksByStatus as Record<string, Task[]>)[status]?.length ?? 0})`}
                      </button>
                    ))}
                  </div>

                  {/* Botón reordenar */}
                  <button
                    onClick={() => setIsReorderMode(v => !v)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${
                      isReorderMode
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <GripVertical size={11} />
                    {isReorderMode ? 'Listo' : 'Orden'}
                  </button>
                </div>

                {isReorderMode && (
                  <p className="text-[10px] text-violet-500 font-bold mt-2 px-1">
                    Arrastra el ícono ≡ para reordenar las tarjetas
                  </p>
                )}

                {(() => {
                  const mobileTasks = filteredTasks.filter(t => !filterStatus || t.status === filterStatus);
                  if (mobileTasks.length === 0) return <EmptyState onAdd={openCreate} />;
                  return (
                    <SortableContext items={mobileTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="mt-3 flex flex-col gap-3">
                        {mobileTasks.map(task => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            categories={categories}
                            goals={goals}
                            items={itemsByTask[task.id] ?? []}
                            expanded={expandedTask === task.id}
                            onToggleExpand={() => !isReorderMode && setExpandedTask(expandedTask === task.id ? null : task.id)}
                            onEdit={() => !isReorderMode && openEdit(task)}
                            onDelete={() => !isReorderMode && deleteTask(task.id)}
                            onStatusChange={changeStatus}
                            onToggleItem={toggleChecklistItem}
                            reorderMode={isReorderMode}
                            isMobile
                          />
                        ))}
                      </div>
                    </SortableContext>
                  );
                })()}
              </div>

              {/* ── Desktop: 4-column Kanban ── */}
              <div className="hidden md:grid md:grid-cols-4 gap-4">
                {(['backlog', 'todo', 'inprogress', 'done'] as const).map(status => {
                  const cfg        = STATUS_CONFIG[status];
                  const col        = tasksByStatus[status];
                  const isDropping = activeDragId !== null && overColumnId === status;
                  return (
                    <KanbanColumn key={status} status={status} isDropping={isDropping}>
                      <div className="flex items-center gap-2 px-1">
                        <cfg.Icon size={14} style={{ color: cfg.color }} strokeWidth={2.5} />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-wide">{cfg.label}</span>
                        <span className="ml-auto text-[10px] font-black text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{col.length}</span>
                      </div>
                      <SortableContext items={col.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {col.length === 0 ? (
                          <div className={`flex-1 rounded-2xl border-2 border-dashed flex items-center justify-center py-10 transition-colors ${isDropping ? 'border-violet-300 bg-violet-50' : 'border-slate-100'}`}>
                            <p className={`text-[10px] font-bold uppercase ${isDropping ? 'text-violet-400' : 'text-slate-300'}`}>
                              {isDropping ? 'Soltar aquí' : 'Sin tareas'}
                            </p>
                          </div>
                        ) : (
                          col.map(task => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              categories={categories}
                              goals={goals}
                              items={itemsByTask[task.id] ?? []}
                              expanded={expandedTask === task.id}
                              onToggleExpand={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                              onEdit={() => openEdit(task)}
                              onDelete={() => deleteTask(task.id)}
                              onStatusChange={changeStatus}
                              onToggleItem={toggleChecklistItem}
                            />
                          ))
                        )}
                      </SortableContext>
                    </KanbanColumn>
                  );
                })}
              </div>

              {/* Overlay flotante mientras se arrastra */}
              <DragOverlay dropAnimation={null}>
                {activeDragId ? (() => {
                  const t = tasks.find(t => t.id === activeDragId);
                  if (!t) return null;
                  return (
                    <div className="rotate-1 scale-[1.03] shadow-2xl opacity-95 pointer-events-none">
                      <TaskCard
                        task={t}
                        categories={categories}
                        goals={goals}
                        items={itemsByTask[t.id] ?? []}
                        expanded={false}
                        onToggleExpand={() => {}}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        onStatusChange={() => {}}
                        onToggleItem={() => {}}
                      />
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          </>
        )}

        {/* ═══ RESUMEN ═══ */}
        {subView === 'resumen' && (
          <ResumenView
            tasks={tasks}
            checklistItems={checklistItems}
            categories={categories}
            currentDate={currentDate}
          />
        )}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={openCreate}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-violet-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30 hover:bg-violet-700 hover:scale-105 active:scale-95 transition-all z-[100]"
      >
        <Plus size={24} />
      </button>

      {/* ── Task Modal ── */}
      {modalTask && (
        <TaskModal
          task={modalTask}
          items={isCreating ? [] : (checklistItems.filter(ci => ci.taskId === modalTask.id))}
          categories={categories}
          goals={goals}
          isCreating={isCreating}
          onSave={saveTask}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  categories: Categories;
  goals: Goal[];
  items: ChecklistItem[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (task: Task, status: Task['status']) => void;
  onToggleItem: (item: ChecklistItem) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task, categories, goals, items, expanded,
  onToggleExpand, onEdit, onDelete, onStatusChange, onToggleItem,
}) => {
  const cat      = task.categoryId ? categories[task.categoryId] : null;
  const goal     = task.goalId ? goals.find(g => g.id === task.goalId) : null;
  const cfg      = STATUS_CONFIG[task.status];
  const pri      = PRIORITY_CONFIG[task.priority];
  const doneItems  = items.filter(i => i.done).length;
  const totalItems = items.length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : null;

  const deadlineStatus: DeadlineStatus | null =
    task.deadline && task.status !== 'done' ? getDeadlineStatus(task.deadline) : null;
  const overdue   = deadlineStatus === 'overdue';
  const isToday   = deadlineStatus === 'today';
  const isTomorrow = deadlineStatus === 'tomorrow';
  const soon      = deadlineStatus === 'soon';

  const timeDays = task.startedAt && task.completedAt
    ? daysBetween(task.startedAt, task.completedAt)
    : task.startedAt && task.status === 'inprogress'
    ? daysBetween(task.startedAt, getLocalISODate())
    : null;

  const nextStatuses: Task['status'][] =
    task.status === 'backlog'    ? ['todo'] :
    task.status === 'todo'       ? ['inprogress'] :
    task.status === 'inprogress' ? ['todo', 'done'] :
    ['backlog'];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-150 ${overdue ? 'border-red-200' : 'border-slate-100'}`}>
      {/* Top: área strip */}
      {cat && (
        <div className="h-1" style={{ backgroundColor: cat.color }} />
      )}

      <div className="p-4">
        {/* Row 1: priority dot + title + actions */}
        <div className="flex items-start gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${pri.dot}`} title={pri.label} />
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-slate-800 leading-snug text-sm line-clamp-2 ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>
              {task.title}
            </p>
            {cat && (
              <p className="text-xs font-bold mt-0.5 truncate" style={{ color: cat.color }}>{cat.label}</p>
            )}
            {goal && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs">🎯</span>
                <p className="text-xs font-bold text-violet-500 truncate">{goal.title}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onEdit}   className="p-1.5 hover:bg-slate-100 rounded-full transition-all"><Edit2 size={13} className="text-slate-400" /></button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50   rounded-full transition-all"><Trash2 size={13} className="text-red-400" /></button>
          </div>
        </div>

        {/* Row 2: deadline + time tracking */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {task.deadline && (
            <div className={`flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 ${
              overdue    ? 'bg-red-50 text-red-500'
              : isToday  ? 'bg-orange-50 text-orange-500'
              : isTomorrow ? 'bg-amber-50 text-amber-500'
              : soon     ? 'bg-yellow-50 text-yellow-600'
              : 'bg-slate-50 text-slate-400'
            }`}>
              <Calendar size={11} />
              {overdue    ? 'Vencida · '
               : isToday  ? 'Hoy · '
               : isTomorrow ? 'Mañana · '
               : soon     ? 'Pronto · '
               : ''}
              {new Date(task.deadline + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
            </div>
          )}
          {timeDays !== null && (
            <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
              <Clock size={11} />
              {task.status === 'done' ? `${timeDays}d` : `${timeDays}d en progreso`}
            </div>
          )}
          {/* Status badge */}
          <div className={`ml-auto flex items-center gap-1 text-[11px] font-black uppercase rounded-full px-2.5 py-0.5 ${cfg.bg} ${cfg.text}`}>
            <cfg.Icon size={11} strokeWidth={2.5} />
            {cfg.label}
          </div>
        </div>

        {/* Checklist progress bar */}
        {totalItems > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-400">{doneItems}/{totalItems} subtareas</span>
              {pct !== null && <span className="text-xs font-black text-slate-500">{pct}%</span>}
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct ?? 0}%`, backgroundColor: cat?.color ?? '#6366f1' }}
              />
            </div>
          </div>
        )}

        {/* Expand/collapse checklist */}
        {totalItems > 0 && (
          <button
            onClick={onToggleExpand}
            className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Ocultar' : 'Ver'} subtareas
          </button>
        )}

        {expanded && totalItems > 0 && (
          <div className="mt-2 space-y-1.5 pl-1">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => onToggleItem(item)}
                className="flex items-start gap-2 w-full text-left group"
              >
                {item.done
                  ? <CheckSquare size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <Square size={14} className="text-slate-300 group-hover:text-slate-400 shrink-0 mt-0.5 transition-all" />
                }
                <span className={`text-xs leading-snug ${item.done ? 'line-through text-slate-300' : 'text-slate-600 font-medium'}`}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Status quick-actions — solo mobile (en desktop se usa drag & drop) */}
        <div className="md:hidden flex gap-1.5 mt-3 pt-3 border-t border-slate-50">
          {nextStatuses.map(s => {
            const nc = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => onStatusChange(task, s)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${nc.bg} ${nc.text} hover:opacity-80`}
              >
                <nc.Icon size={12} strokeWidth={2.5} />
                Mover a: {nc.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── SortableTaskCard ─────────────────────────────────────────────────────────

const SortableTaskCard: React.FC<TaskCardProps & { reorderMode?: boolean; isMobile?: boolean }> = ({ reorderMode, isMobile, ...props }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      className={`select-none ${isDragging ? 'opacity-30' : ''}`}
    >
      {reorderMode ? (
        /* Mobile — modo Reordenar: handle grande explícito */
        <div className="flex items-stretch gap-0">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-12 bg-slate-100 rounded-l-2xl border border-r-0 border-slate-200 cursor-grab active:cursor-grabbing shrink-0"
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={22} className="text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <TaskCard {...props} />
          </div>
        </div>
      ) : isMobile ? (
        /* Mobile — modo normal: sin listeners para no bloquear botones */
        <TaskCard {...props} />
      ) : (
        /* Desktop: grip sutil al hover */
        <div className="relative group/card">
          <div
            {...attributes}
            {...listeners}
            className="absolute left-1.5 top-0 bottom-0 flex items-center z-20 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover/card:opacity-100 transition-opacity"
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={14} className="text-slate-300" />
          </div>
          <div className="pl-5">
            <TaskCard {...props} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

const KanbanColumn: React.FC<{
  status: Task['status'];
  isDropping: boolean;
  children: React.ReactNode;
}> = ({ status, isDropping, children }) => {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 min-h-[200px] rounded-2xl transition-all duration-150 ${
        isDropping ? 'ring-2 ring-offset-2 ring-violet-300 bg-violet-50/30' : ''
      }`}
    >
      {children}
    </div>
  );
};

// ─── EmptyState ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center">
      <CheckSquare size={28} className="text-violet-400" />
    </div>
    <div className="text-center px-4">
      <p className="font-black text-slate-700 text-base">Sin tareas aquí</p>
      <p className="text-sm text-slate-400 mt-1 max-w-[200px] mx-auto leading-snug">
        Crea tu primera tarea para empezar a medir tu productividad
      </p>
    </div>
    <button
      onClick={onAdd}
      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-2xl px-5 py-2.5 transition-all"
    >
      <Plus size={15} /> Nueva tarea
    </button>
  </div>
);

// ─── ResumenView ──────────────────────────────────────────────────────────────

interface ResumenViewProps {
  tasks: Task[];
  checklistItems: ChecklistItem[];
  categories: Categories;
  currentDate: Date;
}

const ResumenView: React.FC<ResumenViewProps> = ({ tasks, categories, currentDate }) => {
  const [range, setRange] = useState<ResumeRange>('week');
  const [viewDate, setViewDate] = useState(new Date(currentDate));

  function prevPeriod() {
    const d = new Date(viewDate);
    if (range === 'week')  d.setDate(d.getDate() - 7);
    if (range === 'month') d.setMonth(d.getMonth() - 1);
    if (range === 'year')  d.setFullYear(d.getFullYear() - 1);
    setViewDate(d);
  }
  function nextPeriod() {
    const d = new Date(viewDate);
    if (range === 'week')  d.setDate(d.getDate() + 7);
    if (range === 'month') d.setMonth(d.getMonth() + 1);
    if (range === 'year')  d.setFullYear(d.getFullYear() + 1);
    setViewDate(d);
  }

  function inRange(dateStr?: string): boolean {
    if (!dateStr) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (range === 'week') {
      const mon = new Date(viewDate);
      mon.setDate(viewDate.getDate() - ((viewDate.getDay() + 6) % 7));
      mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return date >= mon && date <= sun;
    }
    if (range === 'month') return y === viewDate.getFullYear() && m - 1 === viewDate.getMonth();
    return y === viewDate.getFullYear();
  }

  const periodLabel = useMemo(() => {
    if (range === 'month') return viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (range === 'year')  return String(viewDate.getFullYear());
    const mon = new Date(viewDate);
    mon.setDate(viewDate.getDate() - ((viewDate.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${sun.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }, [range, viewDate]);

  // Stats
  const stats = useMemo(() => {
    const periodDone = tasks.filter(t => t.status === 'done' && inRange(t.completedAt));
    const periodStarted = tasks.filter(t => inRange(t.startedAt));
    const totalInPeriod = tasks.filter(t => inRange(t.createdAt) || inRange(t.startedAt) || inRange(t.completedAt));

    // Avg time (days from startedAt to completedAt)
    const withTime = periodDone.filter(t => t.startedAt && t.completedAt);
    const avgDays = withTime.length > 0
      ? Math.round(withTime.reduce((s, t) => s + daysBetween(t.startedAt!, t.completedAt!), 0) / withTime.length)
      : null;

    // By category
    const byCat: Record<string, number> = {};
    periodDone.forEach(t => {
      const k = t.categoryId ?? '__none__';
      byCat[k] = (byCat[k] ?? 0) + 1;
    });
    const byCatArr = Object.entries(byCat)
      .map(([id, count]) => ({
        id,
        count,
        label: id === '__none__' ? 'Sin área' : (categories[id]?.label ?? id),
        color: id === '__none__' ? '#94a3b8' : (categories[id]?.color ?? '#94a3b8'),
      }))
      .sort((a, b) => b.count - a.count);

    const maxCount = byCatArr[0]?.count ?? 1;

    return { periodDone, periodStarted, totalInPeriod, avgDays, byCatArr, maxCount };
  }, [tasks, range, viewDate, categories]);

  // Recent completed tasks
  const recentDone = useMemo(() =>
    tasks
      .filter(t => t.status === 'done' && t.completedAt)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 5),
    [tasks]
  );

  return (
    <div className="space-y-5">
      {/* Period controls */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex bg-slate-100 p-0.5 rounded-full text-[9px] font-black">
          {(['week', 'month', 'year'] as ResumeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-full uppercase transition-all ${range === r ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >{r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : 'Año'}</button>
          ))}
        </div>
        <div className="flex items-center bg-slate-100 rounded-full p-0.5">
          <button onClick={prevPeriod} className="p-1.5 hover:bg-white rounded-full transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="px-2 text-[10px] font-bold text-slate-600 min-w-[130px] text-center capitalize">{periodLabel}</span>
          <button onClick={nextPeriod} className="p-1.5 hover:bg-white rounded-full transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Completadas', value: stats.periodDone.length,    color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Iniciadas',   value: stats.periodStarted.length, color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
          { label: 'Creadas',     value: tasks.filter(t => inRange(t.createdAt)).length, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
          { label: 'Promedio',    value: stats.avgDays !== null ? `${stats.avgDays}d` : '—', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border px-4 py-3.5 flex flex-col gap-0.5 ${bg}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`text-xl font-black ${color} tabular-nums`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tasks completed by area */}
      {stats.byCatArr.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Tareas completadas por área
          </p>
          <div className="space-y-3">
            {stats.byCatArr.map(({ id, count, label, color }) => (
              <div key={id} className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <p className="text-xs font-bold text-slate-600 w-28 shrink-0 truncate">{label}</p>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(count / stats.maxCount) * 100}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs font-black text-slate-700 tabular-nums shrink-0 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm font-bold text-slate-400">Sin tareas completadas en este período</p>
        </div>
      )}

      {/* All-time stats */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Estado general de todas las tareas</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['backlog', 'todo', 'inprogress', 'done'] as const).map(status => {
            const cfg = STATUS_CONFIG[status];
            const count = tasks.filter(t => t.status === status).length;
            const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
            return (
              <div key={status} className={`rounded-xl p-3 text-center ${cfg.bg}`}>
                <cfg.Icon size={16} className={`mx-auto mb-1 ${cfg.text}`} strokeWidth={2.5} />
                <p className={`text-xs font-black ${cfg.text}`}>{cfg.label}</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{count}</p>
                <p className="text-[9px] text-slate-400 font-bold">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent completions */}
      {recentDone.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Últimas completadas</p>
          <div className="space-y-2">
            {recentDone.map(task => {
              const cat = task.categoryId ? categories[task.categoryId] : null;
              const days = task.startedAt && task.completedAt ? daysBetween(task.startedAt, task.completedAt) : null;
              return (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{task.title}</p>
                    {cat && <p className="text-[10px] font-bold truncate" style={{ color: cat.color }}>{cat.label}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {days !== null && <p className="text-[10px] font-black text-slate-400">{days}d</p>}
                    {task.completedAt && (
                      <p className="text-[9px] text-slate-300 font-bold">
                        {new Date(task.completedAt + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TaskModal ────────────────────────────────────────────────────────────────

interface TaskModalProps {
  task: Task;
  items: ChecklistItem[];
  categories: Categories;
  goals: Goal[];
  isCreating: boolean;
  onSave: (task: Task, items: ChecklistItem[]) => void;
  onClose: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({
  task: initialTask, items: initialItems, categories, goals, isCreating, onSave, onClose,
}) => {
  const [task, setTask]   = useState<Task>({ ...initialTask });
  const [items, setItems] = useState<ChecklistItem[]>([...initialItems]);
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText]     = useState('');
  const newItemRef  = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const catList = Object.values(categories);

  function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    const ci: ChecklistItem = {
      id: generateId(),
      taskId: task.id,
      text,
      done: false,
      order: items.length,
      createdAt: getLocalISODate(),
    };
    setItems(prev => [...prev, ci]);
    setNewItemText('');
    newItemRef.current?.focus();
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function toggleItem(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }

  function startEdit(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditingText(item.text);
    setTimeout(() => editInputRef.current?.select(), 0);
  }

  function commitEdit() {
    const text = editingText.trim();
    if (text && editingItemId) {
      setItems(prev => prev.map(i => i.id === editingItemId ? { ...i, text } : i));
    }
    setEditingItemId(null);
    setEditingText('');
  }

  function cancelEdit() {
    setEditingItemId(null);
    setEditingText('');
  }

  function handleSave() {
    if (!task.title.trim()) return;
    onSave({ ...task, title: task.title.trim() }, items);
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl md:rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-base font-black text-slate-800 uppercase italic">
            {isCreating ? 'Nueva tarea' : 'Editar tarea'}
          </h3>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-full transition-all">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Title */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Título *</label>
            <input
              type="text"
              value={task.title}
              onChange={e => setTask(t => ({ ...t, title: e.target.value }))}
              placeholder="¿Qué necesitas hacer?"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
              autoFocus
            />
          </div>

          {/* Área */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Área</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTask(t => ({ ...t, categoryId: undefined }))}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${!task.categoryId ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}
              >Sin área</button>
              {catList.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setTask(t => ({ ...t, categoryId: cat.id }))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${task.categoryId === cat.id ? 'text-white border-2' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                  style={task.categoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task.categoryId === cat.id ? 'rgba(255,255,255,0.8)' : cat.color }} />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Prioridad</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map(p => {
                const pc = PRIORITY_CONFIG[p];
                const active = task.priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setTask(t => ({ ...t, priority: p }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${active ? 'border-2' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                    style={active ? { backgroundColor: pc.color + '15', borderColor: pc.color, color: pc.color } : {}}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${pc.dot}`} />
                    {pc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Deadline</label>
            <input
              type="date"
              value={task.deadline ?? ''}
              onChange={e => setTask(t => ({ ...t, deadline: e.target.value || undefined }))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
            />
          </div>

          {/* Objetivo */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Objetivo (opcional)</label>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              <button
                onClick={() => setTask(t => ({ ...t, goalId: undefined }))}
                className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition-all ${!task.goalId ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}
              >
                Sin objetivo
              </button>
              {(() => {
                const activeGoals = goals.filter(g => !g.completed).sort((a, b) => b.weekId.localeCompare(a.weekId));
                if (activeGoals.length === 0) return (
                  <p className="text-[10px] text-slate-300 font-bold px-1 py-1">No hay objetivos activos</p>
                );
                return activeGoals.map(goal => {
                  const pc         = PRIORITY_CONFIG[goal.priority];
                  const isSelected = task.goalId === goal.id;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setTask(t => ({ ...t, goalId: goal.id }))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition-all flex items-center gap-2 ${isSelected ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white/70' : pc.dot}`} />
                      <span className="flex-1 truncate">{goal.title}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Descripción</label>
            <textarea
              value={task.description ?? ''}
              onChange={e => setTask(t => ({ ...t, description: e.target.value || undefined }))}
              placeholder="Notas adicionales..."
              rows={2}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 resize-none"
            />
          </div>

          {/* Status (only when editing) */}
          {!isCreating && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Estado</label>
              <div className="flex gap-2">
                {(['backlog', 'todo', 'inprogress', 'done'] as const).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const active = task.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        const today = getLocalISODate();
                        setTask(t => ({
                          ...t,
                          status: s,
                          startedAt:   s === 'inprogress' && !t.startedAt ? today : t.startedAt,
                          completedAt: s === 'done' ? today : (s !== 'done' ? undefined : t.completedAt),
                        }));
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                        active ? `${cfg.bg} ${cfg.text} border-current` : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'
                      }`}
                    >
                      <cfg.Icon size={10} strokeWidth={2.5} />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
              Subtareas ({items.length})
            </label>
            {items.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button onClick={() => toggleItem(item.id)} className="shrink-0">
                      {item.done
                        ? <CheckSquare size={15} className="text-emerald-500" />
                        : <Square size={15} className="text-slate-300 group-hover:text-slate-400 transition-all" />
                      }
                    </button>

                    {editingItemId === item.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                        }}
                        className="flex-1 text-sm text-slate-700 font-medium bg-violet-50 border border-violet-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    ) : (
                      <span
                        onClick={() => !item.done && startEdit(item)}
                        className={`flex-1 text-sm ${item.done ? 'line-through text-slate-300 cursor-default' : 'text-slate-600 font-medium cursor-text hover:text-slate-800'}`}
                        title={item.done ? undefined : 'Clic para editar'}
                      >
                        {item.text}
                      </span>
                    )}

                    <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                      {!item.done && editingItemId !== item.id && (
                        <button onClick={() => startEdit(item)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                          <Edit2 size={11} className="text-slate-400" />
                        </button>
                      )}
                      <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-red-50 rounded-lg transition-all">
                        <X size={11} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={newItemRef}
                type="text"
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Agregar subtarea..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
              />
              <button
                onClick={addItem}
                disabled={!newItemText.trim()}
                className="p-2 bg-violet-100 hover:bg-violet-200 disabled:opacity-40 text-violet-600 rounded-xl transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 shrink-0 md:rounded-b-[2.5rem]">
          <button
            onClick={handleSave}
            disabled={!task.title.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase italic tracking-wide rounded-2xl py-3.5 transition-all"
          >
            {isCreating ? 'Crear tarea' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lista;
