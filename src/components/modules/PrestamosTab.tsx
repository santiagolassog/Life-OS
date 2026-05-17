import React, { useState, useMemo } from 'react';
import { Plus, X, Check, ChevronDown, ChevronUp, DollarSign, User, Calendar, AlertCircle, CheckCircle2, Edit2, Trash2, TrendingDown, TrendingUp, Clock } from 'lucide-react';
import type { Loan, LoanPayment, Transaction, FinCategory } from '../../types';
import { LOAN_OUT_CAT_ID, LOAN_IN_CAT_ID } from '../../types';
import { generateId, fmtCurrency as fmt, formatCOPInput, parseCOPNumber, getLocalISODate } from '../../lib/utils';

interface PrestamosTabProps {
  loans: Loan[];
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  loanPayments: LoanPayment[];
  setLoanPayments: React.Dispatch<React.SetStateAction<LoanPayment[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  finCategories: FinCategory[];
}

type LoanForm = { personName: string; amount: string; date: string; description: string };
type PaymentForm = { amount: string; date: string; description: string };

const PrestamosTab: React.FC<PrestamosTabProps> = ({
  loans, setLoans, loanPayments, setLoanPayments,
  transactions, setTransactions, finCategories,
}) => {
  const today = getLocalISODate();

  const [loanModal, setLoanModal]         = useState<LoanForm | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [payModal, setPayModal]           = useState<{ loanId: string; form: PaymentForm } | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loanAmountInput, setLoanAmountInput] = useState('');
  const [payAmountInput, setPayAmountInput]   = useState('');

  const activeLoans    = useMemo(() => loans.filter(l => l.status === 'active'), [loans]);
  const completedLoans = useMemo(() => loans.filter(l => l.status === 'completed'), [loans]);

  const paidByLoan = useMemo(() => {
    const map: Record<string, number> = {};
    loanPayments.forEach(p => { map[p.loanId] = (map[p.loanId] || 0) + p.amount; });
    return map;
  }, [loanPayments]);

  const totalActive    = activeLoans.reduce((s, l) => s + l.amount, 0);
  const totalRecovered = activeLoans.reduce((s, l) => s + (paidByLoan[l.id] || 0), 0);
  const totalPending   = totalActive - totalRecovered;

  const handleAddLoan = () => {
    if (!loanModal) return;
    if (editingLoanId) { handleSaveEditLoan(); return; }
    const amount = parseCOPNumber(loanAmountInput);
    if (!loanModal.personName.trim() || amount <= 0) return;

    const now    = new Date().toISOString();
    const loanId = generateId();
    const txId   = generateId();

    const newLoan: Loan = {
      id: loanId,
      personName: loanModal.personName.trim(),
      amount,
      date: loanModal.date,
      description: loanModal.description.trim() || undefined,
      transactionId: txId,
      status: 'active',
      createdAt: now,
    };

    const newTx: Transaction = {
      id: txId,
      date: loanModal.date,
      type: 'expense',
      amount,
      finCategoryId: LOAN_OUT_CAT_ID,
      description: `Préstamo a ${loanModal.personName.trim()}${loanModal.description ? ` – ${loanModal.description}` : ''}`,
      linkedEventId: undefined,
    };

    setLoans(prev => [newLoan, ...prev]);
    setTransactions(prev => [newTx, ...prev]);
    setLoanModal(null);
  };

  const handleSaveEditLoan = () => {
    if (!loanModal || !editingLoanId) return;
    const amount = parseCOPNumber(loanAmountInput);
    if (!loanModal.personName.trim() || amount <= 0) return;

    setLoans(prev => prev.map(l => l.id === editingLoanId ? {
      ...l,
      personName: loanModal.personName.trim(),
      amount,
      date: loanModal.date,
      description: loanModal.description.trim() || undefined,
    } : l));

    const loan = loans.find(l => l.id === editingLoanId);
    if (loan?.transactionId) {
      setTransactions(prev => prev.map(t => t.id === loan.transactionId ? {
        ...t,
        amount,
        date: loanModal.date,
        description: `Préstamo a ${loanModal.personName.trim()}${loanModal.description ? ` – ${loanModal.description}` : ''}`,
      } : t));
    }

    setLoanModal(null);
    setEditingLoanId(null);
  };

  const handleDeleteLoan = (loan: Loan) => {
    if (window.confirm(`¿Seguro que quieres eliminar el préstamo a ${loan.personName}? Esto también borrará todos sus pagos registrados.`)) {
      const pTxs = loanPayments.filter(p => p.loanId === loan.id).map(p => p.transactionId).filter(Boolean) as string[];
      setLoans(prev => prev.filter(l => l.id !== loan.id));
      setLoanPayments(prev => prev.filter(p => p.loanId !== loan.id));
      setTransactions(prev => prev.filter(t => t.id !== loan.transactionId && !pTxs.includes(t.id)));
    }
  };

