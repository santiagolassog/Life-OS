import React, { useMemo } from 'react';
import {
  CalendarDays, CheckSquare, Target, DollarSign,
  ChevronRight, TrendingUp, TrendingDown, Sparkles,
  Clock, Circle, Loader, CheckCircle2, Inbox,
  AlertCircle, Sun, Moon, Sunset, BarChart3, Flame,
} from 'lucide-react';
import type { Events, Categories, Task, Goal, Transaction, FinCategory, MonthBalance, Habit, HabitLog } from '../../types';
import { formatDateId, getWeekId, getWeekDays, fmtCurrency, GRID_HOURS, PRIORITY_CONFIG } from '../../lib/utils';
import { LOAN_IN_CAT_ID, LOAN_OUT_CAT_ID } from '../../types';
import { generateId } from '../../lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionKey = 'hoy' | 'tiempo' | 'dinero' | 'objetivos' | 'lista' | 'revision' | 'habitos';

interface HoyProps {
  userName: string;
  streak: number;
  events: Events;
  categories: Categories;
  tasks: Task[];
  goals: Goal[];
  transactions: Transaction[];
  finCategories: FinCategory[];
  monthBalances: MonthBalance[];
  habits: Habit[];
  habitLogs: HabitLog[];
  setHabitLogs: React.Dispatch<React.SetStateAction<HabitLog[]>>;
  currentDate: Date;
  onNavigate: (s: SectionKey) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12)  return { text: 'Buenos días',   Icon: Sun };
  if (h >= 12 && h < 19) return { text: 'Buenas tardes', Icon: Sunset };
  return                           { text: 'Buenas noches', Icon: Moon };
}

