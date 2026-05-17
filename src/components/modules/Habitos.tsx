import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, Circle, Plus, Edit2, TrendingUp, ChevronLeft, ChevronRight,
  Flame, BarChart3, Activity, X, Trash2, Target, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Habit, HabitLog } from '../../types';
import { generateId } from '../../lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const HABIT_COLORS = [
  { bg: 'bg-indigo-500',  hex: '#6366f1', label: 'Índigo'    },
  { bg: 'bg-emerald-500', hex: '#10b981', label: 'Esmeralda' },
  { bg: 'bg-amber-500',   hex: '#f59e0b', label: 'Ámbar'     },
  { bg: 'bg-rose-500',    hex: '#f43f5e', label: 'Rosa'      },
  { bg: 'bg-violet-500',  hex: '#8b5cf6', label: 'Violeta'   },
];

const HABIT_DONE_MSGS = [
  '¡Un día más sumado a tu identidad!',
  '¡La consistencia es tu superpoder!',
  '¡Otro hábito ganado!',
  '¡Sigue construyendo tu mejor versión!',
  '¡Excelente! La disciplina lo es todo.',
];

// ─── Date Utilities ───────────────────────────────────────────────────────────

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getNextMonday = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
};

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewType = 'week' | 'month' | 'year';

interface HabitForm {
  name: string;
  target: number;
  color: string;
  startDate: string;
}

interface HabitosProps {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  habitLogs: HabitLog[];
  setHabitLogs: React.Dispatch<React.SetStateAction<HabitLog[]>>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Logs agrupados por fecha: { "YYYY-MM-DD": [habitId1, habitId2] } */
const groupLogsByDate = (logs: HabitLog[]): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  for (const l of logs) {
    if (!map[l.date]) map[l.date] = [];
    map[l.date].push(l.habitId);
  }
  return map;
};

