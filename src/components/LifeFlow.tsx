import React, { useState, useMemo, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Clock, Save, Zap, ChevronLeft, ChevronRight, X, Plus,
  PieChart as PieChartIcon, Trash2, CalendarDays, Menu, Copy, CheckCircle2, Circle, Edit2, Palette,
  Download, ListPlus, Target, BarChart3, History, DollarSign, Star, ChevronDown, LogOut, CheckSquare
} from 'lucide-react';
import Dinero from './modules/Dinero';
import Objetivos from './modules/Objetivos';
import Revision from './modules/Revision';
import Lista from './modules/Lista';
import type { Transaction, FinCategory, Goal, Savings, MonthBalance, SavingsWithdrawal, SavingsPocket, PocketFunding, SavingsYearBalance, Loan, LoanPayment, Budget, Task, ChecklistItem } from '../types';
import { LOAN_OUT_CAT_ID, LOAN_IN_CAT_ID } from '../types';
import { generateId, formatDateId as fmtDateId, getWeekDays, GRID_HOURS, fmtCurrency, getWeekId } from '../lib/utils';
import {
  loadAllData, migrateFromLocalStorage,
  loadEvents, loadCategories, loadTransactions, loadFinCategories, loadGoals,
  loadSavings, loadMonthBalances, loadSavingsWithdrawals, loadSavingsPockets,
  loadPocketFundings, loadSavingsYearBalances, loadLoans, loadLoanPayments,
  loadBudgets, loadTasks, loadChecklistItems,
  syncEvents, syncCategories, syncTransactions, syncFinCategories, syncGoals,
  syncSavings, syncMonthBalances, syncSavingsWithdrawals, syncSavingsPockets,
  syncPocketFundings, syncSavingsYearBalances, syncLoans, syncLoanPayments, syncBudgets,
  syncTasks, syncChecklistItems,
} from '../lib/db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const INITIAL_CATEGORIES = {
  'cat-1': {
    id: 'cat-1',
    label: 'Personal',
    color: '#6366f1',
    short: 'PER',
    presets: ['Ejercicio', 'Desayuno', 'Almuerzo', 'Cena', 'Descanso', 'Lectura']
  },
  'cat-2': {
    id: 'cat-2',
    label: 'Trabajo',
    color: '#10b981',
    short: 'TRB',
    presets: ['Reunión', 'Tareas', 'Planificación', 'Revisión']
  },
  'cat-3': {
    id: 'cat-3',
    label: 'Estudio',
    color: '#3b82f6',
    short: 'EST',
    presets: ['Clases', 'Lectura', 'Práctica', 'Investigación']
  },
  'cat-4': {
    id: 'cat-4',
    label: 'Otra',
    color: '#94a3b8',
    short: 'OTR',
    presets: []
  },
};

const INITIAL_FIN_CATEGORIES: FinCategory[] = [
  // ── Ingresos ──────────────────────────────────────────────────────────────
  { id: 'finc-i1', label: 'Salario',            color: '#10b981', type: 'income' },
  { id: 'finc-i2', label: 'Negocio',            color: '#f59e0b', type: 'income' },
  { id: 'finc-i3', label: 'Marca Personal',     color: '#ec4899', type: 'income' },
  { id: 'finc-i4', label: 'Otros',              color: '#94a3b8', type: 'income' },
  // ── Gastos ────────────────────────────────────────────────────────────────
  { id: 'finc-e1',  label: 'Vivienda',                color: '#6366f1', type: 'expense', description: 'Arriendo, servicios públicos, internet y mantenimiento del hogar' },
  { id: 'finc-e2',  label: 'Alimentación',            color: '#f59e0b', type: 'expense', description: 'Mercado, supermercado y alimentación diaria' },
  { id: 'finc-e3',  label: 'Transporte',              color: '#3b82f6', type: 'expense', description: 'Gasolina, transporte público, Uber/Didi y mantenimiento vehicular' },
  { id: 'finc-e4',  label: 'Salud',                   color: '#ef4444', type: 'expense', description: 'Seguros, citas médicas, farmacia y bienestar' },
  { id: 'finc-e5',  label: 'Suscripciones',           color: '#8b5cf6', type: 'expense', description: 'Netflix, Spotify, gimnasio y servicios digitales recurrentes' },
  { id: 'finc-e6',  label: 'Ocio y Entretenimiento',  color: '#ec4899', type: 'expense', description: 'Salidas, restaurantes, cine y pasatiempos' },
  { id: 'finc-e7',  label: 'Ropa y Estilo',           color: '#f43f5e', type: 'expense', description: 'Ropa, calzado y cuidado personal' },
  { id: 'finc-e8',  label: 'Hogar',                   color: '#84cc16', type: 'expense', description: 'Muebles, decoración y artículos para la casa' },
  { id: 'finc-e9',  label: 'Inversión Personal',      color: '#14b8a6', type: 'expense', description: 'Educación, libros y desarrollo profesional' },
  { id: 'finc-e10', label: 'Familia y Aportes',       color: '#fb923c', type: 'expense', description: 'Ayuda familiar y contribuciones' },
  { id: 'finc-e11', label: 'Detalles y Regalos',      color: '#a78bfa', type: 'expense', description: 'Regalos para terceros y detalles especiales' },
  { id: 'finc-e12', label: 'Compromisos Financieros', color: '#f97316', type: 'expense', description: 'Deudas, créditos y obligaciones bancarias' },
  { id: 'finc-e13', label: 'Impuestos y Comisiones',  color: '#0ea5e9', type: 'expense', description: 'Impuestos, 4x1000 y comisiones bancarias' },
  { id: 'finc-e14', label: 'Imprevistos',             color: '#64748b', type: 'expense', description: 'Gastos inesperados o de emergencia' },
  // ── Préstamos (fijos) ─────────────────────────────────────────────────────
  { id: LOAN_OUT_CAT_ID, label: 'Préstamos',  color: '#f97316', type: 'expense', description: 'Dinero prestado a otras personas que esperas que se devuelva' },
  { id: LOAN_IN_CAT_ID,  label: 'Reintegros', color: '#22c55e', type: 'income',  description: 'Devoluciones de préstamos recibidas' },
];

const MIN_OPTIONS = ['00', '15', '30', '45'];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const WEEK_DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const SEGMENT_HEIGHT = 22;
const FIELD_HEIGHT = SEGMENT_HEIGHT * 2;
const ROW_HEIGHT = SEGMENT_HEIGHT * 4;

