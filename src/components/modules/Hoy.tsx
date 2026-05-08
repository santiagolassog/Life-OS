import React, { useMemo } from 'react';
import {
  CalendarDays, CheckSquare, Target, DollarSign,
  ChevronRight, TrendingUp, TrendingDown, Sparkles,
  Clock, Circle, Loader, CheckCircle2, Inbox,
  AlertCircle, Sun, Moon, Sunset, BarChart3,
} from 'lucide-react';
import type { Events, Categories, Task, Goal, Transaction, FinCategory, MonthBalance } from '../../types';
import { formatDateId, getWeekId, getWeekDays, fmtCurrency, GRID_HOURS, PRIORITY_CONFIG } from '../../lib/utils';
import { LOAN_IN_CAT_ID, LOAN_OUT_CAT_ID } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionKey = 'hoy' | 'tiempo' | 'dinero' | 'objetivos' | 'lista' | 'revision';

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

// ─── Component ────────────────────────────────────────────────────────────────

const Hoy: React.FC<HoyProps> = ({
  userName, streak, events, categories, tasks, goals,
  transactions, finCategories, monthBalances, currentDate, onNavigate,
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
    // Separate upcoming vs past
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

  // ── Resumen semanal (para card "Esta semana") ──────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto p-4 md:p-8 pb-28 md:pb-12 space-y-5">

        {/* ── Greeting ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
              <GreetIcon size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                {greetText}{userName ? <>, <span className="capitalize">{userName}</span></> : ''}
              </h2>
              <p className="text-[11px] text-slate-400 font-bold capitalize">
                {fmtDateLabel(new Date())}
              </p>
            </div>
          </div>

          {/* Badge de racha */}
          {streak >= 2 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 ${
              streak >= 7
                ? 'bg-amber-100 border border-amber-200'
                : 'bg-orange-50 border border-orange-100'
            }`}>
              <span className="text-base leading-none">🔥</span>
              <div className="text-right">
                <p className={`text-xs font-black leading-none ${streak >= 7 ? 'text-amber-600' : 'text-orange-500'}`}>
                  {streak} días
                </p>
                {streak >= 7 && (
                  <p className="text-[8px] font-bold text-amber-400 uppercase tracking-wide leading-none mt-0.5">racha</p>
                )}
              </div>
            </div>
          )}
        </div>

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
            {/* ── Agenda de hoy ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                onClick={() => onNavigate('tiempo')}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-indigo-500" />
                  <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Hoy</span>
                  {todayEvents.all.length > 0 && (
                    <span className="text-[10px] font-black text-indigo-400 bg-indigo-50 rounded-full px-2 py-0.5">
                      {todayEvents.all.length} {todayEvents.all.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </button>

              {todayEvents.all.length === 0 ? (
                <div className="px-5 pb-5">
                  <div className="bg-slate-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-slate-400 font-bold">Sin actividades agendadas hoy</p>
                    <button
                      onClick={() => onNavigate('tiempo')}
                      className="mt-2 text-[11px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest"
                    >
                      + Agendar actividad
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 pb-5 space-y-2">
                  {todayEvents.upcoming.map(ev => {
                    const cat = categories[ev.category] ?? { color: '#94a3b8', short: '??' };
                    return (
                      <div key={ev.id} className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${ev.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {ev.task}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {eventTime(ev.startHour)} – {eventTime(ev.endHour)}
                          </p>
                        </div>
                        {ev.completed && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                      </div>
                    );
                  })}
                  {todayEvents.all.length > 3 && (
                    <button
                      onClick={() => onNavigate('tiempo')}
                      className="text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest pl-4"
                    >
                      +{todayEvents.all.length - 3} más →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Tareas activas + objetivos (grid) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Tareas */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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

                {featuredTasks.shown.length === 0 ? (
                  <div className="px-5 pb-5">
                    <div className="bg-slate-50 rounded-2xl p-4 text-center">
                      <p className="text-sm text-slate-400 font-bold">Todo al día 🎉</p>
                      <button
                        onClick={() => onNavigate('lista')}
                        className="mt-2 text-[11px] font-black text-violet-500 hover:text-violet-700 uppercase tracking-widest"
                      >
                        + Nueva tarea
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pb-5 space-y-2">
                    {featuredTasks.shown.map(task => {
                      const pri = PRIORITY_CONFIG[task.priority];
                      const StatusIcon = task.status === 'inprogress' ? Loader : task.status === 'todo' ? Circle : Inbox;
                      return (
                        <div key={task.id} className="flex items-center gap-2.5">
                          <StatusIcon size={12} className={task.status === 'inprogress' ? 'text-blue-400' : 'text-slate-300'} />
                          <p className="text-sm font-bold text-slate-700 flex-1 truncate">{task.title}</p>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pri.dot}`} />
                        </div>
                      );
                    })}
                    {tasks.filter(t => t.status !== 'done').length > 4 && (
                      <button
                        onClick={() => onNavigate('lista')}
                        className="text-[10px] font-black text-violet-400 hover:text-violet-600 uppercase tracking-widest pl-4"
                      >
                        +{tasks.filter(t => t.status !== 'done').length - 4} más →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Objetivos */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                  onClick={() => onNavigate('objetivos')}
                >
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-violet-500" />
                    <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Esta semana</span>
                    {goalStats.total > 0 && (
                      <span className="text-[10px] font-black text-violet-500 bg-violet-50 rounded-full px-2 py-0.5">
                        {goalStats.rate}%
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>

                {goalStats.total === 0 ? (
                  <div className="px-5 pb-5">
                    <div className="bg-slate-50 rounded-2xl p-4 text-center">
                      <p className="text-sm text-slate-400 font-bold">Sin objetivos esta semana</p>
                      <button
                        onClick={() => onNavigate('objetivos')}
                        className="mt-2 text-[11px] font-black text-violet-500 hover:text-violet-700 uppercase tracking-widest"
                      >
                        + Definir objetivos
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pb-5 space-y-3">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-700"
                        style={{ width: `${goalStats.rate}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">
                      {goalStats.completed} de {goalStats.total} completados
                    </p>
                    {goalStats.goals.slice(0, 3).map(g => (
                      <div key={g.id} className="flex items-center gap-2">
                        {g.completed
                          ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          : <Circle size={13} className="text-slate-300 shrink-0" />
                        }
                        <p className={`text-sm truncate ${g.completed ? 'line-through text-slate-400' : 'text-slate-700 font-bold'}`}>
                          {g.title}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Finanzas del mes ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 pt-5 pb-3"
                onClick={() => onNavigate('dinero')}
              >
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-500" />
                  <span className="text-sm font-black text-slate-700 uppercase tracking-wide">
                    {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${finStats.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {finStats.balance >= 0 ? '+' : ''}{fmtCurrency(finStats.balance)}
                  </span>
                  {finStats.balance >= 0
                    ? <TrendingUp size={14} className="text-emerald-500" />
                    : <TrendingDown size={14} className="text-red-400" />
                  }
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </button>

              {finStats.income === 0 && finStats.expenses === 0 ? (
                <div className="px-5 pb-5">
                  <div className="bg-slate-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-slate-400 font-bold">Sin movimientos este mes</p>
                    <button
                      onClick={() => onNavigate('dinero')}
                      className="mt-2 text-[11px] font-black text-emerald-500 hover:text-emerald-700 uppercase tracking-widest"
                    >
                      + Registrar movimiento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 pb-5 space-y-3">
                  {[
                    { label: 'Ingresos', amount: finStats.income, color: 'bg-emerald-400', textColor: 'text-emerald-600' },
                    { label: 'Gastos',   amount: finStats.expenses, color: 'bg-red-400',    textColor: 'text-red-500' },
                  ].map(({ label, amount, color, textColor }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
                        <span className={`text-sm font-black ${textColor}`}>${fmtCurrency(amount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color} transition-all duration-700`}
                          style={{ width: `${Math.min((amount / finStats.maxBar) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ── Card "Esta semana" ── */}
            {hasWeekData && (
              <button
                onClick={() => onNavigate('revision')}
                className="w-full bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-5 text-left hover:shadow-md transition-all active:scale-[0.99]"
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
                  {/* Actividades */}
                  <div className="text-center">
                    <p className={`text-2xl font-black ${
                      weeklyActivity.rate === null ? 'text-slate-300' :
                      weeklyActivity.rate >= 70 ? 'text-emerald-600' :
                      weeklyActivity.rate >= 40 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {weeklyActivity.rate !== null ? `${weeklyActivity.rate}%` : '—'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Actividades</p>
                  </div>

                  {/* Objetivos */}
                  <div className="text-center border-x border-indigo-100">
                    <p className={`text-2xl font-black ${
                      goalStats.total === 0 ? 'text-slate-300' :
                      goalStats.rate >= 70 ? 'text-emerald-600' :
                      goalStats.rate >= 40 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {goalStats.total === 0 ? '—' : `${goalStats.completed}/${goalStats.total}`}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Objetivos</p>
                  </div>

                  {/* Balance */}
                  <div className="text-center">
                    <p className={`text-2xl font-black truncate ${
                      finStats.income === 0 && finStats.expenses === 0 ? 'text-slate-300' :
                      finStats.balance >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {finStats.income === 0 && finStats.expenses === 0
                        ? '—'
                        : `${finStats.balance >= 0 ? '+' : '-'}$${fmtCurrency(Math.abs(finStats.balance))}`
                      }
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Balance</p>
                  </div>
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
