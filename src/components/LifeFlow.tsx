import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Clock, Save, Zap, ChevronLeft, ChevronRight, X, Plus,
  PieChart as PieChartIcon, Trash2, CalendarDays, Menu, Copy, CheckCircle2, Circle, Edit2, Palette,
  Download, ListPlus, Target, BarChart3, History, DollarSign, Star, ChevronDown, LogOut, CheckSquare,
  Sparkles, Keyboard, Home, MoreHorizontal, Search, GripVertical, Flame, GraduationCap, Shield, KeyRound,
} from 'lucide-react';
import Dinero from './modules/Dinero';
import Objetivos from './modules/Objetivos';
import Revision from './modules/Revision';
import Lista from './modules/Lista';
import Hoy from './modules/Hoy';
import Habitos from './modules/Habitos';
import Admin from './modules/Admin';
import Academia from './modules/Academia';
import SearchModal, { type SearchResult } from './SearchModal';
import type { Transaction, FinCategory, Goal, Savings, MonthBalance, SavingsWithdrawal, SavingsPocket, PocketFunding, SavingsYearBalance, Loan, LoanPayment, Budget, Task, ChecklistItem, EventEntry, Habit, HabitLog } from '../types';
import { LOAN_OUT_CAT_ID, LOAN_IN_CAT_ID } from '../types';
import { generateId, formatDateId as fmtDateId, getWeekDays, GRID_HOURS, fmtCurrency, getWeekId } from '../lib/utils';
import {
  loadAllData, migrateFromLocalStorage,
  loadEvents, loadCategories, loadTransactions, loadFinCategories, loadGoals,
  loadSavings, loadMonthBalances, loadSavingsWithdrawals, loadSavingsPockets,
  loadPocketFundings, loadSavingsYearBalances, loadLoans, loadLoanPayments,
  loadBudgets, loadTasks, loadChecklistItems, loadHabits, loadHabitLogs,
  syncEvents, syncCategories, syncTransactions, syncFinCategories, syncGoals,
  syncSavings, syncMonthBalances, syncSavingsWithdrawals, syncSavingsPockets,
  syncPocketFundings, syncSavingsYearBalances, syncLoans, syncLoanPayments, syncBudgets,
  syncTasks, syncChecklistItems, syncHabits, syncHabitLogs,
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


type SectionKey = 'hoy' | 'tiempo' | 'dinero' | 'objetivos' | 'lista' | 'revision' | 'habitos' | 'academia' | 'admin';

const SECTIONS: Array<{ key: SectionKey; label: string; Icon: React.FC<{ size?: number }> }> = [
  { key: 'hoy',      label: 'Inicio',   Icon: Home },
  { key: 'dinero',   label: 'Dinero',   Icon: DollarSign },
  { key: 'tiempo',   label: 'Agenda',   Icon: CalendarDays },
  { key: 'lista',    label: 'Tareas',   Icon: CheckSquare },
  { key: 'habitos',  label: 'Hábitos',  Icon: Flame },
  { key: 'objetivos',label: 'Objetivos',Icon: Target },
  { key: 'revision', label: 'Revisión', Icon: BarChart3 },
  { key: 'academia', label: 'Academia', Icon: GraduationCap },
];

// Secciones en el nav mobile principal (sin Hábitos/Objetivos/Revisión — van en "Más")
const MOBILE_NAV = SECTIONS.filter(s => ['hoy','dinero','tiempo','lista'].includes(s.key));
const MORE_SECTIONS = SECTIONS.filter(s => ['habitos','objetivos','revision','academia'].includes(s.key));

const App = () => {
  const { user, signOut, displayName, updateDisplayName, isSuperAdmin } = useAuth();
  const userId = user?.id ?? '';

  // ── Módulos habilitados por empresa ───────────────────────────────────────────
  // null = sin restricción (usuario personal o super_admin) → se muestran todos
  // string[] = lista de moduleKeys habilitados para la empresa del usuario
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user || isSuperAdmin) { setEnabledModules(null); return; }
    const fetchModules = async () => {
      // Empresa del usuario
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) { setEnabledModules(null); return; } // sin empresa → todo habilitado

      // Módulos configurados para esa empresa
      const { data: mods } = await supabase
        .from('company_modules')
        .select('module_key, enabled')
        .eq('company_id', membership.company_id);

      if (!mods || mods.length === 0) { setEnabledModules(null); return; } // sin config → todo habilitado

      const enabled = mods.filter(m => m.enabled).map(m => m.module_key as string);
      setEnabledModules(enabled);
    };
    fetchModules();
  }, [user, isSuperAdmin]);

  // Helper: ¿está habilitado este módulo para el usuario actual?
  // 'hoy' y 'admin' siempre están habilitados (no son módulos configurables)
  const isModuleEnabled = (key: string) => key === 'hoy' || key === 'admin' || isSuperAdmin || enabledModules === null || enabledModules.includes(key);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showSearch, setShowSearch]         = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError]  = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const closePasswordModal = () => {
    setShowChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
    setPasswordSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Las contraseñas no coinciden.'); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) { setPasswordError(error.message); }
    else { setPasswordSuccess(true); setTimeout(() => { closePasswordModal(); }, 2000); }
  };

  const [showMoreMenu, setShowMoreMenu]   = useState(false);
  const [profileName, setProfileName]     = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);

  const [streak, setStreak] = useState(0);

  // ── Conexión y estado de guardado ─────────────────────────────────────────────
  // Siempre inicia en true: navigator.onLine no es confiable en dev/HMR.
  // El banner solo aparece si la desconexión persiste más de 3 segundos.
  const [isOnline, setIsOnline] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaving = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    }, 900);
  };

  // ── Estado principal ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState({});
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [modalData, setModalData] = useState(null);
  const [catModal, setCatModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draggedItem, setDraggedItem] = useState(null);
  const [mobileDayOffset, setMobileDayOffset] = useState(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  });
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [newPreset, setNewPreset] = useState("");
  const [reportRange, setReportRange] = useState('week');
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [section, setSection] = useState<SectionKey>('hoy');
  const [showShortcuts, setShowShortcuts] = useState(false);
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
  const [habits, setHabits]                         = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs]                   = useState<HabitLog[]>([]);

  // ── Carga inicial desde Supabase (con migración automática de localStorage) ─
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setLoadError(false);
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
        setHabits(d.habits ?? []);
        setHabitLogs(d.habitLogs ?? []);

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
        prevHabits.current             = d.habits ?? [];
        prevHabitLogs.current          = d.habitLogs ?? [];

      } catch (err) {
        console.error('Error al cargar datos de Supabase:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId, retryKey]); // retryKey fuerza re-init al pulsar "Reintentar"

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
  const prevHabits              = useRef(habits);
  const prevHabitLogs           = useRef(habitLogs);

  // Flag por tabla: true cuando el cambio vino de RT (no de acción local).
  // El sync-effect lo detecta, actualiza prevXxx y omite el upsert a Supabase,
  // evitando el loop local SIN bloquear eventos RT posteriores de otros dispositivos.
  const isRTUpdate = useRef<Record<string, boolean>>({});

  // Refs para funciones de apertura de modales en componentes hijos
  const listOpenEditRef = useRef<(task: Task) => void>(null);
  const objetivosOpenEditRef = useRef<(goal: Goal) => void>(null);
  const dineroOpenEditRef = useRef<(tx: Transaction) => void>(null);
  const tiempoHandleOpenModalRef = useRef<(date: Date, hour: string, event?: typeof events[keyof typeof events][0]) => void>(null);

  // Helper: marca flag, actualiza prev y omite sync si el cambio es de RT.
  // Devuelve true cuando hay que saltar el sync.
  const skipIfRT = (table: string, prev: React.MutableRefObject<unknown>, curr: unknown): boolean => {
    if (isRTUpdate.current[table]) {
      isRTUpdate.current[table] = false;
      (prev as React.MutableRefObject<unknown>).current = curr;
      return true;
    }
    return false;
  };

  // ── Sincronización con Supabase (fire-and-forget, sin bloquear la UI) ───────

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('events', prevEvents, events)) return;
    markSaving();
    syncEvents(prevEvents.current, events, userId).catch(console.error);
    prevEvents.current = events;
  }, [events, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('categories', prevCategories, categories)) return;
    markSaving();
    syncCategories(prevCategories.current, categories, userId).catch(console.error);
    prevCategories.current = categories;
  }, [categories, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('transactions', prevTransactions, transactions)) return;
    markSaving();
    syncTransactions(prevTransactions.current, transactions, userId).catch(console.error);
    prevTransactions.current = transactions;
  }, [transactions, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('fin_categories', prevFinCategories, finCategories)) return;
    markSaving();
    syncFinCategories(prevFinCategories.current, finCategories, userId).catch(console.error);
    prevFinCategories.current = finCategories;
  }, [finCategories, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('goals', prevGoals, goals)) return;
    markSaving();
    syncGoals(prevGoals.current, goals, userId).catch(console.error);
    prevGoals.current = goals;
  }, [goals, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('savings', prevSavings, savings)) return;
    markSaving();
    syncSavings(prevSavings.current, savings, userId).catch(console.error);
    prevSavings.current = savings;
  }, [savings, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('month_balances', prevMonthBalances, monthBalances)) return;
    markSaving();
    syncMonthBalances(prevMonthBalances.current, monthBalances, userId).catch(console.error);
    prevMonthBalances.current = monthBalances;
  }, [monthBalances, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('savings_withdrawals', prevSavingsWithdrawals, savingsWithdrawals)) return;
    markSaving();
    syncSavingsWithdrawals(prevSavingsWithdrawals.current, savingsWithdrawals, userId).catch(console.error);
    prevSavingsWithdrawals.current = savingsWithdrawals;
  }, [savingsWithdrawals, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('savings_pockets', prevSavingsPockets, savingsPockets)) return;
    markSaving();
    syncSavingsPockets(prevSavingsPockets.current, savingsPockets, userId).catch(console.error);
    prevSavingsPockets.current = savingsPockets;
  }, [savingsPockets, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('pocket_fundings', prevPocketFundings, pocketFundings)) return;
    markSaving();
    syncPocketFundings(prevPocketFundings.current, pocketFundings, userId).catch(console.error);
    prevPocketFundings.current = pocketFundings;
  }, [pocketFundings, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('savings_year_balances', prevSavingsYearBalances, savingsYearBalances)) return;
    markSaving();
    syncSavingsYearBalances(prevSavingsYearBalances.current, savingsYearBalances, userId).catch(console.error);
    prevSavingsYearBalances.current = savingsYearBalances;
  }, [savingsYearBalances, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('loans', prevLoans, loans)) return;
    markSaving();
    syncLoans(prevLoans.current, loans, userId).catch(console.error);
    prevLoans.current = loans;
  }, [loans, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('loan_payments', prevLoanPayments, loanPayments)) return;
    markSaving();
    syncLoanPayments(prevLoanPayments.current, loanPayments, userId).catch(console.error);
    prevLoanPayments.current = loanPayments;
  }, [loanPayments, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('budgets', prevBudgets, budgets)) return;
    markSaving();
    syncBudgets(prevBudgets.current, budgets, userId).catch(console.error);
    prevBudgets.current = budgets;
  }, [budgets, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('tasks', prevTasks, tasks)) return;
    markSaving();
    syncTasks(prevTasks.current, tasks, userId).catch(console.error);
    prevTasks.current = tasks;
  }, [tasks, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('checklist_items', prevChecklistItems, checklistItems)) return;
    markSaving();
    syncChecklistItems(prevChecklistItems.current, checklistItems, userId).catch(console.error);
    prevChecklistItems.current = checklistItems;
  }, [checklistItems, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('habits', prevHabits, habits)) return;
    markSaving();
    syncHabits(prevHabits.current, habits, userId).catch(console.error);
    prevHabits.current = habits;
  }, [habits, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    if (skipIfRT('habit_logs', prevHabitLogs, habitLogs)) return;
    markSaving();
    syncHabitLogs(prevHabitLogs.current, habitLogs, userId).catch(console.error);
    prevHabitLogs.current = habitLogs;
  }, [habitLogs, loading, userId]);

  // ── Real-time: recibe cambios de otros dispositivos/tabs ─────────────────────
  // El flag isRTUpdate marca el update como "venido de RT" para que el
  // sync-effect lo salte sin upload. No hay cooldown → cada evento RT
  // siempre se aplica, sin bloquear cambios rápidos de otros dispositivos.
  useEffect(() => {
    if (!userId || loading) return;

    const f = `user_id=eq.${userId}`;
    const rt = isRTUpdate.current;

    const channel = supabase
      .channel(`lifeos-rt-${userId}`)

      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: f }, async () => {
        const fresh = await loadEvents();
        rt['events'] = true; prevEvents.current = fresh; setEvents(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: f }, async () => {
        const fresh = await loadCategories();
        rt['categories'] = true; prevCategories.current = fresh; setCategories(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: f }, async () => {
        const fresh = await loadTransactions();
        rt['transactions'] = true; prevTransactions.current = fresh; setTransactions(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fin_categories', filter: f }, async () => {
        const fresh = await loadFinCategories();
        rt['fin_categories'] = true; prevFinCategories.current = fresh; setFinCategories(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: f }, async () => {
        const fresh = await loadGoals();
        rt['goals'] = true; prevGoals.current = fresh; setGoals(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings', filter: f }, async () => {
        const fresh = await loadSavings();
        rt['savings'] = true; prevSavings.current = fresh; setSavings(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_balances', filter: f }, async () => {
        const fresh = await loadMonthBalances();
        rt['month_balances'] = true; prevMonthBalances.current = fresh; setMonthBalances(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_withdrawals', filter: f }, async () => {
        const fresh = await loadSavingsWithdrawals();
        rt['savings_withdrawals'] = true; prevSavingsWithdrawals.current = fresh; setSavingsWithdrawals(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_pockets', filter: f }, async () => {
        const fresh = await loadSavingsPockets();
        rt['savings_pockets'] = true; prevSavingsPockets.current = fresh; setSavingsPockets(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pocket_fundings', filter: f }, async () => {
        const fresh = await loadPocketFundings();
        rt['pocket_fundings'] = true; prevPocketFundings.current = fresh; setPocketFundings(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_year_balances', filter: f }, async () => {
        const fresh = await loadSavingsYearBalances();
        rt['savings_year_balances'] = true; prevSavingsYearBalances.current = fresh; setSavingsYearBalances(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: f }, async () => {
        const fresh = await loadLoans();
        rt['loans'] = true; prevLoans.current = fresh; setLoans(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_payments', filter: f }, async () => {
        const fresh = await loadLoanPayments();
        rt['loan_payments'] = true; prevLoanPayments.current = fresh; setLoanPayments(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: f }, async () => {
        const fresh = await loadBudgets();
        rt['budgets'] = true; prevBudgets.current = fresh; setBudgets(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: f }, async () => {
        const fresh = await loadTasks();
        rt['tasks'] = true; prevTasks.current = fresh; setTasks(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: f }, async () => {
        const fresh = await loadChecklistItems();
        rt['checklist_items'] = true; prevChecklistItems.current = fresh; setChecklistItems(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: f }, async () => {
        const fresh = await loadHabits();
        rt['habits'] = true; prevHabits.current = fresh; setHabits(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: f }, async () => {
        const fresh = await loadHabitLogs();
        rt['habit_logs'] = true; prevHabitLogs.current = fresh; setHabitLogs(fresh);
      })

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, loading]);

  // ── Onboarding: mostrar si el usuario no tiene nombre guardado ───────────────
  useEffect(() => {
    if (!loading && !loadError && !displayName) {
      setProfileName('');
      setShowOnboarding(true);
    }
  }, [loading, loadError, displayName]);

  // ── Racha de días activos (localStorage por usuario) ─────────────────────────
  useEffect(() => {
    if (!userId || loading) return;
    const key = `lifeos-streak-${userId}`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      localStorage.setItem(key, JSON.stringify({ lastVisit: todayStr, streak: 1 }));
      setStreak(1); return;
    }
    const { lastVisit, streak: s } = JSON.parse(stored) as { lastVisit: string; streak: number };
    if (lastVisit === todayStr) { setStreak(s); return; }

    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;

    const newStreak = lastVisit === yesterdayStr ? s + 1 : 1;
    localStorage.setItem(key, JSON.stringify({ lastVisit: todayStr, streak: newStreak }));
    setStreak(newStreak);
  }, [userId, loading]);

  const handleSaveName = async (name: string, isOnboarding = false) => {
    if (!name.trim()) {
      if (isOnboarding) setShowOnboarding(false);
      else setShowProfile(false);
      return;
    }
    setProfileSaving(true);
    await updateDisplayName(name);
    setProfileSaving(false);
    if (isOnboarding) setShowOnboarding(false);
    else setShowProfile(false);
  };

  // ── Detección de conexión con debounce de 3s ─────────────────────────────────
  // El debounce filtra cortes momentáneos de HMR/dev que disparan false positivos.
  useEffect(() => {
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
      setIsOnline(true);
      toast.success('Conexión restaurada', {
        description: 'Todos tus datos están sincronizados.',
        duration: 3000,
      });
    };

    const handleOffline = () => {
      // Esperar 3 s antes de mostrar el banner (descarta cortes momentáneos)
      offlineTimer = setTimeout(() => setIsOnline(false), 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (offlineTimer) clearTimeout(offlineTimer);
    };
  }, []);

  // ── Atajos de teclado (solo desktop, sin input activo) ───────────────────────
  useEffect(() => {
    const hasOpenModalRef = { current: false };
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K abre búsqueda global
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if ((e.target as HTMLElement).contentEditable === 'true') return;

      switch (e.key.toLowerCase()) {
        case 'h': setSection('hoy');       break;
        case 'd': setSection('dinero');    break;
        case 't': setSection('tiempo');    break;
        case 'l': setSection('lista');     break;
        case 'o': setSection('objetivos'); break;
        case 'r': setSection('revision');  break;
        case '?': setShowShortcuts(v => !v); break;
        case 'escape':
          setModalData(null);
          setCatModal(null);
          setShowShortcuts(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Auto-expandir el grupo correcto al cambiar de sección
  useEffect(() => {
    const g = SECTION_TO_GROUP[section as SectionKey];
    if (g) setExpandedGroups(prev => prev.includes(g) ? prev : [...prev, g]);
  }, [section]);

  // Redirigir a 'hoy' si la sección activa queda deshabilitada para este usuario
  useEffect(() => {
    if (enabledModules !== null && section !== 'hoy' && section !== 'admin' && !enabledModules.includes(section)) {
      setSection('hoy');
    }
  }, [enabledModules, section]);

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

  // Categorías ordenadas por sortOrder del usuario
  const sortedCategories = useMemo(() =>
    Object.values(categories).sort((a, b) =>
      ((a.sortOrder ?? 0) - (b.sortOrder ?? 0)) || a.label.localeCompare(b.label)
    ),
  [categories]);

  // Estado para DnD del sidebar de categorías (HTML5 nativo)
  const [draggingCatId, setDraggingCatId] = React.useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = React.useState<string | null>(null);

  const handleCatDrop = (targetId: string) => {
    if (!draggingCatId || draggingCatId === targetId) { setDraggingCatId(null); setDragOverCatId(null); return; }
    const sorted = [...sortedCategories];
    const fromIdx = sorted.findIndex(c => c.id === draggingCatId);
    const toIdx   = sorted.findIndex(c => c.id === targetId);
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const newCats = { ...categories };
    sorted.forEach((cat, i) => { newCats[cat.id] = { ...cat, sortOrder: (i + 1) * 1000 }; });
    setCategories(newCats);
    setDraggingCatId(null);
    setDragOverCatId(null);
  };

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

  // ── Autocompletado inteligente de actividades ────────────────────────────────
  const getFilteredPresets = (categoryId: string, searchText: string) => {
    if (!searchText.trim()) {
      // Si no hay búsqueda, mostrar todos
      return {
        matches: categories[categoryId]?.presets ?? [],
        exactMatch: false,
        canCreate: false
      };
    }

    const presets = categories[categoryId]?.presets ?? [];
    const trimmed = searchText.trim();
    const lowerTrimmed = trimmed.toLowerCase();

    // Filtro: actividades que contengan el texto (case-insensitive)
    const matches = presets.filter(p => p.toLowerCase().includes(lowerTrimmed));

    // ¿Hay coincidencia exacta?
    const exactMatch = matches.some(p => p.toLowerCase() === lowerTrimmed);

    // ¿Puede crear? Solo si no existe exactamente y el texto no está vacío
    const canCreate = !exactMatch && trimmed.length > 0;

    return { matches, exactMatch, canCreate };
  };

  const createPresetDynamically = (categoryId: string, presetName: string) => {
    const trimmed = presetName.trim();
    if (!trimmed || !categories[categoryId]) return;

    const preset = trimmed;
    const existingPresets = categories[categoryId].presets ?? [];

    // Evitar duplicados exactos (case-sensitive)
    if (existingPresets.includes(preset)) {
      // Si ya existe, solo seleccionarlo
      setModalData({ ...modalData, task: preset });
      return;
    }

    // Crear nuevo preset
    setCategories(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        presets: [...(prev[categoryId].presets ?? []), preset]
      }
    }));

    // Seleccionar automáticamente
    setModalData({ ...modalData, task: preset });
  };

  const handleDeleteCategory = (id) => {
    const newCats = { ...categories };
    delete newCats[id];
    setCategories(newCats);
    setCatModal(null);
  };

    const handleOpenModal = (dayDate: Date, hour: string, existingEvent: EventEntry | null = null) => {
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
        category: Object.keys(categories)[0] || '', task: '', isEditing: false, mode: 'edit', completed: false, selectedDays: [], energy: undefined, impact: undefined, habitId: undefined
      });
    }
  };

  // Manejador para búsqueda global: abre detalles de items encontrados
  const handleSearchSelect = (result: SearchResult) => {
    setSection(result.section);

    if (result.type === 'task') {
      const task = tasks.find(t => t.id === result.id);
      if (task && listOpenEditRef.current) {
        setTimeout(() => listOpenEditRef.current?.(task), 100);
      }
    } else if (result.type === 'goal') {
      const goal = goals.find(g => g.id === result.id);
      if (goal && objetivosOpenEditRef.current) {
        setTimeout(() => objetivosOpenEditRef.current?.(goal), 100);
      }
    } else if (result.type === 'event') {
      // Encontrar la fecha y evento
      const [dateId, event] = Object.entries(events)
        .flatMap(([dId, evs]) => evs.map(ev => [dId, ev] as const))
        .find(([_, ev]) => ev.id === result.id) ?? [null, null];

      if (dateId && event && tiempoHandleOpenModalRef.current) {
        const eventDate = new Date(dateId + 'T12:00:00');
        // Scrollear al día
        setTimeout(() => {
          const element = document.querySelector(`[data-day-id="${dateId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
        // Abrir el modal después del scroll
        setTimeout(() => tiempoHandleOpenModalRef.current?.(eventDate, event.startHour, event), 150);
      }
    } else if (result.type === 'transaction') {
      const tx = transactions.find(t => t.id === result.id);
      if (tx && dineroOpenEditRef.current) {
        setTimeout(() => dineroOpenEditRef.current?.(tx), 100);
      }
    }
  };

  // Asignar ref de handleOpenModal para búsqueda global
  useEffect(() => {
    tiempoHandleOpenModalRef.current = handleOpenModal;
  }, []);

  const saveActivity = () => {
    if (!modalData) return;
    const { dateId, id, startHour, startMin, endHour, endMin, category, task, mode, selectedDays, completed, energy, impact, habitId } = modalData;
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
            startHour: startStr, endHour: endStr, category, task: String(task), completed: mode === 'edit' ? !!completed : false, habitId: habitId || undefined
          });
        });
      } else {
        if (!nextEvents[dateId]) nextEvents[dateId] = [];
        nextEvents[dateId].push({ id, startHour: startStr, endHour: endStr, category, task: String(task), completed: !!completed, energy: energy || undefined, impact: impact || undefined, habitId: habitId || undefined });
      }
      return nextEvents;
    });

    // Auto-check hábito si la actividad está completada y tiene habitId
    if (completed && habitId) {
      const targetDate = dateId;
      const alreadyLogged = habitLogs.some(l => l.habitId === habitId && l.date === targetDate);
      if (!alreadyLogged) {
        setHabitLogs(prev => [...prev, { id: generateId(), habitId, date: targetDate }]);
        toast('🔗 Hábito marcado automáticamente', { duration: 2000 });
      }
    }

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

  // ── Grupos colapsables del sidebar ───────────────────────────────────────────
  const SECTION_TO_GROUP: Partial<Record<SectionKey, string>> = {
    tiempo: 'planificacion', lista: 'planificacion',
    habitos: 'crecimiento', objetivos: 'crecimiento', academia: 'crecimiento',
    dinero: 'finanzas',
    revision: 'reflexion',
  };
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['planificacion', 'crecimiento']);
  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // ── Desktop sidebar nav item ─────────────────────────────────────────────────
  const NavItem = ({ navKey, label, Icon, amber = false }: {
    navKey: SectionKey; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }>; amber?: boolean
  }) => {
    const isActive = section === navKey;
    return (
      <button
        onClick={() => setSection(navKey)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group ${
          isActive
            ? amber ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/25 text-white'
            : amber ? 'text-amber-500/60 hover:bg-amber-500/10 hover:text-amber-400' : 'text-indigo-400 hover:bg-white/5 hover:text-indigo-200'
        }`}
      >
        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
        <span className="truncate">{label}</span>
        {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${amber ? 'bg-amber-400' : 'bg-indigo-400'}`} />}
      </button>
    );
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

  if (loadError) {
    return (
      <div className="flex flex-col h-screen bg-indigo-950 items-center justify-center gap-5 p-6 text-center">
        <div className="bg-indigo-500 p-3 rounded-2xl shadow-inner">
          <Zap size={32} className="text-white" fill="white" />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 max-w-xs w-full space-y-4">
          <p className="text-white font-black text-base">No se pudo conectar</p>
          <p className="text-indigo-400 text-xs leading-relaxed">
            LifeOS no pudo cargar tus datos. Verifica tu conexión a internet e intenta de nuevo.
          </p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all active:scale-[0.98]"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen [height:100dvh] bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* ══ DESKTOP SIDEBAR ══════════════════════════════════════════════════════ */}
      <nav className="hidden lg:flex flex-col w-[220px] shrink-0 bg-indigo-950 border-r border-indigo-900/50 z-[100] overflow-hidden">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-500 p-1.5 rounded-lg shadow-inner shrink-0">
              <Zap size={18} fill="white" className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight uppercase italic text-white leading-none">LifeOS</span>
          </div>
        </div>

        {/* Búsqueda — fija, no hace scroll */}
        <div className="px-3 py-3 border-b border-indigo-900/50 shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-indigo-900/80 text-indigo-400 hover:bg-white/10 hover:text-indigo-200 transition-all text-sm font-bold"
          >
            <Search size={14} strokeWidth={2} />
            <span className="flex-1 text-left text-[13px]">Buscar</span>
            <kbd className="text-[9px] font-black text-indigo-600 bg-black/20 border border-indigo-900 px-1.5 py-0.5 rounded-md">⌘K</kbd>
          </button>
        </div>

        {/* Nav groups — scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2">

          {/* INICIO — acceso directo */}
          <button
            onClick={() => setSection('hoy')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
              section === 'hoy'
                ? 'bg-indigo-500/25 text-white'
                : 'text-indigo-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Home size={16} strokeWidth={section === 'hoy' ? 2.5 : 2} />
            <span className="flex-1 text-left">Inicio</span>
            {section === 'hoy' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
          </button>

          {/* GRUPOS COLAPSABLES */}
          {([
            { key: 'planificacion', label: 'Planificación', items: [
              { navKey: 'tiempo' as SectionKey, label: 'Agenda', Icon: CalendarDays },
              { navKey: 'lista'  as SectionKey, label: 'Tareas', Icon: CheckSquare },
            ]},
            { key: 'crecimiento', label: 'Crecimiento', items: [
              { navKey: 'habitos'   as SectionKey, label: 'Hábitos',   Icon: Flame },
              { navKey: 'objetivos' as SectionKey, label: 'Objetivos', Icon: Target },
              { navKey: 'academia'  as SectionKey, label: 'Academia',  Icon: GraduationCap },
            ]},
            { key: 'finanzas', label: 'Finanzas', items: [
              { navKey: 'dinero' as SectionKey, label: 'Dinero', Icon: DollarSign },
            ]},
            { key: 'reflexion', label: 'Reflexión', items: [
              { navKey: 'revision' as SectionKey, label: 'Revisión', Icon: BarChart3 },
            ]},
          ] as const).map(group => {
            // Filtrar items por módulos habilitados para la empresa del usuario
            const visibleItems = group.items.filter(i => isModuleEnabled(i.navKey));
            if (visibleItems.length === 0) return null; // ocultar grupo completo si no hay items

            const isExpanded = expandedGroups.includes(group.key);
            const isGroupActive = visibleItems.some(i => i.navKey === section);
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isGroupActive && !isExpanded
                      ? 'text-white'
                      : isGroupActive
                        ? 'text-indigo-200 hover:bg-white/5'
                        : 'text-indigo-400 hover:bg-white/5 hover:text-indigo-200'
                  }`}
                >
                  <span className="flex-1 text-left">{group.label}</span>
                  {isGroupActive && !isExpanded && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                  <ChevronRight size={13} className={`shrink-0 transition-transform duration-200 text-indigo-600 ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                {/* Sub-items */}
                {isExpanded && (
                  <div className="pb-1">
                    {visibleItems.map(item => (
                      <NavItem key={item.navKey} navKey={item.navKey} label={item.label} Icon={item.Icon} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom: admin + profile */}
        <div className="border-t border-indigo-900/50 p-3 space-y-1 shrink-0">
          {/* Admin — solo super_admin */}
          {isSuperAdmin && (
            <NavItem navKey="admin" label="Admin" Icon={Shield} amber />
          )}

          <div className="h-px bg-indigo-900/50 my-1" />

          {/* Perfil — botón con dropdown */}
          <div className="relative">
            <button
              onClick={() => setSidebarMenuOpen(v => !v)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${sidebarMenuOpen ? 'bg-white/10 text-white' : 'text-indigo-300 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[11px] font-black shrink-0">
                {(displayName || user?.email)?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-black text-indigo-200 truncate leading-none">{displayName || user?.email?.split('@')[0]}</p>
                <p className="text-[10px] text-indigo-500 truncate mt-0.5 leading-none">{user?.email}</p>
              </div>
              <ChevronDown size={13} className={`text-indigo-500 shrink-0 transition-transform ${sidebarMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown del perfil */}
            {sidebarMenuOpen && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setSidebarMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-2 z-[91] bg-[#1a1d2e] border border-indigo-800/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150">
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setProfileName(displayName); setShowProfile(true); setSidebarMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-indigo-300 hover:bg-white/5 hover:text-white text-xs font-bold text-left transition-all"
                    >
                      <Edit2 size={14} className="shrink-0" />
                      <span>Mi perfil</span>
                    </button>
                    <button
                      onClick={() => { setShowChangePassword(true); setSidebarMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-indigo-300 hover:bg-white/5 hover:text-white text-xs font-bold text-left transition-all"
                    >
                      <KeyRound size={14} className="shrink-0" />
                      <span>Cambiar contraseña</span>
                    </button>
                    <div className="h-px bg-indigo-800/40 mx-2" />
                    <button
                      onClick={() => { signOut(); setSidebarMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs font-bold text-left transition-all"
                    >
                      <LogOut size={14} className="shrink-0" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ══ RIGHT COLUMN (header + content + mobile nav) ═════════════════════ */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

      {/* ---- HEADER LIFEOS — solo mobile/tablet, desktop usa sidebar ---- */}
      <header className="lg:hidden bg-indigo-950 border-b border-indigo-900/50 px-4 md:px-6 py-3 flex justify-between items-center z-[100] shrink-0 shadow-lg">
        <div className="flex items-center gap-3 text-white">
          {/* Mobile: logo + menú tiempo */}
          <div className="lg:hidden flex items-center gap-2">
            {section === 'tiempo' && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-xl">
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="bg-indigo-500 p-1.5 rounded-lg shadow-inner"><Zap size={18} fill="white" /></div>
              <h1 className="text-lg font-black tracking-tight uppercase italic leading-none hidden sm:block">LifeOS</h1>
            </div>
          </div>
          {/* Desktop: título de la sección actual + menú tiempo */}
          <div className="hidden lg:flex items-center gap-3">
            {section === 'tiempo' && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-xl">
                <Menu size={20} />
              </button>
            )}
            <span className="text-white font-black text-base">
              {section === 'admin' ? 'Admin' : SECTIONS.find(s => s.key === section)?.label ?? ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 text-white">
          {/* Botón búsqueda — desktop */}
          <button
            onClick={() => setShowSearch(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-indigo-300 hover:text-white transition-all"
          >
            <Search size={13} />
            <span className="text-[11px] font-bold hidden lg:inline">Buscar...</span>
            <kbd className="hidden lg:inline-flex items-center text-[9px] font-black text-indigo-500 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">⌘K</kbd>
          </button>

          {/* Indicador de guardado — visible en desktop y tablet */}
          <div className={`hidden sm:flex items-center gap-1.5 text-[10px] font-bold min-w-[90px] justify-center transition-all duration-300 ${
            saveStatus === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${saveStatus === 'saving' ? 'text-indigo-400' : 'text-emerald-400'}`}>
            {saveStatus === 'saving' ? (
              <><div className="w-2.5 h-2.5 border border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />Guardando...</>
            ) : (
              <><CheckCircle2 size={12} />Guardado</>
            )}
          </div>


          {/* Ícono de guardado — mobile/tablet (siempre ocupa el mismo espacio) */}
          <div className={`lg:hidden w-7 h-7 flex items-center justify-center transition-all duration-300 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
            {saveStatus === 'saving' ? (
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-white/60 rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400" />
            )}
          </div>

          {/* Mobile: search + avatar agrupados en cluster compacto */}
          <button
            onClick={() => setShowSearch(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-indigo-300 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <Search size={16} />
          </button>

          {/* Menú de usuario — solo mobile/tablet (desktop lo tiene en sidebar) */}
          <div className="lg:hidden relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className={`flex items-center gap-2 border rounded-full pl-1 pr-2.5 py-1 transition-all ${userMenuOpen ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              {/* Avatar con iniciales */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[11px] font-black shadow-sm shrink-0">
                {(displayName || user?.email)?.[0]?.toUpperCase()}
              </div>
              {/* Nombre o email */}
              <span className="text-[10px] font-bold text-indigo-200 hidden sm:block max-w-[90px] truncate leading-none">
                {displayName || user?.email?.split('@')[0]}
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
                      {(displayName || user?.email)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-black truncate">
                        {displayName || user?.email?.split('@')[0]}
                      </p>
                      <p className="text-indigo-400 text-[10px] font-medium truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="p-2 space-y-0.5">
                  <button
                    onClick={() => { setProfileName(displayName); setShowProfile(true); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-indigo-300 hover:bg-white/5 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    <Edit2 size={14} />
                    Mi perfil
                  </button>
                  <button
                    onClick={() => { setShowChangePassword(true); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-indigo-300 hover:bg-white/5 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  >
                    <KeyRound size={14} />
                    Cambiar contraseña
                  </button>
                  <div className="h-px bg-indigo-800/40 my-1" />
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

      {/* Banner sin conexión */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[500] bg-amber-500 text-white text-[11px] font-black py-2 px-4 text-center uppercase tracking-widest flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-200 shadow-md">
          <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse shrink-0" />
          Sin conexión — los cambios se guardarán al reconectar
        </div>
      )}


      <div className="flex flex-1 overflow-hidden relative">
        {isMobile && sidebarOpen && section === 'tiempo' && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]" onClick={() => setSidebarOpen(false)}/>
        )}

        {/* Sidebar — only in tiempo section */}
        {section === 'tiempo' && (
          <aside className={`fixed inset-y-0 left-0 z-[120] w-80 bg-white border-r transform transition-transform lg:relative lg:inset-y-auto lg:left-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-translate-x-full lg:w-0 lg:opacity-0 lg:overflow-hidden'} flex flex-col shrink-0 overflow-y-auto custom-scrollbar`}>
            <div className="p-6 space-y-8 pb-24 lg:pb-6">
              <section>
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Palette size={14} className="text-indigo-600" /> Mis Áreas</h3>
                  <button onClick={() => setCatModal({ id: generateId(), label: '', short: '', color: '#6366f1', presets: [], sortOrder: Date.now() })} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Plus size={14} /></button>
                </div>
                <div className="space-y-1">
                  {sortedCategories.map(cat => (
                    <div
                      key={cat.id}
                      draggable
                      onDragStart={() => setDraggingCatId(cat.id)}
                      onDragOver={e => { e.preventDefault(); setDragOverCatId(cat.id); }}
                      onDragLeave={() => setDragOverCatId(null)}
                      onDrop={() => handleCatDrop(cat.id)}
                      onDragEnd={() => { setDraggingCatId(null); setDragOverCatId(null); }}
                      className={`group flex items-center justify-between p-2.5 rounded-xl transition-all border cursor-grab active:cursor-grabbing select-none ${
                        draggingCatId === cat.id  ? 'opacity-40 scale-[0.97]' :
                        dragOverCatId === cat.id  ? 'bg-indigo-50 border-indigo-200 shadow-sm' :
                        'hover:bg-slate-50 border-transparent hover:border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Grip handle */}
                        <GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: cat.color }} />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                          <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter">{cat.presets?.length || 0} Sub-actividades</span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setCatModal(cat); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <Edit2 size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-50 rounded-3xl p-5 border border-slate-100 shadow-inner">
                <div className="flex flex-col gap-3 mb-5">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <History size={14} className="text-indigo-600" /> Histórico
                  </h3>
                  <div className="flex bg-slate-200 p-0.5 rounded-full text-[8px] font-black self-start">
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
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tight min-w-0">
                          <span className="text-slate-600 flex-1 min-w-0 truncate">{s.name}</span>
                          <span className="text-indigo-600 shrink-0">{s.hours}h ({s.percentage}%)</span>
                        </div>
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
                        <div key={i} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm transition-all hover:scale-[1.02] hover:border-indigo-100 min-w-0">
                          <span className="text-[9px] font-black text-slate-600 uppercase truncate leading-tight flex-1 min-w-0">{s.name}</span>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/50 shrink-0">{s.hours}h</span>
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
                <div className="bg-white border-b shrink-0 sticky top-0 z-[60]" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                  {/* Navegación de semana — mobile */}
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <button
                      onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
                      className="p-1.5 hover:bg-slate-100 rounded-full transition-all active:scale-95"
                    >
                      <ChevronLeft size={16} className="text-slate-400" />
                    </button>
                    <span className="text-[11px] font-black text-slate-500 tracking-widest capitalize">
                      {weekDays[0]?.getDate()} {weekDays[0]?.toLocaleDateString('es-ES', { month: 'short' })} — {weekDays[6]?.getDate()} {weekDays[6]?.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
                      className="p-1.5 hover:bg-slate-100 rounded-full transition-all active:scale-95"
                    >
                      <ChevronRight size={16} className="text-slate-400" />
                    </button>
                  </div>
                  {/* Días de la semana */}
                  <div className="px-2 pb-2 flex justify-around items-center">
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
                </div>
              )}

              {/* Sub-barra Tiempo — desktop: navegación de semana + total horas */}
              {!isMobile && (
                <div className="hidden md:flex items-center justify-between px-6 py-2.5 bg-slate-100 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-3">
                    {/* Botón abrir sidebar categorías */}
                    <button onClick={() => setSidebarOpen(v => !v)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-all text-slate-500 hover:text-slate-700">
                      <Menu size={16} />
                    </button>
                    <div className="flex items-center bg-white rounded-full p-0.5 border border-slate-200 shadow-sm">
                      <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }} className="p-1.5 hover:bg-slate-100 rounded-full transition-all"><ChevronLeft size={14} className="text-slate-500"/></button>
                      <span className="px-3 text-xs font-black min-w-[180px] text-center text-slate-700">
                        {weekDays[0]?.getDate()} {weekDays[0]?.toLocaleDateString('es-ES', { month: 'short' })} — {weekDays[6]?.getDate()} {weekDays[6]?.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                      </span>
                      <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }} className="p-1.5 hover:bg-slate-100 rounded-full transition-all"><ChevronRight size={14} className="text-slate-500"/></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Total Real</span>
                    <span className="text-lg font-black text-indigo-600">{stats.total}h</span>
                  </div>
                </div>
              )}

              <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar scroll-smooth">
                <div className={`${isMobile ? 'px-3' : 'px-6'}`}>
                  <div className="min-w-full relative">
                    {!isMobile && (
                      <div className="sticky top-0 z-50 bg-slate-50 pt-3">
                        <div className="bg-white rounded-t-[2.5rem] shadow-sm border-x border-t border-slate-200 overflow-hidden">
                          <div className={`grid ${isMobile ? 'grid-cols-[60px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'} bg-indigo-950 text-white`}>
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
                        </div>
                      </div>
                    )}
                    <div className={`bg-white ${!isMobile ? 'rounded-b-[2.5rem] border-x border-b' : 'mt-3 rounded-[2.5rem] border'} shadow-sm border-slate-200 overflow-hidden`}>
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
                          <div key={dateId} className="border-r h-full relative" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, dateId, draggedItem?.startHour)}>
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

          {/* ---- SECCIÓN HOY ---- */}
          {section === 'hoy' && (
            <Hoy
              userName={displayName || ''}
              streak={streak}
              events={events}
              categories={categories}
              tasks={tasks}
              goals={goals}
              transactions={transactions}
              finCategories={finCategories}
              monthBalances={monthBalances}
              habits={habits}
              habitLogs={habitLogs}
              setHabitLogs={setHabitLogs}
              currentDate={currentDate}
              onNavigate={setSection}
              isModuleEnabled={isModuleEnabled}
            />
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
              openEditRef={dineroOpenEditRef}
            />
          )}
          {section === 'objetivos' && (
            <Objetivos
              goals={goals}
              setGoals={setGoals}
              categories={categories}
              setCategories={setCategories}
              currentDate={currentDate}
              events={events}
              tasks={tasks}
              setTasks={setTasks}
              openEditRef={objetivosOpenEditRef}
            />
          )}
          {section === 'lista' && (
            <Lista
              tasks={tasks}
              setTasks={setTasks}
              checklistItems={checklistItems}
              setChecklistItems={setChecklistItems}
              categories={categories}
              setCategories={setCategories}
              goals={goals}
              currentDate={currentDate}
              openEditRef={listOpenEditRef}
            />
          )}
          {section === 'habitos' && (
            <Habitos
              habits={habits}
              setHabits={setHabits}
              habitLogs={habitLogs}
              setHabitLogs={setHabitLogs}
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
              habits={habits}
              habitLogs={habitLogs}
              currentDate={currentDate}
              onDownloadReport={downloadReport}
              isExporting={isExporting}
              isModuleEnabled={isModuleEnabled}
            />
          )}
          {section === 'academia' && <Academia />}
          {section === 'admin' && isSuperAdmin && <Admin />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <>

          {/* Panel "Más" — bottom sheet rediseñado */}
          {showMoreMenu && (() => {
            const visibleMore = MORE_SECTIONS.filter(s => isModuleEnabled(s.key))
            const allItems = [
              ...visibleMore.map(s => ({ ...s, amber: false })),
              ...(isSuperAdmin ? [{ key: 'admin' as SectionKey, label: 'Admin', Icon: Shield, amber: true }] : []),
            ]
            if (!allItems.length) return null

            return (
              <>
                {/* Overlay para cerrar */}
                <div className="fixed inset-0 z-[148]" onClick={() => setShowMoreMenu(false)} />

                {/* Sheet */}
                <div
                  className="fixed left-0 right-0 z-[149] bg-[#0f1221] border-t border-white/10 animate-in slide-in-from-bottom-2 duration-200"
                  style={{ bottom: `calc(64px + env(safe-area-inset-bottom, 0px))` }}
                >
                  {/* Handle indicator */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-8 h-1 rounded-full bg-white/20" />
                  </div>

                  {/* Grid de ítems — 3 por fila máx */}
                  <div className={`grid gap-1 px-4 pt-2 pb-4 ${
                    allItems.length <= 3 ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'
                  }`}>
                    {allItems.map(({ key, label, Icon, amber }) => {
                      const isActive = section === key
                      return (
                        <button
                          key={key}
                          onClick={() => { setSection(key); setShowMoreMenu(false); }}
                          className={`flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-95 ${
                            isActive
                              ? amber ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/25 text-white'
                              : amber ? 'text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-300' : 'text-indigo-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                            isActive
                              ? amber ? 'bg-amber-500/30' : 'bg-indigo-500/40'
                              : 'bg-white/5'
                          }`}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                          </div>
                          <span className="text-[10px] font-black tracking-wide">{label}</span>
                          {isActive && <div className={`w-1 h-1 rounded-full ${amber ? 'bg-amber-400' : 'bg-indigo-400'}`} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          })()}

          {/* Barra de nav principal — filtrada por módulos habilitados */}
          {(() => {
            const visibleMain = MOBILE_NAV.filter(s => isModuleEnabled(s.key))
            const visibleMore = MORE_SECTIONS.filter(s => isModuleEnabled(s.key))
            const hasMoreItems = visibleMore.length > 0 || isSuperAdmin
            const moreActive = showMoreMenu || ['habitos','objetivos','revision','academia','admin'].includes(section)
            return (
              <div
                className="fixed bottom-0 left-0 right-0 bg-indigo-950 border-t border-indigo-800/60 flex z-[150]"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                {/* Inicio siempre visible */}
                {visibleMain.filter(s => s.key === 'hoy').map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setSection(key as SectionKey); setShowMoreMenu(false); }}
                    className={`flex-1 flex flex-col items-center justify-center py-3.5 gap-1 transition-all active:scale-95 ${section === key ? 'text-white' : 'text-indigo-400'}`}
                  >
                    <Icon size={22} strokeWidth={section === key ? 2.5 : 2} />
                    <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
                  </button>
                ))}
                {/* Resto de secciones principales habilitadas (sin hoy) */}
                {visibleMain.filter(s => s.key !== 'hoy').map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setSection(key as SectionKey); setShowMoreMenu(false); }}
                    className={`flex-1 flex flex-col items-center justify-center py-3.5 gap-1 transition-all active:scale-95 ${section === key ? 'text-white' : 'text-indigo-400'}`}
                  >
                    <Icon size={22} strokeWidth={section === key ? 2.5 : 2} />
                    <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
                  </button>
                ))}
                {/* Botón Más — solo si hay secciones habilitadas en el menú más */}
                {hasMoreItems && (
                  <button
                    onClick={() => setShowMoreMenu(v => !v)}
                    className={`flex-1 flex flex-col items-center justify-center py-3.5 gap-1 transition-all active:scale-95 ${moreActive ? 'text-white' : 'text-indigo-400'}`}
                  >
                    <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 2} />
                    <span className="text-[9px] font-black uppercase tracking-wide">Más</span>
                  </button>
                )}
              </div>
            )
          })()}
        </>
      )}

      </div>{/* ── end right column ── */}

      {/* ── BÚSQUEDA GLOBAL ── */}
      {showSearch && (
        <SearchModal
          tasks={tasks}
          goals={goals}
          events={events}
          transactions={transactions}
          categories={categories}
          finCategories={finCategories}
          habits={habits}
          onClose={() => setShowSearch(false)}
          onSearchSelect={(result) => { handleSearchSelect(result); setShowSearch(false); }}
          isModuleEnabled={isModuleEnabled}
        />
      )}

      {/* MODAL ONBOARDING — nombre preferido (primer login) */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-indigo-950/80 backdrop-blur-sm animate-in fade-in p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 animate-in zoom-in-95 duration-200 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">👋</div>
              <h2 className="text-xl font-black text-slate-800">¡Bienvenido a LifeOS!</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                ¿Cómo prefieres que te llame?
              </p>
            </div>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName(profileName, true)}
              placeholder="Tu nombre o apodo..."
              autoFocus
              maxLength={40}
              className="w-full px-4 py-3.5 border-2 border-slate-200 focus:border-indigo-400 rounded-2xl text-slate-800 font-bold text-base outline-none transition-all"
            />
            <div className="space-y-2">
              <button
                onClick={() => handleSaveName(profileName, true)}
                disabled={profileSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest py-3.5 rounded-2xl transition-all active:scale-[0.98]"
              >
                {profileSaving ? 'Guardando...' : 'Continuar →'}
              </button>
              <button
                onClick={() => setShowOnboarding(false)}
                className="w-full text-slate-400 hover:text-slate-600 text-xs font-bold py-1.5 transition-all"
              >
                Saltar por ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERFIL — editar nombre */}
      {showProfile && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in p-6"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 animate-in zoom-in-95 duration-200 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">Mi perfil</h2>
              <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                ¿Cómo prefieres que te llame?
              </label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName(profileName, false)}
                placeholder="Tu nombre o apodo..."
                autoFocus
                maxLength={40}
                className="w-full px-4 py-3 border-2 border-slate-200 focus:border-indigo-400 rounded-2xl text-slate-800 font-bold text-sm outline-none transition-all"
              />
              <p className="text-[10px] text-slate-400 font-medium px-1">
                Correo: {user?.email}
              </p>
            </div>
            <button
              onClick={() => handleSaveName(profileName, false)}
              disabled={profileSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all active:scale-[0.98]"
            >
              {profileSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL ATAJOS DE TECLADO */}
      {/* MODAL CAMBIAR CONTRASEÑA */}
      {showChangePassword && (
        <div
          className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={closePasswordModal}
          onKeyDown={e => e.key === 'Escape' && closePasswordModal()}
          tabIndex={-1}
        >
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col"
            style={{ maxHeight: 'min(90svh, 520px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header fijo */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <KeyRound size={16} className="text-indigo-600" />
                </div>
                <h2 className="text-base font-black text-slate-800">Cambiar contraseña</h2>
              </div>
              <button
                onClick={closePasswordModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {passwordSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={30} className="text-emerald-500" />
                  </div>
                  <p className="text-base font-black text-slate-800">¡Contraseña actualizada!</p>
                  <p className="text-sm text-slate-400">El cambio se realizó correctamente.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }}
                      autoFocus
                      placeholder="Mínimo 6 caracteres"
                      className="w-full mt-1.5 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirmar contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleChangePassword(); }}
                      placeholder="Repite la nueva contraseña"
                      className="w-full mt-1.5 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    />
                  </div>
                  {passwordError && (
                    <div className="flex items-start gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                      <span className="shrink-0 mt-0.5">⚠️</span>
                      <span>{passwordError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer fijo */}
            {!passwordSuccess && (
              <div
                className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
              >
                <button
                  onClick={closePasswordModal}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !newPassword.trim() || !confirmPassword.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {passwordSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showShortcuts && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in hidden md:flex"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-5">
              <Keyboard size={16} className="text-indigo-500" />
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Atajos de teclado</h3>
              <button onClick={() => setShowShortcuts(false)} className="ml-auto p-1 hover:bg-slate-100 rounded-full">
                <X size={14} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'H', desc: 'Dashboard Hoy' },
                { key: 'D', desc: 'Dinero' },
                { key: 'T', desc: 'Agenda' },
                { key: 'L', desc: 'Tareas' },
                { key: 'O', desc: 'Objetivos' },
                { key: 'R', desc: 'Revisión' },
                { key: '?', desc: 'Mostrar atajos' },
                { key: 'Esc', desc: 'Cerrar modal' },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 font-medium">{desc}</span>
                  <kbd className="bg-slate-100 text-slate-700 text-[11px] font-black px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-300 font-bold text-center mt-5 uppercase tracking-widest">
              Solo en desktop · Sin input activo
            </p>
          </div>
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
                    {sortedCategories.map((cat) => {
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
                  {(() => {
                    const { matches, canCreate } = getFilteredPresets(modalData.category, modalData.task);
                    const hasMatches = matches.length > 0 || canCreate;

                    return hasMatches && (
                      <div className="flex flex-wrap gap-1.5 animate-in fade-in">
                        {/* Presets filtrados */}
                        {matches.map((preset, i) => (
                          <button
                            key={i}
                            onClick={() => setModalData({...modalData, task: String(preset)})}
                            className={`px-3.5 py-2 rounded-xl text-[10px] font-black border-2 transition-all active:scale-95
                              ${modalData.task === preset
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}`}
                          >
                            {preset}
                          </button>
                        ))}

                        {/* Botón para crear nuevo preset */}
                        {canCreate && (
                          <button
                            onClick={() => createPresetDynamically(modalData.category, modalData.task)}
                            className="px-3.5 py-2 rounded-xl text-[10px] font-black border-2 border-dashed border-indigo-300 text-indigo-600 bg-indigo-50 hover:border-indigo-500 hover:bg-indigo-100 transition-all active:scale-95"
                          >
                            + Crear '{modalData.task.trim()}'
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Asociar hábito (opcional) */}
                {habits.length > 0 && (
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Asociar a hábito <span className="text-slate-300 normal-case tracking-normal">(opcional)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {habits
                        .filter(h => !modalData.dateId || h.startDate <= modalData.dateId)
                        .map(h => {
                          const isSelected = modalData.habitId === h.id;
                          return (
                            <button
                              key={h.id}
                              onClick={() => setModalData({...modalData, habitId: isSelected ? undefined : h.id})}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-black border-2 transition-all active:scale-95 ${
                                isSelected
                                  ? `${h.color} border-transparent text-white shadow-md`
                                  : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'
                              }`}
                            >
                              <Flame size={12} />
                              {h.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

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