const WheelColumn = ({ options, value, onChange }) => {
  const containerRef = useRef(null);
  const itemHeight = 44;
  const isInternalScroll = useRef(false);

  useEffect(() => {
    if (containerRef.current && !isInternalScroll.current) {
      const index = options.indexOf(String(value));
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
    isInternalScroll.current = false;
  }, [value, options]);

  const handleScroll = (e) => {
    const scrollPos = e.target.scrollTop;
    const index = Math.round(scrollPos / itemHeight);
    const newValue = options[index];

    if (newValue && newValue !== String(value)) {
      isInternalScroll.current = true;
      onChange(newValue);
    }
  };

  return (
    <div className="relative h-[132px] w-16 overflow-hidden flex items-center justify-center bg-black/20 rounded-xl">
      <div className="absolute inset-x-0 h-11 border-y border-white/10 bg-white/5 pointer-events-none z-10" />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[44px] touch-pan-y"
      >
        {options.map((opt) => (
          <div
            key={opt}
            className={`h-11 flex items-center justify-center snap-center text-xl font-black transition-all duration-200 ${
              String(opt) === String(value) ? 'text-white scale-110' : 'text-slate-600 scale-90'
            }`}
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  );
};

const CustomTimePicker = ({ label, hour, minute, onTimeChange, minTime = "00:00", isMobileView }) => {
  const [minH, minM] = minTime.split(':').map(Number);
  const filteredHours = HOUR_OPTIONS.filter(h => parseInt(h) >= minH);

  const currentMinOptions = parseInt(hour) === minH
    ? MIN_OPTIONS.filter(m => parseInt(m) >= minM)
    : MIN_OPTIONS;

  if (isMobileView) {
    return (
      <div className="flex flex-col items-center gap-2 flex-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</label>
        <div className="relative flex items-center bg-[#1a1c24] rounded-3xl p-1 border border-white/5 shadow-xl w-full justify-center gap-1">
          <WheelColumn options={filteredHours} value={hour} onChange={(newH) => onTimeChange(newH, minute)} />
          <span className="text-xl font-black text-slate-500 mb-1">:</span>
          <WheelColumn options={currentMinOptions} value={minute} onChange={(newM) => onTimeChange(hour, newM)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="relative flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-200 w-full overflow-hidden h-14">
        <div className="flex w-full justify-around items-center z-20">
          <select
            value={hour}
            onChange={(e) => onTimeChange(e.target.value, String(minute))}
            className="bg-transparent text-xl font-black focus:outline-none cursor-pointer text-slate-800 appearance-none text-center w-1/2"
          >
            {filteredHours.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="text-xl font-black text-slate-300">:</span>
          <select
            value={minute}
            onChange={(e) => onTimeChange(String(hour), e.target.value)}
            className="bg-transparent text-xl font-black focus:outline-none cursor-pointer text-slate-800 appearance-none text-center w-1/2"
          >
            {currentMinOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};


type SectionKey = 'tiempo' | 'dinero' | 'objetivos' | 'lista' | 'revision';

const SECTIONS: Array<{ key: SectionKey; label: string; Icon: React.FC<{ size?: number }> }> = [
  { key: 'dinero',    label: 'Dinero',    Icon: DollarSign },
  { key: 'tiempo',    label: 'Tiempo',    Icon: CalendarDays },
  { key: 'lista',     label: 'Lista',     Icon: CheckSquare },
  { key: 'objetivos', label: 'Objetivos', Icon: Target },
  { key: 'revision',  label: 'Revisión',  Icon: BarChart3 },
];

const App = () => {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? '';
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);

  // ── Estado principal ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState({});
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [modalData, setModalData] = useState(null);
  const [catModal, setCatModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [mobileDayOffset, setMobileDayOffset] = useState(new Date().getDay() || 1);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [newPreset, setNewPreset] = useState("");
  const [reportRange, setReportRange] = useState('week');
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [section, setSection] = useState<SectionKey>('dinero');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [finCategories, setFinCategories] = useState<FinCategory[]>(INITIAL_FIN_CATEGORIES);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [monthBalances, setMonthBalances] = useState<MonthBalance[]>([]);
  const [savingsWithdrawals, setSavingsWithdrawals] = useState<SavingsWithdrawal[]>([]);
  const [savingsPockets, setSavingsPockets] = useState<SavingsPocket[]>([]);
  const [pocketFundings, setPocketFundings] = useState<PocketFunding[]>([]);
  const [savingsYearBalances, setSavingsYearBalances] = useState<SavingsYearBalance[]>([]);
  const [loans, setLoans]                           = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments]             = useState<LoanPayment[]>([]);
  const [budgets, setBudgets]                       = useState<Budget[]>([]);
  const [tasks, setTasks]                           = useState<Task[]>([]);
  const [checklistItems, setChecklistItems]         = useState<ChecklistItem[]>([]);

  // ── Carga inicial desde Supabase (con migración automática de localStorage) ─
  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      try {
        const remote = await loadAllData();
        const isDbEmpty =
          Object.keys(remote.categories).length === 0 &&
          remote.transactions.length === 0 &&
          Object.keys(remote.events).length === 0;

        const d = isDbEmpty
          ? await migrateFromLocalStorage(userId, INITIAL_CATEGORIES, INITIAL_FIN_CATEGORIES)
          : remote;

        const finalCategories   = Object.keys(d.categories).length > 0 ? d.categories : INITIAL_CATEGORIES;

        // Procesamiento de categorías financieras:
        // 1. Si la DB está totalmente vacía, cargamos todos los valores por defecto
        // 2. Si ya existen categorías, respetamos lo que hay en la DB para permitir CRUD
        // 3. Casos especiales: Asegurar que las categorías de Préstamos/Reintegros siempre existan
        // y que la migración inicial de gastos ocurra si es necesario.
        let finalFinCategories = d.finCategories;
        if (finalFinCategories.length === 0) {
          finalFinCategories = INITIAL_FIN_CATEGORIES;
        } else {
          // Asegurar categorías de préstamos (necesarias para la lógica del sistema)
          const loanIn = INITIAL_FIN_CATEGORIES.find(c => c.id === LOAN_IN_CAT_ID)!;
          const loanOut = INITIAL_FIN_CATEGORIES.find(c => c.id === LOAN_OUT_CAT_ID)!;
          
          if (!finalFinCategories.some(c => c.id === LOAN_IN_CAT_ID)) finalFinCategories.push(loanIn);
          if (!finalFinCategories.some(c => c.id === LOAN_OUT_CAT_ID)) finalFinCategories.push(loanOut);

          // Migración inicial de gastos si el usuario no tiene ninguno
          const hasExpenses = finalFinCategories.some(c => (c.type === 'expense' || c.type === 'both') && c.id !== LOAN_OUT_CAT_ID);
          if (!hasExpenses) {
            const defaultExpenses = INITIAL_FIN_CATEGORIES.filter(c => c.type === 'expense' && c.id !== LOAN_OUT_CAT_ID);
            finalFinCategories = [...finalFinCategories, ...defaultExpenses];
          }
        }

        // Actualizar state
        setEvents(d.events);
        setCategories(finalCategories);
        setTransactions(d.transactions);
        setFinCategories(finalFinCategories);
        setGoals(d.goals);
        setSavings(d.savings);
        setMonthBalances(d.monthBalances);
        setSavingsWithdrawals(d.savingsWithdrawals);
        setSavingsPockets(d.savingsPockets);
        setPocketFundings(d.pocketFundings);
        setSavingsYearBalances(d.savingsYearBalances);
        setLoans(d.loans);
        setLoanPayments(d.loanPayments);
        setBudgets(d.budgets ?? []);
        setTasks(d.tasks ?? []);
        setChecklistItems(d.checklistItems ?? []);

        // Sincronizar refs con los datos cargados ANTES de setLoading(false).
        // Así los sync-effects ven prev === curr y no re-suben nada a Supabase.
        prevEvents.current             = d.events;
        prevCategories.current         = finalCategories;
        prevTransactions.current       = d.transactions;
        prevFinCategories.current      = finalFinCategories;
        prevGoals.current              = d.goals;
        prevSavings.current            = d.savings;
        prevMonthBalances.current      = d.monthBalances;
        prevSavingsWithdrawals.current = d.savingsWithdrawals;
        prevSavingsPockets.current     = d.savingsPockets;
        prevPocketFundings.current     = d.pocketFundings;
        prevSavingsYearBalances.current = d.savingsYearBalances;
        prevLoans.current              = d.loans;
        prevLoanPayments.current       = d.loanPayments;
        prevBudgets.current            = d.budgets ?? [];
        prevTasks.current              = d.tasks ?? [];
        prevChecklistItems.current     = d.checklistItems ?? [];

      } catch (err) {
        console.error('Error al cargar datos de Supabase:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId]);

  // ── Refs para calcular diffs en los sync effects ────────────────────────────
  const prevEvents = useRef(events);
  const prevCategories = useRef(categories);
  const prevTransactions = useRef(transactions);
  const prevFinCategories = useRef(finCategories);
  const prevGoals = useRef(goals);
  const prevSavings = useRef(savings);
  const prevMonthBalances = useRef(monthBalances);
  const prevSavingsWithdrawals = useRef(savingsWithdrawals);
  const prevSavingsPockets = useRef(savingsPockets);
  const prevPocketFundings = useRef(pocketFundings);
  const prevSavingsYearBalances = useRef(savingsYearBalances);
  const prevLoans               = useRef(loans);
  const prevLoanPayments        = useRef(loanPayments);
  const prevBudgets             = useRef(budgets);
  const prevTasks               = useRef(tasks);
  const prevChecklistItems      = useRef(checklistItems);

  // Timestamps hasta los que el RT está silenciado por tabla (ms).
  // Cada sync local extiende el cooldown 5 s para evitar que el RT
  // refleje nuestros propios cambios con datos potencialmente stale.
  const rtCooldown = useRef<Record<string, number>>({});
  const RT_COOLDOWN_MS = 5000;
  const pause = (table: string) => {
    rtCooldown.current[table] = Date.now() + RT_COOLDOWN_MS;
  };
  const inCooldown = (table: string) =>
    Date.now() < (rtCooldown.current[table] ?? 0);

  // ── Sincronización con Supabase (fire-and-forget, sin bloquear la UI) ───────

  useEffect(() => {
    if (loading || !userId) return;
    pause('events');
    syncEvents(prevEvents.current, events, userId).catch(console.error);
    prevEvents.current = events;
  }, [events, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('categories');
    syncCategories(prevCategories.current, categories, userId).catch(console.error);
    prevCategories.current = categories;
  }, [categories, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('transactions');
    syncTransactions(prevTransactions.current, transactions, userId).catch(console.error);
    prevTransactions.current = transactions;
  }, [transactions, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('fin_categories');
    syncFinCategories(prevFinCategories.current, finCategories, userId).catch(console.error);
    prevFinCategories.current = finCategories;
  }, [finCategories, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('goals');
    syncGoals(prevGoals.current, goals, userId).catch(console.error);
    prevGoals.current = goals;
  }, [goals, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('savings');
    syncSavings(prevSavings.current, savings, userId).catch(console.error);
    prevSavings.current = savings;
  }, [savings, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('month_balances');
    syncMonthBalances(prevMonthBalances.current, monthBalances, userId).catch(console.error);
    prevMonthBalances.current = monthBalances;
  }, [monthBalances, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('savings_withdrawals');
    syncSavingsWithdrawals(prevSavingsWithdrawals.current, savingsWithdrawals, userId).catch(console.error);
    prevSavingsWithdrawals.current = savingsWithdrawals;
  }, [savingsWithdrawals, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('savings_pockets');
    syncSavingsPockets(prevSavingsPockets.current, savingsPockets, userId).catch(console.error);
    prevSavingsPockets.current = savingsPockets;
  }, [savingsPockets, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('pocket_fundings');
    syncPocketFundings(prevPocketFundings.current, pocketFundings, userId).catch(console.error);
    prevPocketFundings.current = pocketFundings;
  }, [pocketFundings, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('savings_year_balances');
    syncSavingsYearBalances(prevSavingsYearBalances.current, savingsYearBalances, userId).catch(console.error);
    prevSavingsYearBalances.current = savingsYearBalances;
  }, [savingsYearBalances, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('loans');
    syncLoans(prevLoans.current, loans, userId).catch(console.error);
    prevLoans.current = loans;
  }, [loans, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('loan_payments');
    syncLoanPayments(prevLoanPayments.current, loanPayments, userId).catch(console.error);
    prevLoanPayments.current = loanPayments;
  }, [loanPayments, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('budgets');
    syncBudgets(prevBudgets.current, budgets, userId).catch(console.error);
    prevBudgets.current = budgets;
  }, [budgets, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('tasks');
    syncTasks(prevTasks.current, tasks, userId).catch(console.error);
    prevTasks.current = tasks;
  }, [tasks, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    pause('checklist_items');
    syncChecklistItems(prevChecklistItems.current, checklistItems, userId).catch(console.error);
    prevChecklistItems.current = checklistItems;
  }, [checklistItems, loading, userId]);

  // ── Real-time: recibe cambios de otros dispositivos/tabs ─────────────────────
  useEffect(() => {
    if (!userId || loading) return;

    const f = `user_id=eq.${userId}`;

    const channel = supabase
      .channel(`lifeos-rt-${userId}`)

      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: f }, async () => {
        if (inCooldown('events')) return;
        const fresh = await loadEvents();
        prevEvents.current = fresh; setEvents(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: f }, async () => {
        if (inCooldown('categories')) return;
        const fresh = await loadCategories();
        prevCategories.current = fresh; setCategories(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: f }, async () => {
        if (inCooldown('transactions')) return;
        const fresh = await loadTransactions();
        prevTransactions.current = fresh; setTransactions(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fin_categories', filter: f }, async () => {
        if (inCooldown('fin_categories')) return;
        const fresh = await loadFinCategories();
        prevFinCategories.current = fresh; setFinCategories(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: f }, async () => {
        if (inCooldown('goals')) return;
        const fresh = await loadGoals();
        prevGoals.current = fresh; setGoals(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings', filter: f }, async () => {
        if (inCooldown('savings')) return;
        const fresh = await loadSavings();
        prevSavings.current = fresh; setSavings(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_balances', filter: f }, async () => {
        if (inCooldown('month_balances')) return;
        const fresh = await loadMonthBalances();
        prevMonthBalances.current = fresh; setMonthBalances(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_withdrawals', filter: f }, async () => {
        if (inCooldown('savings_withdrawals')) return;
        const fresh = await loadSavingsWithdrawals();
        prevSavingsWithdrawals.current = fresh; setSavingsWithdrawals(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_pockets', filter: f }, async () => {
        if (inCooldown('savings_pockets')) return;
        const fresh = await loadSavingsPockets();
        prevSavingsPockets.current = fresh; setSavingsPockets(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pocket_fundings', filter: f }, async () => {
        if (inCooldown('pocket_fundings')) return;
        const fresh = await loadPocketFundings();
        prevPocketFundings.current = fresh; setPocketFundings(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_year_balances', filter: f }, async () => {
        if (inCooldown('savings_year_balances')) return;
        const fresh = await loadSavingsYearBalances();
        prevSavingsYearBalances.current = fresh; setSavingsYearBalances(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: f }, async () => {
        if (inCooldown('loans')) return;
        const fresh = await loadLoans();
        prevLoans.current = fresh; setLoans(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_payments', filter: f }, async () => {
        if (inCooldown('loan_payments')) return;
        const fresh = await loadLoanPayments();
        prevLoanPayments.current = fresh; setLoanPayments(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: f }, async () => {
        if (inCooldown('budgets')) return;
        const fresh = await loadBudgets();
        prevBudgets.current = fresh; setBudgets(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: f }, async () => {
        if (inCooldown('tasks')) return;
        const fresh = await loadTasks();
        prevTasks.current = fresh; setTasks(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: f }, async () => {
        if (inCooldown('checklist_items')) return;
        const fresh = await loadChecklistItems();
        prevChecklistItems.current = fresh; setChecklistItems(fresh);
      })

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, loading]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll a la primera actividad del día
  useEffect(() => {
    if (section === 'tiempo' && !loading) {
      const todayId = formatDateId(new Date());
      const todayEvents = events[todayId] || [];
      
      let scrollIdx = -1;
      if (todayEvents.length > 0) {
        const sorted = [...todayEvents].sort((a, b) => GRID_HOURS.indexOf(a.startHour) - GRID_HOURS.indexOf(b.startHour));
        scrollIdx = GRID_HOURS.indexOf(sorted[0].startHour);
      } else {
        // Fallback a las 8:00 AM si no hay eventos
        scrollIdx = GRID_HOURS.indexOf('08:00');
      }

      if (scrollIdx !== -1) {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const pos = Math.max(0, scrollIdx * SEGMENT_HEIGHT - (SEGMENT_HEIGHT * 4));
            scrollContainerRef.current.scrollTop = pos;
          }
        }, 150);
      }
    }
  }, [section, loading]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const isMobile = windowWidth < 1024;

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const formatDateId = (date) => fmtDateId(date);

  const currentVisibleDays = isMobile ? [weekDays[mobileDayOffset - 1]] : weekDays;

    const handleSaveCategory = () => {
    if (!catModal?.label || !catModal?.short) return;
    setCategories(prev => ({ ...prev, [catModal.id]: { ...catModal } }));
    setCatModal(null);
  };

  const addPresetToCat = () => {
    if (!newPreset.trim()) return;
    setCatModal({ ...catModal, presets: [...(catModal.presets || []), newPreset.trim()] });
    setNewPreset("");
  };

  const updatePreset = (index, newValue) => {
    const updated = [...(catModal.presets || [])];
    updated[index] = newValue;
    setCatModal({ ...catModal, presets: updated });
  };

  const removePreset = (index) => {
    const updated = [...(catModal.presets || [])];
    updated.splice(index, 1);
    setCatModal({ ...catModal, presets: updated });
  };

  const handleDeleteCategory = (id) => {
    const newCats = { ...categories };
    delete newCats[id];
    setCategories(newCats);
    setCatModal(null);
  };

    const handleOpenModal = (dayDate, hour, existingEvent = null) => {
    const dateId = formatDateId(dayDate);
    if (existingEvent) {
      const [startH, startM] = existingEvent.startHour.split(':');
      const [endH, endM] = existingEvent.endHour.split(':');
      setModalData({
        ...existingEvent,
        startHour: startH, startMin: startM, endHour: endH, endMin: endM,
        dateId, isEditing: true, mode: 'edit', selectedDays: []
      });
    } else {
      const [h, m] = hour.split(':');
      let endH = (parseInt(h) + 1).toString().padStart(2, '0');
      if (parseInt(endH) > 23) endH = "23";
      setModalData({
        id: generateId(), dateId,
        startHour: h, startMin: m, endHour: endH, endMin: m,
        category: Object.keys(categories)[0] || '', task: '', isEditing: false, mode: 'edit', completed: false, selectedDays: [], energy: undefined, impact: undefined
      });
    }
  };

  const saveActivity = () => {
    if (!modalData) return;
    const { dateId, id, startHour, startMin, endHour, endMin, category, task, mode, selectedDays, completed, energy, impact } = modalData;
    const startStr = `${startHour}:${startMin}`;
    const endStr = `${endHour}:${endMin}`;

    setEvents(prev => {
      let nextEvents = { ...prev };
      if (mode === 'edit') {
        Object.keys(nextEvents).forEach(dayKey => {
          nextEvents[dayKey] = (nextEvents[dayKey] || []).filter(e => e.id !== id);
        });
      }

      if (mode === 'duplicate' || mode !== 'edit') {
        const daysToApply = (mode === 'duplicate' && selectedDays?.length > 0)
          ? selectedDays.map(idx => formatDateId(weekDays[idx]))
          : [dateId];

        daysToApply.forEach(dId => {
          if (!nextEvents[dId]) nextEvents[dId] = [];
          nextEvents[dId].push({
            id: generateId(),
            startHour: startStr, endHour: endStr, category, task: String(task), completed: mode === 'edit' ? !!completed : false
          });
        });
      } else {
        if (!nextEvents[dateId]) nextEvents[dateId] = [];
        nextEvents[dateId].push({ id, startHour: startStr, endHour: endStr, category, task: String(task), completed: !!completed, energy: energy || undefined, impact: impact || undefined });
      }
      return nextEvents;
    });
    setModalData(null);
  };

  const deleteActivity = () => {
    if (!modalData) return;
    const { dateId, id } = modalData;
    setEvents(prev => ({ ...prev, [dateId]: (prev[dateId] || []).filter(e => e.id !== id) }));
    setModalData(null);
  };

  const handleDragStart = (e, event, dateId) => {
    setDraggedItem({ ...event, sourceDateId: dateId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetDateId, targetHour) => {
    e.preventDefault();
    if (!draggedItem) return;
    const startIdx = GRID_HOURS.indexOf(draggedItem.startHour);
    const endIdx = GRID_HOURS.indexOf(draggedItem.endHour);
    const duration = endIdx - startIdx;
    const newStartIdx = GRID_HOURS.indexOf(targetHour);
    const newEndIdx = Math.min(newStartIdx + duration, GRID_HOURS.length - 1);

    setEvents(prev => {
      let nextEvents = { ...prev };
      const sourceId = draggedItem.sourceDateId;
      if (nextEvents[sourceId]) {
        nextEvents[sourceId] = nextEvents[sourceId].filter(ev => ev.id !== draggedItem.id);
      }
      if (!nextEvents[targetDateId]) nextEvents[targetDateId] = [];
      nextEvents[targetDateId].push({ ...draggedItem, startHour: GRID_HOURS[newStartIdx], endHour: GRID_HOURS[newEndIdx] });
      return { ...nextEvents };
    });
    setDraggedItem(null);
  };

    const stats = useMemo(() => {
    const catHours: Record<string, number> = {};
    const subCatHours: Record<string, number> = {};
    Object.values(categories).forEach(c => catHours[c.id] = 0);
    const targetYear = currentDate.getFullYear();
    const targetMonth = currentDate.getMonth();
    const weekStart = weekDays[0];
    const weekEnd = weekDays[6];

    Object.keys(events).forEach(dayId => {
      const [y, m, d] = dayId.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      let include = false;
      if (reportRange === 'year') include = (y === targetYear);
      else if (reportRange === 'month') include = (y === targetYear && (m - 1) === targetMonth);
      else include = (dateObj >= weekStart && dateObj <= weekEnd);

      if (include) {
        (events[dayId] || []).forEach(ev => {
          if (ev.completed && categories[ev.category]) {
            const s = GRID_HOURS.indexOf(ev.startHour);
            const e = GRID_HOURS.indexOf(ev.endHour);
            const duration = Math.max(0, (e - s) * 0.25);
            catHours[ev.category] += duration;
            const taskName = String(ev.task || 'Sin nombre');
            subCatHours[taskName] = (subCatHours[taskName] || 0) + duration;
          }
        });
      }
    });

    const total = Object.values(catHours).reduce((a: number, b: number) => a + b, 0);
    const mainStats = Object.entries(catHours).map(([id, hours]: [string, number]) => ({
      id, name: String(categories[id].label), hours, color: String(categories[id].color), percentage: total > 0 ? (((hours as number) / (total as number)) * 100).toFixed(0) : 0
    })).filter(s => s.hours > 0).sort((a,b) => b.hours - a.hours);

    const subStats = Object.entries(subCatHours).map(([name, hours]: [string, number]) => ({ name: String(name), hours })).filter(s => s.hours > 0).sort((a,b) => b.hours - a.hours);
    return { main: mainStats, sub: subStats, total };
  }, [events, categories, currentDate, reportRange, weekDays]);

  const downloadReport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    // Pequeña espera para asegurar que el DOM esté listo y las animaciones terminadas
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(reportRef.current!, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#f8fafc',
          logging: false,
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`LifeOS-Reporte-${reportRange}-${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (error) {
        console.error('Error al generar PDF:', error);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-indigo-950 items-center justify-center gap-4">
        <div className="bg-indigo-500 p-3 rounded-2xl shadow-inner animate-pulse">
          <Zap size={32} className="text-white" fill="white" />
        </div>
        <p className="text-indigo-300 text-xs font-black uppercase tracking-[0.3em]">Cargando LifeOS…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans select-none">

      {/* ---- HEADER LIFEOS ---- */}
      <header className="bg-indigo-950 border-b border-indigo-900/50 px-4 md:px-6 py-3 flex justify-between items-center z-[100] shrink-0 shadow-lg">
        <div className="flex items-center gap-3 text-white">
          {section === 'tiempo' && (
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-xl lg:hidden">
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500 p-1.5 rounded-lg shadow-inner"><Zap size={18} fill="white" /></div>
            <h1 className="text-lg font-black tracking-tight uppercase italic leading-none hidden sm:block">LifeOS</h1>
          </div>
          {section === 'tiempo' && (
            <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 ml-1">
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-1 hover:bg-white/10 rounded-full transition-all"><ChevronLeft size={16}/></button>
              <span className="px-3 text-xs font-bold min-w-[110px] text-center capitalize text-indigo-100">
                {weekDays[0]?.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-1 hover:bg-white/10 rounded-full transition-all"><ChevronRight size={16}/></button>
            </div>
          )}
        </div>

        {/* Section tabs — desktop */}
        <div className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/10 gap-0.5">
          {SECTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-all ${section === key ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-300 hover:text-white hover:bg-white/10'}`}
            >
              <Icon size={12} />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-white">
          {/* Total horas — solo en sección Tiempo */}
          {section === 'tiempo' && (
            <div className="hidden sm:flex flex-col items-end border-r border-white/10 pr-3">
              <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest leading-none mb-1">Total Real</span>
              <span className="text-xl font-black leading-none">{stats.total}h</span>
            </div>
          )}

          {/* Menú de usuario */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className={`flex items-center gap-2 border rounded-full pl-1 pr-2.5 py-1 transition-all ${userMenuOpen ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              {/* Avatar con iniciales */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[11px] font-black shadow-sm shrink-0">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              {/* Username (parte antes del @) */}
              <span className="text-[10px] font-bold text-indigo-200 hidden sm:block max-w-[90px] truncate leading-none">
                {user?.email?.split('@')[0]}
              </span>
              <ChevronDown size={11} className={`text-indigo-400 transition-transform shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-[#1a1d2e] border border-indigo-800/60 rounded-2xl shadow-2xl overflow-hidden z-[200] animate-in fade-in slide-in-from-top-1 duration-150">

                {/* Cabecera del menú */}
                <div className="p-4 border-b border-indigo-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xl font-black shadow-lg shrink-0">
                      {user?.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-black truncate capitalize">
                        {user?.email?.split('@')[0]}
                      </p>
                      <p className="text-indigo-400 text-[10px] font-medium truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="p-2">
                  <button
                    onClick={() => { signOut(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    <LogOut size={14} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {isMobile && sidebarOpen && section === 'tiempo' && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]" onClick={() => setSidebarOpen(false)}/>
        )}

        {/* Sidebar — only in tiempo section */}
        {section === 'tiempo' && (
          <aside className={`fixed inset-y-0 left-0 z-[120] w-80 bg-white border-r transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shrink-0 overflow-y-auto custom-scrollbar`}>
            <div className="p-6 space-y-8 pb-24 lg:pb-6">
              <section>
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Palette size={14} className="text-indigo-600" /> Mis Áreas</h3>
                  <button onClick={() => setCatModal({ id: generateId(), label: '', short: '', color: '#6366f1', presets: [] })} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Plus size={14} /></button>
                </div>
                <div className="space-y-1">
                  {Object.values(categories).map(cat => (
                    <div key={cat.id} className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                          <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter">{cat.presets?.length || 0} Sub-actividades</span>
                        </div>
                      </div>
                      <button onClick={() => setCatModal(cat)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all"><Edit2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-50 rounded-[2.5rem] p-6 border border-slate-100 shadow-inner">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><History size={14} className="text-indigo-600" /> Histórico</h3>
                  <div className="flex bg-slate-200 p-0.5 rounded-full text-[8px] font-black">
                    {['week', 'month', 'year'].map(r => (
                      <button key={r} onClick={() => setReportRange(r)} className={`px-3 py-1.5 rounded-full uppercase transition-all ${reportRange === r ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {r === 'week' ? 'Sem' : r === 'month' ? 'Mes' : 'Año'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-44 relative mb-4">
                  {stats.main.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={stats.main} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="hours" strokeWidth={0}>
                          {stats.main.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '10px', fontWeight: 'black', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} formatter={(val) => [`${val}h`, 'Tiempo']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-20"><Target size={32} /><p className="text-[9px] font-bold uppercase mt-2">Sin Datos</p></div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Distribución de Áreas</p>
                    {stats.main.map(s => (
                      <div key={s.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight"><span className="text-slate-600">{s.name}</span><span className="text-indigo-600">{s.hours}h ({s.percentage}%)</span></div>
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden"><div className="h-full transition-all duration-700 ease-out" style={{ backgroundColor: s.color, width: `${s.percentage}%` }} /></div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 flex items-center justify-between">
                      <span>Actividades Específicas</span>
                      <span className="text-[8px] opacity-60">Top 5</span>
                    </p>
                    <div className="space-y-2">
                      {stats.sub.length > 0 ? stats.sub.slice(0, 5).map((s, i) => (
                        <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm transition-all hover:scale-[1.02] hover:border-indigo-100">
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-[9px] font-black text-slate-600 uppercase truncate leading-tight">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/50">{s.hours}h</span>
                          </div>
                        </div>
                      )) : (
                        <p className="text-[10px] text-slate-400 italic text-center py-2">Agrega datos para ver el desglose.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        )}

        <main className={`flex-1 overflow-hidden flex flex-col bg-slate-100/30 relative ${isMobile ? 'pb-16' : ''}`}>

          {/* Template oculto para exportación PDF (A4 optimizado) */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div ref={reportRef} className="w-[210mm] p-[20mm] bg-slate-50 font-sans text-slate-900">
              <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-6 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-indigo-600 p-2 rounded-lg"><Zap size={24} className="text-white" fill="white" /></div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-indigo-950">LifeOS</h1>
                  </div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-indigo-600">Reporte de Revisión Integral</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-400 uppercase">Periodo de Análisis</p>
                  <p className="text-lg font-black text-slate-800 capitalize">
                    {reportRange === 'week' ? 'Semana Actual' : reportRange === 'month' ? 'Mes Actual' : 'Año Actual'}
                  </p>
                  <p className="text-xs font-bold text-slate-500">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Grid Principal: Tiempo y Dinero */}
              <div className="grid grid-cols-2 gap-10 mb-10">
                {/* Columna Izquierda: Gestión del Tiempo */}
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Distribución del Tiempo</h3>
                    <div className="space-y-4">
                      {stats.main.map(s => (
                        <div key={s.id} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-black uppercase gap-4">
                            <span className="text-slate-600 flex-1">{s.name}</span>
                            <span className="text-indigo-600 shrink-0">{s.hours}h ({s.percentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full" style={{ backgroundColor: s.color, width: `${s.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="pt-6 border-t border-slate-100 mt-6 flex justify-between items-center">
                        <span className="text-sm font-black text-slate-400 uppercase">Total Productivo</span>
                        <span className="text-2xl font-black text-indigo-600">{stats.total}h</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Finanzas y Objetivos */}
                <div className="space-y-8">
                  {/* Finanzas */}
                  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Resumen Financiero</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {(() => {
                        const rangeTxs = transactions.filter(tx => {
                          const [y, m, d] = tx.date.split('-').map(Number);
                          const date = new Date(y, m - 1, d);
                          if (reportRange === 'week') return date >= weekDays[0] && date <= weekDays[6];
                          if (reportRange === 'month') return y === currentDate.getFullYear() && m - 1 === currentDate.getMonth();
                          return y === currentDate.getFullYear();
                        });
                        const income = rangeTxs.filter(t => t.type === 'income' && t.finCategoryId !== LOAN_IN_CAT_ID).reduce((s, t) => s + t.amount, 0);
                        const expenses = rangeTxs.filter(t => t.type === 'expense' && t.finCategoryId !== LOAN_OUT_CAT_ID).reduce((s, t) => s + t.amount, 0);
                        return (
                          <>
                            <div className="bg-emerald-50 p-4 rounded-2xl flex justify-between items-center">
                              <span className="text-xs font-black text-slate-500 uppercase">Ingresos</span>
                              <span className="text-lg font-black text-emerald-600">${fmtCurrency(income)}</span>
                            </div>
                            <div className="bg-red-50 p-4 rounded-2xl flex justify-between items-center">
                              <span className="text-xs font-black text-slate-500 uppercase">Gastos</span>
                              <span className="text-lg font-black text-red-500">${fmtCurrency(expenses)}</span>
                            </div>
                            <div className="pt-4 border-t border-slate-100 mt-2 flex justify-between items-center px-4">
                              <span className="text-sm font-black text-slate-400 uppercase">Balance Neto</span>
                              <span className="text-2xl font-black text-indigo-600">${fmtCurrency(income - expenses)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Objetivos */}
                  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Cumplimiento de Objetivos</h3>
                    <div className="flex items-center gap-6">
                      {(() => {
                        const weekId = formatDateId(weekDays[0]); // Aproximación, pero mejor usar getWeekId si estuviera disponible
                        // Nota: getWeekId está en utils. Usémoslo.
                        const rangeGoals = goals.filter(g => {
                          if (reportRange === 'week') return g.weekId === getWeekId(currentDate);
                          if (reportRange === 'month') {
                             const [gy, gm] = (g.createdAt || "").split('-').map(Number);
                             return gy === currentDate.getFullYear() && gm - 1 === currentDate.getMonth();
                          }
                          return new Date(g.createdAt).getFullYear() === currentDate.getFullYear();
                        });
                        const completed = rangeGoals.filter(g => g.completed).length;
                        const total = rangeGoals.length;
                        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
                        return (
                          <>
                            <div className="flex-1">
                              <p className="text-sm font-black text-slate-700 uppercase">Logrados / Planeados</p>
                              <p className="text-3xl font-black text-indigo-600">{completed} / {total}</p>
                            </div>
                            <div className="w-16 h-16 rounded-full border-4 border-indigo-600 flex items-center justify-center">
                              <span className="text-sm font-black text-indigo-600">{rate}%</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actividades Detalladas */}
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-10">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Top Actividades Realizadas</h3>
                <div className="grid grid-cols-2 gap-4">
                  {stats.sub.slice(0, 10).map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-xs font-black text-slate-700 uppercase pr-4 leading-tight flex-1">{s.name}</span>
                      <span className="text-xs font-black text-indigo-600 bg-white px-3 py-1 rounded-lg shadow-sm border border-indigo-50 shrink-0">{s.hours}h</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer / Nota Final */}
              <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                  <div className="max-w-xl">
                    <h2 className="text-2xl font-black mb-2 uppercase italic">Análisis Estratégico</h2>
                    <p className="text-indigo-200 text-sm leading-relaxed font-medium">
                      Este reporte consolida tu ejecución en tiempo, finanzas y objetivos. 
                      La clave del crecimiento es la revisión constante. Utiliza estos datos para ajustar tu enfoque en la siguiente semana y maximizar tu impacto personal.
                    </p>
                  </div>
                  <Zap size={100} className="text-white/10 shrink-0" fill="white" />
                </div>
              </div>
              
              <div className="mt-12 text-center border-t border-slate-200 pt-8">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">LifeOS — Generado Automáticamente por tu Sistema de Vida</p>
              </div>
            </div>
          </div>

          {/* ---- TIEMPO SECTION ---- */}
          {section === 'tiempo' && (
            <>
              {isMobile && (
                <div className="bg-white border-b px-2 py-2 flex justify-around items-center shrink-0 sticky top-0 z-[60]" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                  {weekDays.map((date, i) => {
                    const isActive = mobileDayOffset === i + 1;
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <button key={i} onClick={() => setMobileDayOffset(i + 1)}
                        className={`flex flex-col items-center justify-center w-[13%] py-2.5 rounded-2xl transition-all active:scale-95 ${isActive ? 'bg-indigo-600 shadow-md' : ''}`}>
                        <span className={`text-[9px] font-black uppercase tracking-wide leading-none ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>{WEEK_DAYS_SHORT[i][0]}</span>
                        <span className={`text-[18px] font-black mt-0.5 leading-none ${isActive ? 'text-white' : isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{date.getDate()}</span>
                        <div className={`w-1 h-1 rounded-full mt-1 ${isToday ? (isActive ? 'bg-white/50' : 'bg-indigo-500') : 'bg-transparent'}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar scroll-smooth">
                <div className="mt-3 md:mt-6 px-3 pb-3 md:px-6 md:pb-6">
                  <div className="inline-block min-w-full bg-white rounded-[2.5rem] shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className={`grid ${isMobile ? 'grid-cols-[60px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'} sticky top-0 z-[50] bg-indigo-950 text-white`}>
                      {!isMobile && <div className="p-4 border-r border-white/10 flex items-center justify-center text-indigo-300 font-black text-[9px] tracking-[0.2em] bg-indigo-950 sticky left-0 z-[51]">HORARIO</div>}
                      {weekDays.map((date) => {
                        const isVisible = !isMobile || (formatDateId(date) === formatDateId(currentVisibleDays[0]));
                        if (!isVisible) return null;
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                          <div key={formatDateId(date)} className={`p-4 text-center border-r border-white/5 flex flex-col gap-1 bg-indigo-950 ${isToday ? 'bg-indigo-800/40' : ''}`}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-300 leading-none">{date.toLocaleDateString('es-ES', { weekday: 'long' })}</span>
                            <span className={`text-xl font-black font-sans ${isToday ? 'text-indigo-400' : 'text-white'}`}>{date.getDate()}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className={`grid ${isMobile ? 'grid-cols-[60px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'} relative`}>
                      <div className={`flex flex-col border-r bg-slate-50/80 sticky left-0 z-[45] md:bg-slate-100/90 backdrop-blur-sm`}>
                        {GRID_HOURS.slice(0, -1).map((hour) => (
                          <div key={hour} style={{ height: `${SEGMENT_HEIGHT}px` }} className={`flex items-center justify-center text-[9px] font-black ${hour.endsWith(':00') ? 'text-slate-500 bg-slate-200/40 border-b border-slate-200' : 'text-transparent'}`}>
                            {hour.endsWith(':00') ? hour : ""}
                          </div>
                        ))}
                      </div>

                      {currentVisibleDays.map((date) => {
                        const dateId = formatDateId(date);
                        const dayEvents = events[dateId] || [];
                        return (
                          <div key={dateId} className="border-r h-full relative min-w-[140px]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, dateId, draggedItem?.startHour)}>
                            <div className="absolute inset-0 z-0">
                              {GRID_HOURS.slice(0, -1).filter(h => h.endsWith(':00') || h.endsWith(':30')).map((hour) => (
                                <div key={hour} onClick={() => handleOpenModal(date, hour)} style={{ height: `${FIELD_HEIGHT}px` }} className={`transition-colors cursor-pointer flex items-center justify-center group/cell border-slate-100 ${hour.endsWith(':30') ? 'border-b border-dashed opacity-30' : 'border-b'}`}><Plus size={14} className="text-indigo-200 opacity-0 group-hover/cell:opacity-100 scale-75" /></div>
                              ))}
                            </div>
                            {dayEvents.map((event) => {
                              const sIdx = GRID_HOURS.indexOf(event.startHour);
                              const eIdx = GRID_HOURS.indexOf(event.endHour);
                              const span = eIdx - sIdx;
                              const cat = categories[event.category] || { color: '#cbd5e1', short: '??' };
                              const isSmall = span <= 2;
                              return (
                                <div key={event.id} draggable onDragStart={(e) => handleDragStart(e, event, dateId)} onClick={(e) => { e.stopPropagation(); handleOpenModal(date, event.startHour, event); }}
                                  className={`absolute inset-x-1 z-10 rounded-xl overflow-hidden cursor-pointer transition-all ${draggedItem?.id === event.id ? 'opacity-20 scale-95' : 'hover:brightness-95 active:scale-[0.98]'}`}
                                  style={{ top: `${sIdx * SEGMENT_HEIGHT + 2}px`, height: `${(eIdx - sIdx) * SEGMENT_HEIGHT - 4}px`, backgroundColor: event.completed ? `${cat.color}18` : 'white', border: `1px solid ${event.completed ? cat.color + '40' : '#e2e8f0'}`, borderLeft: `3px solid ${cat.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                  <div className={`h-full flex flex-col overflow-hidden relative ${span === 1 ? 'px-2 py-0 justify-center' : isSmall ? 'px-2 py-1' : 'px-2.5 pt-1.5 pb-1.5'}`}>
                                    <div className={`flex items-start gap-1 overflow-hidden ${event.completed ? 'pr-4' : ''}`}>
                                      <span className={`font-black leading-tight flex-1 overflow-hidden ${isSmall ? 'text-[9px]' : 'text-[10px]'} ${event.completed ? 'text-slate-600' : 'text-slate-800'} ${span === 1 ? 'leading-[1.1]' : ''}`}>{event.task}</span>
                                    </div>
                                    {event.completed && (
                                      <div className={`absolute right-1.5 ${span === 1 ? 'top-1/2 -translate-y-1/2' : 'top-2'}`}>
                                        <CheckCircle2 size={12} className="text-emerald-500 bg-white/20 rounded-full" />
                                      </div>
                                    )}
                                    {!isSmall && <span className="text-[8px] font-bold mt-auto leading-none" style={{ color: `${cat.color}bb` }}>{event.startHour} – {event.endHour}</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Action Button for Tiempo */}
              <button
                onClick={() => {
                  const now = new Date();
                  const currentHour = now.getHours().toString().padStart(2, '0');
                  handleOpenModal(now, `${currentHour}:00`);
                }}
                className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all z-[100]"
              >
                <Plus size={24} />
              </button>
            </>
          )}

          {/* ---- OTHER SECTIONS ---- */}
          {section === 'dinero' && (
            <Dinero
              transactions={transactions}
              setTransactions={setTransactions}
              finCategories={finCategories}
              setFinCategories={setFinCategories}
              savings={savings}
              setSavings={setSavings}
              monthBalances={monthBalances}
              setMonthBalances={setMonthBalances}
              savingsWithdrawals={savingsWithdrawals}
              setSavingsWithdrawals={setSavingsWithdrawals}
              savingsPockets={savingsPockets}
              setSavingsPockets={setSavingsPockets}
              pocketFundings={pocketFundings}
              setPocketFundings={setPocketFundings}
              savingsYearBalances={savingsYearBalances}
              setSavingsYearBalances={setSavingsYearBalances}
              loans={loans}
              setLoans={setLoans}
              loanPayments={loanPayments}
              setLoanPayments={setLoanPayments}
              budgets={budgets}
              setBudgets={setBudgets}
              initialFinCategories={INITIAL_FIN_CATEGORIES}
              currentDate={currentDate}
            />
          )}
          {section === 'objetivos' && (
            <Objetivos
              goals={goals}
              setGoals={setGoals}
              categories={categories}
              currentDate={currentDate}
              events={events}
              tasks={tasks}
              setTasks={setTasks}
            />
          )}
          {section === 'lista' && (
            <Lista
              tasks={tasks}
              setTasks={setTasks}
              checklistItems={checklistItems}
              setChecklistItems={setChecklistItems}
              categories={categories}
              goals={goals}
              currentDate={currentDate}
            />
          )}
          {section === 'revision' && (
            <Revision
              events={events}
              categories={categories}
              transactions={transactions}
              finCategories={finCategories}
              goals={goals}
              tasks={tasks}
              currentDate={currentDate}
              onDownloadReport={downloadReport}
              isExporting={isExporting}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-indigo-950 border-t border-indigo-900/50 flex z-[150]">
          {SECTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all ${section === key ? 'text-indigo-400' : 'text-indigo-700 hover:text-indigo-500'}`}
            >
              <Icon size={20} />
              <span className="text-[8px] font-black uppercase">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* MODAL ACTIVIDAD */}
      {modalData && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2.5rem] shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>

            {/* Drag handle — mobile */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 md:px-8 md:py-5 flex justify-between items-center shrink-0 border-b border-slate-100">
              <div className="flex gap-3 items-center">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md transition-colors ${modalData.completed ? 'bg-emerald-500' : 'bg-indigo-600'}`}>
                  <Zap className="text-white" size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800 uppercase italic leading-tight">{modalData.mode === 'duplicate' ? 'Clonar Bloque' : 'Seguimiento'}</h2>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${modalData.completed ? 'text-emerald-500' : 'text-indigo-400'}`}>{modalData.completed ? 'Actividad completada' : 'Planificando'}</p>
                </div>
              </div>
              <button onClick={() => setModalData(null)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18}/></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 md:p-8 space-y-5">

                {/* Completed toggle */}
                {modalData.isEditing && modalData.mode === 'edit' && (
                  <button onClick={() => setModalData({...modalData, completed: !modalData.completed})}
                    className={`w-full px-4 py-3.5 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-[0.99] ${modalData.completed ? 'bg-emerald-50 border-emerald-400' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full transition-colors ${modalData.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {modalData.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </div>
                      <span className={`text-sm font-black ${modalData.completed ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {modalData.completed ? '¡Completada!' : '¿Completaste esta tarea?'}
                      </span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl ${modalData.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {modalData.completed ? 'Sí' : 'No'}
                    </span>
                  </button>
                )}

                {/* Energy + Impact */}
                {modalData.completed && (
                  <div className="grid grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${(modalData.energy || 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Energía invertida</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setModalData({...modalData, energy: modalData.energy === n ? 0 : n})}
                            className={`transition-all active:scale-90 ${n <= (modalData.energy || 0) ? 'text-amber-400' : 'text-slate-200'}`}>
                            <Star size={20} fill={n <= (modalData.energy || 0) ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${(modalData.impact || 0) > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Impacto generado</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setModalData({...modalData, impact: modalData.impact === n ? 0 : n})}
                            className={`transition-all active:scale-90 ${n <= (modalData.impact || 0) ? 'text-indigo-500' : 'text-slate-200'}`}>
                            <Star size={20} fill={n <= (modalData.impact || 0) ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Area selector */}
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Área</label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {Object.values(categories).map((cat) => {
                      const isActive = modalData.category === cat.id;
                      return (
                        <button key={cat.id} onClick={() => setModalData({...modalData, category: cat.id})}
                          className={`flex flex-col items-center gap-2 py-3 px-2 rounded-2xl text-[9px] font-black transition-all border-2 min-h-[60px] justify-center active:scale-95 ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-transparent bg-slate-50 opacity-50 grayscale hover:grayscale-0 hover:opacity-100'}`}>
                          <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} />
                          <span className="truncate w-full text-center uppercase tracking-tighter">{cat.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Task name */}
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Actividad</label>
                  <input type="text" placeholder="Nombre de la actividad..."
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl px-4 py-4 text-base font-black outline-none transition-all"
                    value={modalData.task} onChange={(e) => setModalData({...modalData, task: e.target.value})} />
                  {categories[modalData.category]?.presets?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 animate-in fade-in">
                      {categories[modalData.category].presets.map((preset, i) => (
                        <button key={i} onClick={() => setModalData({...modalData, task: String(preset)})}
                          className={`px-3.5 py-2 rounded-xl text-[10px] font-black border-2 transition-all active:scale-95 ${modalData.task === preset ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}`}>
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date + Time — unified card */}
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Fecha y hora</label>
                  <div className="bg-slate-50 rounded-2xl overflow-hidden border-2 border-transparent">
                    <div className="date-picker-container relative h-14 cursor-pointer group">
                      <div className="absolute inset-0 px-4 flex items-center justify-between pointer-events-none group-hover:bg-slate-100 transition-all">
                        <span className="text-sm font-black text-slate-700 capitalize">
                          {new Date(modalData.dateId + "T00:00").toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'long' })}
                        </span>
                        <CalendarDays size={16} className="text-indigo-400" />
                      </div>
                      <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 native-date-input"
                        value={modalData.dateId} onChange={(e) => setModalData({...modalData, dateId: e.target.value})} />
                    </div>
                    <div className="h-px bg-slate-200 mx-3" />
                    <div className="grid grid-cols-2 gap-1 p-2" style={{ height: isMobile ? '170px' : 'auto' }}>
                      <CustomTimePicker label="Inicio" hour={modalData.startHour} minute={modalData.startMin} onTimeChange={(h, m) => setModalData({...modalData, startHour: h, startMin: m})} isMobileView={isMobile} />
                      <CustomTimePicker label="Fin" hour={modalData.endHour} minute={modalData.endMin} minTime={`${modalData.startHour}:${modalData.startMin}`} onTimeChange={(h, m) => setModalData({...modalData, endHour: h, endMin: m})} isMobileView={isMobile} />
                    </div>
                  </div>
                </div>

                {/* Duplicate day picker */}
                {modalData.mode === 'duplicate' && (
                  <div className="space-y-3 p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center block">Días de copia</label>
                    <div className="flex justify-between gap-1.5">
                      {weekDays.map((date, idx) => {
                        const isSel = (modalData.selectedDays || []).includes(idx);
                        return (
                          <button key={idx} onClick={() => { const current = modalData.selectedDays || []; const next = isSel ? current.filter(d => d !== idx) : [...current, idx]; setModalData({...modalData, selectedDays: next}); }}
                            className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${isSel ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-indigo-100'}`}>
                            {WEEK_DAYS_SHORT[idx][0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`px-5 py-4 md:px-8 flex gap-3 shrink-0 border-t transition-colors duration-300 md:rounded-b-[2.5rem] ${modalData.completed ? 'bg-emerald-600 border-emerald-500' : 'bg-indigo-950 border-indigo-900'}`}
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              {modalData.isEditing && (
                <div className="flex gap-2">
                  <button onClick={deleteActivity} className="p-3.5 rounded-2xl text-red-400 hover:bg-white/10 border border-red-500/20 transition-all active:scale-90"><Trash2 size={18} /></button>
                  <button onClick={() => setModalData({...modalData, mode: 'duplicate', selectedDays: []})} className="p-3.5 rounded-2xl text-slate-300 hover:bg-white/10 border border-white/10 transition-all active:scale-90"><Copy size={18} /></button>
                </div>
              )}
              <button onClick={saveActivity}
                className={`flex-1 py-4 rounded-2xl font-black shadow-lg active:scale-[0.98] uppercase text-xs tracking-widest transition-all ${modalData.completed ? 'bg-white text-emerald-600 hover:bg-emerald-50' : 'bg-indigo-500 text-white hover:bg-indigo-400'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÁREA */}
      {catModal && (
        <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <h2 className="text-base font-black text-slate-800 uppercase italic">Editar Área</h2>
              <button onClick={() => setCatModal(null)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nombre</label>
                <input type="text" value={catModal.label || ""} onChange={e => setCatModal({...catModal, label: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tag (4 letras)</label>
                  <input type="text" maxLength={4} value={catModal.short || ""} onChange={e => setCatModal({...catModal, short: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none text-center transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Color</label>
                  <input type="color" value={catModal.color || "#000000"} onChange={e => setCatModal({...catModal, color: e.target.value})} className="w-full h-[54px] rounded-2xl cursor-pointer bg-transparent border-2 border-slate-100" />
                </div>
              </div>
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><ListPlus size={13}/> Actividades Sugeridas</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nueva actividad..." value={newPreset} onChange={e => setNewPreset(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPresetToCat()} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-200 transition-all" />
                  <button onClick={addPresetToCat} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all active:scale-90"><Plus size={18}/></button>
                </div>
                <div className="space-y-1.5">
                  {(catModal.presets || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 bg-indigo-50 px-3 py-2.5 rounded-xl border border-indigo-100">
                      <input type="text" value={String(p)} onChange={(e) => updatePreset(i, e.target.value)} className="flex-1 bg-transparent text-[11px] font-black text-indigo-700 outline-none border-none focus:ring-0" />
                      <button onClick={() => removePreset(i)} className="text-indigo-300 hover:text-red-500 transition-all p-0.5 active:scale-90"><X size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3 shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={() => handleDeleteCategory(catModal.id)} className="p-3.5 rounded-xl text-red-400 hover:bg-red-50 border border-red-100 transition-all active:scale-90"><Trash2 size={18}/></button>
              <button onClick={handleSaveCategory} className="flex-1 bg-indigo-600 text-white font-black rounded-2xl py-4 hover:bg-indigo-700 shadow-md text-xs uppercase tracking-widest transition-all active:scale-[0.98]">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        select { -webkit-appearance: none; appearance: none; }
        .native-date-input::-webkit-calendar-picker-indicator { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 0; cursor: pointer; opacity: 0; }
        [draggable] { user-select: none; -webkit-user-drag: element; }
      `}</style>
    </div>
  );
};

export default App;
export { App as LifeFlow };
