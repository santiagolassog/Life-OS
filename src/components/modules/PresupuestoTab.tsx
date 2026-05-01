import React, { useState, useMemo } from 'react';
import {
  Plus, X, Trash2, Edit2, Copy, Target, ChevronDown, ChevronUp,
  TrendingDown, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { Budget, FinCategory, Transaction } from '../../types';
import { generateId, fmtCurrency as fmt, formatCOPInput, parseCOPNumber, getLocalISODate } from '../../lib/utils';
import { LOAN_OUT_CAT_ID, LOAN_IN_CAT_ID } from '../../types';

interface PresupuestoTabProps {
  budgets: Budget[];
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
  transactions: Transaction[];
  finCategories: FinCategory[];
  viewDate: Date;
}

function getYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getPrevYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PresupuestoTab: React.FC<PresupuestoTabProps> = ({
  budgets,
  setBudgets,
  transactions,
  finCategories,
  viewDate,
}) => {
  const yearMonth = getYearMonth(viewDate);

  // Only expense categories (excluding loan categories)
  const expenseCategories = useMemo(
    () => finCategories.filter(
      c => c.type === 'expense' && c.id !== LOAN_OUT_CAT_ID && c.id !== LOAN_IN_CAT_ID
    ),
    [finCategories]
  );

  // Budgets for current month
  const monthBudgets = useMemo(
    () => budgets.filter(b => b.yearMonth === yearMonth),
    [budgets, yearMonth]
  );

  // Spending per category for current month (string-compare to avoid timezone issues)
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      if (tx.date.slice(0, 7) !== yearMonth) return;
      map[tx.finCategoryId] = (map[tx.finCategoryId] ?? 0) + tx.amount;
    });
    return map;
  }, [transactions, yearMonth]);

  // Stats
  const totalBudgeted = useMemo(() => monthBudgets.reduce((s, b) => s + b.amount, 0), [monthBudgets]);
  const totalSpent    = useMemo(() => monthBudgets.reduce((s, b) => s + (spentByCategory[b.finCategoryId] ?? 0), 0), [monthBudgets, spentByCategory]);
  const totalRemaining = totalBudgeted - totalSpent;
  const globalPct      = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;
  const isOver         = totalRemaining < 0;

  // Modal state
  const [modalOpen, setModalOpen]     = useState(false);
  const [editBudget, setEditBudget]   = useState<Budget | null>(null);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [showCopied, setShowCopied]   = useState(false);

  // Categories already budgeted this month
  const budgetedCatIds = useMemo(() => new Set(monthBudgets.map(b => b.finCategoryId)), [monthBudgets]);

  const availableCats = useMemo(
    () => expenseCategories.filter(c => !budgetedCatIds.has(c.id) || (editBudget && editBudget.finCategoryId === c.id)),
    [expenseCategories, budgetedCatIds, editBudget]
  );

  function openAdd() {
    setEditBudget(null);
    setSelectedCatId(availableCats[0]?.id ?? '');
    setAmountInput('');
    setModalOpen(true);
  }

  function openEdit(b: Budget) {
    setEditBudget(b);
    setSelectedCatId(b.finCategoryId);
    setAmountInput(formatCOPInput(String(b.amount)));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditBudget(null);
    setSelectedCatId('');
    setAmountInput('');
  }

  function saveBudget() {
    const amount = parseCOPNumber(amountInput);
    if (!selectedCatId || !amount || amount <= 0) return;
    if (editBudget) {
      setBudgets(prev => prev.map(b =>
        b.id === editBudget.id ? { ...b, finCategoryId: selectedCatId, amount } : b
      ));
    } else {
      setBudgets(prev => [...prev, {
        id: generateId(),
        yearMonth,
        finCategoryId: selectedCatId,
        amount,
        createdAt: getLocalISODate(),
      }]);
    }
    closeModal();
  }

  function deleteBudget(id: string) {
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  function copyFromPrevMonth() {
    const prevYM      = getPrevYearMonth(yearMonth);
    const prevBudgets = budgets.filter(b => b.yearMonth === prevYM);
    if (prevBudgets.length === 0) return;
    const newBudgets: Budget[] = prevBudgets
      .filter(pb => !monthBudgets.some(b => b.finCategoryId === pb.finCategoryId))
      .map(pb => ({
        id: generateId(),
        yearMonth,
        finCategoryId: pb.finCategoryId,
        amount: pb.amount,
        createdAt: getLocalISODate(),
      }));
    if (newBudgets.length > 0) {
      setBudgets(prev => [...prev, ...newBudgets]);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2500);
    }
  }

  const prevYM        = getPrevYearMonth(yearMonth);
  const hasPrevBudgets = budgets.some(b => b.yearMonth === prevYM);

  // Sort: over-budget first, then alphabetical
  const sortedBudgets = useMemo(() => {
    return [...monthBudgets].sort((a, b) => {
      const aOver = (spentByCategory[a.finCategoryId] ?? 0) > a.amount;
      const bOver = (spentByCategory[b.finCategoryId] ?? 0) > b.amount;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      const aLabel = finCategories.find(c => c.id === a.finCategoryId)?.label ?? '';
      const bLabel = finCategories.find(c => c.id === b.finCategoryId)?.label ?? '';
      return aLabel.localeCompare(bLabel);
    });
  }, [monthBudgets, spentByCategory, finCategories]);

  return (
    <div className="flex flex-col gap-4 pb-10">

      {/* ─── Header stats ─── */}
      {monthBudgets.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Row 1: Planeado | Gastado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-slate-100 flex flex-col gap-0.5 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Planeado</p>
              <p className="text-base font-black text-slate-800 tabular-nums truncate">{fmt(totalBudgeted)}</p>
            </div>
            <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-slate-100 flex flex-col gap-0.5 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Gastado</p>
              <p className="text-base font-black text-slate-700 tabular-nums truncate">{fmt(totalSpent)}</p>
            </div>
          </div>

          {/* Row 2: Disponible / Excedido — full width with progress bar */}
          <div className={`rounded-2xl px-4 py-3.5 shadow-sm border flex flex-col gap-2 ${
            isOver ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <div className="flex items-center justify-between min-w-0 gap-2">
              <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${isOver ? 'text-red-400' : 'text-emerald-500'}`}>
                {isOver ? 'Presupuesto excedido' : 'Disponible este mes'}
              </p>
              <p className={`text-base font-black tabular-nums shrink-0 ${isOver ? 'text-red-600' : 'text-emerald-700'}`}>
                {isOver ? '+' : ''}{fmt(Math.abs(totalRemaining))}
              </p>
            </div>
            {/* Global progress bar */}
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/60">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${globalPct}%`, backgroundColor: isOver ? '#ef4444' : '#10b981' }}
              />
            </div>
            <p className={`text-[10px] font-semibold ${isOver ? 'text-red-400' : 'text-emerald-600'}`}>
              {Math.round(globalPct)}% del presupuesto total usado
            </p>
          </div>
        </div>
      )}

      {/* ─── Action bar ─── */}
      <div className="flex gap-2">
        <button
          onClick={openAdd}
          disabled={availableCats.length === 0}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black uppercase italic tracking-wide rounded-2xl px-4 py-3 transition-all shadow-sm whitespace-nowrap"
        >
          <Plus size={15} strokeWidth={3} />
          Agregar categoría
        </button>
        {hasPrevBudgets && (
          <button
            onClick={copyFromPrevMonth}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-2xl px-3.5 py-3 transition-all shadow-sm shrink-0"
          >
            {showCopied
              ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              : <Copy size={15} className="shrink-0" />
            }
            <span className="text-xs whitespace-nowrap hidden sm:inline">
              {showCopied ? '¡Copiado!' : 'Copiar mes anterior'}
            </span>
            <span className="text-xs whitespace-nowrap sm:hidden">
              {showCopied ? '¡Listo!' : 'Copiar'}
            </span>
          </button>
        )}
      </div>

      {/* ─── Empty state ─── */}
      {monthBudgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <Target size={28} className="text-indigo-400" />
          </div>
          <div className="text-center px-4">
            <p className="font-black text-slate-700 text-base">Sin presupuesto este mes</p>
            <p className="text-sm text-slate-400 mt-1 max-w-[220px] mx-auto leading-snug">
              Define cuánto quieres gastar en cada categoría
            </p>
          </div>
          {hasPrevBudgets && (
            <button
              onClick={copyFromPrevMonth}
              className="flex items-center gap-2 text-indigo-600 text-sm font-bold border border-indigo-200 bg-indigo-50 rounded-2xl px-5 py-2.5 hover:bg-indigo-100 active:bg-indigo-200 transition-all"
            >
              <Copy size={14} />
              Copiar mes anterior
            </button>
          )}
        </div>
      )}

      {/* ─── Budget cards ─── */}
      {sortedBudgets.length > 0 && (
        <div className="flex flex-col gap-3">
          {sortedBudgets.map(b => {
            const cat       = finCategories.find(c => c.id === b.finCategoryId);
            if (!cat) return null;
            const spent     = spentByCategory[b.finCategoryId] ?? 0;
            const pct       = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
            const over      = spent > b.amount;
            const remaining = b.amount - spent;

            return (
              <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">

                {/* Top row: icon + name + actions */}
                <div className="flex items-start gap-2.5 mb-3">
                  {/* Color dot */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  </div>

                  {/* Name + amounts */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm leading-tight truncate">{cat.label}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5 tabular-nums">
                      <span className="text-slate-600 font-bold">{fmt(spent)}</span>
                      <span className="text-slate-300 mx-1">de</span>
                      {fmt(b.amount)}
                    </p>
                  </div>

                  {/* Edit + delete */}
                  <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
                    <button
                      onClick={() => openEdit(b)}
                      className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-all"
                      aria-label="Editar"
                    >
                      <Edit2 size={13} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => deleteBudget(b.id)}
                      className="p-2 hover:bg-red-50 active:bg-red-100 rounded-full transition-all"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: over ? '#ef4444' : cat.color }}
                  />
                </div>

                {/* Bottom row: % + badge or remaining */}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <p className="text-[10px] text-slate-400 font-semibold tabular-nums shrink-0">
                    {Math.round((spent / b.amount) * 100)}% usado
                  </p>
                  {over ? (
                    <div className="flex items-center gap-1 bg-red-50 text-red-500 text-[10px] font-black rounded-full px-2.5 py-1 min-w-0">
                      <AlertCircle size={9} className="shrink-0" />
                      <span className="truncate">Excedido {fmt(spent - b.amount)}</span>
                    </div>
                  ) : spent === b.amount && spent > 0 ? (
                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full px-2.5 py-1">
                      <CheckCircle2 size={9} className="shrink-0" />
                      <span>Exacto</span>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold tabular-nums truncate" style={{ color: cat.color }}>
                      {fmt(remaining)} libre
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Unbudgeted categories with spending ─── */}
      <UnbudgetedSection
        expenseCategories={expenseCategories}
        budgetedCatIds={budgetedCatIds}
        spentByCategory={spentByCategory}
        onAdd={(catId) => {
          setEditBudget(null);
          setSelectedCatId(catId);
          setAmountInput('');
          setModalOpen(true);
        }}
      />

      {/* ─── Modal ─── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-[2.5rem] w-full max-w-md shadow-2xl md:mx-4"
            style={{ maxHeight: 'calc(95vh - env(safe-area-inset-top, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase italic">
                {editBudget ? 'Editar presupuesto' : 'Nueva categoría'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2.5 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">

              {/* Category picker */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Categoría de gasto
                </label>
                {availableCats.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                    Todas las categorías ya tienen presupuesto
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5">
                    {availableCats.map(cat => {
                      const active = selectedCatId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCatId(cat.id)}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left border transition-all ${
                            active
                              ? 'border-2 text-white'
                              : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                          }`}
                          style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : cat.color }}
                          />
                          <span className="text-[12px] font-bold leading-tight line-clamp-1">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Amount input */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Monto presupuestado
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={e => setAmountInput(formatCOPInput(e.target.value))}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-800 font-bold text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 tabular-nums"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick chips */}
              <div className="flex flex-wrap gap-2">
                {[50000, 100000, 200000, 300000, 500000, 1000000].map(v => (
                  <button
                    key={v}
                    onClick={() => setAmountInput(formatCOPInput(String(v)))}
                    className="text-[11px] font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 rounded-full px-3 py-1.5 transition-all tabular-nums"
                  >
                    {fmt(v)}
                  </button>
                ))}
              </div>

              {/* Save */}
              <button
                onClick={saveBudget}
                disabled={!selectedCatId || !amountInput || parseCOPNumber(amountInput) <= 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase italic tracking-wide rounded-2xl py-3.5 transition-all"
              >
                {editBudget ? 'Guardar cambios' : 'Crear presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Unbudgeted section ─────────────────────────────────────────────────── */

interface UnbudgetedSectionProps {
  expenseCategories: FinCategory[];
  budgetedCatIds: Set<string>;
  spentByCategory: Record<string, number>;
  onAdd: (catId: string) => void;
}

const UnbudgetedSection: React.FC<UnbudgetedSectionProps> = ({
  expenseCategories,
  budgetedCatIds,
  spentByCategory,
  onAdd,
}) => {
  const [expanded, setExpanded] = useState(false);

  const unbudgeted = useMemo(
    () => expenseCategories
      .filter(c => !budgetedCatIds.has(c.id) && (spentByCategory[c.id] ?? 0) > 0)
      .sort((a, b) => (spentByCategory[b.id] ?? 0) - (spentByCategory[a.id] ?? 0)),
    [expenseCategories, budgetedCatIds, spentByCategory]
  );

  if (unbudgeted.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full px-4 py-3.5"
      >
        <div className="flex items-center gap-2 min-w-0">
          <TrendingDown size={14} className="text-amber-500 shrink-0" />
          <p className="text-sm font-black text-amber-700 leading-tight">
            {unbudgeted.length} {unbudgeted.length === 1 ? 'categoría' : 'categorías'} con gastos sin presupuestar
          </p>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-amber-500 shrink-0 ml-2" />
          : <ChevronDown size={16} className="text-amber-500 shrink-0 ml-2" />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {unbudgeted.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
              {/* Color dot */}
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              {/* Name */}
              <p className="text-sm font-bold text-slate-700 flex-1 min-w-0 truncate">{cat.label}</p>
              {/* Amount */}
              <p className="text-sm font-black text-slate-800 tabular-nums shrink-0">
                {fmt(spentByCategory[cat.id] ?? 0)}
              </p>
              {/* CTA */}
              <button
                onClick={() => onAdd(cat.id)}
                className="text-[10px] font-black uppercase tracking-wide text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-1 hover:bg-indigo-100 active:bg-indigo-200 transition-all shrink-0 whitespace-nowrap"
              >
                + Agregar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PresupuestoTab;