  const handleAddPayment = () => {
    if (!payModal) return;
    const amount = parseCOPNumber(payAmountInput);
    if (amount <= 0) return;

    const loan      = loans.find(l => l.id === payModal.loanId);
    if (!loan) return;

    const now       = new Date().toISOString();
    const payId     = generateId();
    const txId      = generateId();
    const paidSoFar = paidByLoan[loan.id] || 0;
    const remaining = loan.amount - paidSoFar;
    const isFullyPaid = amount >= remaining;

    const newPayment: LoanPayment = {
      id: payId,
      loanId: payModal.loanId,
      amount,
      date: payModal.form.date,
      description: payModal.form.description.trim() || undefined,
      transactionId: txId,
      createdAt: now,
    };

    const newTx: Transaction = {
      id: txId,
      date: payModal.form.date,
      type: 'income',
      amount,
      finCategoryId: LOAN_IN_CAT_ID,
      description: `Reintegro de ${loan.personName}${payModal.form.description ? ` – ${payModal.form.description}` : ''}`,
      linkedEventId: undefined,
    };

    setLoanPayments(prev => [...prev, newPayment]);
    setTransactions(prev => [newTx, ...prev]);

    if (isFullyPaid) {
      setLoans(prev => prev.map(l =>
        l.id === payModal.loanId ? { ...l, status: 'completed', completedAt: now } : l
      ));
    }

    setPayModal(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Summary strip ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Prestado */}
          <div className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <TrendingDown size={10} className="text-slate-500" />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Prestado</span>
            </div>
            <p className="text-base font-black text-slate-800 tabular-nums leading-none">${fmt(totalActive)}</p>
          </div>
          {/* Recuperado */}
          <div className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <TrendingUp size={10} className="text-emerald-500" />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Recibido</span>
            </div>
            <p className="text-base font-black text-emerald-600 tabular-nums leading-none">${fmt(totalRecovered)}</p>
          </div>
          {/* Pendiente */}
          <div className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${totalPending > 0 ? 'bg-orange-50' : 'bg-slate-50'}`}>
                <Clock size={10} className={totalPending > 0 ? 'text-orange-500' : 'text-slate-300'} />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Pendiente</span>
            </div>
            <p className={`text-base font-black tabular-nums leading-none ${totalPending > 0 ? 'text-orange-500' : 'text-slate-300'}`}>${fmt(totalPending)}</p>
          </div>
        </div>
        {/* Recovery progress bar */}
        {totalActive > 0 && (
          <div className="px-4 pb-3">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (totalRecovered / totalActive) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 text-right">
              {Math.round((totalRecovered / totalActive) * 100)}% recuperado
            </p>
          </div>
        )}
      </div>

      {/* ── Active loans header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Préstamos activos</p>
          <p className="text-xs font-bold text-slate-500">{activeLoans.length} {activeLoans.length === 1 ? 'persona' : 'personas'}</p>
        </div>
        <button
          onClick={() => { setLoanAmountInput(''); setLoanModal({ personName: '', amount: '', date: today, description: '' }); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wide hover:bg-orange-600 active:scale-95 transition-all shadow-sm shadow-orange-200"
        >
          <Plus size={13} strokeWidth={3} /> Nuevo
        </button>
      </div>

      {/* ── Active loan list ── */}
      {activeLoans.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-100 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
            <DollarSign size={22} className="text-slate-200" />
          </div>
          <p className="text-sm font-black text-slate-300 uppercase tracking-wide">Sin préstamos activos</p>
          <p className="text-[10px] text-slate-300 mt-1">Registra un préstamo para hacer seguimiento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeLoans.map(loan => {
            const paid      = paidByLoan[loan.id] || 0;
            const remaining = Math.max(0, loan.amount - paid);
            const progress  = Math.min(100, (paid / loan.amount) * 100);
            return (
              <div key={loan.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Top: person + amount */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <User size={15} className="text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{loan.personName}</p>
                      {loan.description && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{loan.description}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar size={9} className="text-slate-300" />
                        <p className="text-[9px] text-slate-300 font-bold">{loan.date}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setLoanAmountInput(loan.amount ? fmt(loan.amount) : ''); setEditingLoanId(loan.id); setLoanModal({ personName: loan.personName, amount: loan.amount.toString(), date: loan.date, description: loan.description || '' }); }}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                      ><Edit2 size={13} /></button>
                      <button
                        onClick={() => handleDeleteLoan(loan)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      ><Trash2 size={13} /></button>
                    </div>
                    <p className="text-base font-black text-slate-800 tabular-nums">${fmt(loan.amount)}</p>
                    <p className="text-[10px] font-bold text-orange-500 tabular-nums">${fmt(remaining)} pend.</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="px-4 pb-2">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold mb-1.5">
                    <span>Recuperado</span>
                    <span className="tabular-nums">{progress.toFixed(0)}% · ${fmt(paid)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Action */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => { setPayAmountInput(''); setPayModal({ loanId: loan.id, form: { amount: '', date: today, description: '' } }); }}
                    className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wide hover:bg-emerald-100 active:scale-[0.98] transition-all border border-emerald-100 flex items-center justify-center gap-1.5"
                  >
                    <Check size={11} strokeWidth={3} /> Registrar pago
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Completed loans ── */}
      {completedLoans.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center justify-between w-full text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 hover:text-slate-600 transition-colors bg-slate-50 p-3.5 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Préstamos Saldados ({completedLoans.length})
            </div>
            {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showCompleted && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              {completedLoans.map(loan => (
                <div key={loan.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center justify-between shadow-sm border-l-4 border-l-emerald-400">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Check size={14} className="text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-400 line-through decoration-slate-300 decoration-2 truncate">{loan.personName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[9px] text-slate-300 font-bold">{loan.date}</p>
                        <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Saldado</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-black text-slate-300 line-through decoration-slate-200 tabular-nums">${fmt(loan.amount)}</p>
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1 mt-0.5">
                      <Check size={8} strokeWidth={4} /> Pagado
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Modal: Nuevo / Editar Préstamo ─────────────────────────────────── */}
      {loanModal && (
        <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
          <div className="bg-white rounded-t-3xl md:rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-base font-black text-slate-800 uppercase italic">
                  {editingLoanId ? 'Editar Préstamo' : 'Nuevo Préstamo'}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {editingLoanId ? 'Modifica los datos del préstamo' : 'Registra un préstamo para hacer seguimiento'}
                </p>
              </div>
              <button onClick={() => { setLoanAmountInput(''); setLoanModal(null); setEditingLoanId(null); }} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Persona</label>
                <input
                  type="text"
                  placeholder="Nombre de quien recibe el préstamo"
                  value={loanModal.personName}
                  onChange={e => setLoanModal({ ...loanModal, personName: e.target.value })}
                  autoFocus
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={loanAmountInput}
                      onChange={e => setLoanAmountInput(formatCOPInput(e.target.value))}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl pl-8 pr-3 py-3 text-sm font-bold outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</label>
                  <input
                    type="date"
                    value={loanModal.date}
                    onChange={e => setLoanModal({ ...loanModal, date: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="¿Para qué fue el préstamo?"
                  value={loanModal.description}
                  onChange={e => setLoanModal({ ...loanModal, description: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all"
                />
              </div>
              <div className="bg-orange-50 rounded-2xl p-3.5 flex gap-3 border border-orange-100">
                <AlertCircle size={15} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-orange-600 font-medium leading-relaxed">
                  Se registrará automáticamente como gasto en la categoría <strong>"Préstamos"</strong>.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
              <button
                onClick={handleAddLoan}
                disabled={!loanModal.personName.trim() || !loanAmountInput || !parseCOPNumber(loanAmountInput)}
                className={`w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg ${editingLoanId ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'}`}
              >
                {editingLoanId ? 'Guardar Cambios' : 'Registrar Préstamo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Registrar Pago ────────────────────────────────────────────── */}
      {payModal && (() => {
        const loan      = loans.find(l => l.id === payModal.loanId);
        const paid      = paidByLoan[payModal.loanId] || 0;
        const remaining = loan ? Math.max(0, loan.amount - paid) : 0;
        return (
          <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in md:p-8">
            <div className="bg-white rounded-t-3xl md:rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(92svh, calc(100vh - env(safe-area-inset-top, 0px)))' }}>
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>
              <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-base font-black text-slate-800 uppercase italic">Registrar Pago</h2>
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    {loan?.personName} · <span className="tabular-nums">${fmt(remaining)}</span> pendiente
                  </p>
                </div>
                <button onClick={() => { setPayAmountInput(''); setPayModal(null); }} className="p-2.5 hover:bg-slate-100 rounded-full transition-all"><X size={18}/></button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto pagado</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        autoFocus
                        value={payAmountInput}
                        onChange={e => setPayAmountInput(formatCOPInput(e.target.value))}
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-200 rounded-2xl pl-8 pr-3 py-3 text-sm font-bold outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</label>
                    <input
                      type="date"
                      value={payModal.form.date}
                      onChange={e => setPayModal({ ...payModal, form: { ...payModal.form, date: e.target.value } })}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Pago parcial, transferencia..."
                    value={payModal.form.description}
                    onChange={e => setPayModal({ ...payModal, form: { ...payModal.form, description: e.target.value } })}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all"
                  />
                </div>
                <button
                  onClick={() => setPayAmountInput(fmt(remaining))}
                  className="w-full py-3 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-100 hover:bg-emerald-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Check size={12} strokeWidth={3} />
                  Pagar saldo completo · <span className="tabular-nums">${fmt(remaining)}</span>
                </button>
                <div className="bg-emerald-50 rounded-2xl p-3.5 flex gap-3 border border-emerald-100">
                  <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                    Se registrará como ingreso en la categoría <strong>"Reintegros"</strong>.
                  </p>
                </div>
              </div>
              <div className="px-5 py-4 border-t shrink-0 md:rounded-b-[2rem]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                <button
                  onClick={handleAddPayment}
                  disabled={!payAmountInput || !parseCOPNumber(payAmountInput)}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-emerald-200"
                >
                  Confirmar Pago
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PrestamosTab;
