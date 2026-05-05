import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell,
} from 'recharts';
import {
  Plus, X, TrendingUp, TrendingDown, DollarSign, Trash2,
  ChevronLeft, ChevronRight, Wallet, PiggyBank, Edit2, BarChart3, List, Tag,
  Info, Pencil, Check, ArrowLeftRight, User, AlertCircle, CheckCircle2, Target,
  MoreHorizontal, Receipt, Settings,
} from 'lucide-react';
import type { Transaction, FinCategory, Savings, MonthBalance, SavingsWithdrawal, SavingsPocket, PocketFunding, SavingsYearBalance, Loan, LoanPayment, Budget } from '../../types';
import { LOAN_OUT_CAT_ID, LOAN_IN_CAT_ID } from '../../types';
import { generateId, fmtCurrency as fmt, formatCOPInput, parseCOPNumber, getLocalISODate } from '../../lib/utils';
import PrestamosTab from './PrestamosTab';
import PresupuestoTab from './PresupuestoTab';

type DineroTab = 'movimientos' | 'analisis' | 'ahorros' | 'mas';
type MovSubTab = 'transacciones' | 'presupuesto';
type MasSection = 'prestamos' | 'categorias';

interface DineroProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  finCategories: FinCategory[];
  setFinCategories: React.Dispatch<React.SetStateAction<FinCategory[]>>;
  savings: Savings[];
  setSavings: React.Dispatch<React.SetStateAction<Savings[]>>;
  monthBalances: MonthBalance[];
  setMonthBalances: React.Dispatch<React.SetStateAction<MonthBalance[]>>;
  savingsWithdrawals: SavingsWithdrawal[];
  setSavingsWithdrawals: React.Dispatch<React.SetStateAction<SavingsWithdrawal[]>>;
  savingsPockets: SavingsPocket[];
  setSavingsPockets: React.Dispatch<React.SetStateAction<SavingsPocket[]>>;
  pocketFundings: PocketFunding[];
  setPocketFundings: React.Dispatch<React.SetStateAction<PocketFunding[]>>;
  savingsYearBalances: SavingsYearBalance[];
  setSavingsYearBalances: React.Dispatch<React.SetStateAction<SavingsYearBalance[]>>;
  loans: Loan[];
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  loanPayments: LoanPayment[];
  setLoanPayments: React.Dispatch<React.SetStateAction<LoanPayment[]>>;
  budgets: Budget[];
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
  initialFinCategories: FinCategory[];
  currentDate: Date;
}

const COLOR_PALETTE = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899',
  '#6366f1', '#ef4444', '#0ea5e9', '#64748b', '#94a3b8',
  '#f97316', '#14b8a6',
];

const POCKET_EMOJIS = ['💰', '🏠', '✈️', '🎓', '🚗', '📱', '🎉', '🏋️', '💊', '🛍️', '🎸', '🌿', '🎯', '🔑', '🏖️', '🎁', '💡', '🍕', '🎵', '⚽'];
const POCKET_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#ef4444', '#0ea5e9', '#f97316', '#14b8a6'];


const TABS: Array<{ key: DineroTab; label: string; Icon: React.FC<{ size?: number }> }> = [
  { key: 'movimientos', label: 'Movimientos', Icon: Receipt },
  { key: 'analisis',    label: 'Análisis',    Icon: BarChart3 },
  { key: 'ahorros',     label: 'Ahorros',     Icon: PiggyBank },
  { key: 'mas',         label: 'Más',         Icon: MoreHorizontal },
];

type WithdrawalModal = { amount: number; description: string; date: string; fromPocketId: string };
type PocketModal = { id?: string; name: string; color: string; emoji: string };
type AllocateModal = { pocketId: string; amount: number; description: string; date: string; direction: 'to' | 'from' };

