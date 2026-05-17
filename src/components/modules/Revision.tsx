import React, { useMemo, useState, useCallback } from 'react';
import {
  PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, Clock, DollarSign, Lightbulb,
  CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, Zap, Star, Download, Flame
} from 'lucide-react';
import type { Events, Categories, Transaction, FinCategory, Goal, Task, Habit, HabitLog } from '../../types';
import { LOAN_IN_CAT_ID, LOAN_OUT_CAT_ID } from '../../types';
import { getWeekId, getWeekDays, formatDateId, GRID_HOURS, fmtCurrency as fmt } from '../../lib/utils';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PERA = {
  plan: { label: 'PLANEAR', badge: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
  execute: { label: 'EJECUTAR', badge: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
  review: { label: 'REVISAR', badge: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600' },
  adjust: { label: 'AJUSTAR', badge: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' },
};

interface RevisionProps {
  events: Events;
  categories: Categories;
  transactions: Transaction[];
  finCategories: FinCategory[];
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  currentDate: Date;
  onDownloadReport: () => void;
  isExporting: boolean;
}

type Range = 'week' | 'month' | 'year';

const Revision: React.FC<RevisionProps> = ({
  events, categories, transactions, finCategories, goals, tasks, habits, habitLogs, currentDate,
  onDownloadReport, isExporting
}) => {
  const [range, setRange] = useState<Range>('week');
  const [viewDate, setViewDate] = useState(new Date(currentDate));

  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);
  const weekId = useMemo(() => getWeekId(viewDate), [viewDate]);

  const prevPeriod = () => {
    const d = new Date(viewDate);
    if (range === 'week') d.setDate(d.getDate() - 7);
    else if (range === 'month') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setViewDate(d);
  };
  const nextPeriod = () => {
    const d = new Date(viewDate);
    if (range === 'week') d.setDate(d.getDate() + 7);
    else if (range === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setViewDate(d);
  };

  const isInRange = useCallback((dateStr: string): boolean => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (range === 'week') return date >= weekDays[0] && date <= weekDays[6];
    if (range === 'month') return y === viewDate.getFullYear() && m - 1 === viewDate.getMonth();
    return y === viewDate.getFullYear();
  }, [range, weekDays, viewDate]);

  const timeStats = useMemo(() => {
    const catHours: Record<string, number> = {};
    Object.values(categories).forEach(c => { catHours[c.id] = 0; });

    let totalEvents = 0, completedEvents = 0;
    let energySum = 0, energyCount = 0, impactSum = 0, impactCount = 0;
    const dayActivity: Record<string, number> = {};
    const taskHours: Record<string, number> = {};

    Object.keys(events).forEach(dayId => {
      if (!isInRange(dayId)) return;
      const dayEvts = events[dayId] || [];
      totalEvents += dayEvts.length;
      dayActivity[dayId] = (dayActivity[dayId] || 0) + dayEvts.filter(e => e.completed).length;

      dayEvts.forEach(ev => {
        if (ev.completed && categories[ev.category]) {
          const si = GRID_HOURS.indexOf(ev.startHour);
          const ei = GRID_HOURS.indexOf(ev.endHour);
          const dur = Math.max(0, (ei - si) * 0.25);
          catHours[ev.category] = (catHours[ev.category] || 0) + dur;
          const key = String(ev.task || 'Sin nombre');
          taskHours[key] = (taskHours[key] || 0) + dur;
          completedEvents++;
        }
        if (ev.energy) { energySum += ev.energy; energyCount++; }
        if (ev.impact) { impactSum += ev.impact; impactCount++; }
      });
    });

    const total = Object.values(catHours).reduce((a, b) => a + b, 0);
    const main = Object.entries(catHours)
      .filter(([id]) => categories[id])
      .map(([id, hours]) => ({
        id, hours,
        name: categories[id].label,
        color: categories[id].color,
        percentage: total > 0 ? ((hours / total) * 100) : 0,
      }))
      .filter(s => s.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    const topTasks = Object.entries(taskHours)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    const dayBar = weekDays.map((date, i) => {
      const dateId = formatDateId(date);
      return {
        day: DAY_LABELS[i],
        completed: dayActivity[dateId] || 0,
        total: (events[dateId] || []).length,
      };
    });

    const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;
    const avgEnergy = energyCount > 0 ? (energySum / energyCount) : null;
    const avgImpact = impactCount > 0 ? (impactSum / impactCount) : null;
    const bestDay = dayBar.reduce((best, d) => d.completed > best.completed ? d : best, dayBar[0]);

    return { main, total, completionRate, avgEnergy, avgImpact, topTasks, dayBar, totalEvents, completedEvents, bestDay };
  }, [events, categories, isInRange, weekDays]);

  const financialStats = useMemo(() => {
    let income = 0, expenses = 0, count = 0;
    const byCategory: Record<string, { label: string; color: string; total: number }> = {};

    transactions.forEach(tx => {
      if (!isInRange(tx.date)) return;
      count++;
      if (tx.type === 'income' && tx.finCategoryId !== LOAN_IN_CAT_ID) income += tx.amount;
      else if (tx.type === 'expense' && tx.finCategoryId !== LOAN_OUT_CAT_ID) expenses += tx.amount;
      const cat = finCategories.find(c => c.id === tx.finCategoryId);
      if (cat) {
        if (!byCategory[tx.finCategoryId]) byCategory[tx.finCategoryId] = { label: cat.label, color: cat.color, total: 0 };
        byCategory[tx.finCategoryId].total += tx.amount;
      }
    });

    const topExpenses = Object.values(byCategory).sort((a, b) => b.total - a.total).slice(0, 4);
    return { income, expenses, balance: income - expenses, topExpenses, count };
  }, [transactions, finCategories, isInRange]);

  const goalStats = useMemo(() => {
    const weekGoals = goals.filter(g => g.weekId === weekId);
    const completed = weekGoals.filter(g => g.completed).length;
    const total = weekGoals.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const highIncomplete = weekGoals.filter(g => g.priority === 'high' && !g.completed);

    // Métricas de deadline
    const withDeadline = weekGoals.filter(g => !!g.deadline);
    const today = new Date().toISOString().split('T')[0];
    const metOnTime  = withDeadline.filter(g => g.completed && g.completedAt && g.deadline && g.completedAt.split('T')[0] <= g.deadline).length;
    const late       = withDeadline.filter(g => g.completed && g.completedAt && g.deadline && g.completedAt.split('T')[0] > g.deadline).length;
    const overdue    = withDeadline.filter(g => !g.completed && g.deadline && g.deadline < today).length;

    // Promedio de días para completar (con deadline y completados)
    const completedWithDates = weekGoals.filter(g => g.completed && g.completedAt && g.createdAt);
    const avgDays = completedWithDates.length > 0
      ? Math.round(completedWithDates.reduce((sum, g) => {
          const a = new Date(g.createdAt); a.setHours(0,0,0,0);
          const b = new Date(g.completedAt!); b.setHours(0,0,0,0);
          return sum + Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
        }, 0) / completedWithDates.length)
      : null;

    return { total, completed, rate, highIncomplete, weekGoals, withDeadline: withDeadline.length, metOnTime, late, overdue, avgDays };
  }, [goals, weekId]);

  // Tasks completed in period grouped by área
  const taskStats = useMemo(() => {
    const doneTasks = tasks.filter(t => t.status === 'done' && isInRange(t.completedAt ?? ''));
    const total = doneTasks.length;
    const inProgress = tasks.filter(t => t.status === 'inprogress' && isInRange(t.startedAt ?? '')).length;

    // By category
    const byCat: Record<string, { label: string; color: string; count: number }> = {};
    doneTasks.forEach(t => {
      const catId = t.categoryId ?? '__none__';
      const cat   = t.categoryId ? categories[t.categoryId] : null;
      if (!byCat[catId]) byCat[catId] = { label: cat?.label ?? 'Sin área', color: cat?.color ?? '#94a3b8', count: 0 };
      byCat[catId].count++;
    });
    const byCatArr = Object.values(byCat).sort((a, b) => b.count - a.count);
    const maxCount = byCatArr[0]?.count ?? 1;

    return { total, inProgress, byCatArr, maxCount };
  }, [tasks, isInRange, categories]);

  // ── Habit stats ──────────────────────────────────────────────────────────
  const habitStats = useMemo(() => {
    // Get all dates in the period
    const periodDates: string[] = [];
    if (range === 'week') {
      weekDays.forEach(d => periodDates.push(formatDateId(d)));
    } else if (range === 'month') {
      const y = viewDate.getFullYear(), m = viewDate.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        periodDates.push(formatDateId(new Date(y, m, d)));
      }
    } else {
      const y = viewDate.getFullYear();
      for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          periodDates.push(formatDateId(new Date(y, m, d)));
        }
      }
    }

    const today = formatDateId(new Date());
    const activeDates = periodDates.filter(d => d <= today);

    // Per-habit stats
    const perHabit = habits.map(h => {
      const relevantDates = activeDates.filter(d => d >= h.startDate);
      const logsInPeriod = habitLogs.filter(l => l.habitId === h.id && relevantDates.includes(l.date));
      const doneCount = logsInPeriod.length;

      // Target for period: target days per week × number of weeks
      const weeksInPeriod = Math.max(1, relevantDates.length / 7);
      const periodTarget = Math.round(h.target * weeksInPeriod);
      const pct = periodTarget > 0 ? Math.min(100, Math.round((doneCount / periodTarget) * 100)) : 0;

      // Current streak
      let streak = 0;
      const sortedDates = [...activeDates].filter(d => d >= h.startDate).sort().reverse();
      for (const d of sortedDates) {
        if (habitLogs.some(l => l.habitId === h.id && l.date === d)) streak++;
        else break;
      }

      return { id: h.id, name: h.name, color: h.color, doneCount, periodTarget, pct, streak };
    });

    const activeHabits = perHabit.filter(h => h.periodTarget > 0);
    const totalDone = activeHabits.reduce((s, h) => s + h.doneCount, 0);
    const totalTarget = activeHabits.reduce((s, h) => s + h.periodTarget, 0);
    const overallPct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
    const bestStreak = activeHabits.reduce((best, h) => Math.max(best, h.streak), 0);

    return { perHabit: activeHabits, overallPct, totalDone, totalTarget, bestStreak, count: habits.length };
  }, [habits, habitLogs, range, weekDays, viewDate]);

  const insights = useMemo(() => {
    const list: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; text: string }> = [];

    if (timeStats.completionRate >= 80 && timeStats.totalEvents > 0) {
      list.push({ type: 'success', text: `Excelente ejecución: completaste el ${timeStats.completionRate}% de tus actividades programadas.` });
    } else if (timeStats.completionRate < 50 && timeStats.totalEvents > 0) {
      list.push({ type: 'warning', text: `Tu tasa de cumplimiento fue del ${timeStats.completionRate}%. Revisa si tienes demasiadas actividades o si hay bloqueos.` });
    }

    if (timeStats.main.length > 0) {
      const top = timeStats.main[0];
      if (top.percentage > 65) {
        list.push({ type: 'warning', text: `El ${top.percentage.toFixed(0)}% de tu tiempo productivo fue en "${top.name}". Considera diversificar tus áreas.` });
      }
    }

    if (timeStats.avgEnergy !== null && timeStats.avgEnergy < 2.5) {
      list.push({ type: 'warning', text: `Tu energía promedio fue ${timeStats.avgEnergy.toFixed(1)}/5. Identifica qué actividades te están drenando más.` });
    } else if (timeStats.avgEnergy !== null && timeStats.avgEnergy >= 4) {
      list.push({ type: 'success', text: `Energía alta esta semana (${timeStats.avgEnergy.toFixed(1)}/5). Sigue con las actividades que te dan energía.` });
    }

    if (financialStats.balance < 0) {
      list.push({ type: 'danger', text: `Tus gastos superaron tus ingresos por $${fmt(Math.abs(financialStats.balance))}. Revisa tu presupuesto.` });
    } else if (financialStats.income > 0 && financialStats.balance > 0) {
      list.push({ type: 'success', text: `Balance positivo de $${fmt(financialStats.balance)}. ¡Buen control financiero!` });
    }

    if (goalStats.total > 0) {
      if (goalStats.rate < 50) {
        list.push({ type: 'warning', text: `Solo completaste el ${goalStats.rate}% de tus objetivos. Evalúa si son alcanzables o si necesitas más enfoque.` });
      } else if (goalStats.rate === 100) {
        list.push({ type: 'success', text: '¡Cumpliste el 100% de tus objetivos semanales! Excelente semana.' });
      }
      if (goalStats.highIncomplete.length > 0) {
        list.push({ type: 'danger', text: `Tienes ${goalStats.highIncomplete.length} objetivo(s) de alta prioridad sin completar esta semana.` });
      }
    } else {
      list.push({ type: 'info', text: 'No definiste objetivos esta semana. Los objetivos claros mejoran tu productividad hasta un 40%.' });
    }

    if (timeStats.bestDay && timeStats.bestDay.completed > 0) {
      list.push({ type: 'info', text: `Tu día más productivo fue ${timeStats.bestDay.day} con ${timeStats.bestDay.completed} actividades completadas.` });
    }

    if (timeStats.total === 0 && goalStats.total === 0 && financialStats.count === 0) {
      list.push({ type: 'info', text: 'Sin datos suficientes para generar insights. Comienza a registrar tu tiempo, objetivos y movimientos financieros.' });
    }

    return list;
  }, [timeStats, financialStats, goalStats]);

  const periodLabel = useMemo(() => {
    if (range === 'week') {
      return `${weekDays[0]?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${weekDays[6]?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (range === 'month') return viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return String(viewDate.getFullYear());
  }, [range, weekDays, viewDate]);

  const insightColors = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', Icon: CheckCircle2, iconCls: 'text-emerald-500' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', Icon: AlertTriangle, iconCls: 'text-amber-500' },
    danger: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', Icon: AlertTriangle, iconCls: 'text-red-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', Icon: Lightbulb, iconCls: 'text-blue-500' },
  };

  // ── Narrativa de la semana ────────────────────────────────────────────────
  const weekNarrative = useMemo(() => {
    const noData = timeStats.totalEvents === 0 && goalStats.total === 0 && financialStats.count === 0;
    if (noData) return null;

    const parts: string[] = [];
    if (timeStats.totalEvents > 0) {
      if (timeStats.completionRate >= 80)
        parts.push(`ejecutaste el **${timeStats.completionRate}%** de tus actividades`);
      else if (timeStats.completionRate >= 50)
        parts.push(`completaste el **${timeStats.completionRate}%** de tus actividades`);
      else
        parts.push(`registraste **${timeStats.totalEvents}** actividades (${timeStats.completionRate}% completadas)`);
    }
    if (goalStats.total > 0)
      parts.push(`**${goalStats.completed}/${goalStats.total}** objetivos logrados`);
    if (financialStats.balance > 0)
      parts.push(`balance positivo de **$${fmt(financialStats.balance)}**`);
    else if (financialStats.balance < 0)
      parts.push(`gastos por encima de ingresos en **$${fmt(Math.abs(financialStats.balance))}**`);

    const emoji =
      timeStats.completionRate >= 80 && goalStats.rate >= 80 ? '🏆' :
      timeStats.completionRate >= 60 || goalStats.rate >= 60 ? '💪' :
      financialStats.balance < 0 ? '⚠️' : '📊';

    return { parts, emoji };
  }, [timeStats, goalStats, financialStats]);

  // ── Análisis 80/20: Energía vs Impacto ─────────────────────────────────────
  const energyStats = useMemo(() => {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const MID = 3; // punto medio de la escala 1-5

    type Rated = { category: string; task: string; energy: number; impact: number; hours: number };
    const rated: Rated[] = [];

    Object.keys(events).forEach(dayId => {
      if (!isInRange(dayId)) return;
      (events[dayId] || []).forEach(ev => {
        if (!ev.completed || !ev.energy || !ev.impact) return;
        const si = GRID_HOURS.indexOf(ev.startHour);
        const ei = GRID_HOURS.indexOf(ev.endHour);
        rated.push({
          category: ev.category,
          task: String(ev.task || 'Sin nombre'),
          energy: ev.energy,
          impact: ev.impact,
          hours: Math.max(0, (ei - si) * 0.25),
        });
      });
    });

    if (rated.length < 1) return null;

    const quadrant = (e: number, i: number) =>
      e < MID && i >= MID ? 'leverage' :
      e >= MID && i >= MID ? 'worthit'  :
      e >= MID && i < MID  ? 'drain'    : 'noise';

    // Por categoría
    const byCat: Record<string, { eArr: number[]; iArr: number[]; hours: number }> = {};
    rated.forEach(r => {
      if (!byCat[r.category]) byCat[r.category] = { eArr: [], iArr: [], hours: 0 };
      byCat[r.category].eArr.push(r.energy);
      byCat[r.category].iArr.push(r.impact);
      byCat[r.category].hours += r.hours;
    });

    const catStats = Object.entries(byCat)
      .filter(([id]) => categories[id])
      .map(([id, d]) => {
        const avgE = avg(d.eArr), avgI = avg(d.iArr);
        return {
          id, name: categories[id].label, color: categories[id].color,
          avgEnergy: Math.round(avgE * 10) / 10,
          avgImpact: Math.round(avgI * 10) / 10,
          efficiency: avgI / avgE,
          hours: Math.round(d.hours * 10) / 10,
          count: d.eArr.length,
          quadrant: quadrant(avgE, avgI),
        };
      })
      .sort((a, b) => b.efficiency - a.efficiency);

    // Por actividad
    const byTask: Record<string, { eArr: number[]; iArr: number[] }> = {};
    rated.forEach(r => {
      if (!byTask[r.task]) byTask[r.task] = { eArr: [], iArr: [] };
      byTask[r.task].eArr.push(r.energy);
      byTask[r.task].iArr.push(r.impact);
    });

    const taskStats = Object.entries(byTask)
      .map(([name, d]) => {
        const avgE = avg(d.eArr), avgI = avg(d.iArr);
        return {
          name,
          avgEnergy: Math.round(avgE * 10) / 10,
          avgImpact: Math.round(avgI * 10) / 10,
          efficiency: avgI / avgE,
          count: d.eArr.length,
          quadrant: quadrant(avgE, avgI),
        };
      })
      .sort((a, b) => b.efficiency - a.efficiency);

    const leverage = taskStats.filter(t => t.quadrant === 'leverage');
    const worthit  = taskStats.filter(t => t.quadrant === 'worthit');
    const drain    = taskStats.filter(t => t.quadrant === 'drain');
    const noise    = taskStats.filter(t => t.quadrant === 'noise');

    const overallE = Math.round(avg(rated.map(r => r.energy)) * 10) / 10;
    const overallI = Math.round(avg(rated.map(r => r.impact)) * 10) / 10;

    // Insights comportamentales
    const behaviorInsights: Array<{ type: 'gold' | 'warning' | 'danger'; text: string }> = [];

    if (leverage.length > 0) {
      const names = leverage.slice(0, 2).map(t => `"${t.name}"`).join(' y ');
      behaviorInsights.push({ type: 'gold', text: `${names} son tus actividades de mayor apalancamiento: generan alto impacto con baja energía. Tu regla 80/20 — hazlas más seguido.` });
    }

    if (drain.length > 0) {
      const top = [...drain].sort((a, b) => b.avgEnergy - a.avgEnergy)[0];
      behaviorInsights.push({ type: 'danger', text: `"${top.name}" te drena energía (${top.avgEnergy}/5) con impacto bajo (${top.avgImpact}/5). Evalúa si es necesaria, cómo delegarla o reducir su frecuencia.` });
    }

    const bestTask = taskStats[0];
    if (bestTask && bestTask.efficiency > 1.3 && !leverage.find(t => t.name === bestTask.name)) {
      behaviorInsights.push({ type: 'gold', text: `"${bestTask.name}" es tu actividad más eficiente esta semana (E:${bestTask.avgEnergy} → I:${bestTask.avgImpact}). Priorízala en tu planeación.` });
    }

    if (overallE > overallI) {
      behaviorInsights.push({ type: 'warning', text: `Tu energía media (${overallE}/5) supera tu impacto medio (${overallI}/5). Hay potencial para redistribuir el tiempo hacia actividades de mayor retorno.` });
    } else if (overallI > overallE) {
      behaviorInsights.push({ type: 'gold', text: `¡Excelente! Tu impacto medio (${overallI}/5) supera tu energía invertida (${overallE}/5). Estás operando de forma eficiente esta semana.` });
    }

    return { catStats, taskStats, leverage, worthit, drain, noise, overallE, overallI, totalRated: rated.length, behaviorInsights };
  }, [events, categories, isInRange]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Revisión P.E.R.A.</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ciclo de mejora continua</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-slate-100 p-0.5 rounded-full text-[9px] font-black">
              {(['week', 'month', 'year'] as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-full uppercase transition-all ${range === r ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >{r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : 'Año'}</button>
              ))}
            </div>
            <div className="flex items-center bg-slate-100 rounded-full p-0.5">
              <button onClick={prevPeriod} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronLeft size={14} /></button>
              <span className="px-2 text-[10px] font-bold text-slate-600 min-w-[120px] text-center capitalize">{periodLabel}</span>
              <button onClick={nextPeriod} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronRight size={14} /></button>
            </div>
            <button
              onClick={onDownloadReport}
              disabled={isExporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${isExporting ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg active:scale-95'}`}
            >
              {isExporting ? <div className="w-3 h-3 border-2 border-indigo-200 border-t-white rounded-full animate-spin" /> : <Download size={14} />}
              {isExporting ? 'Generando...' : 'Descargar Reporte'}
            </button>
          </div>
        </div>

        {/* ── Narrativa de la semana ── */}
        {weekNarrative && (
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-5 md:p-5">
            <div className="flex items-center gap-4 mb-3">
              {/* Emoji — grande en mobile para equilibrar el diseño */}
              <span className="text-5xl md:text-4xl leading-none shrink-0">{weekNarrative.emoji}</span>
              <p className="text-xs md:text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                {range === 'week' ? 'Tu semana' : range === 'month' ? 'Tu mes' : 'Tu año'}
              </p>
            </div>
            <p className="text-slate-700 text-base md:text-sm font-bold leading-relaxed">
              {weekNarrative.parts.map((part, i) => {
                const segments = part.split(/\*\*(.*?)\*\*/g);
                return (
                  <span key={i}>
                    {i > 0 && i < weekNarrative.parts.length && <span className="text-slate-400"> · </span>}
                    {segments.map((s, j) => j % 2 === 1
                      ? <strong key={j} className="text-slate-900 font-black">{s}</strong>
                      : <span key={j}>{s}</span>
                    )}
                  </span>
                );
              })}
            </p>
            {insights.length > 0 && (
              <div className="flex items-start gap-2 mt-3">
                <Lightbulb size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-sm text-indigo-600 font-bold leading-snug">
                  {insights[0].text}
                </p>
              </div>
            )}
          </div>
        )}

        {/* PERA grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* P — PLANEAR */}
          <div className={`rounded-3xl border ${PERA.plan.border} ${PERA.plan.bg} p-5 space-y-4`}>
            <div className="flex items-center gap-2">
              <span className={`${PERA.plan.badge} text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>P — Planear</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-700">Objetivos fijados</span>
                <span className={`text-2xl font-black ${PERA.plan.text}`}>{goalStats.total}</span>
              </div>
              {goalStats.total > 0 && (
                <>
                  <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${goalStats.rate}%` }} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {([['high', 'Alta', 'bg-red-400'], ['medium', 'Media', 'bg-amber-400'], ['low', 'Baja', 'bg-slate-300']] as const).map(([p, label, dot]) => {
                      const count = goalStats.weekGoals.filter(g => g.priority === p).length;
                      const done = goalStats.weekGoals.filter(g => g.priority === p && g.completed).length;
                      return (
                        <div key={p} className="bg-white/60 rounded-xl p-2 text-center">
                          <div className={`w-2 h-2 rounded-full ${dot} mx-auto mb-1`} />
                          <p className="text-[9px] font-black text-slate-500 uppercase">{label}</p>
                          <p className="text-sm font-black text-slate-700">{done}/{count}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Métricas de deadline */}
                  {goalStats.withDeadline > 0 && (
                    <div className="bg-white/60 rounded-2xl p-3 space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cumplimiento de fechas</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {goalStats.metOnTime > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-100 rounded-full px-2.5 py-1">
                            ✓ {goalStats.metOnTime} a tiempo
                          </span>
                        )}
                        {goalStats.late > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
                            ⚠ {goalStats.late} fuera de fecha
                          </span>
                        )}
                        {goalStats.overdue > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 rounded-full px-2.5 py-1">
                            ✗ {goalStats.overdue} vencida{goalStats.overdue > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {goalStats.avgDays !== null && (
                        <p className="text-[10px] font-bold text-slate-500">
                          Promedio de conquista: <span className="font-black text-blue-600">{goalStats.avgDays} días</span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {goalStats.total === 0 && (
                <p className="text-xs text-blue-400 font-bold italic">Sin objetivos definidos este período</p>
              )}
            </div>
          </div>

          {/* E — EJECUTAR */}
          <div className={`rounded-3xl border ${PERA.execute.border} ${PERA.execute.bg} p-5 space-y-4`}>
            <div className="flex items-center gap-2">
              <span className={`${PERA.execute.badge} text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>E — Ejecutar</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tiempo real', value: `${timeStats.total}h`, Icon: Clock },
                { label: 'Completadas', value: `${timeStats.completionRate}%`, Icon: CheckCircle2 },
                { label: 'Energía media', value: timeStats.avgEnergy ? `${timeStats.avgEnergy.toFixed(1)}/5` : '—', Icon: Zap },
                { label: 'Impacto medio', value: timeStats.avgImpact ? `${timeStats.avgImpact.toFixed(1)}/5` : '—', Icon: Star },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="bg-white/60 rounded-2xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Icon size={12} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">{label}</span>
                  </div>
                  <span className="text-xl font-black text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            {/* Tasks completadas por área en el período */}
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 size={10} className="text-emerald-500" /> Tareas completadas (Lista)
                </p>
                <span className="text-sm font-black text-emerald-600">{taskStats.total}</span>
              </div>
              {taskStats.byCatArr.length > 0 ? (
                <div className="space-y-1.5">
                  {taskStats.byCatArr.map(({ label, color, count }) => (
                    <div key={label} className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[10px] font-bold text-slate-600 truncate w-24 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / taskStats.maxCount) * 100}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[10px] font-black text-slate-600 tabular-nums w-4 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-emerald-400 italic font-bold">Sin tareas completadas en este período</p>
              )}
              {taskStats.inProgress > 0 && (
                <p className="text-[9px] text-blue-400 font-bold">{taskStats.inProgress} en progreso</p>
              )}
            </div>

            {/* Hábitos */}
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Flame size={10} className="text-indigo-500" /> Hábitos
                </p>
                {habitStats.count > 0 && (
                  <span className={`text-sm font-black ${habitStats.overallPct >= 70 ? 'text-emerald-600' : habitStats.overallPct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                    {habitStats.overallPct}%
                  </span>
                )}
              </div>
              {habitStats.perHabit.length > 0 ? (
                <>
                  <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${habitStats.overallPct >= 70 ? 'bg-emerald-500' : habitStats.overallPct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${habitStats.overallPct}%` }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {habitStats.perHabit.map(h => (
                      <div key={h.id} className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-600 truncate flex-1">{h.name}</span>
                        <span className={`text-[10px] font-black tabular-nums shrink-0 ${h.pct >= 70 ? 'text-emerald-600' : h.pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                          {h.doneCount}/{h.periodTarget}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0 w-8 text-right">{h.pct}%</span>
                      </div>
                    ))}
                  </div>
                  {habitStats.bestStreak > 0 && (
                    <div className="bg-white/60 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-sm leading-none">🔥</span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Mejor racha: <span className="font-black text-emerald-600">{habitStats.bestStreak} días</span>
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[10px] text-emerald-400 italic font-bold">Sin hábitos activos en este período</p>
              )}
            </div>
          </div>

          {/* R — REVISAR */}
          <div className={`rounded-3xl border ${PERA.review.border} ${PERA.review.bg} p-5 space-y-4`}>
            <div className="flex items-center gap-2">
              <span className={`${PERA.review.badge} text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>R — Revisar</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {/* Time distribution */}
              {timeStats.main.length > 0 ? (
                <div className="flex gap-4 items-center">
                  <div className="h-28 w-28 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={timeStats.main} innerRadius={28} outerRadius={44} dataKey="hours" strokeWidth={0}>
                          {timeStats.main.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 800 }}
                          formatter={(v: number) => [`${v}h`, '']}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {timeStats.main.slice(0, 4).map(s => (
                      <div key={s.id} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-600 uppercase truncate">{s.name}</span>
                          <span className="text-[9px] font-black text-slate-500 shrink-0 ml-1">{s.hours}h</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ backgroundColor: s.color, width: `${s.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-violet-400 font-bold italic">Sin actividades completadas este período</p>
              )}

              {/* Financial summary */}
              <div className="bg-white/60 rounded-2xl p-3 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <DollarSign size={10} /> Finanzas del período
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-center">
                  <div className="md:col-span-1">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Ingresos</p>
                    <p className="text-sm font-black text-emerald-600">${fmt(financialStats.income)}</p>
                  </div>
                  <div className="md:col-span-1">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Gastos</p>
                    <p className="text-sm font-black text-red-500">${fmt(financialStats.expenses)}</p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Balance</p>
                    <p className={`text-sm font-black ${financialStats.balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>${fmt(financialStats.balance)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* A — AJUSTAR */}
          <div className={`rounded-3xl border ${PERA.adjust.border} ${PERA.adjust.bg} p-5 space-y-4`}>
            <div className="flex items-center gap-2">
              <span className={`${PERA.adjust.badge} text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>A — Ajustar</span>
            </div>
            <div className="space-y-2.5">
              {insights.map((insight, i) => {
                const cfg = insightColors[insight.type];
                const { Icon } = cfg;
                return (
                  <div key={i} className={`${cfg.bg} ${cfg.border} border rounded-2xl p-3 flex items-start gap-2.5`}>
                    <Icon size={14} className={`${cfg.iconCls} shrink-0 mt-0.5`} />
                    <p className={`text-[11px] font-bold leading-snug ${cfg.text}`}>{insight.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Top activities */}
            {timeStats.topTasks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-amber-200/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Top actividades</p>
                {timeStats.topTasks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/60 px-3 py-2 rounded-xl">
                    <span className="text-[10px] font-black text-slate-600 truncate">{t.name}</span>
                    <span className="text-[10px] font-black text-amber-600 shrink-0 ml-2">{t.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ ANÁLISIS 80/20: Energía e Impacto ═══ */}
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-400 to-amber-500 p-2 rounded-xl shadow-lg shrink-0">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Tu 80/20</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {energyStats ? `Energía vs Impacto — ${energyStats.totalRated} actividades` : 'Análisis de Energía e Impacto'}
              </p>
            </div>
          </div>

          {!energyStats ? (
            /* Empty state */
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-dashed border-amber-200 rounded-3xl p-8 text-center">
              <div className="text-5xl mb-3">⚡</div>
              <p className="text-sm font-bold text-slate-600">Sin datos de energía e impacto</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                Al completar actividades en <strong>Tiempo</strong>, califícalas con energía e impacto. Así verás qué te drena y qué te impulsa.
              </p>
            </div>
          ) : (
            <>
              {/* Métricas globales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-orange-500">{energyStats.overallE}<span className="text-sm font-bold">/5</span></p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Energía media</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-emerald-600">{energyStats.overallI}<span className="text-sm font-bold">/5</span></p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Impacto medio</p>
                </div>
              </div>

              {/* Cuadrantes 80/20 */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'leverage', label: '🌟 Alto Leverage', desc: 'Poca energía · alto impacto', items: energyStats.leverage, bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                  { key: 'worthit',  label: '💪 Vale la Pena',  desc: 'Alta energía · alto impacto', items: energyStats.worthit,  bg: 'from-blue-50 to-indigo-50',  border: 'border-blue-200',    text: 'text-blue-700'    },
                  { key: 'drain',    label: '🔥 Te Drena',      desc: 'Alta energía · bajo impacto', items: energyStats.drain,    bg: 'from-red-50 to-orange-50',  border: 'border-red-200',     text: 'text-red-700'     },
                  { key: 'noise',    label: '😴 Ruido',         desc: 'Poca energía · bajo impacto', items: energyStats.noise,    bg: 'from-slate-50 to-gray-50',  border: 'border-slate-200',   text: 'text-slate-500'   },
                ] as const).map(q => (
                  <div key={q.key} className={`bg-gradient-to-br ${q.bg} border ${q.border} rounded-2xl p-3.5 space-y-2`}>
                    <div>
                      <p className={`text-[10px] font-black ${q.text}`}>{q.label}</p>
                      <p className="text-[9px] text-slate-400 font-bold leading-tight">{q.desc}</p>
                    </div>
                    {q.items.length === 0 ? (
                      <p className="text-[9px] text-slate-300 italic">Sin actividades</p>
                    ) : (
                      <div className="space-y-1">
                        {q.items.slice(0, 3).map((t, i) => (
                          <p key={i} className={`text-[10px] font-bold ${q.text} truncate`}>· {t.name}</p>
                        ))}
                        {q.items.length > 3 && (
                          <p className="text-[9px] text-slate-400 font-bold">+{q.items.length - 3} más</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Insights comportamentales */}
              {energyStats.behaviorInsights.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Patrones de comportamiento</p>
                  {energyStats.behaviorInsights.map((ins, i) => {
                    const cfg =
                      ins.type === 'gold'    ? { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400'  } :
                      ins.type === 'danger'  ? { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-400'    } :
                                               { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  dot: 'bg-slate-400'  };
                    return (
                      <div key={i} className={`${cfg.bg} ${cfg.border} border rounded-2xl p-3.5 flex items-start gap-3`}>
                        <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0 mt-1.5`} />
                        <p className={`text-xs font-bold leading-snug ${cfg.text}`}>{ins.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default Revision;