function fmtDateLabel(d: Date) {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function eventTime(hour: string) {
  const [h, m] = hour.split(':');
  return `${h}:${m}`;
}

// ─── SVG Progress Ring ──────────────────────────────────────────────────────

const ProgressRing: React.FC<{
  size: number;
  strokeWidth: number;
  percentage: number;
  gradientId: string;
  colorFrom: string;
  colorTo: string;
}> = ({ size, strokeWidth, percentage, gradientId, colorFrom, colorTo }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  return (
    <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={`url(#${gradientId})`} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out" />
    </svg>
  );
};

const MiniRing: React.FC<{
  size: number;
  strokeWidth: number;
  percentage: number;
  color: string;
}> = ({ size, strokeWidth, percentage, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  return (
    <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out" />
    </svg>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const Hoy: React.FC<HoyProps> = ({
  userName, streak, events, categories, tasks, goals,
  transactions, finCategories, monthBalances, habits, habitLogs, setHabitLogs,
  currentDate, onNavigate,
}) => {
  const { text: greetText, Icon: GreetIcon } = greeting();
  const todayStr = formatDateId(new Date());
  const weekId   = useMemo(() => getWeekId(currentDate), [currentDate]);

  // ── Today's events ─────────────────────────────────────────────────────────
  const todayEvents = useMemo(() => {
    const evs = (events[todayStr] ?? []).slice().sort((a, b) =>
      GRID_HOURS.indexOf(a.startHour) - GRID_HOURS.indexOf(b.startHour)
    );
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const upcoming = evs.filter(e => {
      const [h, m] = e.endHour.split(':').map(Number);
      return h * 60 + m > now;
    });
    const past = evs.filter(e => {
      const [h, m] = e.endHour.split(':').map(Number);
      return h * 60 + m <= now;
    });
    return { upcoming: upcoming.slice(0, 3), past: past.slice(-2), all: evs };
  }, [events, todayStr]);

  // ── Active tasks ───────────────────────────────────────────────────────────
  const featuredTasks = useMemo(() => {
    const inProgress = tasks.filter(t => t.status === 'inprogress');
    const highTodo   = tasks.filter(t => t.status === 'todo' && t.priority === 'high');
    const overdue    = tasks.filter(t =>
      t.status !== 'done' && t.deadline && t.deadline < todayStr
    );
    return { inProgress, highTodo, overdue, shown: [...inProgress, ...highTodo].slice(0, 4) };
  }, [tasks, todayStr]);

  // ── Weekly goals ───────────────────────────────────────────────────────────
  const goalStats = useMemo(() => {
    const weekGoals = goals.filter(g => g.weekId === weekId);
    const completed = weekGoals.filter(g => g.completed).length;
    const rate      = weekGoals.length > 0 ? Math.round((completed / weekGoals.length) * 100) : 0;
    return { total: weekGoals.length, completed, rate, goals: weekGoals.slice(0, 4) };
  }, [goals, weekId]);

  // ── Monthly finances ───────────────────────────────────────────────────────
  const finStats = useMemo(() => {
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const monthTxs = transactions.filter(t => t.date.startsWith(month));
    const income   = monthTxs.filter(t => t.type === 'income' && t.finCategoryId !== LOAN_IN_CAT_ID).reduce((s, t) => s + t.amount, 0);
    const expenses = monthTxs.filter(t => t.type === 'expense' && t.finCategoryId !== LOAN_OUT_CAT_ID).reduce((s, t) => s + t.amount, 0);
    const opening  = monthBalances.find(mb => mb.yearMonth === month)?.openingBalance ?? 0;
    const balance  = opening + income - expenses;
    const maxBar   = Math.max(income, expenses, 1);
    return { income, expenses, balance, maxBar, month };
  }, [transactions, monthBalances, currentDate]);

  // ── Weekly activity ────────────────────────────────────────────────────────
  const weeklyActivity = useMemo(() => {
    const weekDays = getWeekDays(currentDate);
    let total = 0, completed = 0;
    weekDays.forEach(day => {
      const dateId = formatDateId(day);
      const evs = events[dateId] ?? [];
      total += evs.length;
      completed += evs.filter(e => e.completed).length;
    });
    const rate = total > 0 ? Math.round((completed / total) * 100) : null;
    return { total, completed, rate };
  }, [events, currentDate]);

  const hasWeekData = weeklyActivity.total > 0 || goalStats.total > 0 || finStats.income > 0 || finStats.expenses > 0;

  const isNewUser = todayEvents.all.length === 0 && tasks.length === 0 && goals.length === 0 && transactions.length === 0;

  // ── Daily score ────────────────────────────────────────────────────────────
  const dailyScore = useMemo(() => {
    const activeHabits = habits.filter(h => todayStr >= h.startDate);
    const habitsDone = activeHabits.filter(h =>
      habitLogs.some(l => l.habitId === h.id && l.date === todayStr)
    ).length;
    const habitsTotal = activeHabits.length;
    const eventsDone = todayEvents.all.filter(e => e.completed).length;
    const eventsTotal = todayEvents.all.length;
    const total = habitsTotal + eventsTotal;
    const done = habitsDone + eventsDone;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { pct, done, total, habitsDone, habitsTotal, eventsDone, eventsTotal };
  }, [habits, habitLogs, todayStr, todayEvents]);

  // ── Habits helpers ─────────────────────────────────────────────────────────
  const activeHabits = useMemo(() => habits.filter(h => todayStr >= h.startDate), [habits, todayStr]);
  const todayLogIds = useMemo(() => new Set(habitLogs.filter(l => l.date === todayStr).map(l => l.habitId)), [habitLogs, todayStr]);

  const toggleHabit = (habitId: string) => {
    const exists = habitLogs.some(l => l.habitId === habitId && l.date === todayStr);
    if (exists) {
      setHabitLogs(prev => prev.filter(l => !(l.habitId === habitId && l.date === todayStr)));
    } else {
      setHabitLogs(prev => [...prev, { id: generateId(), habitId, date: todayStr }]);
      const emojis = ['🔥', '💪', '✅', '🚀', '⭐'];
      const msgs = [
        '¡Un día más sumado a tu identidad!',
        '¡La consistencia es tu superpoder!',
        '¡Otro hábito ganado!',
        '¡Sigue construyendo tu mejor versión!',
        '¡Excelente! La disciplina lo es todo.',
      ];
      const idx = Math.floor(Math.random() * msgs.length);
      toast(`${emojis[idx]} ${msgs[idx]}`, { duration: 2000 });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto p-4 md:p-8 pb-28 md:pb-12 space-y-4 md:space-y-5">

        {/* ── Bienvenida usuario nuevo ── */}
        {isNewUser && (
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-indigo-100 p-4 rounded-2xl">
                <Sparkles size={32} className="text-indigo-600" />
              </div>
            </div>
            <div>
              <p className="font-black text-slate-800 text-lg">Bienvenido a LifeOS</p>
              <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto leading-relaxed">
                Tu sistema de vida personal. Elige por dónde empezar.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {[
                { label: 'Agenda tu día', icon: CalendarDays, section: 'tiempo' as SectionKey, color: 'bg-indigo-500' },
                { label: 'Registra un gasto', icon: DollarSign, section: 'dinero' as SectionKey, color: 'bg-emerald-500' },
                { label: 'Define objetivos', icon: Target, section: 'objetivos' as SectionKey, color: 'bg-violet-500' },
                { label: 'Añade una tarea', icon: CheckSquare, section: 'lista' as SectionKey, color: 'bg-blue-500' },
              ].map(({ label, icon: Icon, section, color }) => (
                <button
                  key={section}
                  onClick={() => onNavigate(section)}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left active:scale-95"
                >
                  <div className={`${color} p-2 rounded-xl shrink-0`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <span className="text-xs font-black text-slate-700">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isNewUser && (
          <>
            {/* ═══════════════════════════════════════════════════════════════
                FILA 1: HERO BANNER
            ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-r from-indigo-950 to-indigo-800 rounded-3xl p-5 md:p-8 flex items-center justify-between gap-4 shadow-lg relative overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Left: Greeting */}
              <div className="space-y-1 relative z-10">
                <div className="flex items-center gap-2">
                  <GreetIcon size={18} className="text-indigo-300" />
                  <h2 className="text-lg md:text-xl font-black text-white">
                    {greetText}{userName ? <>, <span className="capitalize">{userName}</span></> : ''}
                  </h2>
                </div>
                <p className="text-[11px] text-indigo-300 font-bold capitalize">{fmtDateLabel(new Date())}</p>

                {/* Streak badge */}
                {streak >= 2 && (
                  <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">
                    <Flame size={14} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-300">{streak} días</span>
                  </div>
                )}

                {/* Mini stat pills */}
                <div className="flex flex-wrap gap-2 mt-3 pt-1">
                  {[
                    { label: `${todayEvents.all.length} evento${todayEvents.all.length !== 1 ? 's' : ''}`, show: true },
                    { label: `${featuredTasks.inProgress.length + featuredTasks.highTodo.length} tarea${(featuredTasks.inProgress.length + featuredTasks.highTodo.length) !== 1 ? 's' : ''}`, show: tasks.filter(t => t.status !== 'done').length > 0 },
                    { label: `${activeHabits.length} hábito${activeHabits.length !== 1 ? 's' : ''}`, show: activeHabits.length > 0 },
                  ].filter(p => p.show).map(({ label }) => (
                    <span key={label} className="text-[10px] font-bold text-indigo-200 bg-white/10 rounded-full px-2.5 py-1">
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: Progress ring */}
              <div className="shrink-0 relative w-20 h-20 md:w-24 md:h-24">
                <ProgressRing
                  size={96}
                  strokeWidth={8}
                  percentage={dailyScore.pct}
                  gradientId="heroScoreGrad"
                  colorFrom="#818cf8"
                  colorTo="#a78bfa"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg md:text-xl font-black text-white leading-none">{dailyScore.pct}%</span>
                  <span className="text-[8px] font-bold text-indigo-300 uppercase tracking-widest mt-0.5">hoy</span>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                FILA 2: AGENDA + HÁBITOS
            ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ── Agenda de hoy (timeline) ── */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <button
                  className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                  onClick={() => onNavigate('tiempo')}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-indigo-500" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Agenda</span>
                    {todayEvents.all.length > 0 && (
                      <span className="text-[10px] font-black text-indigo-400 bg-indigo-50 rounded-full px-2 py-0.5">
                        {todayEvents.all.filter(e => e.completed).length}/{todayEvents.all.length}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>

                <div className="px-5 pb-5 flex-1">
                  {todayEvents.all.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-4 text-center h-full flex flex-col items-center justify-center">
                      <Clock size={24} className="text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400 font-bold">Sin actividades hoy</p>
                      <button
                        onClick={() => onNavigate('tiempo')}
                        className="mt-2 text-[11px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest"
                      >
                        + Agendar actividad
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {todayEvents.all.slice(0, 5).map((ev) => {
                        const cat = categories[ev.category] ?? { color: '#94a3b8', short: '??' };
                        const isNext = !ev.completed && todayEvents.upcoming[0]?.id === ev.id;
                        return (
                          <div
                            key={ev.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                              isNext ? 'bg-indigo-50/60 ring-1 ring-indigo-100' : ''
                            }`}
                          >
                            <span className="text-[10px] font-bold text-slate-400 w-10 shrink-0 text-right tabular-nums">
                              {eventTime(ev.startHour)}
                            </span>
                            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <p className={`text-sm font-bold truncate flex-1 ${
                              ev.completed ? 'line-through text-slate-400' : 'text-slate-700'
                            }`}>
                              {ev.task}
                            </p>
                            {ev.completed && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                            {isNext && (
                              <span className="text-[8px] font-black text-indigo-500 bg-indigo-100 rounded-full px-1.5 py-0.5 uppercase shrink-0">
                                Ahora
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {todayEvents.all.length > 5 && (
                        <button
                          onClick={() => onNavigate('tiempo')}
                          className="text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest pl-14 pt-1"
                        >
                          +{todayEvents.all.length - 5} más →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Hábitos del día ── */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <button
                  className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                  onClick={() => onNavigate('habitos')}
                >
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-indigo-500" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Hábitos</span>
                    {activeHabits.length > 0 && (
                      <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${
                        dailyScore.habitsDone === dailyScore.habitsTotal && dailyScore.habitsTotal > 0
                          ? 'text-emerald-600 bg-emerald-50'
                          : 'text-indigo-500 bg-indigo-50'
                      }`}>
                        {dailyScore.habitsDone}/{dailyScore.habitsTotal}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>

                <div className="px-5 pb-5 flex-1">
                  {activeHabits.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-4 text-center h-full flex flex-col items-center justify-center">
                      <Flame size={24} className="text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400 font-bold">Sin hábitos activos</p>
                      <button
                        onClick={() => onNavigate('habitos')}
                        className="mt-2 text-[11px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest"
                      >
                        + Crear hábito
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeHabits.map(h => {
                        const done = todayLogIds.has(h.id);
                        return (
                          <button
                            key={h.id}
                            onClick={() => toggleHabit(h.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                              done
                                ? `${h.color} border-transparent text-white shadow-sm`
                                : 'border-slate-100 bg-slate-50/60 hover:border-indigo-200 hover:bg-indigo-50/40'
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 size={18} strokeWidth={2.5} className="shrink-0" />
                            ) : (
                              <Circle size={18} strokeWidth={2} className="text-slate-300 shrink-0" />
                            )}
                            <span className={`text-sm font-bold flex-1 text-left truncate ${done ? '' : 'text-slate-700'}`}>
                              {h.name}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${done ? 'text-white/80' : 'text-slate-400'}`}>
                              {h.target}d/sem
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                FILA 3: TAREAS + OBJETIVOS
            ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ── Tareas activas ── */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <button
                  className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                  onClick={() => onNavigate('lista')}
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare size={16} className="text-violet-500" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Tareas</span>
                    {featuredTasks.overdue.length > 0 && (
                      <span className="text-[10px] font-black text-red-500 bg-red-50 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <AlertCircle size={9} />
                        {featuredTasks.overdue.length} vencida{featuredTasks.overdue.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>

                <div className="px-5 pb-5 flex-1">
                  {featuredTasks.shown.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-4 text-center h-full flex flex-col items-center justify-center">
                      <CheckCircle2 size={24} className="text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400 font-bold">Todo al día</p>
                      <button
                        onClick={() => onNavigate('lista')}
                        className="mt-2 text-[11px] font-black text-violet-500 hover:text-violet-700 uppercase tracking-widest"
                      >
                        + Nueva tarea
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {featuredTasks.shown.map(task => {
                        const pri = PRIORITY_CONFIG[task.priority];
                        const StatusIcon = task.status === 'inprogress' ? Loader : task.status === 'todo' ? Circle : Inbox;
                        return (
                          <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all">
                            <StatusIcon size={14} className={task.status === 'inprogress' ? 'text-blue-400 shrink-0' : 'text-slate-300 shrink-0'} />
                            <p className="text-sm font-bold text-slate-700 flex-1 truncate">{task.title}</p>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${pri.dot}`} />
                          </div>
                        );
                      })}
                      {tasks.filter(t => t.status !== 'done').length > 4 && (
                        <button
                          onClick={() => onNavigate('lista')}
                          className="text-[10px] font-black text-violet-400 hover:text-violet-600 uppercase tracking-widest pl-7 pt-1"
                        >
                          +{tasks.filter(t => t.status !== 'done').length - 4} más →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Objetivos semanales (con anillo) ── */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <button
                  className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                  onClick={() => onNavigate('objetivos')}
                >
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-violet-500" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Objetivos</span>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>

                <div className="px-5 pb-5 flex-1">
                  {goalStats.total === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-4 text-center h-full flex flex-col items-center justify-center">
                      <Target size={24} className="text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400 font-bold">Sin objetivos esta semana</p>
                      <button
                        onClick={() => onNavigate('objetivos')}
                        className="mt-2 text-[11px] font-black text-violet-500 hover:text-violet-700 uppercase tracking-widest"
                      >
                        + Definir objetivos
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Ring + stats */}
                      <div className="flex items-center gap-4">
                        <div className="relative w-14 h-14 shrink-0">
                          <MiniRing size={56} strokeWidth={6} percentage={goalStats.rate} color="#8b5cf6" />
                          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-violet-600">
                            {goalStats.rate}%
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-700">
                            {goalStats.completed} <span className="text-slate-300">/ {goalStats.total}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">completados esta semana</p>
                        </div>
                      </div>

                      {/* Goal list */}
                      {goalStats.goals.slice(0, 3).map(g => (
                        <div key={g.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all">
                          {g.completed
                            ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            : <Circle size={14} className="text-slate-300 shrink-0" />
                          }
                          <p className={`text-sm truncate flex-1 ${g.completed ? 'line-through text-slate-400' : 'text-slate-700 font-bold'}`}>
                            {g.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                FILA 4: FINANZAS (horizontal)
            ═══════════════════════════════════════════════════════════════ */}
            <button
              onClick={() => onNavigate('dinero')}
              className="w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all active:scale-[0.995] text-left"
            >
              <div className="flex items-center gap-2 mb-4">
                <DollarSign size={16} className="text-emerald-500" />
                <span className="text-sm font-black text-slate-700 uppercase tracking-wide">
                  {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <ChevronRight size={14} className="text-slate-300 ml-auto" />
              </div>

              {finStats.income === 0 && finStats.expenses === 0 ? (
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-sm text-slate-400 font-bold">Sin movimientos este mes</p>
                  <span className="mt-2 text-[11px] font-black text-emerald-500 uppercase tracking-widest">
                    + Registrar movimiento
                  </span>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Income */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <TrendingUp size={16} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingresos</p>
                      <p className="text-sm font-black text-emerald-600">${fmtCurrency(finStats.income)}</p>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <TrendingDown size={16} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos</p>
                      <p className="text-sm font-black text-red-500">${fmtCurrency(finStats.expenses)}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:block w-px h-10 bg-slate-100" />

                  {/* Balance */}
                  <div className="flex items-center gap-3 flex-1 md:justify-end">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                      <p className={`text-xl font-black ${finStats.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {finStats.balance >= 0 ? '+' : ''}{fmtCurrency(finStats.balance)}
                      </p>
                    </div>
                  </div>

                  {/* Proportion bar — mobile only */}
                  <div className="w-full md:hidden h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-400 rounded-l-full transition-all duration-700"
                      style={{ width: `${(finStats.income / (finStats.income + finStats.expenses || 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-400 rounded-r-full transition-all duration-700"
                      style={{ width: `${(finStats.expenses / (finStats.income + finStats.expenses || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </button>

            {/* ═══════════════════════════════════════════════════════════════
                FILA 5: RESUMEN SEMANAL
            ═══════════════════════════════════════════════════════════════ */}
            {hasWeekData && (
              <button
                onClick={() => onNavigate('revision')}
                className="w-full bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-5 text-left hover:shadow-md transition-all active:scale-[0.995]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-indigo-500" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Esta semana</span>
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 flex items-center gap-0.5">
                    Ver análisis <ChevronRight size={11} />
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      value: weeklyActivity.rate !== null ? `${weeklyActivity.rate}%` : '—',
                      label: 'Actividades',
                      rate: weeklyActivity.rate ?? 0,
                    },
                    {
                      value: goalStats.total === 0 ? '—' : `${goalStats.completed}/${goalStats.total}`,
                      label: 'Objetivos',
                      rate: goalStats.rate,
                    },
                    {
                      value: finStats.income === 0 && finStats.expenses === 0
                        ? '—'
                        : `${finStats.balance >= 0 ? '+' : ''}$${fmtCurrency(Math.abs(finStats.balance))}`,
                      label: 'Balance',
                      rate: finStats.balance >= 0 ? 70 : 30,
                    },
                  ].map(({ value, label, rate }) => (
                    <div key={label} className="text-center">
                      <p className={`text-xl md:text-2xl font-black ${
                        value === '—' ? 'text-slate-300' :
                        rate >= 70 ? 'text-emerald-600' :
                        rate >= 40 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {value}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Hoy;