const hexForColor = (bgClass: string): string =>
  HABIT_COLORS.find(c => c.bg === bgClass)?.hex ?? '#6366f1';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Habitos({ habits, setHabits, habitLogs, setHabitLogs }: HabitosProps) {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewType>('week');
  const [showModal, setShowModal] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitForm, setHabitForm] = useState<HabitForm>({
    name: '',
    target: 3,
    color: 'bg-indigo-500',
    startDate: formatDate(new Date()),
  });
  const [habitNameError, setHabitNameError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedHabitIdForYear, setSelectedHabitIdForYear] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ─── Derived ────────────────────────────────────────────────────────────────
  const logsByDate = useMemo(() => groupLogsByDate(habitLogs), [habitLogs]);

  // Set initial habit for year view
  useEffect(() => {
    if (habits.length > 0 && !selectedHabitIdForYear) {
      setSelectedHabitIdForYear(habits[0].id);
    }
    if (selectedHabitIdForYear && !habits.find(h => h.id === selectedHabitIdForYear)) {
      setSelectedHabitIdForYear(habits[0]?.id ?? null);
    }
  }, [habits, selectedHabitIdForYear]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  // ─── Periods ────────────────────────────────────────────────────────────────
  const currentWeekStart = useMemo(() => getStartOfWeek(currentDate), [currentDate]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeekStart]);

  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const padding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1));
    return { name: MONTHS[month], year, days, grid: [...Array(padding).fill(null), ...days] as (Date | null)[] };
  }, [currentDate]);

  const yearMonths = useMemo(() => {
    const year = currentDate.getFullYear();
    return MONTHS.map((name, index) => {
      const firstDay = new Date(year, index, 1);
      const lastDay = new Date(year, index + 1, 0);
      const padding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
      const days = Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, index, i + 1));
      return { name, index, days, grid: [...Array(padding).fill(null), ...days] as (Date | null)[] };
    });
  }, [currentDate]);

  // Current streak (consecutive days with at least 1 habit logged)
  const currentStreak = useMemo((): number => {
    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    if (!logsByDate[formatDate(checkDate)] || logsByDate[formatDate(checkDate)].length === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const dateStr = formatDate(checkDate);
      const activeHabitsOnDate = habits.filter(h => dateStr >= h.startDate);
      if (activeHabitsOnDate.length === 0) break;
      if (logsByDate[dateStr] && logsByDate[dateStr].length > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [logsByDate, habits]);

  // ─── Stats Helpers ──────────────────────────────────────────────────────────
  const getHabitStats = (habit: Habit, datesArray: (Date | null)[]) => {
    const actualDates = datesArray.filter((d): d is Date => d !== null);
    const activeDates = actualDates.filter(d => formatDate(d) >= habit.startDate);
    const doneCount = activeDates.filter(d => logsByDate[formatDate(d)]?.includes(habit.id)).length;
    const periodTarget = Math.ceil((activeDates.length / 7) * habit.target);
    const percentage = periodTarget > 0 ? Math.min(100, Math.round((doneCount / periodTarget) * 100)) : 0;
    return { doneCount, periodTarget, percentage };
  };

  const calculatePeriodScore = (dates: (Date | null)[]): number => {
    if (habits.length === 0) return 0;
    const total = habits.reduce((acc, h) => acc + getHabitStats(h, dates).percentage, 0);
    return Math.round(total / habits.length);
  };

  const getLogCount = (dates: (Date | null)[]): number =>
    dates.filter(d => d && logsByDate[formatDate(d)]?.length > 0).length;

  // ─── Callbacks ──────────────────────────────────────────────────────────────
  const toggleLog = (dateStr: string, habitId: string): void => {
    const exists = habitLogs.some(l => l.habitId === habitId && l.date === dateStr);
    if (exists) {
      setHabitLogs(prev => prev.filter(l => !(l.habitId === habitId && l.date === dateStr)));
    } else {
      setHabitLogs(prev => [...prev, { id: generateId(), habitId, date: dateStr }]);
      toast.success(pickRandom(HABIT_DONE_MSGS));
    }
  };

  const handleOpenNew = () => {
    setEditingHabitId(null);
    setHabitForm({ name: '', target: 3, color: 'bg-indigo-500', startDate: formatDate(new Date()) });
    setHabitNameError(null);
    setDeleteConfirm(false);
    setShowModal(true);
  };

  const handleOpenEdit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setHabitForm({ name: habit.name, target: habit.target, color: habit.color, startDate: habit.startDate });
    setHabitNameError(null);
    setDeleteConfirm(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setHabitNameError(null);
    setDeleteConfirm(false);
  };

  const handleSaveHabit = () => {
    if (!habitForm.name.trim()) {
      setHabitNameError('El nombre es requerido');
      return;
    }
    if (editingHabitId) {
      setHabits(prev => prev.map(h => h.id === editingHabitId
        ? { ...h, name: habitForm.name.trim(), target: habitForm.target, color: habitForm.color, startDate: habitForm.startDate }
        : h));
      toast.success('Hábito actualizado');
    } else {
      const newHabit: Habit = {
        id: generateId(),
        name: habitForm.name.trim(),
        target: habitForm.target,
        color: habitForm.color,
        startDate: habitForm.startDate,
        createdAt: new Date().toISOString(),
      };
      setHabits(prev => [...prev, newHabit]);
      if (!selectedHabitIdForYear) setSelectedHabitIdForYear(newHabit.id);
      toast.success('¡Hábito creado!');
    }
    handleCloseModal();
  };

  const handleDeleteHabit = () => {
    if (!editingHabitId) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setHabits(prev => prev.filter(h => h.id !== editingHabitId));
    setHabitLogs(prev => prev.filter(l => l.habitId !== editingHabitId));
    toast.success('Hábito eliminado');
    handleCloseModal();
  };

  const changeDate = (offset: number): void => {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() + (offset * 7));
    else if (view === 'month') d.setMonth(d.getMonth() + offset);
    else d.setFullYear(d.getFullYear() + offset);
    setCurrentDate(d);
  };

  const todayStr = formatDate(new Date());

  const selectedHabitForYear = habits.find(h => h.id === selectedHabitIdForYear) ?? null;

  const annualCurvePoints = useMemo(() => {
    if (!selectedHabitForYear) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return yearMonths.map((m) => {
      const pastDays = m.days.filter(d => d <= today);
      if (pastDays.length === 0) return { monthIndex: m.index, percentage: null as number | null, hasData: false };
      const { percentage } = getHabitStats(selectedHabitForYear, pastDays);
      return { monthIndex: m.index, percentage, hasData: true };
    });
  }, [yearMonths, logsByDate, selectedHabitForYear]);

  const periodDates = view === 'week' ? weekDates : view === 'month' ? monthData.days : yearMonths.flatMap(m => m.days);
  const periodScore = calculatePeriodScore(periodDates);
  const periodLogCount = getLogCount(periodDates);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-28 md:pb-12">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-xl shadow-lg">
              <Flame size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Hábitos</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Construye tu identidad día a día
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle vista */}
            <div className="flex bg-slate-100 p-1 rounded-full gap-0.5">
              {(['week', 'month', 'year'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-all ${
                    view === v ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {v === 'week' ? 'Semana' : v === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ STATS DASHBOARD ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">% Cumplimiento</p>
            <p className="text-2xl md:text-3xl font-black text-indigo-600">{periodScore}%</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Días de impacto</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-600">{periodLogCount}</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Racha actual</p>
            <div className="flex items-center gap-2">
              <Flame className="text-orange-500" size={22} />
              <p className="text-2xl md:text-3xl font-black text-slate-800">{currentStreak}</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-5 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hábitos activos</p>
            <div className="flex items-center gap-2">
              <Activity className="text-indigo-500" size={20} />
              <p className="text-2xl md:text-3xl font-black text-slate-800">{habits.length}</p>
            </div>
          </div>
        </div>

        {/* ═══ NAVEGADOR DE PERIODO ═══ */}
        <div className="bg-white rounded-3xl border border-slate-100 p-3 md:p-4 shadow-sm flex items-center justify-between">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-95"
          >
            <ChevronLeft size={20} className="text-slate-400" />
          </button>
          <div className="text-center">
            <span className="block text-[9px] font-black text-indigo-500 uppercase tracking-widest">Periodo</span>
            <span className="text-sm md:text-base font-bold text-slate-700 capitalize">
              {view === 'week'
                ? `Semana del ${weekDates[0].getDate()} al ${weekDates[6].getDate()} de ${MONTHS[weekDates[6].getMonth()]}`
                : view === 'month'
                  ? `${monthData.name} ${monthData.year}`
                  : `Año ${currentDate.getFullYear()}`}
            </span>
          </div>
          <button
            onClick={() => changeDate(1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-95"
          >
            <ChevronRight size={20} className="text-slate-400" />
          </button>
        </div>

        {/* ═══ EMPTY STATE ═══ */}
        {habits.length === 0 && (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
              <Sparkles size={28} className="text-indigo-500" />
            </div>
            <h3 className="text-lg font-black text-slate-700 mb-2">Crea tu primer hábito</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 max-w-md mx-auto">
              Cada día que cumples un hábito es un voto a la persona en la que te quieres convertir.
            </p>
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-wide rounded-full shadow-md transition-all"
            >
              <Plus size={16} /> Nuevo Hábito
            </button>
          </div>
        )}

        {/* ═══ VISTA SEMANA ═══ */}
        {habits.length > 0 && view === 'week' && habits.map((habit) => {
          const { doneCount, periodTarget, percentage } = getHabitStats(habit, weekDates);
          const isCompleted = doneCount >= periodTarget && periodTarget > 0;

          return (
            <div
              key={habit.id}
              className="bg-white rounded-3xl border border-slate-100 p-5 md:p-7 shadow-sm group/card"
            >
              {/* Header del hábito */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-12 rounded-full ${habit.color}`} />
                  <div>
                    <h3 className="font-black text-lg text-slate-800 leading-tight">{habit.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      Meta: {habit.target} días/sem · Inicio: {habit.startDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl min-w-[80px]">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cumplimiento</span>
                    <span className={`text-2xl font-black ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {percentage}%
                    </span>
                  </div>
                  <div className="flex-1 md:flex-none">
                    <div className="flex justify-between items-baseline mb-1.5 gap-3">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progreso</span>
                      <span className="text-sm font-black text-slate-700">
                        {doneCount} <span className="text-slate-300">/ {periodTarget}</span>
                      </span>
                    </div>
                    <div className="w-full md:w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : habit.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(habit)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Tracker semana */}
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {weekDates.map((date, idx) => {
                  const dStr = formatDate(date);
                  const isBeforeStart = dStr < habit.startDate;
                  const isFuture = dStr > todayStr;
                  const isDisabled = isBeforeStart || isFuture;
                  const active = !isDisabled && logsByDate[dStr]?.includes(habit.id);
                  return (
                    <button
                      key={idx}
                      disabled={isDisabled}
                      onClick={() => !isDisabled && toggleLog(dStr, habit.id)}
                      title={isFuture ? `Disponible el ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                      className={`w-full flex flex-col items-center p-2 md:p-3 rounded-2xl border-2 transition-all duration-300 ${
                        isBeforeStart
                          ? 'opacity-30 cursor-not-allowed border-slate-100 bg-slate-50'
                          : isFuture
                            ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                            : active
                              ? `${habit.color} border-transparent text-white shadow-lg scale-[1.03]`
                              : 'border-slate-100 bg-white text-slate-400 hover:border-indigo-200 hover:bg-indigo-50/50 active:scale-95'
                      } ${dStr === todayStr && !isDisabled ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-tight opacity-70 mb-1">{DAYS_OF_WEEK[idx]}</span>
                      {active ? (
                        <CheckCircle2 size={20} strokeWidth={2.5} />
                      ) : (
                        <Circle size={20} strokeWidth={2} className={isDisabled ? '' : 'opacity-30'} />
                      )}
                      <span className="text-[11px] mt-1 font-black">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ═══ VISTA MES — grid 2 columnas desktop ═══ */}
        {habits.length > 0 && view === 'month' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {habits.map((habit) => {
              const { doneCount, periodTarget, percentage } = getHabitStats(habit, monthData.days);
              const isCompleted = doneCount >= periodTarget && periodTarget > 0;

              return (
                <div
                  key={habit.id}
                  className="bg-white rounded-3xl border border-slate-100 p-4 md:p-5 shadow-sm"
                >
                  {/* Header compacto */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-10 rounded-full shrink-0 ${habit.color}`} />
                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-slate-800 leading-tight truncate">{habit.name}</h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Meta: {habit.target} días/sem
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-black ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          {percentage}%
                        </span>
                        <span className="text-[8px] font-black text-slate-300">{doneCount}/{periodTarget}</span>
                      </div>
                      <button
                        onClick={() => handleOpenEdit(habit)}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Calendario mes */}
                  <div className="bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {DAYS_OF_WEEK.map(d => (
                        <div key={d} className="text-[8px] font-black text-slate-400 text-center uppercase tracking-widest">{d[0]}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {monthData.grid.map((date, idx) => {
                        if (!date) return <div key={idx} className="aspect-square" />;
                        const dStr = formatDate(date);
                        const isBeforeStart = dStr < habit.startDate;
                        const isFuture = dStr > todayStr;
                        const isDisabled = isBeforeStart || isFuture;
                        const active = !isDisabled && logsByDate[dStr]?.includes(habit.id);
                        return (
                          <button
                            key={idx}
                            disabled={isDisabled}
                            onClick={() => !isDisabled && toggleLog(dStr, habit.id)}
                            className={`aspect-square w-full rounded-md flex items-center justify-center text-[10px] font-black transition-all duration-200 ${
                              isBeforeStart
                                ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'
                                : isFuture
                                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                                  : active
                                    ? `${habit.color} text-white shadow-sm`
                                    : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 active:scale-90'
                            } ${dStr === todayStr && !isDisabled ? 'ring-2 ring-indigo-400' : ''}`}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ VISTA AÑO ═══ */}
        {habits.length > 0 && view === 'year' && (
          <>
            {/* Selector de hábito */}
            <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-5 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                Auditar progreso de:
              </span>
              <div className="flex flex-wrap gap-2">
                {habits.map(h => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHabitIdForYear(h.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 border-2 ${
                      selectedHabitIdForYear === h.id
                        ? `${h.color} border-transparent text-white shadow-md`
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${selectedHabitIdForYear === h.id ? 'bg-white' : h.color}`} />
                    {h.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedHabitForYear ? (
              <>
                {/* Banner anual */}
                {(() => {
                  const yearStats = getHabitStats(selectedHabitForYear, yearMonths.flatMap(m => m.days));
                  return (
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 to-indigo-800 rounded-3xl p-6 md:p-10 text-white shadow-lg">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Sparkles size={100} />
                      </div>
                      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="max-w-xl text-center md:text-left">
                          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
                            <Sparkles size={12} /> Identidad en construcción
                          </div>
                          <h2 className="text-xl md:text-2xl font-black mb-3 leading-tight">
                            Un hábito es la arquitectura diaria que te permite alcanzar constancia.
                          </h2>
                          <p className="text-white/80 text-sm font-medium italic">
                            &quot;Un hábito no es una carrera de una milla, sino una maratón que se construye a lo largo de toda una vida.&quot;
                          </p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-sm border border-white/20 p-6 rounded-2xl flex flex-col items-center min-w-[180px] text-center">
                          <span className="text-[9px] font-black text-white/80 uppercase tracking-widest mb-2">Avance anual</span>
                          <div className="text-4xl font-black mb-2 flex items-baseline">
                            {yearStats.percentage}<span className="text-lg ml-1 text-white/70">%</span>
                          </div>
                          <div className="w-28 h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full transition-all duration-1000"
                              style={{ width: `${yearStats.percentage}%` }}
                            />
                          </div>
                          <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-white/80">
                            {yearStats.doneCount} días ganados
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Curva anual */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-8 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl text-white shadow-md ${selectedHabitForYear.color}`}>
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-black text-slate-800">Curva de dominio anual</h3>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                          Consistencia mensual en {selectedHabitForYear.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progreso</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-transparent" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sin datos</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full">
                    <div className="flex">
                      {/* Y-axis — fixed */}
                      <div className="flex flex-col justify-between h-[220px] md:h-[300px] pr-2 md:pr-3 text-[9px] font-black text-slate-400 border-r border-slate-100 uppercase w-10 shrink-0">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>

                      {/* Chart area — scrollable on mobile */}
                      <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <div className="min-w-[600px] md:min-w-0 relative h-[252px] md:h-[332px] pl-2">
                          {/* Horizontal grid */}
                          <div className="absolute inset-x-0 top-0 h-[220px] md:h-[300px] flex flex-col justify-between pointer-events-none">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <div key={i} className="w-full border-b border-slate-100" />
                            ))}
                          </div>

                          <svg
                            className="w-full overflow-visible relative z-10"
                            style={{ height: 'calc(100% - 32px)' }}
                            viewBox="0 0 1100 300"
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <linearGradient id={`grad-${selectedHabitForYear.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={hexForColor(selectedHabitForYear.color)} stopOpacity="0.2" />
                                <stop offset="100%" stopColor={hexForColor(selectedHabitForYear.color)} stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            {/* Vertical guides */}
                            {MONTHS.map((_, i) => (
                              <line
                                key={i}
                                x1={i * 100} y1="0"
                                x2={i * 100} y2="300"
                                stroke="#e2e8f0"
                                strokeWidth="1"
                              />
                            ))}

                            {/* Area fill */}
                            {(() => {
                              const activePoints = annualCurvePoints.filter(p => p.hasData && p.percentage !== null);
                              if (activePoints.length < 2) return null;
                              const points = activePoints.map(p => ({ x: p.monthIndex * 100, y: 300 - (p.percentage ?? 0) * 3 }));
                              let pathData = `M ${points[0].x},${points[0].y}`;
                              for (let i = 0; i < points.length - 1; i++) {
                                const curr = points[i];
                                const next = points[i + 1];
                                const cp1x = curr.x + (next.x - curr.x) / 2;
                                const cp2x = curr.x + (next.x - curr.x) / 2;
                                pathData += ` C ${cp1x},${curr.y} ${cp2x},${next.y} ${next.x},${next.y}`;
                              }
                              const fillPath = `${pathData} L ${points[points.length - 1].x},300 L ${points[0].x},300 Z`;
                              return <path d={fillPath} fill={`url(#grad-${selectedHabitForYear.id})`} />;
                            })()}

                            {/* Curve line */}
                            {(() => {
                              const activePoints = annualCurvePoints.filter(p => p.hasData && p.percentage !== null);
                              if (activePoints.length < 2) return null;
                              const points = activePoints.map(p => ({ x: p.monthIndex * 100, y: 300 - (p.percentage ?? 0) * 3 }));
                              let pathData = `M ${points[0].x},${points[0].y}`;
                              for (let i = 0; i < points.length - 1; i++) {
                                const curr = points[i];
                                const next = points[i + 1];
                                const cp1x = curr.x + (next.x - curr.x) / 2;
                                const cp2x = curr.x + (next.x - curr.x) / 2;
                                pathData += ` C ${cp1x},${curr.y} ${cp2x},${next.y} ${next.x},${next.y}`;
                              }
                              return (
                                <path
                                  d={pathData}
                                  fill="none"
                                  stroke={hexForColor(selectedHabitForYear.color)}
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              );
                            })()}

                            {/* Data points */}
                            {annualCurvePoints.map((p, i) =>
                              p.hasData && p.percentage !== null ? (
                                <g key={i} className="cursor-pointer group">
                                  <circle
                                    cx={p.monthIndex * 100}
                                    cy={300 - (p.percentage ?? 0) * 3}
                                    r="5"
                                    fill="white"
                                    stroke={hexForColor(selectedHabitForYear.color)}
                                    strokeWidth="2.5"
                                    className="transition-all"
                                  />
                                  <text
                                    x={p.monthIndex * 100}
                                    y={300 - (p.percentage ?? 0) * 3 - 14}
                                    fontSize="11"
                                    textAnchor="middle"
                                    fontWeight="700"
                                    fill={hexForColor(selectedHabitForYear.color)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                  >
                                    {p.percentage}%
                                  </text>
                                </g>
                              ) : (
                                <circle
                                  key={i}
                                  cx={p.monthIndex * 100}
                                  cy="300"
                                  r="3"
                                  fill="#cbd5e1"
                                  opacity="0.5"
                                />
                              )
                            )}
                          </svg>

                          {/* Month labels */}
                          <div className="flex w-full pt-2">
                            {MONTHS.map((m, i) => (
                              <div key={i} className="flex-1 text-center">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${
                                  annualCurvePoints[i]?.hasData ? 'text-slate-500' : 'text-slate-300'
                                }`}>
                                  {m.substring(0, 3)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auditoría mensual */}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-8 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-indigo-600">
                        <BarChart3 size={20} />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-black text-slate-800">Auditoría mensual</h3>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Consistencia diaria del año</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {yearMonths.map(month => {
                      const { doneCount, periodTarget, percentage } = getHabitStats(selectedHabitForYear, month.days);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const monthHasPastDays = month.days.some(d => d <= today);
                      return (
                        <div
                          key={month.index}
                          className={`bg-slate-50/60 p-4 rounded-2xl border border-slate-100 ${!monthHasPastDays ? 'opacity-40' : ''}`}
                        >
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest">{month.name}</h4>
                            {monthHasPastDays && (
                              <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                percentage >= 80
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : percentage >= 50
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                              }`}>
                                {percentage}%
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-7 gap-1 mb-4">
                            {month.grid.map((date, idx) => {
                              if (!date) return <div key={idx} className="aspect-square" />;
                              const dStr = formatDate(date);
                              const isFuture = date > today;
                              const isLogged = logsByDate[dStr]?.includes(selectedHabitForYear.id);
                              return (
                                <div
                                  key={idx}
                                  className={`aspect-square rounded-sm transition-all ${
                                    isFuture
                                      ? 'bg-slate-100 opacity-50'
                                      : isLogged
                                        ? `${selectedHabitForYear.color} shadow-sm`
                                        : 'bg-slate-200/70 hover:bg-slate-300/70'
                                  }`}
                                  title={date.toLocaleDateString()}
                                />
                              );
                            })}
                          </div>

                          <div className="pt-3 border-t border-slate-200/60">
                            <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                              <span>Consistencia</span>
                              <span className="text-slate-600">{doneCount}<span className="text-slate-300"> / {periodTarget}</span></span>
                            </div>
                            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${selectedHabitForYear.color}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                  Crea un hábito para comenzar tu auditoría anual
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ FAB ═══ */}
      <button
        onClick={handleOpenNew}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all z-[100]"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* ═══ MODAL CRUD ═══ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[200] animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-3 shrink-0 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">
                {editingHabitId ? 'Editar hábito' : 'Nuevo hábito'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Meditar, Leer, Hacer ejercicio..."
                  className={`w-full px-4 py-3 bg-slate-50 border-2 rounded-2xl focus:outline-none font-semibold text-slate-800 placeholder:text-slate-400 transition-all ${
                    habitNameError ? 'border-red-300 focus:border-red-400' : 'border-slate-100 focus:border-indigo-400 focus:bg-white'
                  }`}
                  value={habitForm.name}
                  onChange={e => {
                    setHabitForm({ ...habitForm, name: e.target.value });
                    if (habitNameError) setHabitNameError(null);
                  }}
                  autoFocus
                />
                {habitNameError && <p className="mt-2 text-xs font-bold text-red-500">{habitNameError}</p>}
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta semanal</label>
                  <span className="text-indigo-600 font-black text-sm">{habitForm.target} días</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="7"
                  className="w-full accent-indigo-600"
                  value={habitForm.target}
                  onChange={e => setHabitForm({ ...habitForm, target: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Color</label>
                <div className="flex gap-2 justify-center">
                  {HABIT_COLORS.map(c => (
                    <button
                      key={c.bg}
                      onClick={() => setHabitForm({ ...habitForm, color: c.bg })}
                      className={`w-10 h-10 rounded-xl transition-all ${c.bg} ${
                        habitForm.color === c.bg ? 'ring-4 ring-indigo-200 scale-110' : 'opacity-40 hover:opacity-100'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Fecha de inicio</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHabitForm({ ...habitForm, startDate: formatDate(new Date()) })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition-all ${
                        habitForm.startDate === formatDate(new Date())
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                          : 'border-slate-100 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => setHabitForm({ ...habitForm, startDate: getNextMonday() })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition-all ${
                        habitForm.startDate === getNextMonday()
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                          : 'border-slate-100 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      El lunes
                    </button>
                  </div>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-400 focus:bg-white outline-none transition-all"
                    value={habitForm.startDate}
                    onChange={e => setHabitForm({ ...habitForm, startDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pt-3 pb-6 shrink-0 border-t border-slate-100 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleSaveHabit}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-wide text-sm shadow-md transition-all active:scale-95"
                >
                  Guardar
                </button>
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-3 text-slate-500 hover:bg-slate-100 rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
              {editingHabitId && (
                <button
                  onClick={handleDeleteHabit}
                  className={`w-full py-2 text-xs font-black uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    deleteConfirm
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'text-red-500/70 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash2 size={14} />
                  {deleteConfirm ? '¿Confirmar eliminación?' : 'Eliminar hábito'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
