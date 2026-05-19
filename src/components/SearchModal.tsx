import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, X, CheckSquare, Target, CalendarDays,
  DollarSign, ChevronRight, Inbox, Circle, Loader,
  CheckCircle2, ArrowUp, ArrowDown, CornerDownLeft, Flame,
} from 'lucide-react';
import type { Task, Goal, Events, Transaction, FinCategory, Categories, Habit } from '../types';
import { fmtCurrency } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionKey = 'hoy' | 'tiempo' | 'dinero' | 'objetivos' | 'lista' | 'revision' | 'habitos';
type ResultType = 'task' | 'goal' | 'event' | 'transaction' | 'habit';

export interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  meta?: string;
  color: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  section: SectionKey;
  done?: boolean;
}

interface SearchModalProps {
  tasks: Task[];
  goals: Goal[];
  events: Events;
  transactions: Transaction[];
  categories: Categories;
  finCategories: FinCategory[];
  habits: Habit[];
  onClose: () => void;
  onSearchSelect: (result: SearchResult) => void;
  isModuleEnabled?: (key: string) => boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_STATUS_LABEL: Record<string, string> = {
  backlog:    'Por definir',
  todo:       'Por hacer',
  inprogress: 'En progreso',
  done:       'Hecha',
};

const TASK_STATUS_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  backlog:    Inbox,
  todo:       Circle,
  inprogress: Loader,
  done:       CheckCircle2,
};

const TYPE_CONFIG: Record<ResultType, { label: string; color: string; Icon: React.FC<any>; module: string }> = {
  task:        { label: 'Tareas',        color: '#8b5cf6', Icon: CheckSquare,  module: 'lista' },
  goal:        { label: 'Objetivos',     color: '#6366f1', Icon: Target,       module: 'objetivos' },
  event:       { label: 'Actividades',   color: '#3b82f6', Icon: CalendarDays, module: 'tiempo' },
  transaction: { label: 'Transacciones', color: '#10b981', Icon: DollarSign,   module: 'dinero' },
  habit:       { label: 'Hábitos',       color: '#f97316', Icon: Flame,        module: 'habitos' },
};