const Dinero: React.FC<DineroProps> = ({
  transactions, setTransactions, finCategories, setFinCategories,
  savings, setSavings, monthBalances, setMonthBalances,
  savingsWithdrawals, setSavingsWithdrawals,
  savingsPockets, setSavingsPockets,
  pocketFundings, setPocketFundings,
  savingsYearBalances, setSavingsYearBalances,
  loans, setLoans, loanPayments, setLoanPayments,
  budgets, setBudgets,
  initialFinCategories,
  currentDate,
}) => {
  const today = getLocalISODate();
  const [tab, setTab]               = useState<DineroTab>('movimientos');
  const [movSubTab, setMovSubTab]   = useState<MovSubTab>('transacciones');
  const [masSection, setMasSection] = useState<MasSection>('prestamos');
  const [viewDate, setViewDate]     = useState(new Date(currentDate));

  // Transaction form
  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<number>(1);
  const [editTx, setEditTx] = useState<Partial<Transaction> | null>(null);
  const [isEditingTx, setIsEditingTx] = useState(false);
  const [savingsPercent, setSavingsPercent] = useState(10);
  const [pendingTxAmount, setPendingTxAmount] = useState(0);
  const [pendingTxId, setPendingTxId] = useState('');
  // Formatted text inputs for amounts
  const [amountInput, setAmountInput] = useState('');
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState('');
  const [allocateAmountInput, setAllocateAmountInput] = useState('');
  const [editSavingAmountInput, setEditSavingAmountInput] = useState('');

  // Opening-balance editing
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');

  const [linkingLoanId, setLinkingLoanId] = useState('');
  const [loanPersonName, setLoanPersonName] = useState('');

  // Category CRUD
  const [catModal, setCatModal] = useState<Partial<FinCategory> | null>(null);

  // Savings modals
  const [withdrawalModal, setWithdrawalModal] = useState<WithdrawalModal | null>(null);
  const [pocketModal, setPocketModal] = useState<PocketModal | null>(null);
  const [allocateModal, setAllocateModal] = useState<AllocateModal | null>(null);

  // Year opening balance editor
  const [editingYearOpening, setEditingYearOpening] = useState<'savings' | 'general' | null>(null);
  const [yearOpeningInput, setYearOpeningInput] = useState('');
  const [editSaving, setEditSaving] = useState<any | null>(null);


  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const yearMonth = `${y}-${String(m + 1).padStart(2, '0')}`;

  const currentBalanceRecord = monthBalances.find(b => b.yearMonth === yearMonth);
  const manualOpeningBalance = currentBalanceRecord?.openingBalance ?? null;

  const handleSaveBalance = () => {
    const amount = parseCOPNumber(balanceInput) || 0;
    setMonthBalances(prev => [
      ...prev.filter(b => b.yearMonth !== yearMonth),
      { id: currentBalanceRecord?.id || generateId(), yearMonth, openingBalance: amount },
    ]);
    setEditingBalance(false);
  };

  const resetToAuto = () => {
    setMonthBalances(prev => prev.filter(b => b.yearMonth !== yearMonth));
  };

  // Saldo inicial efectivo: manual > automático (cierre del mes anterior, recursivo) > null
  const effectiveOpening = useMemo(() => {
    if (manualOpeningBalance !== null) return { value: manualOpeningBalance, isAuto: false };

    // Función recursiva para calcular el cierre de cualquier mes hacia atrás
    const computeClosing = (tY: number, tM: number, depth: number): number | null => {
      if (depth > 12) return null; // máximo 1 año hacia atrás
      const tYM = `${tY}-${String(tM + 1).padStart(2, '0')}`;
      const stored = monthBalances.find(b => b.yearMonth === tYM)?.openingBalance ?? null;

      let opening: number | null;
      if (stored !== null) {
        opening = stored;
      } else {
        const pd = new Date(tY, tM - 1, 1);
        opening = computeClosing(pd.getFullYear(), pd.getMonth(), depth + 1);
      }
      if (opening === null) return null;

      let inc = 0, exp = 0, savDep = 0, loansIn = 0;
      transactions.forEach(tx => {
        const [ty2, tm2] = tx.date.split('-').map(Number);
        if (ty2 === tY && tm2 - 1 === tM) {
          if (tx.type === 'income' && tx.finCategoryId !== LOAN_IN_CAT_ID) inc += tx.amount;
          else if (tx.type === 'expense') exp += tx.amount;
          if (tx.finCategoryId === LOAN_IN_CAT_ID) loansIn += tx.amount;
        }
      });
      (Array.isArray(savings) ? savings : []).forEach(s => {
        const [sy, sm] = s.date.split('-').map(Number);
        if (sy === tY && sm - 1 === tM) savDep += s.amount;
      });
      return opening + inc - exp - savDep + loansIn;
    };

    const prevDate = new Date(y, m - 1, 1);
    const autoValue = computeClosing(prevDate.getFullYear(), prevDate.getMonth(), 0);
    return autoValue !== null
      ? { value: autoValue, isAuto: true }
      : { value: null, isAuto: false };
  }, [manualOpeningBalance, monthBalances, transactions, savings, y, m]);

  const monthTxs = useMemo(() =>
    transactions
      .filter(tx => {
        const [ty, tm] = tx.date.split('-').map(Number);
        return ty === y && tm - 1 === m;
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, y, m]
  );

  const { stats, grouped } = useMemo(() => {
    let income = 0, expenses = 0;
    let monthLoansIn = 0, monthLoansOut = 0;
    const byCategory: Record<string, { label: string; color: string; total: number; txType: string }> = {};
    const g: Record<string, Transaction[]> = {};

    monthTxs.forEach(tx => {
      if (tx.type === 'income' && tx.finCategoryId !== LOAN_IN_CAT_ID) income += tx.amount;
      else if (tx.type === 'expense') expenses += tx.amount;
      
      if (tx.finCategoryId === LOAN_IN_CAT_ID) monthLoansIn += tx.amount;
      if (tx.finCategoryId === LOAN_OUT_CAT_ID) monthLoansOut += tx.amount;

      const cat = finCategories.find(c => c.id === tx.finCategoryId);
      if (cat) {
        if (!byCategory[tx.finCategoryId])
          byCategory[tx.finCategoryId] = { label: cat.label, color: cat.color, total: 0, txType: tx.type };
        byCategory[tx.finCategoryId].total += tx.amount;
      }
      if (!g[tx.date]) g[tx.date] = [];
      g[tx.date].push(tx);
    });

    // Ahorros depositados y retirados en este mes
    const safeSavings = Array.isArray(savings) ? savings : [];
    const safeWithdrawals = Array.isArray(savingsWithdrawals) ? savingsWithdrawals : [];

    const monthSavingsDeposits = safeSavings
      .filter(s => {
        const [sy, sm] = (s.date || '').split('-').map(Number);
        return sy === y && sm - 1 === m;
      })
      .reduce((s, x) => s + (x.amount || 0), 0);

    const monthSavingsWithdrawn = safeWithdrawals
      .filter(w => {
        const [wy, wm] = (w.date || '').split('-').map(Number);
        return wy === y && wm - 1 === m;
      })
      .reduce((s, x) => s + (x.amount || 0), 0);

    const incomeChart = Object.values(byCategory)
      .filter(c => c.txType === 'income')
      .sort((a, b) => b.total - a.total);

    const expenseChart = Object.values(byCategory)
      .filter(c => c.txType === 'expense')
      .sort((a, b) => b.total - a.total);

    const balance = income - expenses - monthSavingsDeposits + monthLoansIn;

    return { stats: { income, expenses, monthSavingsDeposits, monthSavingsWithdrawn, monthLoansIn, monthLoansOut, balance, incomeChart, expenseChart }, grouped: g };
  }, [monthTxs, finCategories, savings, savingsWithdrawals, y, m]);

  const closingBalance = effectiveOpening.value !== null
    ? effectiveOpening.value + stats.income - stats.expenses - stats.monthSavingsDeposits + stats.monthLoansIn
    : null;

  const yearlyCategoryStats = useMemo(() => {
    const year = viewDate.getFullYear();
    const byCategory: Record<string, { label: string; color: string; total: number; txType: string }> = {};

    transactions.forEach(tx => {
      const [ty] = tx.date.split('-').map(Number);
      if (ty === year) {
        if (!byCategory[tx.finCategoryId]) {
          const cat = finCategories.find(c => c.id === tx.finCategoryId);
          if (cat) {
            byCategory[tx.finCategoryId] = { label: cat.label, color: cat.color, total: 0, txType: tx.type };
          }
        }
        if (byCategory[tx.finCategoryId]) {
          byCategory[tx.finCategoryId].total += tx.amount;
        }
      }
    });

    const incomeChart = Object.values(byCategory)
      .filter(c => c.txType === 'income')
      .sort((a, b) => b.total - a.total);

    const expenseChart = Object.values(byCategory)
      .filter(c => c.txType === 'expense')
      .sort((a, b) => b.total - a.total);

    return { incomeChart, expenseChart };
  }, [transactions, viewDate, finCategories]);

  // Dashboard data — Jan to Dec of selected year
  const dashboardData = useMemo(() => {
    const year = viewDate.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      let inc = 0, exp = 0;
      transactions.forEach(tx => {
        const [ty, tm] = tx.date.split('-').map(Number);
        if (ty === year && tm - 1 === m) {
          if (tx.type === 'income' && tx.finCategoryId !== LOAN_IN_CAT_ID) inc += tx.amount;
          else if (tx.type === 'expense') exp += tx.amount;
        }
      });
      months.push({ label: d.toLocaleDateString('es-ES', { month: 'short' }), income: inc, gastos: exp });
    }
    return months;
  }, [transactions, viewDate]);

  const allTimeStats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income' && t.finCategoryId !== LOAN_IN_CAT_ID).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalSavingsDeposited = savings.reduce((s, x) => s + x.amount, 0);
    return { totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses, totalSavingsDeposited };
  }, [transactions, savings]);

  // ─── SAVINGS STATS ───────────────────────────────────────────────────────
  const savingsStats = useMemo(() => {
    // Use the earliest year with an opening balance as the base
    const sorted = [...savingsYearBalances].sort((a, b) => a.year - b.year);
    const baseEntry = sorted[0];
    const openingBalance = baseEntry?.savingsOpening ?? 0;
    const baseDate = baseEntry ? `${baseEntry.year}-01-01` : null;

    const filteredSavings = baseDate ? savings.filter(s => s.date >= baseDate) : savings;
    const filteredWithdrawals = baseDate ? savingsWithdrawals.filter(w => w.date >= baseDate) : savingsWithdrawals;

    const totalDeposits = filteredSavings.reduce((s, x) => s + x.amount, 0);
    const totalWithdrawals = filteredWithdrawals.reduce((s, w) => s + w.amount, 0);
    const totalNetSavings = openingBalance + totalDeposits - totalWithdrawals;

    const pocketBalances: Record<string, number> = {};
    savingsPockets.forEach(p => { pocketBalances[p.id] = 0; });
    pocketFundings.forEach(f => {
      if (!(f.pocketId in pocketBalances)) pocketBalances[f.pocketId] = 0;
      pocketBalances[f.pocketId] += f.amount;
    });
    savingsWithdrawals.forEach(w => {
      if (w.fromPocketId && w.fromPocketId in pocketBalances) {
        pocketBalances[w.fromPocketId] -= w.amount;
      }
    });

    const totalPocketed = Object.values(pocketBalances).reduce((s, b) => s + b, 0);
    const generalBalance = totalNetSavings - totalPocketed;

    return { openingBalance, totalDeposits, totalWithdrawals, totalNetSavings, pocketBalances, generalBalance };
  }, [savings, savingsWithdrawals, pocketFundings, savingsPockets, savingsYearBalances]);

  // Annual stats for current viewDate year
  const annualStats = useMemo(() => {
    const year = viewDate.getFullYear();
    const yearStr = String(year);
    const yearIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(yearStr) && t.finCategoryId !== LOAN_IN_CAT_ID).reduce((s, t) => s + t.amount, 0);
    const yearExpenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(yearStr)).reduce((s, t) => s + t.amount, 0);
    const yearDeposited = savings.filter(s => s.date.startsWith(yearStr)).reduce((s, x) => s + x.amount, 0);
    const yearWithdrawn = savingsWithdrawals.filter(w => w.date.startsWith(yearStr)).reduce((s, w) => s + w.amount, 0);
    const yearEntry = savingsYearBalances.find(b => b.year === year);
    const yearOpeningSavings = yearEntry?.savingsOpening ?? null;
    const yearClosingSavings = yearOpeningSavings !== null ? yearOpeningSavings + yearDeposited - yearWithdrawn : null;
    return {
      year, yearIncome, yearExpenses, yearDeposited, yearWithdrawn,
      yearNetSavings: yearDeposited - yearWithdrawn, yearOpeningSavings, yearClosingSavings
    };
  }, [viewDate, transactions, savings, savingsWithdrawals, savingsYearBalances]);

  // Savings history grouped by month (full year)
  const savingsHistory = useMemo(() => {
    const yearStr = String(viewDate.getFullYear());
    type HistoryEvent = { id: string; date: string; type: 'deposit' | 'withdrawal' | 'pocket_in' | 'pocket_out'; amount: number; description: string; pocketId?: string };
    const all: HistoryEvent[] = [];

    savings.filter(s => s.date.startsWith(yearStr)).forEach(s =>
      all.push({ id: s.id, date: s.date, type: 'deposit', amount: s.amount, description: s.description })
    );
    savingsWithdrawals.filter(w => w.date.startsWith(yearStr)).forEach(w =>
      all.push({ id: w.id, date: w.date, type: 'withdrawal', amount: w.amount, description: w.description, pocketId: w.fromPocketId })
    );
    pocketFundings.filter(f => f.date.startsWith(yearStr)).forEach(f =>
      all.push({ id: f.id, date: f.date, type: f.amount > 0 ? 'pocket_in' : 'pocket_out', amount: Math.abs(f.amount), description: f.description, pocketId: f.pocketId })
    );

    const grouped: Record<string, HistoryEvent[]> = {};
    all.sort((a, b) => b.date.localeCompare(a.date)).forEach(e => {
      const key = e.date.slice(0, 7);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return grouped;
  }, [viewDate, savings, savingsWithdrawals, pocketFundings]);

  // ─── TRANSACTION FORM ────────────────────────────────────────────────────
  const openNew = (type: 'expense' | 'income' = 'expense') => {
    const defaultCat = finCategories.find(c => c.type === type || c.type === 'both');
    setEditTx({ date: today, type, amount: 0, finCategoryId: defaultCat?.id || '', description: '' });
    setAmountInput('');
    setIsEditingTx(false);
    setFormStep(1);
    setFormOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditTx({ ...tx });
    setAmountInput(tx.amount ? fmt(tx.amount) : '');
    setIsEditingTx(true);
    setFormStep(1);
    setFormOpen(true);
  };

  const handleSave = () => {
    const parsedAmount = parseCOPNumber(amountInput);
    const txWithAmount = { ...editTx, amount: parsedAmount };
    if (!txWithAmount?.description?.trim() || !parsedAmount || !txWithAmount.finCategoryId || !txWithAmount.date) return;
    const txId = txWithAmount.id || generateId();
    const tx: Transaction = {
      id: txId, date: txWithAmount.date!,
      type: txWithAmount.type as 'income' | 'expense',
      amount: parsedAmount,
      finCategoryId: txWithAmount.finCategoryId!,
      description: txWithAmount.description!,
    };
    setTransactions(prev => [...prev.filter(t => t.id !== tx.id), tx]);

    const isLoanTx = tx.finCategoryId === LOAN_IN_CAT_ID || tx.finCategoryId === LOAN_OUT_CAT_ID;

    if (tx.type === 'expense' && tx.finCategoryId === LOAN_OUT_CAT_ID && !isEditingTx) {
      if (!loanPersonName.trim()) {
        alert('Por favor ingresa a quién le haces el préstamo.');
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
        return;
      }
      const loanId = generateId();
      const newLoan: Loan = {
        id: loanId,
        personName: loanPersonName.trim(),
        amount: parsedAmount,
        date: tx.date,
        description: tx.description,
        transactionId: txId,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      setLoans(prev => [newLoan, ...(Array.isArray(prev) ? prev : [])]);
      setEditTx(null); setFormOpen(false); setLoanPersonName('');
      return;
    }

    if (tx.type === 'income' && !isEditingTx) {
      if (tx.finCategoryId === LOAN_IN_CAT_ID && linkingLoanId) {
        // Registrar el vínculo inmediatamente si ya se seleccionó en el paso 1
        const payId = generateId();
        const loan = (Array.isArray(loans) ? loans : []).find(l => l.id === linkingLoanId);
        if (loan) {
          const newPayment: LoanPayment = {
            id: payId, loanId: linkingLoanId, amount: tx.amount, date: tx.date,
            description: `Reintegro: ${tx.description}`, transactionId: txId,
            createdAt: new Date().toISOString()
          };
          setLoanPayments(prev => [...(Array.isArray(prev) ? prev : []), newPayment]);
          
          const loanPaymentsArr = Array.isArray(loanPayments) ? loanPayments : [];
          const paidSoFar = loanPaymentsArr
            .filter(p => p.loanId === linkingLoanId)
            .reduce((s, p) => s + (p.amount || 0), 0) + (tx.amount || 0);
          
          if (paidSoFar >= (loan.amount || 0)) {
            setLoans(prev => (Array.isArray(prev) ? prev : []).map(l => 
              l.id === linkingLoanId ? { ...l, status: 'completed', completedAt: new Date().toISOString() } : l
            ));
          }
        }
        setLinkingLoanId('');
        setEditTx(null); setFormOpen(false);
      } else if (tx.finCategoryId === LOAN_IN_CAT_ID) {
        // Si no se seleccionó, ir al paso de vinculación
        setPendingTxId(txId);
        setPendingTxAmount(tx.amount);
        setFormStep(3);
      } else {
        setPendingTxId(txId);
        setPendingTxAmount(tx.amount);
        setSavingsPercent(10);
        setFormStep(2);
      }
    } else {
      setEditTx(null); setFormOpen(false); setIsEditingTx(false);
    }
  };

  const handleConfirmLoanLink = () => {
    if (!linkingLoanId || !pendingTxId) return;
    const amount = pendingTxAmount;
    const safeLoans = Array.isArray(loans) ? loans : [];
    const loan = safeLoans.find(l => l.id === linkingLoanId);
    if (!loan) return;

    const payId = generateId();
    const newPayment: LoanPayment = {
      id: payId,
      loanId: linkingLoanId,
      amount,
      date: editTx?.date || today,
      description: `Reintegro vía movimientos: ${editTx?.description || ''}`,
      transactionId: pendingTxId,
      createdAt: new Date().toISOString(),
    };

    setLoanPayments(prev => [...(Array.isArray(prev) ? prev : []), newPayment]);

    // Verificar si se saldó
    const safePayments = Array.isArray(loanPayments) ? loanPayments : [];
    const paidSoFar = safePayments.filter(p => p.loanId === linkingLoanId).reduce((s, p) => s + (p.amount || 0), 0) + amount;
    if (paidSoFar >= (loan.amount || 0)) {
      setLoans(prev => (Array.isArray(prev) ? prev : []).map(l => l.id === linkingLoanId ? { ...l, status: 'completed', completedAt: new Date().toISOString() } : l));
    }

    setPendingTxId(''); setPendingTxAmount(0); setLinkingLoanId('');
    setEditTx(null); setFormOpen(false); setFormStep(1);
  };

  const handleConfirmSavings = (save: boolean) => {
    if (save && savingsPercent > 0) {
      const savAmount = Math.round((pendingTxAmount * savingsPercent) / 100);
      if (savAmount > 0) {
        setSavings(prev => [...prev, {
          id: generateId(), amount: savAmount,
          date: editTx?.date || today,
          description: `Ahorro de ${editTx?.description || 'ingreso'}`,
          sourceTransactionId: pendingTxId,
        }]);
      }
    }
    setPendingTxId(''); setPendingTxAmount(0);
    setEditTx(null); setFormOpen(false); setFormStep(1);
  };

  const handleDelete = (id: string) => {
    const safeTxs = Array.isArray(transactions) ? transactions : [];
    const tx = safeTxs.find(t => t.id === id);
    if (!tx) return;

    // 1. Verificar si es un pago de préstamo (Reintegro)
    const safePayments = Array.isArray(loanPayments) ? loanPayments : [];
    const payment = safePayments.find(p => p.transactionId === id);
    if (payment) {
      if (window.confirm('Este movimiento está vinculado a un pago de préstamo. Al eliminarlo, el saldo pendiente del préstamo se actualizará. ¿Continuar?')) {
        setLoanPayments(prev => (Array.isArray(prev) ? prev : []).filter(p => p.id !== payment.id));
        setLoans(prev => (Array.isArray(prev) ? prev : []).map(l => l.id === payment.loanId ? { ...l, status: 'active', completedAt: undefined } : l));
        setTransactions(prev => (Array.isArray(prev) ? prev : []).filter(t => t.id !== id));
      }
      return;
    }

    // 2. Verificar si es el préstamo original
    const safeLoans = Array.isArray(loans) ? loans : [];
    const loan = safeLoans.find(l => l.transactionId === id);
    if (loan) {
      if (window.confirm(`Este movimiento es el origen del préstamo a ${loan.personName}. Si lo eliminas, se borrará el préstamo y sus registros asociados. ¿Deseas continuar?`)) {
        const pTxs = safePayments.filter(p => p.loanId === loan.id).map(p => p.transactionId).filter(Boolean) as string[];
        setLoans(prev => (Array.isArray(prev) ? prev : []).filter(l => l.id !== loan.id));
        setLoanPayments(prev => (Array.isArray(prev) ? prev : []).filter(p => p.loanId !== loan.id));
        setTransactions(prev => (Array.isArray(prev) ? prev : []).filter(t => t.id !== id && !pTxs.includes(t.id)));
      }
      return;
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // ─── CATEGORY CRUD ───────────────────────────────────────────────────────
  const saveCat = () => {
    if (!catModal?.label?.trim() || !catModal.color || !catModal.type) return;
    const cat: FinCategory = {
      id: catModal.id || generateId(), label: catModal.label.trim(),
      color: catModal.color, type: catModal.type as 'income' | 'expense',
      description: catModal.description,
    };
    setFinCategories(prev => [...prev.filter(c => c.id !== cat.id), cat]);
    setCatModal(null);
  };
  const deleteCat = (id: string) => { setFinCategories(prev => prev.filter(c => c.id !== id)); setCatModal(null); };

  const handleDeleteHistoryEvent = (e: any) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este movimiento de ahorro?')) {
      if (e.type === 'deposit') setSavings(prev => prev.filter(s => s.id !== e.id));
      else if (e.type === 'withdrawal') setSavingsWithdrawals(prev => prev.filter(w => w.id !== e.id));
      else if (e.type === 'pocket_in' || e.type === 'pocket_out') setPocketFundings(prev => prev.filter(f => f.id !== e.id));
    }
  };

  const handleSaveEditSaving = () => {
    if (!editSaving) return;
    const { id, type, amount, description, date, pocketId, direction } = editSaving;
    if (!description.trim() || amount <= 0) return;

    if (type === 'deposit') {
      setSavings(prev => prev.map(s => s.id === id ? { ...s, amount, description, date } : s));
    } else if (type === 'withdrawal') {
      setSavingsWithdrawals(prev => prev.map(w => w.id === id ? { ...w, amount, description, date, fromPocketId: pocketId || undefined } : w));
    } else if (type === 'pocket_in' || type === 'pocket_out') {
      const finalAmount = direction === 'from' ? -Math.abs(amount) : Math.abs(amount);
      setPocketFundings(prev => prev.map(f => f.id === id ? { ...f, amount: finalAmount, description, date, pocketId } : f));
    }
    setEditSaving(null);
  };


  // ─── SAVINGS HANDLERS ────────────────────────────────────────────────────
  const handleWithdrawal = () => {
    if (!withdrawalModal?.amount || !withdrawalModal.description) return;
    setSavingsWithdrawals(prev => [...prev, {
      id: generateId(), date: withdrawalModal.date,
      amount: withdrawalModal.amount, description: withdrawalModal.description,
      fromPocketId: withdrawalModal.fromPocketId || undefined,
    }]);
    setWithdrawalModal(null);
  };

  const handleAllocate = () => {
    if (!allocateModal?.amount || !allocateModal.pocketId) return;
    const amount = allocateModal.direction === 'to' ? allocateModal.amount : -allocateModal.amount;
    setPocketFundings(prev => [...prev, {
      id: generateId(), pocketId: allocateModal.pocketId,
      date: allocateModal.date, amount,
      description: allocateModal.description || (allocateModal.direction === 'to' ? 'Transferencia a bolsillo' : 'Devolución a general'),
    }]);
    setAllocateModal(null);
  };

  const handleSavePocket = () => {
    if (!pocketModal?.name?.trim()) return;
    const pocket: SavingsPocket = {
      id: pocketModal.id || generateId(),
      name: pocketModal.name.trim(), color: pocketModal.color, emoji: pocketModal.emoji,
    };
    setSavingsPockets(prev => [...prev.filter(p => p.id !== pocket.id), pocket]);
    setPocketModal(null);
  };

  const handleDeletePocket = (id: string) => {
    setSavingsPockets(prev => prev.filter(p => p.id !== id));
    setPocketFundings(prev => prev.filter(f => f.pocketId !== id));
    setSavingsWithdrawals(prev => prev.map(w => w.fromPocketId === id ? { ...w, fromPocketId: undefined } : w));
    setPocketModal(null);
  };

  const saveYearOpening = (field: 'savings' | 'general') => {
    const val = parseFloat(yearOpeningInput.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val < 0) { setEditingYearOpening(null); return; }
    const year = viewDate.getFullYear();
    if (field === 'savings') {
      setSavingsYearBalances(prev => {
        const existing = prev.find(b => b.year === year);
        return existing
          ? prev.map(b => b.year === year ? { ...b, savingsOpening: val } : b)
          : [...prev, { id: generateId(), year, savingsOpening: val }];
      });
    } else {
      // general opening → write to monthBalances for Jan of the year
      const janYearMonth = `${year}-01`;
      setMonthBalances(prev => {
        const existing = prev.find(b => b.yearMonth === janYearMonth);
        return existing
          ? prev.map(b => b.yearMonth === janYearMonth ? { ...b, openingBalance: val } : b)
          : [...prev, { id: generateId(), yearMonth: janYearMonth, openingBalance: val }];
      });
    }
    setEditingYearOpening(null);
    setYearOpeningInput('');
  };

  const selectedCatObj = editTx ? finCategories.find(c => c.id === editTx.finCategoryId) : null;
  const savingsAmount = Math.round((pendingTxAmount * savingsPercent) / 100);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-xl shadow-lg">
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Dinero</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Registro financiero</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {tab === 'movimientos' && movSubTab === 'transacciones' && (
              <div className="flex items-center bg-slate-100 rounded-full p-1">
                <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); }} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronLeft size={16} /></button>
                <span className="px-3 text-xs font-bold min-w-[110px] text-center capitalize text-slate-600">
                  {viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d); }} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronRight size={16} /></button>
              </div>
            )}
            {tab === 'movimientos' && movSubTab === 'presupuesto' && (
              <div className="flex items-center bg-slate-100 rounded-full p-1">
                <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); }} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronLeft size={16} /></button>
                <span className="px-3 text-xs font-bold min-w-[110px] text-center capitalize text-slate-600">
                  {viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d); }} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronRight size={16} /></button>
              </div>
            )}
            {tab === 'mas' && masSection === 'categorias' && (
              <button onClick={() => setCatModal({ type: 'income', color: COLOR_PALETTE[0] })} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all">
                <Plus size={14} /> Nueva categoría
              </button>
            )}
            {tab === 'analisis' && (
              <div className="flex items-center bg-slate-100 rounded-full p-1">
                <button onClick={() => { const d = new Date(viewDate); d.setFullYear(d.getFullYear() - 1); setViewDate(d); }} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronLeft size={16} /></button>
                <span className="px-3 text-xs font-bold min-w-[60px] text-center text-slate-600">{viewDate.getFullYear()}</span>
                <button onClick={() => { const d = new Date(viewDate); d.setFullYear(d.getFullYear() + 1); setViewDate(d); }} className="p-1.5 hover:bg-white rounded-full transition-all"><ChevronRight size={16} /></button>
              </div>
            )}
            {tab === 'ahorros' && (
              <>
                <button onClick={() => { setWithdrawalAmountInput(''); setWithdrawalModal({ amount: 0, description: '', date: today, fromPocketId: '' }); }}
                  className="border border-red-200 text-red-500 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-red-50 transition-all">
                  <TrendingDown size={13} /> Retirar
                </button>
                {savingsPockets.length > 0 && (
                  <button onClick={() => { setAllocateAmountInput(''); setAllocateModal({ pocketId: savingsPockets[0].id, amount: 0, description: '', date: today, direction: 'to' }); }}
                    className="border border-indigo-200 text-indigo-500 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-indigo-50 transition-all">
                    <ArrowLeftRight size={13} /> Mover
                  </button>
                )}
                <button onClick={() => setPocketModal({ name: '', color: POCKET_COLORS[0], emoji: '💰' })}
                  className="bg-violet-500 hover:bg-violet-400 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all">
                  <Plus size={13} /> Bolsillo
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Tab bar principal (4 tabs) ── */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 rounded-xl transition-all ${
                  active
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-400 hover:text-slate-600 active:bg-white/60'
                }`}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wide leading-none ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── MOVIMIENTOS ─── */}
        {tab === 'movimientos' && (
          <>
            {/* Sub-tab: Transacciones | Presupuesto */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              {([
                { key: 'transacciones' as MovSubTab, label: 'Transacciones', Icon: List },
                { key: 'presupuesto'   as MovSubTab, label: 'Presupuesto',   Icon: Target },
              ]).map(({ key, label, Icon }) => {
                const active = movSubTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setMovSubTab(key)}
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

            {/* Presupuesto sub-tab */}
            {movSubTab === 'presupuesto' && (
              <PresupuestoTab
                budgets={budgets}
                setBudgets={setBudgets}
                transactions={transactions}
                finCategories={finCategories}
                viewDate={viewDate}
              />
            )}

            {/* Transacciones sub-tab */}
            {movSubTab === 'transacciones' && (<>
            <div className="bg-white rounded-2xl border border-slate-100 px-4 md:px-5 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-slate-400 shrink-0" />
                <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Saldo inicial del mes</span>
              </div>

              {editingBalance ? (
                /* ── Modo edición ── */
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 font-black">$</span>
                  <input
                    type="text" inputMode="numeric"
                    value={balanceInput}
                    onChange={e => setBalanceInput(formatCOPInput(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveBalance(); if (e.key === 'Escape') setEditingBalance(false); }}
                    className="w-full max-w-[140px] bg-slate-50 rounded-xl px-3 py-1.5 text-sm font-black outline-none focus:ring-2 ring-emerald-300 border border-slate-200"
                    placeholder="0" autoFocus
                  />
                  <button onClick={handleSaveBalance} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all"><Check size={14} /></button>
                  <button onClick={() => setEditingBalance(false)} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>

              ) : effectiveOpening.value !== null ? (
                /* ── Saldo definido (auto o manual) ── */
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  <span className="text-lg md:text-xl font-black text-slate-700">${fmt(effectiveOpening.value)}</span>

                  {/* Badge auto / manual */}
                  {effectiveOpening.isAuto
                    ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-400 border border-indigo-100">Auto</span>
                    : <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 border border-amber-100">Manual</span>
                  }

                  {/* Editar */}
                  <button
                    onClick={() => { setBalanceInput(fmt(effectiveOpening.value!)); setEditingBalance(true); }}
                    className="p-1.5 text-slate-300 hover:text-indigo-500 transition-all"
                    title="Editar saldo inicial"
                  ><Pencil size={14} /></button>

                  {/* Restablecer a automático (solo si está en modo manual) */}
                  {!effectiveOpening.isAuto && (
                    <button
                      onClick={resetToAuto}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition-all"
                      title="Volver al saldo automático"
                    >
                      ↺ Automático
                    </button>
                  )}
                </div>

              ) : (
                /* ── Sin datos previos: CTA para primer mes ── */
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  <span className="text-xs text-slate-400 italic">Sin saldo de referencia</span>
                  <button
                    onClick={() => { setBalanceInput(''); setEditingBalance(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all shadow-sm"
                  >
                    <Plus size={11} /> Definir saldo inicial
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Ingresos', value: stats.income, cls: 'bg-emerald-50 border-emerald-100', txtCls: 'text-emerald-600', Icon: TrendingUp, iconBg: 'bg-emerald-500' },
                { label: 'Gastos', value: stats.expenses, cls: 'bg-red-50 border-red-100', txtCls: 'text-red-500', Icon: TrendingDown, iconBg: 'bg-red-500' },
                { label: 'Ahorros acum.', value: savingsStats.totalNetSavings, cls: 'bg-violet-50 border-violet-100', txtCls: 'text-violet-600', Icon: PiggyBank, iconBg: 'bg-violet-500' },
                {
                  label: 'Saldo final', value: closingBalance ?? stats.balance,
                  cls: (closingBalance ?? stats.balance) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100',
                  txtCls: (closingBalance ?? stats.balance) >= 0 ? 'text-blue-600' : 'text-orange-500',
                  Icon: Wallet, iconBg: (closingBalance ?? stats.balance) >= 0 ? 'bg-blue-500' : 'bg-orange-500',
                },
              ].map(({ label, value, cls, txtCls, Icon, iconBg }) => (
                <div key={label} className={`rounded-2xl p-3 md:p-4 border ${cls} flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 min-w-0 shadow-sm transition-all hover:shadow-md`}>
                  <div className={`${iconBg} p-1.5 md:p-2 rounded-xl shrink-0 shadow-sm w-fit`}>
                    <Icon size={14} className="text-white md:w-4 md:h-4" />
                  </div>
                  <div className="min-w-0 w-full overflow-hidden">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
                    <p className={`text-sm md:text-base font-black ${txtCls} truncate w-full`}>${fmt(value)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {stats.incomeChart.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingresos por categoría</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={stats.incomeChart} innerRadius={32} outerRadius={52} dataKey="total" strokeWidth={0}>
                          {stats.incomeChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} formatter={(v: number) => [`$${fmt(v)}`, '']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-3">
                    {stats.incomeChart.slice(0, 6).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] font-bold text-slate-600 flex-1 truncate">{cat.label}</span>
                        <span className="text-[10px] font-black text-slate-800">${fmt(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.expenseChart.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Gastos por categoría</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={stats.expenseChart} innerRadius={32} outerRadius={52} dataKey="total" strokeWidth={0}>
                          {stats.expenseChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} formatter={(v: number) => [`$${fmt(v)}`, '']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-3">
                    {stats.expenseChart.slice(0, 6).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] font-bold text-slate-600 flex-1 truncate">{cat.label}</span>
                        <span className="text-[10px] font-black text-slate-800">${fmt(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 mt-6">
              {Object.keys(grouped).length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                    <DollarSign size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-400">Sin registros este mes</p>
                    <p className="text-xs text-slate-300 mt-1">Agrega tu primer movimiento</p>
                    <button onClick={() => openNew('expense')} className="mt-4 bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-600 transition-all">
                      <Plus size={12} className="inline mr-1" /> Registrar movimiento
                    </button>
                  </div>
                ) : (
                  Object.entries(grouped).map(([date, txs]) => (
                    <div key={date} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest capitalize">
                          {new Date(date + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {txs.map(tx => {
                          const cat = finCategories.find(c => c.id === tx.finCategoryId);
                          return (
                            <div key={tx.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50/80 group transition-all">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color || '#94a3b8' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-700 truncate">{tx.description}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{cat?.label}</p>
                              </div>
                              <span className={`text-sm font-black shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                {tx.type === 'income' ? '+' : '-'}${fmt(tx.amount)}
                              </span>
                              <button onClick={() => openEdit(tx)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-indigo-500 transition-all shrink-0"><Edit2 size={12} /></button>
                              <button onClick={() => handleDelete(tx.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all shrink-0"><Trash2 size={12} /></button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
            </div>

            {/* Floating Action Button */}
            <button
              onClick={() => openNew('expense')}
              className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all z-[100]"
            >
              <Plus size={24} />
            </button>
            </>)} {/* end movSubTab === 'transacciones' */}
          </>
        )}

        {/* ─── MÁS: sub-nav + contenido ─── */}
        {tab === 'mas' && (
          <>
            {/* Sub-nav: Préstamos | Categorías */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              {([
                { key: 'prestamos'  as MasSection, label: 'Préstamos',  Icon: ArrowLeftRight },
                { key: 'categorias' as MasSection, label: 'Categorías', Icon: Settings },
              ]).map(({ key, label, Icon }) => {
                const active = masSection === key;
                return (
                  <button
                    key={key}
                    onClick={() => setMasSection(key)}
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

            {/* Préstamos */}
            {masSection === 'prestamos' && (
              <PrestamosTab
                loans={loans}
                setLoans={setLoans}
                loanPayments={loanPayments}
                setLoanPayments={setLoanPayments}
                transactions={transactions}
                setTransactions={setTransactions}
                finCategories={finCategories}
              />
            )}

            {/* Categorías */}
            {masSection === 'categorias' && (
          <div className="space-y-6">
            {(['income', 'expense'] as const).map(type => {
              const sectionLabel = type === 'income' ? 'Ingresos' : 'Gastos';
              const cats = finCategories.filter(c => c.type === type || c.type === 'both');
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{sectionLabel}</span>
                    <span className="text-[9px] text-slate-300 font-bold">({cats.length})</span>
                  </div>
                  <div className="space-y-2">
                    {cats.length === 0 ? (
                      <p className="text-xs text-slate-300 font-bold px-2">Sin categorías</p>
                    ) : cats.map(cat => (
                      <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-start gap-3 shadow-sm group">
                        <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-700">{cat.label}</p>
                          {cat.description && <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{cat.description}</p>}
                        </div>
                        <button onClick={() => setCatModal({ ...cat })} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-indigo-500 transition-all shrink-0"><Edit2 size={13} /></button>
                        {cat.id !== LOAN_IN_CAT_ID && cat.id !== LOAN_OUT_CAT_ID && (
                          <button onClick={() => deleteCat(cat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all shrink-0"><Trash2 size={13} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => {
                // Restauración SEGURA: actualiza labels/colores de las categorías del sistema
                // sin borrar las categorías personalizadas del usuario ni afectar transacciones existentes.
                const builtInIds = new Set(initialFinCategories.map(c => c.id));
                setFinCategories(prev => {
                  const customCats = prev.filter(c => !builtInIds.has(c.id));
                  return [...initialFinCategories, ...customCats];
                });
              }}
              className="w-full py-3 rounded-2xl border border-dashed border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-slate-300 hover:text-slate-500 transition-all">
              Restaurar categorías del sistema
            </button>
          </div>
            )} {/* end masSection === 'categorias' */}
          </>
        )}

        {/* ─── ANÁLISIS ─── */}
        {tab === 'analisis' && (
          <div className="space-y-6">
            {/* Annual tracker */}
            <div className="bg-indigo-950 rounded-2xl p-5 text-white">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-4">Resumen {annualStats.year} — año completo</p>
              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 mb-6 sm:mb-4">
                {[
                  { label: 'Ingresos', value: annualStats.yearIncome, cls: 'text-emerald-400' },
                  { label: 'Gastos', value: annualStats.yearExpenses, cls: 'text-red-400' },
                  {
                    label: annualStats.yearClosingSavings !== null ? 'Ahorro cierre' : 'Ahorro neto',
                    value: annualStats.yearClosingSavings !== null ? annualStats.yearClosingSavings : annualStats.yearNetSavings,
                    cls: 'text-violet-300'
                  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between items-center sm:block sm:text-center bg-white/5 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">{label}</p>
                    <p className={`text-base sm:text-lg font-black ${cls}`}>${fmt(value)}</p>
                  </div>
                ))}
              </div>
              {annualStats.yearIncome > 0 && (
                <>
                  <div className="h-1.5 bg-indigo-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, (annualStats.yearNetSavings / annualStats.yearIncome) * 100))}%` }} />
                  </div>
                  <p className="text-[9px] text-indigo-400 font-bold mt-2 text-center">
                    Tasa de ahorro: {Math.round((annualStats.yearNetSavings / annualStats.yearIncome) * 100)}% de los ingresos
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Ingresos', value: annualStats.yearIncome, cls: 'bg-emerald-50 border-emerald-100', txtCls: 'text-emerald-600', Icon: TrendingUp, iconBg: 'bg-emerald-500' },
                { label: 'Gastos', value: annualStats.yearExpenses, cls: 'bg-red-50 border-red-100', txtCls: 'text-red-500', Icon: TrendingDown, iconBg: 'bg-red-500' },
                { label: 'Ahorro neto', value: annualStats.yearNetSavings, cls: 'bg-violet-50 border-violet-100', txtCls: 'text-violet-600', Icon: PiggyBank, iconBg: 'bg-violet-500' },
                {
                  label: 'Balance', value: annualStats.yearIncome - annualStats.yearExpenses,
                  cls: (annualStats.yearIncome - annualStats.yearExpenses) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100',
                  txtCls: (annualStats.yearIncome - annualStats.yearExpenses) >= 0 ? 'text-blue-600' : 'text-orange-500',
                  Icon: Wallet, iconBg: (annualStats.yearIncome - annualStats.yearExpenses) >= 0 ? 'bg-blue-500' : 'bg-orange-500'
                },
              ].map(({ label, value, cls, txtCls, Icon, iconBg }) => (
                <div key={label} className={`rounded-2xl p-3 md:p-4 border ${cls} flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 min-w-0 shadow-sm transition-all hover:shadow-md`}>
                  <div className={`${iconBg} p-1.5 md:p-2 rounded-xl shrink-0 shadow-sm w-fit`}>
                    <Icon size={14} className="text-white md:w-4 md:h-4" />
                  </div>
                  <div className="min-w-0 w-full overflow-hidden">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
                    <p className={`text-sm md:text-base font-black ${txtCls} truncate w-full`}>${fmt(value)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ingresos vs Gastos — {annualStats.year}</p>
              <p className="text-[9px] text-slate-300 font-bold mb-5">Ene — Dic</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData} barGap={3} barSize={10}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={45} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}
                      formatter={(v: number, name: string) => [`$${fmt(v)}`, name === 'income' ? 'Ingresos' : 'Gastos']} />
                    <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" name="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-5 mt-3 justify-center">
                {[['#10b981', 'Ingresos'], ['#ef4444', 'Gastos']].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {yearlyCategoryStats.incomeChart.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingresos por categoría — {annualStats.year}</p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={yearlyCategoryStats.incomeChart} innerRadius={40} outerRadius={70} dataKey="total" strokeWidth={0}>
                          {yearlyCategoryStats.incomeChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} formatter={(v: number) => [`$${fmt(v)}`, '']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {yearlyCategoryStats.incomeChart.slice(0, 8).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] sm:text-xs font-bold text-slate-600 flex-1 truncate">{cat.label}</span>
                        <span className="text-[10px] sm:text-xs font-black text-slate-800">${fmt(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {yearlyCategoryStats.expenseChart.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Gastos por categoría — {annualStats.year}</p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={yearlyCategoryStats.expenseChart} innerRadius={40} outerRadius={70} dataKey="total" strokeWidth={0}>
                          {yearlyCategoryStats.expenseChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} formatter={(v: number) => [`$${fmt(v)}`, '']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {yearlyCategoryStats.expenseChart.slice(0, 8).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] sm:text-xs font-bold text-slate-600 flex-1 truncate">{cat.label}</span>
                        <span className="text-[10px] sm:text-xs font-black text-slate-800">${fmt(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── AHORROS ─── */}
        {tab === 'ahorros' && (
          <div className="space-y-6">

            {/* Annual tracker */}
            <div className="bg-indigo-950 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Tracker {annualStats.year}</p>
                <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
                  <button onClick={() => { const d = new Date(viewDate); d.setFullYear(d.getFullYear() - 1); setViewDate(d); }} className="p-1 hover:bg-white/10 rounded-full transition-all"><ChevronLeft size={14} /></button>
                  <span className="text-xs font-black text-white px-2">{annualStats.year}</span>
                  <button onClick={() => { const d = new Date(viewDate); d.setFullYear(d.getFullYear() + 1); setViewDate(d); }} className="p-1 hover:bg-white/10 rounded-full transition-all"><ChevronRight size={14} /></button>
                </div>
              </div>
              {/* Opening / closing savings for the year */}
              {annualStats.yearOpeningSavings !== null ? (
                <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 mb-4 bg-white/5 rounded-xl p-3">
                  <div className="flex justify-between items-center sm:block text-center p-2 sm:p-0">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">Apertura</p>
                    <p className="text-base font-black text-white">${fmt(annualStats.yearOpeningSavings)}</p>
                  </div>
                  <div className="flex justify-between items-center sm:block text-center border-y sm:border-y-0 sm:border-x border-indigo-800 p-2 sm:p-0">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">Movimiento</p>
                    <p className={`text-base font-black ${annualStats.yearNetSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {annualStats.yearNetSavings >= 0 ? '+' : ''}{fmt(annualStats.yearNetSavings)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center sm:block text-center p-2 sm:p-0">
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">Cierre</p>
                    <p className="text-base font-black text-violet-300">${fmt(annualStats.yearClosingSavings!)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:grid sm:grid-cols-3 gap-4 mb-4">
                  <div className="flex justify-between items-center sm:block text-center bg-white/5 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">Ingresos</p>
                    <p className="text-lg sm:text-xl font-black text-emerald-400">${fmt(annualStats.yearIncome)}</p>
                  </div>
                  <div className="flex justify-between items-center sm:block text-center bg-white/5 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border-y sm:border-y-0 sm:border-x border-indigo-800">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">Gastos</p>
                    <p className="text-lg sm:text-xl font-black text-red-400">${fmt(annualStats.yearExpenses)}</p>
                  </div>
                  <div className="flex justify-between items-center sm:block text-center bg-white/5 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest sm:mb-1">Ahorro neto</p>
                    <p className="text-lg sm:text-xl font-black text-violet-300">${fmt(annualStats.yearNetSavings)}</p>
                  </div>
                </div>
              )}
              {annualStats.yearIncome > 0 && (
                <>
                  <div className="h-2 bg-indigo-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, (annualStats.yearNetSavings / annualStats.yearIncome) * 100))}%` }} />
                  </div>
                  <p className="text-[9px] text-indigo-400 font-bold mt-2 text-center">
                    Tasa de ahorro: {Math.round((annualStats.yearNetSavings / annualStats.yearIncome) * 100)}% de los ingresos
                  </p>
                </>
              )}
            </div>

            {/* Year opening balances config */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Saldos iniciales {annualStats.year}</p>
              <div className="space-y-2">
                {/* Savings opening */}
                <div className="flex items-center justify-between gap-3 bg-violet-50 rounded-xl p-3 border border-violet-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <PiggyBank size={16} className="text-violet-500 shrink-0" />
                    <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Ahorro inicial</span>
                  </div>
                  {editingYearOpening === 'savings' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-black text-sm">$</span>
                      <input autoFocus type="number" min="0" value={yearOpeningInput}
                        onChange={e => setYearOpeningInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveYearOpening('savings'); if (e.key === 'Escape') setEditingYearOpening(null); }}
                        className="w-28 bg-white border-2 border-violet-300 rounded-lg px-2 py-1 text-sm font-black text-slate-800 outline-none" />
                      <button onClick={() => saveYearOpening('savings')} className="p-1.5 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-all"><Check size={13} /></button>
                      <button onClick={() => setEditingYearOpening(null)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-all"><X size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingYearOpening('savings'); setYearOpeningInput(String(annualStats.yearOpeningSavings ?? '')); }}
                      className="flex items-center gap-1.5 text-violet-600 hover:text-violet-800 transition-all">
                      <span className="text-base font-black">{annualStats.yearOpeningSavings !== null ? `$${fmt(annualStats.yearOpeningSavings)}` : '—'}</span>
                      <Pencil size={12} className="opacity-60" />
                    </button>
                  )}
                </div>

                {/* General money opening */}
                {(() => {
                  const janBalance = monthBalances.find(b => b.yearMonth === `${annualStats.year}-01`)?.openingBalance ?? null;
                  return (
                    <div className="flex items-center justify-between gap-3 bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wallet size={16} className="text-blue-500 shrink-0" />
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Dinero inicial</span>
                      </div>
                      {editingYearOpening === 'general' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-black text-sm">$</span>
                          <input autoFocus type="number" min="0" value={yearOpeningInput}
                            onChange={e => setYearOpeningInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveYearOpening('general'); if (e.key === 'Escape') setEditingYearOpening(null); }}
                            className="w-28 bg-white border-2 border-blue-300 rounded-lg px-2 py-1 text-sm font-black text-slate-800 outline-none" />
                          <button onClick={() => saveYearOpening('general')} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"><Check size={13} /></button>
                          <button onClick={() => setEditingYearOpening(null)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-all"><X size={13} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingYearOpening('general'); setYearOpeningInput(String(janBalance ?? '')); }}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-all">
                          <span className="text-base font-black">{janBalance !== null ? `$${fmt(janBalance)}` : '—'}</span>
                          <Pencil size={12} className="opacity-60" />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Savings balance */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo total de ahorros</p>
                  <p className="text-4xl font-black text-slate-800">${fmt(savingsStats.totalNetSavings)}</p>
                </div>
                <PiggyBank size={28} className="text-violet-300 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {savingsStats.openingBalance > 0 && (
                  <div className="col-span-2 bg-violet-50 rounded-xl p-3 border border-violet-100">
                    <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-0.5">Saldo inicial histórico</p>
                    <p className="text-lg font-black text-violet-700">${fmt(savingsStats.openingBalance)}</p>
                  </div>
                )}
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Depositado</p>
                  <p className="text-lg font-black text-emerald-700">+${fmt(savingsStats.totalDeposits)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-0.5">Retirado</p>
                  <p className="text-lg font-black text-red-600">-${fmt(savingsStats.totalWithdrawals)}</p>
                </div>
              </div>
            </div>

            {/* Bolsillos */}
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Mis bolsillos</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* General */}
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">💼</span>
                    <span className="text-xs font-black text-slate-500 uppercase">General</span>
                  </div>
                  <p className="text-2xl font-black text-slate-800">${fmt(savingsStats.generalBalance)}</p>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">Disponible</p>
                </div>

                {/* Named pockets */}
                {savingsPockets.map(pocket => {
                  const bal = savingsStats.pocketBalances[pocket.id] || 0;
                  return (
                    <div key={pocket.id}
                      className="bg-white rounded-2xl border-2 p-4 shadow-sm cursor-pointer hover:shadow-md transition-all group relative active:scale-[0.98]"
                      style={{ borderColor: pocket.color + '50' }}
                      onClick={() => { setAllocateAmountInput(''); setAllocateModal({ pocketId: pocket.id, amount: 0, description: '', date: today, direction: 'to' }); }}>
                      <button
                        onClick={e => { e.stopPropagation(); setPocketModal({ ...pocket }); }}
                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-slate-600 transition-all">
                        <Edit2 size={12} />
                      </button>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{pocket.emoji}</span>
                        <span className="text-xs font-black uppercase" style={{ color: pocket.color }}>{pocket.name}</span>
                      </div>
                      <p className="text-2xl font-black text-slate-800">${fmt(bal)}</p>
                      <p className="text-[9px] font-bold mt-0.5" style={{ color: pocket.color + 'aa' }}>Toca para mover</p>
                    </div>
                  );
                })}

                {/* Add pocket */}
                <button onClick={() => setPocketModal({ name: '', color: POCKET_COLORS[0], emoji: '💰' })}
                  className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4 flex flex-col items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50 transition-all min-h-[120px] active:scale-[0.98]">
                  <Plus size={22} className="text-slate-300" />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Nuevo bolsillo</span>
                </button>
              </div>
            </div>

            {/* Historial */}
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Historial {annualStats.year}</p>
              {Object.keys(savingsHistory).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
                  <PiggyBank size={36} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-400">Sin movimientos de ahorro</p>
                  <p className="text-xs text-slate-300 mt-1">Los ahorros de tus ingresos aparecerán aquí</p>
                </div>
              ) : (
                Object.entries(savingsHistory).map(([monthKey, events]) => {
                  const [ky, km] = monthKey.split('-').map(Number);
                  const monthLabel = new Date(ky, km - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                  const monthNet = events.reduce((s, e) => e.type === 'deposit' ? s + e.amount : e.type === 'withdrawal' ? s - e.amount : s, 0);
                  return (
                    <div key={monthKey} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-3">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest capitalize">{monthLabel}</span>
                        <span className={`text-[10px] font-black ${monthNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {monthNet >= 0 ? '+' : ''}{fmt(monthNet)}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {events.map(e => {
                          const pocket = e.pocketId ? savingsPockets.find(p => p.id === e.pocketId) : null;
                          const isDeposit = e.type === 'deposit';
                          const isWithdrawal = e.type === 'withdrawal';
                          const isPocketIn = e.type === 'pocket_in';
                          return (
                            <div key={e.id} className="px-4 py-3 flex items-center gap-3 group">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDeposit ? 'bg-emerald-100' : isWithdrawal ? 'bg-red-100' : 'bg-indigo-100'}`}>
                                {isDeposit
                                  ? <TrendingUp size={14} className="text-emerald-600" />
                                  : isWithdrawal
                                    ? <TrendingDown size={14} className="text-red-500" />
                                    : <ArrowLeftRight size={14} className="text-indigo-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-700 truncate">{e.description}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                  {isDeposit ? 'Depósito de ahorro'
                                    : isWithdrawal ? (pocket ? `Gasto desde ${pocket.emoji} ${pocket.name}` : 'Gasto de ahorros')
                                      : isPocketIn ? `→ ${pocket?.emoji} ${pocket?.name}` : `← ${pocket?.emoji} ${pocket?.name}`}
                                </p>
                              </div>
                              <span className={`text-sm font-black shrink-0 ${isDeposit ? 'text-emerald-600' : isWithdrawal ? 'text-red-500' : 'text-indigo-500'}`}>
                                {isDeposit ? '+' : isWithdrawal ? '-' : '↔'}${fmt(e.amount)}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => { setEditSavingAmountInput(e.amount ? fmt(e.amount) : ''); setEditSaving({ ...e, direction: e.type === 'pocket_in' ? 'to' : e.type === 'pocket_out' ? 'from' : undefined }); }}
                                  className="p-1 text-slate-300 hover:text-indigo-500 transition-all">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleDeleteHistoryEvent(e)}
                                  className="p-1 text-slate-300 hover:text-red-500 transition-all">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {/* ─── MODAL: Transaction form ─── */}
      {formOpen && editTx && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col md:mx-4" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {formStep === 1 ? (
              <>
                <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
                  <h3 className="text-base font-black text-slate-800 uppercase italic">{isEditingTx ? 'Editar movimiento' : 'Nuevo movimiento'}</h3>
                  <button onClick={() => setFormOpen(false)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-5 space-y-5">
                    <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                      <button onClick={() => { const c = finCategories.find(c => c.type === 'expense' || c.type === 'both'); setEditTx({ ...editTx, type: 'expense', finCategoryId: c?.id || '' }); }}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-[0.98] ${editTx.type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-500'}`}>Gasto</button>
                      <button onClick={() => { const c = finCategories.find(c => c.type === 'income' || c.type === 'both'); setEditTx({ ...editTx, type: 'income', finCategoryId: c?.id || '' }); }}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-[0.98] ${editTx.type === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>Ingreso</button>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fecha</label>
                      <input type="date" value={editTx.date || ''} onChange={e => setEditTx({ ...editTx, date: e.target.value })}
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all" autoFocus />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Monto</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amountInput}
                          onChange={e => setAmountInput(formatCOPInput(e.target.value))}
                          className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl pl-10 pr-4 py-4 text-2xl font-black outline-none transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción</label>
                      <input type="text" value={editTx.description || ''} onChange={e => setEditTx({ ...editTx, description: e.target.value })}
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all" placeholder="¿De qué se trata?" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Categoría</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const visibleCats = finCategories.filter(c => c.type === editTx.type || c.type === 'both');
                          if (editTx.type === 'expense' && !visibleCats.find(c => c.id === LOAN_OUT_CAT_ID)) {
                            visibleCats.push({ id: LOAN_OUT_CAT_ID, label: 'Préstamo a Terceros', color: '#f97316', type: 'expense', description: 'Dinero que le prestas a alguien y esperas que te devuelva.' } as FinCategory);
                          }
                          return visibleCats;
                        })().map(cat => (
                          <button key={cat.id} onClick={() => setEditTx({ ...editTx, finCategoryId: cat.id })}
                            className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-left border-2 transition-all active:scale-[0.98] ${editTx.finCategoryId === cat.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-transparent bg-slate-50 opacity-70 hover:opacity-100'}`}>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-[10px] font-black text-slate-700 leading-tight">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                      {selectedCatObj?.description && (
                        <div
                          className="mt-3 rounded-2xl px-4 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
                          style={{ backgroundColor: `${selectedCatObj?.color || '#6366f1'}12`, border: `1px solid ${selectedCatObj?.color || '#6366f1'}30` }}
                        >
                          <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center" style={{ backgroundColor: `${selectedCatObj?.color || '#6366f1'}25` }}>
                            <Info size={10} style={{ color: selectedCatObj?.color || '#6366f1' }} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: selectedCatObj?.color || '#6366f1' }}>
                              ¿Qué registrar aquí?
                            </p>
                            <p className="text-[11px] text-slate-600 font-medium leading-snug">{selectedCatObj?.description || 'Registra tus movimientos financieros.'}</p>
                          </div>
                        </div>
                      )}

                      {editTx.finCategoryId === LOAN_IN_CAT_ID && (
                        <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={12} className="text-emerald-500" />
                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Vincular al préstamo de:</label>
                          </div>
                          <select
                            value={linkingLoanId}
                            onChange={e => setLinkingLoanId(e.target.value)}
                            className="w-full bg-white border-2 border-emerald-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm font-bold outline-none transition-all shadow-sm"
                          >
                            <option value="">(Opcional) Selecciona una persona...</option>
                            {(Array.isArray(loans) ? loans : []).filter(l => l.status === 'active').map(l => {
                              const paid = (Array.isArray(loanPayments) ? loanPayments : [])
                                .filter(p => p && p.loanId === l.id)
                                .reduce((s, p) => s + (p.amount || 0), 0);
                              const remaining = Math.max(0, (l.amount || 0) - paid);
                              return (
                                <option key={l.id} value={l.id}>
                                  {l.personName || 'Sin nombre'} (Pendiente: ${fmt(remaining)})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {editTx.finCategoryId === LOAN_OUT_CAT_ID && (
                        <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 animate-in fade-in zoom-in-95 duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={12} className="text-orange-500" />
                            <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">¿A quién le prestas?</label>
                          </div>
                          <input
                            type="text"
                            value={loanPersonName}
                            onChange={e => setLoanPersonName(e.target.value)}
                            placeholder="Nombre de la persona"
                            className="w-full bg-white border-2 border-orange-200 focus:border-orange-400 rounded-xl px-3 py-2.5 text-sm font-bold outline-none transition-all shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                  <button 
                    onClick={handleSave} 
                    disabled={!editTx?.description?.trim() || !amountInput || !parseCOPNumber(amountInput) || !editTx?.finCategoryId}
                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isEditingTx ? 'Guardar cambios' : (editTx.finCategoryId === LOAN_IN_CAT_ID && linkingLoanId) ? 'Confirmar Reintegro' : editTx.type === 'income' ? 'Continuar →' : 'Guardar'}
                  </button>
                  {(!editTx?.description?.trim() || !amountInput) && (
                    <p className="text-[9px] text-slate-400 font-bold text-center mt-2 uppercase tracking-tighter italic">Ingresa descripción y monto para continuar</p>
                  )}
                </div>
              </>
            ) : formStep === 2 ? (
              <>
                <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-base font-black text-slate-800 uppercase italic">¿Ahorrar algo?</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Ingreso: <span className="font-black text-emerald-600">${fmt(pendingTxAmount)}</span></p>
                  </div>
                  <button onClick={() => handleConfirmSavings(false)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-5 space-y-6">
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6 text-center">
                      <PiggyBank size={36} className="mx-auto text-violet-500 mb-3" />
                      <p className="text-4xl font-black text-violet-600">${fmt(savingsAmount)}</p>
                      <p className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mt-2">Ahorro sugerido ({savingsPercent}%)</p>
                    </div>
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Porcentaje a ahorrar</label>
                        <span className="text-sm font-black text-violet-600">{savingsPercent}%</span>
                      </div>
                      <input type="range" min="0" max="50" step="5" value={savingsPercent} onChange={e => setSavingsPercent(Number(e.target.value))} className="w-full accent-violet-500" />
                      <div className="flex justify-between text-[9px] font-bold text-slate-300 mt-1"><span>0%</span><span>25%</span><span>50%</span></div>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-2 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                  <button onClick={() => handleConfirmSavings(true)} disabled={savingsPercent === 0}
                    className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg hover:bg-violet-700 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2">
                    <PiggyBank size={13} /> Sí, ahorrar ${fmt(savingsAmount)}
                  </button>
                  <button onClick={() => handleConfirmSavings(false)} className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl uppercase text-xs tracking-widest hover:bg-slate-200 transition-all active:scale-[0.98]">
                    No, solo registrar ingreso
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-base font-black text-slate-800 uppercase italic">Vincular Préstamo</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Monto del reintegro: <span className="font-black text-emerald-600">${fmt(pendingTxAmount)}</span></p>
                  </div>
                  <button onClick={() => { setFormOpen(false); setFormStep(1); }} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-5 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecciona el préstamo correspondiente:</p>
                    <div className="space-y-2">
                      {(() => {
                        const activeLoans = (Array.isArray(loans) ? loans : []).filter(l => l.status === 'active');
                        if (activeLoans.length === 0) {
                          return (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
                              <p className="text-xs font-bold text-slate-400">No hay préstamos activos para vincular.</p>
                            </div>
                          );
                        }
                        return activeLoans.map(loan => (
                          <button key={loan.id} onClick={() => setLinkingLoanId(loan.id)}
                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${linkingLoanId === loan.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div>
                              <p className="text-sm font-black text-slate-700">{loan.personName}</p>
                              <p className="text-[10px] text-slate-400">{loan.date} · ${fmt(loan.amount)}</p>
                            </div>
                            {linkingLoanId === loan.id && <CheckCircle2 size={16} className="text-indigo-500" />}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                  <button onClick={handleConfirmLoanLink} disabled={!linkingLoanId}
                    className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg hover:bg-emerald-600 transition-all active:scale-[0.98] disabled:opacity-40">
                    Confirmar Vínculo
                  </button>
                  <button onClick={() => { setFormOpen(false); setFormStep(1); }} className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all text-center">Cancelar registro</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Category CRUD ─── */}
      {catModal !== null && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] w-full max-w-sm shadow-2xl flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase italic">{catModal.id ? 'Editar' : 'Nueva'} categoría</h3>
              <button onClick={() => setCatModal(null)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre</label>
                  <input type="text" value={catModal.label || ''} onChange={e => setCatModal({ ...catModal, label: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all" placeholder="Ej: Sueldo" autoFocus />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción (opcional)</label>
                  <input type="text" value={catModal.description || ''} onChange={e => setCatModal({ ...catModal, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold text-sm outline-none transition-all" placeholder="¿Qué gastos incluye?" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tipo</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                    {(['income', 'expense'] as const).map(t => (
                      <button key={t} onClick={() => setCatModal({ ...catModal, type: t })}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all active:scale-[0.98] ${catModal.type === t ? (t === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'bg-red-500 text-white shadow-md') : 'text-slate-400'}`}>
                        {t === 'income' ? 'Ingreso' : 'Gasto'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Color</label>
                  <div className="flex flex-wrap gap-2.5">
                    {COLOR_PALETTE.map(color => (
                      <button key={color} onClick={() => setCatModal({ ...catModal, color })}
                        className={`w-8 h-8 rounded-full transition-all active:scale-90 ${catModal.color === color ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-2 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={saveCat} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-indigo-700 transition-all active:scale-[0.98]">Guardar</button>
              {catModal.id && (
                <button onClick={() => deleteCat(catModal.id!)} className="w-full bg-red-50 text-red-500 font-black py-3 rounded-2xl uppercase text-xs tracking-widest hover:bg-red-100 transition-all active:scale-[0.98]">Eliminar categoría</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Withdrawal ─── */}
      {withdrawalModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col md:mx-4" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase italic">Retirar del ahorro</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Saldo disponible: <span className="text-slate-600 font-black">${fmt(savingsStats.totalNetSavings)}</span></p>
              </div>
              <button onClick={() => { setWithdrawalAmountInput(''); setWithdrawalModal(null); }} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Monto retirado</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={withdrawalAmountInput}
                      onChange={e => {
                        const formatted = formatCOPInput(e.target.value);
                        setWithdrawalAmountInput(formatted);
                        setWithdrawalModal({ ...withdrawalModal, amount: parseCOPNumber(formatted) });
                      }}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-red-200 rounded-2xl pl-10 pr-4 py-4 text-2xl font-black outline-none transition-all"
                      placeholder="0" autoFocus />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">¿En qué lo gastaste?</label>
                  <input type="text" value={withdrawalModal.description}
                    onChange={e => setWithdrawalModal({ ...withdrawalModal, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-red-200 rounded-2xl p-4 font-bold outline-none transition-all"
                    placeholder="Descripción del gasto..." />
                </div>
                {savingsPockets.length > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">¿De qué bolsillo?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setWithdrawalModal({ ...withdrawalModal, fromPocketId: '' })}
                        className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${!withdrawalModal.fromPocketId ? 'border-red-400 bg-red-50' : 'border-transparent bg-slate-50'}`}>
                        <span>💼</span>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-slate-700">General</p>
                          <p className="text-[9px] text-slate-400 font-bold">${fmt(savingsStats.generalBalance)}</p>
                        </div>
                      </button>
                      {savingsPockets.map(pocket => (
                        <button key={pocket.id} onClick={() => setWithdrawalModal({ ...withdrawalModal, fromPocketId: pocket.id })}
                          className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${withdrawalModal.fromPocketId === pocket.id ? 'border-red-400 bg-red-50' : 'border-transparent bg-slate-50'}`}>
                          <span>{pocket.emoji}</span>
                          <div className="text-left">
                            <p className="text-[10px] font-black text-slate-700 truncate">{pocket.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold">${fmt(savingsStats.pocketBalances[pocket.id] || 0)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fecha</label>
                  <input type="date" value={withdrawalModal.date}
                    onChange={e => setWithdrawalModal({ ...withdrawalModal, date: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-red-200 rounded-2xl p-4 font-bold outline-none transition-all" />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={handleWithdrawal} disabled={!withdrawalModal.amount || !withdrawalModal.description}
                className="w-full bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-40">
                Registrar retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Allocate to pocket ─── */}
      {allocateModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in" key={allocateModal.pocketId}>
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col md:mx-4" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase italic">Mover dinero</h3>
              <button onClick={() => { setAllocateAmountInput(''); setAllocateModal(null); }} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                  <button onClick={() => setAllocateModal({ ...allocateModal, direction: 'to' })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all active:scale-[0.98] ${allocateModal.direction === 'to' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500'}`}>
                    General → Bolsillo
                  </button>
                  <button onClick={() => setAllocateModal({ ...allocateModal, direction: 'from' })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all active:scale-[0.98] ${allocateModal.direction === 'from' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500'}`}>
                    Bolsillo → General
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bolsillo</label>
                  <div className="grid grid-cols-2 gap-2">
                    {savingsPockets.map(pocket => (
                      <button key={pocket.id} onClick={() => setAllocateModal({ ...allocateModal, pocketId: pocket.id })}
                        className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${allocateModal.pocketId === pocket.id ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-slate-50'}`}>
                        <span>{pocket.emoji}</span>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-slate-700">{pocket.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">${fmt(savingsStats.pocketBalances[pocket.id] || 0)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={allocateAmountInput}
                      onChange={e => {
                        const formatted = formatCOPInput(e.target.value);
                        setAllocateAmountInput(formatted);
                        setAllocateModal({ ...allocateModal, amount: parseCOPNumber(formatted) });
                      }}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl pl-10 pr-4 py-4 text-2xl font-black outline-none transition-all"
                      placeholder="0" autoFocus />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción (opcional)</label>
                  <input type="text" value={allocateModal.description}
                    onChange={e => setAllocateModal({ ...allocateModal, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all"
                    placeholder="¿Para qué?" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fecha</label>
                  <input type="date" value={allocateModal.date}
                    onChange={e => setAllocateModal({ ...allocateModal, date: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all" />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={handleAllocate} disabled={!allocateModal.amount || !allocateModal.pocketId}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-40">
                Confirmar movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Pocket CRUD ─── */}
      {pocketModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] w-full max-w-sm shadow-2xl flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase italic">{pocketModal.id ? 'Editar' : 'Nuevo'} bolsillo</h3>
              <button onClick={() => setPocketModal(null)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-5">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg border-2"
                    style={{ backgroundColor: pocketModal.color + '15', borderColor: pocketModal.color + '50' }}>
                    {pocketModal.emoji}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre</label>
                  <input type="text" value={pocketModal.name}
                    onChange={e => setPocketModal({ ...pocketModal, name: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all"
                    placeholder="Ej: Viajes, Emergencias..." autoFocus />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ícono</label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {POCKET_EMOJIS.map(emoji => (
                      <button key={emoji} onClick={() => setPocketModal({ ...pocketModal, emoji })}
                        className={`h-10 flex items-center justify-center text-xl rounded-xl transition-all active:scale-90 ${pocketModal.emoji === emoji ? 'bg-indigo-50 ring-2 ring-indigo-400 scale-110' : 'hover:bg-slate-50'}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Color</label>
                  <div className="flex flex-wrap gap-2.5">
                    {POCKET_COLORS.map(color => (
                      <button key={color} onClick={() => setPocketModal({ ...pocketModal, color })}
                        className={`w-8 h-8 rounded-full transition-all active:scale-90 ${pocketModal.color === color ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-2 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={handleSavePocket} disabled={!pocketModal.name.trim()}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-40">
                Guardar bolsillo
              </button>
              {pocketModal.id && (
                <button onClick={() => handleDeletePocket(pocketModal.id!)}
                  className="w-full bg-red-50 text-red-500 font-black py-3 rounded-2xl uppercase text-xs tracking-widest hover:bg-red-100 transition-all active:scale-[0.98]">
                  Eliminar bolsillo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ─── MODAL: Edit Saving Movement ─── */}
      {editSaving && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col md:mx-4" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase italic">Editar ahorro</h3>
              <button onClick={() => { setEditSavingAmountInput(''); setEditSaving(null); }} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editSavingAmountInput}
                      onChange={e => {
                        const formatted = formatCOPInput(e.target.value);
                        setEditSavingAmountInput(formatted);
                        setEditSaving({ ...editSaving, amount: parseCOPNumber(formatted) });
                      }}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl pl-10 pr-4 py-4 text-2xl font-black outline-none transition-all"
                      placeholder="0" autoFocus />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Descripción</label>
                  <input type="text" value={editSaving.description}
                    onChange={e => setEditSaving({ ...editSaving, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all"
                    placeholder="Descripción..." />
                </div>

                {(editSaving.type === 'withdrawal' || editSaving.type === 'pocket_in' || editSaving.type === 'pocket_out') && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bolsillo</label>
                    <div className="grid grid-cols-2 gap-2">
                      {editSaving.type === 'withdrawal' && (
                        <button onClick={() => setEditSaving({ ...editSaving, pocketId: '' })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${!editSaving.pocketId ? 'border-indigo-400 bg-indigo-50' : 'border-transparent bg-slate-50'}`}>
                          <span>💼</span><span className="text-[10px] font-black text-slate-700">General</span>
                        </button>
                      )}
                      {savingsPockets.map(pocket => (
                        <button key={pocket.id} onClick={() => setEditSaving({ ...editSaving, pocketId: pocket.id })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${editSaving.pocketId === pocket.id ? 'border-indigo-400 bg-indigo-50' : 'border-transparent bg-slate-50'}`}>
                          <span>{pocket.emoji}</span><span className="text-[10px] font-black text-slate-700 truncate">{pocket.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(editSaving.type === 'pocket_in' || editSaving.type === 'pocket_out') && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Dirección</label>
                    <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                      <button onClick={() => setEditSaving({ ...editSaving, direction: 'to' })}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${editSaving.direction === 'to' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>
                        Hacia Bolsillo
                      </button>
                      <button onClick={() => setEditSaving({ ...editSaving, direction: 'from' })}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${editSaving.direction === 'from' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>
                        Desde Bolsillo
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fecha</label>
                  <input type="date" value={editSaving.date}
                    onChange={e => setEditSaving({ ...editSaving, date: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl p-4 font-bold outline-none transition-all" />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button onClick={handleSaveEditSaving}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-md hover:bg-indigo-700 transition-all active:scale-[0.98]">
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default Dinero;
