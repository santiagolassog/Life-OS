import React, { useState } from 'react';
import { X, Zap, Clock, DollarSign, Star, ChevronDown } from 'lucide-react';
import type { Categories, Events, Transaction, FinCategory } from '../types';
import { generateId, formatDateId, GRID_HOURS } from '../lib/utils';

interface QuickLogProps {
  categories: Categories;
  finCategories: FinCategory[];
  events: Events;
  setEvents: React.Dispatch<React.SetStateAction<Events>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentDate: Date;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
];

const roundTo15 = (): string => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const rounded = Math.round(m / 15) * 15;
  if (rounded === 60) return `${String(h + 1 > 23 ? 23 : h + 1).padStart(2, '0')}:00`;
  return `${String(h).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`;
};

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  const rounded = Math.round(newM / 15) * 15;
  if (rounded === 60) return `${String(Math.min(newH + 1, 23)).padStart(2, '0')}:00`;
  return `${String(newH).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`;
};

const StarRating: React.FC<{ value: number | null; onChange: (v: number) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="flex flex-col items-center gap-1.5">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`transition-all active:scale-90 ${n <= (value || 0) ? 'text-amber-400' : 'text-slate-200'}`}
        >
          <Star size={22} fill={n <= (value || 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  </div>
);

const QuickLog: React.FC<QuickLogProps> = ({
  categories, finCategories, setEvents, setTransactions, currentDate, onClose
}) => {
  const catList = Object.values(categories);
  const [selectedCat, setSelectedCat] = useState(catList[0]?.id || '');
  const [task, setTask] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [energy, setEnergy] = useState<number>(0);
  const [impact, setImpact] = useState<number>(0);
  const [withMoney, setWithMoney] = useState(false);
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [finCatId, setFinCatId] = useState(finCategories.find(c => c.type === 'expense')?.id || '');
  const [startTime] = useState(roundTo15);

  const cat = categories[selectedCat];
  const endTime = addMinutes(startTime, durationMin);

  const handleSubmit = () => {
    if (!task.trim() || !selectedCat) return;
    const dateId = formatDateId(currentDate);

    setEvents(prev => {
      const next = { ...prev };
      if (!next[dateId]) next[dateId] = [];
      next[dateId] = [...next[dateId], {
        id: generateId(),
        startHour: startTime,
        endHour: endTime,
        category: selectedCat,
        task: task.trim(),
        completed: true,
        energy: energy > 0 ? energy : undefined,
        impact: impact > 0 ? impact : undefined,
      }];
      return next;
    });

    if (withMoney && amount && parseFloat(amount) > 0) {
      setTransactions(prev => [...prev, {
        id: generateId(),
        date: dateId,
        type: txType,
        amount: parseFloat(amount),
        finCategoryId: finCatId,
        description: task.trim(),
        linkedEventId: undefined,
      }]);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 md:p-4 animate-in fade-in">
      <div className="bg-[#0f1117] rounded-t-[2.5rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-xl shadow-lg">
              <Zap size={18} fill="white" className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase italic tracking-tight">Registro Rápido</h3>
              <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Hoy · {startTime} → {endTime}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-all"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">

          {/* Category */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Área</label>
            <div className="grid grid-cols-5 gap-1.5">
              {catList.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCat(c.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl text-[9px] font-black transition-all border-2 ${selectedCat === c.id ? 'border-indigo-500 bg-indigo-500/10 scale-105 shadow-sm' : 'border-transparent bg-white/5 opacity-50 hover:opacity-100'}`}
                >
                  <div className="w-3.5 h-3.5 rounded-full shadow" style={{ backgroundColor: c.color }} />
                  <span className="text-white uppercase tracking-tighter truncate w-full text-center">{c.short}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Task name */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">¿Qué hiciste?</label>
            <input
              type="text"
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Describe la actividad..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold text-sm outline-none focus:ring-2 ring-indigo-500 placeholder:text-slate-600"
              autoFocus
            />
            {cat?.presets?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cat.presets.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setTask(p)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all border ${task === p ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                  >{p}</button>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Clock size={10} /> Duración
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DURATION_OPTIONS.map(({ label, minutes }) => (
                <button
                  key={minutes}
                  onClick={() => setDurationMin(minutes)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border ${durationMin === minutes ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg scale-105' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Energy + Impact */}
          <div className="flex justify-around py-2 bg-white/5 rounded-2xl border border-white/5">
            <StarRating value={energy} onChange={setEnergy} label="Energía" />
            <div className="w-px bg-white/10" />
            <StarRating value={impact} onChange={setImpact} label="Impacto" />
          </div>

          {/* Money toggle */}
          <div className="space-y-3">
            <button
              onClick={() => setWithMoney(!withMoney)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${withMoney ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
            >
              <div className="flex items-center gap-2">
                <DollarSign size={16} className={withMoney ? 'text-emerald-400' : 'text-slate-500'} />
                <span className={`text-xs font-black uppercase tracking-wide ${withMoney ? 'text-emerald-400' : 'text-slate-500'}`}>¿Hubo movimiento de dinero?</span>
              </div>
              <ChevronDown size={14} className={`transition-transform ${withMoney ? 'rotate-180 text-emerald-400' : 'text-slate-600'}`} />
            </button>

            {withMoney && (
              <div className="space-y-3 animate-in slide-in-from-top-2">
                <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
                  <button onClick={() => { setTxType('expense'); setFinCatId(finCategories.find(c => c.type === 'expense')?.id || ''); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${txType === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-500'}`}>Gasto</button>
                  <button onClick={() => { setTxType('income'); setFinCatId(finCategories.find(c => c.type === 'income')?.id || ''); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${txType === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>Ingreso</button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                  <input
                    type="number" step="1" min="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white font-black text-lg outline-none focus:ring-2 ring-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {finCategories.filter(c => c.type === txType || c.type === 'both').map(fc => (
                    <button
                      key={fc.id}
                      onClick={() => setFinCatId(fc.id)}
                      className={`p-2 rounded-xl text-[9px] font-black text-center border transition-all ${finCatId === fc.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 scale-105' : 'border-white/10 bg-white/5 text-slate-500 hover:text-white'}`}
                    >
                      <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: fc.color }} />
                      {fc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="p-6 pt-0 border-t border-white/5">
          <button
            onClick={handleSubmit}
            disabled={!task.trim() || !selectedCat}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Zap size={14} fill="white" /> Registrar actividad
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickLog;