function fmtDateId(dateId: string): string {
  const d = new Date(dateId + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

const SearchModal: React.FC<SearchModalProps> = ({
  tasks, goals, events, transactions, categories, finCategories, habits,
  onClose, onSearchSelect, isModuleEnabled,
}) => {
  const [query, setQuery]         = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // Por defecto todo habilitado (usuario general)
  const modEnabled = (key: string) => isModuleEnabled ? isModuleEnabled(key) : true;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Search logic ────────────────────────────────────────────────────────────
  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (q.length < 1) return [];

    const all: SearchResult[] = [];

    // Tasks
    if (modEnabled('lista')) tasks
      .filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(t => {
        const cat = t.categoryId ? categories[t.categoryId] : null;
        const StatusIcon = TASK_STATUS_ICON[t.status] ?? Circle;
        all.push({
          id: t.id, type: 'task',
          title: t.title,
          subtitle: cat?.label ?? 'Sin área',
          meta: TASK_STATUS_LABEL[t.status] ?? t.status,
          color: cat?.color ?? '#8b5cf6',
          Icon: StatusIcon,
          section: 'lista',
          done: t.status === 'done',
        });
      });

    // Goals
    if (modEnabled('objetivos')) goals
      .filter(g => g.title.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(g => {
        const cat = g.category ? categories[g.category] : null;
        all.push({
          id: g.id, type: 'goal',
          title: g.title,
          subtitle: cat?.label ?? 'Objetivo',
          meta: g.completed ? 'Logrado' : 'Pendiente',
          color: '#6366f1',
          Icon: Target,
          section: 'objetivos',
          done: g.completed,
        });
      });

    // Events
    const eventResults: SearchResult[] = [];
    if (modEnabled('tiempo')) Object.entries(events).forEach(([dateId, evs]) => {
      if (eventResults.length >= 4) return;
      evs.forEach(ev => {
        if (eventResults.length >= 4) return;
        if (!ev.task.toLowerCase().includes(q)) return;
        const cat = categories[ev.category];
        eventResults.push({
          id: ev.id, type: 'event',
          title: ev.task,
          subtitle: fmtDateId(dateId),
          meta: `${ev.startHour} – ${ev.endHour}`,
          color: cat?.color ?? '#3b82f6',
          Icon: CalendarDays,
          section: 'tiempo',
          done: ev.completed,
        });
      });
    });
    all.push(...eventResults);

    // Transactions
    if (modEnabled('dinero')) transactions
      .filter(t => t.description.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(t => {
        const cat = finCategories.find(c => c.id === t.finCategoryId);
        all.push({
          id: t.id, type: 'transaction',
          title: t.description,
          subtitle: cat?.label ?? (t.type === 'income' ? 'Ingreso' : 'Gasto'),
          meta: `$${fmtCurrency(t.amount)}`,
          color: t.type === 'income' ? '#10b981' : '#f59e0b',
          Icon: DollarSign,
          section: 'dinero',
        });
      });

    // Habits
    if (modEnabled('habitos')) habits
      .filter(h => h.name.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(h => {
        all.push({
          id: h.id, type: 'habit',
          title: h.name,
          subtitle: `Meta: ${h.target} días/sem`,
          meta: `Inicio: ${h.startDate}`,
          color: '#6366f1',
          Icon: Flame,
          section: 'habitos',
        });
      });

    return all;
  }, [query, tasks, goals, events, transactions, categories, finCategories, habits]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      onSearchSelect(results[selectedIdx]);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0); }, [results.length]);

  // ── Grouped results ─────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const order: ResultType[] = ['task', 'goal', 'event', 'transaction', 'habit'];
    return order
      .map(type => ({ type, items: results.filter(r => r.type === type) }))
      .filter(g => g.items.length > 0);
  }, [results]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[700] flex items-start justify-center pt-[8vh] px-4 pb-4"
      style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tareas, objetivos, actividades..."
            className="flex-1 text-base md:text-[15px] text-slate-800 placeholder:text-slate-300 outline-none font-medium bg-transparent"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 hover:bg-slate-100 rounded-full transition-all shrink-0"
            >
              <X size={14} className="text-slate-400" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-400 bg-slate-50 shrink-0">
              ESC
            </kbd>
          )}
        </div>

        {/* ── Results ── */}
        <div ref={listRef} className="overflow-y-auto custom-scrollbar flex-1">

          {/* Empty / initial state */}
          {query.length === 0 && (
            <div className="py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-indigo-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">Busca en toda tu plataforma</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {Object.values(TYPE_CONFIG).filter(({ module }) => modEnabled(module)).map(({ label, color, Icon }) => (
                  <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black border"
                    style={{ color, borderColor: color + '30', backgroundColor: color + '0d' }}>
                    <Icon size={11} /> {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {query.length > 0 && results.length === 0 && (
            <div className="py-12 px-6 text-center">
              <p className="text-sm font-bold text-slate-400">Sin resultados para <span className="text-slate-600">"{query}"</span></p>
              <p className="text-xs text-slate-300 mt-1">Intenta con otras palabras clave</p>
            </div>
          )}

          {/* Results grouped */}
          {results.length > 0 && (
            <div className="p-2 space-y-1">
              {groups.map(({ type, items }) => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                      <cfg.Icon size={11} style={{ color: cfg.color }} />
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: cfg.color + '20' }} />
                    </div>

                    {/* Items */}
                    {items.map(result => {
                      const globalIdx = results.indexOf(result);
                      const isSelected = globalIdx === selectedIdx;
                      return (
                        <button
                          key={result.id}
                          data-idx={globalIdx}
                          onClick={() => { onSearchSelect(result); onClose(); }}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-100 ${
                            isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Icon bubble */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: result.color + '18' }}
                          >
                            <result.Icon
                              size={16}
                              className={result.done ? 'opacity-50' : ''}
                              style={{ color: result.color }}
                            />
                          </div>

                          {/* Title + subtitle */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${result.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {result.title}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{result.subtitle}</p>
                          </div>

                          {/* Meta + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            {result.meta && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                result.done
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {result.meta}
                              </span>
                            )}
                            <ChevronRight
                              size={13}
                              className={`transition-all ${isSelected ? 'text-indigo-400' : 'text-slate-200'}`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer: keyboard hints ── */}
        <div className="px-5 py-3 border-t border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-300 font-bold">
              <div className="flex gap-0.5">
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-400">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-400">↓</kbd>
              </div>
              Navegar
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-300 font-bold">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-400">↵</kbd>
              Abrir
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-300 font-bold">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-400">Esc</kbd>
              Cerrar
            </span>
          </div>
          {results.length > 0 && (
            <span className="text-[10px] text-slate-300 font-bold">
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
