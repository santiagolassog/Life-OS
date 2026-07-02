/**
 * Capa de acceso a datos — Supabase
 *
 * Patrón:
 *  - loadXxx()   → carga desde Supabase al arrancar la app
 *  - syncXxx()   → detecta diferencias entre el estado anterior y el actual,
 *                  hace upsert de lo nuevo/modificado y borra lo eliminado
 *
 * Los módulos hijo (Dinero, Objetivos, etc.) siguen usando sus setters
 * normales de React; el diff/sync ocurre en los useEffect de LifeFlow.tsx.
 */

import { supabase } from './supabase'
import { toast } from 'sonner'
import type {
  Events, Categories, EventEntry, Category,
  Transaction, FinCategory, Goal,
  Savings, MonthBalance, SavingsWithdrawal,
  SavingsPocket, PocketFunding, SavingsYearBalance,
  Loan, LoanPayment, Budget, Task, ChecklistItem,
  Habit, HabitLog, Reminder,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_PAGE_SIZE = 1000

/**
 * Trae TODAS las filas de una tabla, paginando en bloques de 1000.
 *
 * PostgREST (Supabase) limita cada respuesta a un máximo de filas (1000 por
 * defecto) aunque no se pida un LIMIT explícito. Con .select('*') a secas,
 * cualquier cuenta cuya tabla supere ese límite pierde en silencio las filas
 * que exceden el corte — sin error visible, simplemente no vuelven en la
 * respuesta. Esto es exactamente lo que causaba que actividades ya guardadas
 * (confirmadas en la base de datos) nunca se reflejaran de vuelta en la app
 * una vez la tabla de eventos superó las 1000 filas.
 *
 * Se ordena por 'id' para garantizar un orden estable entre páginas (sin
 * ORDER BY, Postgres no garantiza el mismo orden en llamadas sucesivas,
 * lo que podría saltarse o duplicar filas al paginar).
 */
async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1)
    if (error) { console.error(`fetchAllRows(${table}):`, error); break }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < FETCH_PAGE_SIZE) break
    from += FETCH_PAGE_SIZE
  }
  return rows
}

/** Aplana un Record<dateId, EventEntry[]> a un array plano con dateId incluido. */
function flattenEvents(events: Events): Array<EventEntry & { dateId: string }> {
  return Object.entries(events).flatMap(([dateId, evs]) =>
    (evs ?? []).map(e => ({ ...e, dateId }))
  )
}

/** Diff genérico para arrays de objetos con { id }. */
function diffArrays<T extends { id: string }>(
  prev: T[],
  curr: T[],
): { upserted: T[]; deletedIds: string[] } {
  const prevMap = new Map(prev.map(i => [i.id, i]))
  const currIds = new Set(curr.map(i => i.id))

  const deletedIds = prev.filter(i => !currIds.has(i.id)).map(i => i.id)
  const upserted = curr.filter(i => {
    const p = prevMap.get(i.id)
    return !p || JSON.stringify(p) !== JSON.stringify(i)
  })

  return { upserted, deletedIds }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversores: DB row → tipo de la app
// ─────────────────────────────────────────────────────────────────────────────

export const rowToEvent = (row: Record<string, unknown>): EventEntry => ({
  id:        row.id as string,
  startHour: row.start_hour as string,
  endHour:   row.end_hour as string,
  category:  row.category_id as string,
  task:      row.task as string,
  completed: row.completed as boolean,
  energy:    row.energy != null ? (row.energy as number) : undefined,
  impact:    row.impact != null ? (row.impact as number) : undefined,
  habitId:   row.habit_id != null ? (row.habit_id as string) : undefined,
})

const rowToCategory = (row: Record<string, unknown>): Category => ({
  id:        row.id as string,
  label:     row.label as string,
  color:     row.color as string,
  short:     row.short as string,
  presets:   (row.presets as string[]) ?? [],
  sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
})

const rowToTransaction = (row: Record<string, unknown>): Transaction => ({
  id:             row.id as string,
  date:           row.date as string,
  type:           row.type as 'income' | 'expense',
  amount:         Number(row.amount),
  finCategoryId:  row.fin_category_id as string,
  description:    row.description as string,
  linkedEventId:  row.linked_event_id ? (row.linked_event_id as string) : undefined,
})

const rowToFinCategory = (row: Record<string, unknown>): FinCategory => ({
  id:          row.id as string,
  label:       row.label as string,
  color:       row.color as string,
  type:        row.type as 'income' | 'expense' | 'both',
  description: row.description ? (row.description as string) : undefined,
})

const rowToGoal = (row: Record<string, unknown>): Goal => ({
  id:          row.id as string,
  title:       row.title as string,
  description: row.description ? (row.description as string) : undefined,
  priority:    row.priority as 'high' | 'medium' | 'low',
  scope:       row.scope as 'weekly' | 'daily',
  weekId:      row.week_id as string,
  dateId:      row.date_id ? (row.date_id as string) : undefined,
  category:    row.category_id ? (row.category_id as string) : undefined,
  deadline:    row.deadline ? (row.deadline as string) : undefined,
  completed:   row.completed as boolean,
  completedAt: row.completed_at ? (row.completed_at as string) : undefined,
  createdAt:   row.created_at as string,
})

const rowToSavings = (row: Record<string, unknown>): Savings => ({
  id:                  row.id as string,
  amount:              Number(row.amount),
  date:                row.date as string,
  description:         row.description as string,
  sourceTransactionId: row.source_transaction_id ? (row.source_transaction_id as string) : undefined,
})

const rowToMonthBalance = (row: Record<string, unknown>): MonthBalance => ({
  id:             row.id as string,
  yearMonth:      row.year_month as string,
  openingBalance: Number(row.opening_balance),
})

const rowToSavingsWithdrawal = (row: Record<string, unknown>): SavingsWithdrawal => ({
  id:            row.id as string,
  date:          row.date as string,
  amount:        Number(row.amount),
  description:   row.description as string,
  fromPocketId:  row.from_pocket_id ? (row.from_pocket_id as string) : undefined,
})

const rowToSavingsPocket = (row: Record<string, unknown>): SavingsPocket => ({
  id:    row.id as string,
  name:  row.name as string,
  color: row.color as string,
  emoji: row.emoji as string,
})

const rowToPocketFunding = (row: Record<string, unknown>): PocketFunding => ({
  id:          row.id as string,
  pocketId:    row.pocket_id as string,
  date:        row.date as string,
  amount:      Number(row.amount),
  description: row.description as string,
})

const rowToSavingsYearBalance = (row: Record<string, unknown>): SavingsYearBalance => ({
  id:             row.id as string,
  year:           row.year as number,
  savingsOpening: Number(row.savings_opening),
  generalOpening: row.general_opening != null ? Number(row.general_opening) : undefined,
})

// ─────────────────────────────────────────────────────────────────────────────
// Conversores: tipo de la app → DB row
// ─────────────────────────────────────────────────────────────────────────────

/** Añade user_id a cualquier objeto DB row */
const withUser = <T extends object>(row: T, userId: string): T & { user_id: string } => ({
  ...row,
  user_id: userId,
})

const eventToDb = (e: EventEntry & { dateId: string }) => ({
  id:          e.id,
  date_id:     e.dateId,
  start_hour:  e.startHour,
  end_hour:    e.endHour,
  category_id: e.category,
  task:        e.task,
  completed:   e.completed,
  energy:      e.energy ?? null,
  impact:      e.impact ?? null,
  habit_id:    e.habitId ?? null,
})

const categoryToDb = (c: Category) => ({
  id:         c.id,
  label:      c.label,
  color:      c.color,
  short:      c.short,
  presets:    c.presets ?? [],
  sort_order: c.sortOrder ?? 0,
})

const transactionToDb = (t: Transaction) => ({
  id:               t.id,
  date:             t.date,
  type:             t.type,
  amount:           t.amount,
  fin_category_id:  t.finCategoryId,
  description:      t.description,
  linked_event_id:  t.linkedEventId ?? null,
})

const finCategoryToDb = (c: FinCategory) => ({
  id:          c.id,
  label:       c.label,
  color:       c.color,
  type:        c.type,
  description: c.description ?? null,
})

const goalToDb = (g: Goal) => ({
  id:          g.id,
  title:       g.title,
  description: g.description ?? null,
  priority:    g.priority,
  scope:       g.scope,
  week_id:     g.weekId,
  date_id:     g.dateId ?? null,
  category_id: g.category ?? null,
  deadline:    g.deadline ?? null,
  completed:   g.completed,
  completed_at: g.completedAt ?? null,
  created_at:  g.createdAt,
})

const savingsToDb = (s: Savings) => ({
  id:                    s.id,
  amount:                s.amount,
  date:                  s.date,
  description:           s.description,
  source_transaction_id: s.sourceTransactionId ?? null,
})

// Hábitos ──────────────────────────────────────────────────────────────────
const rowToHabit = (row: Record<string, unknown>): Habit => ({
  id:        row.id as string,
  name:      row.name as string,
  target:    Number(row.target),
  color:     row.color as string,
  startDate: row.start_date as string,
  sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
  createdAt: row.created_at as string,
})

const habitToDb = (h: Habit) => ({
  id:         h.id,
  name:       h.name,
  target:     h.target,
  color:      h.color,
  start_date: h.startDate,
  sort_order: h.sortOrder ?? 0,
  created_at: h.createdAt,
})

const rowToHabitLog = (row: Record<string, unknown>): HabitLog => ({
  id:      row.id as string,
  habitId: row.habit_id as string,
  date:    row.date as string,
})

const habitLogToDb = (l: HabitLog) => ({
  id:       l.id,
  habit_id: l.habitId,
  date:     l.date,
})

const monthBalanceToDb = (m: MonthBalance) => ({
  id:              m.id,
  year_month:      m.yearMonth,
  opening_balance: m.openingBalance,
})

const savingsWithdrawalToDb = (w: SavingsWithdrawal) => ({
  id:             w.id,
  date:           w.date,
  amount:         w.amount,
  description:    w.description,
  from_pocket_id: w.fromPocketId ?? null,
})

const savingsPocketToDb = (p: SavingsPocket) => ({
  id:    p.id,
  name:  p.name,
  color: p.color,
  emoji: p.emoji,
})

const pocketFundingToDb = (f: PocketFunding) => ({
  id:          f.id,
  pocket_id:   f.pocketId,
  date:        f.date,
  amount:      f.amount,
  description: f.description,
})

const savingsYearBalanceToDb = (b: SavingsYearBalance) => ({
  id:              b.id,
  year:            b.year,
  savings_opening: b.savingsOpening,
  general_opening: b.generalOpening ?? null,
})

// ─────────────────────────────────────────────────────────────────────────────
// CARGA INICIAL
// ─────────────────────────────────────────────────────────────────────────────

export async function loadEvents(): Promise<Events> {
  const data = await fetchAllRows('events')

  const grouped: Events = {}
  data.forEach(row => {
    const dateId = row.date_id as string
    if (!grouped[dateId]) grouped[dateId] = []
    grouped[dateId].push(rowToEvent(row))
  })
  return grouped
}

export async function loadCategories(): Promise<Categories> {
  const data = await fetchAllRows('categories')
  const cats: Categories = {}
  data.forEach(row => { cats[row.id as string] = rowToCategory(row) })
  return cats
}

export async function loadTransactions(): Promise<Transaction[]> {
  const data = await fetchAllRows('transactions')
  return data.map(rowToTransaction).sort((a, b) => b.date.localeCompare(a.date))
}

export async function loadFinCategories(): Promise<FinCategory[]> {
  const data = await fetchAllRows('fin_categories')
  return data.map(rowToFinCategory)
}

export async function loadGoals(): Promise<Goal[]> {
  const data = await fetchAllRows('goals')
  return data.map(rowToGoal)
}

export async function loadHabits(): Promise<Habit[]> {
  const data = await fetchAllRows('habits')
  return data.map(rowToHabit).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function loadHabitLogs(): Promise<HabitLog[]> {
  const data = await fetchAllRows('habit_logs')
  return data.map(rowToHabitLog)
}

export async function loadSavings(): Promise<Savings[]> {
  const data = await fetchAllRows('savings')
  return data.map(rowToSavings)
}

export async function loadMonthBalances(): Promise<MonthBalance[]> {
  const data = await fetchAllRows('month_balances')
  return data.map(rowToMonthBalance)
}

export async function loadSavingsWithdrawals(): Promise<SavingsWithdrawal[]> {
  const data = await fetchAllRows('savings_withdrawals')
  return data.map(rowToSavingsWithdrawal)
}

export async function loadSavingsPockets(): Promise<SavingsPocket[]> {
  const data = await fetchAllRows('savings_pockets')
  return data.map(rowToSavingsPocket)
}

export async function loadPocketFundings(): Promise<PocketFunding[]> {
  const data = await fetchAllRows('pocket_fundings')
  return data.map(rowToPocketFunding)
}

export async function loadSavingsYearBalances(): Promise<SavingsYearBalance[]> {
  const data = await fetchAllRows('savings_year_balances')
  return data.map(rowToSavingsYearBalance)
}

// ── Loans ────────────────────────────────────────────────────────────────────

const rowToLoan = (row: Record<string, unknown>): Loan => ({
  id:            row.id as string,
  personName:    row.person_name as string,
  amount:        Number(row.amount),
  date:          row.date as string,
  description:   row.description ? (row.description as string) : undefined,
  transactionId: row.transaction_id ? (row.transaction_id as string) : undefined,
  status:        row.status as 'active' | 'completed',
  completedAt:   row.completed_at ? (row.completed_at as string) : undefined,
  createdAt:     row.created_at as string,
})

const rowToLoanPayment = (row: Record<string, unknown>): LoanPayment => ({
  id:            row.id as string,
  loanId:        row.loan_id as string,
  amount:        Number(row.amount),
  date:          row.date as string,
  description:   row.description ? (row.description as string) : undefined,
  transactionId: row.transaction_id ? (row.transaction_id as string) : undefined,
  createdAt:     row.created_at as string,
})

const loanToDb = (l: Loan) => ({
  id:             l.id,
  person_name:    l.personName,
  amount:         l.amount,
  date:           l.date,
  description:    l.description ?? null,
  transaction_id: l.transactionId ?? null,
  status:         l.status,
  completed_at:   l.completedAt ?? null,
  created_at:     l.createdAt,
})

const loanPaymentToDb = (p: LoanPayment) => ({
  id:             p.id,
  loan_id:        p.loanId,
  amount:         p.amount,
  date:           p.date,
  description:    p.description ?? null,
  transaction_id: p.transactionId ?? null,
  created_at:     p.createdAt,
})

export async function loadLoans(): Promise<Loan[]> {
  const data = await fetchAllRows('loans')
  return data.map(rowToLoan).sort((a, b) => b.date.localeCompare(a.date))
}

export async function loadLoanPayments(): Promise<LoanPayment[]> {
  const data = await fetchAllRows('loan_payments')
  return data.map(rowToLoanPayment)
}

export async function syncLoans(prev: Loan[], curr: Loan[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('loans').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncLoans delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('loans').upsert(upserted.map(l => withUser(loanToDb(l), userId))).then(({ error }) => { if (error) console.error('syncLoans upsert:', error) }))
  await Promise.all(ops)
}

export async function syncLoanPayments(prev: LoanPayment[], curr: LoanPayment[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('loan_payments').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncLoanPayments delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('loan_payments').upsert(upserted.map(p => withUser(loanPaymentToDb(p), userId))).then(({ error }) => { if (error) console.error('syncLoanPayments upsert:', error) }))
  await Promise.all(ops)
}

// ── Budgets ───────────────────────────────────────────────────────────────────

const rowToBudget = (row: Record<string, unknown>): Budget => ({
  id:            row.id as string,
  yearMonth:     row.year_month as string,
  finCategoryId: row.fin_category_id as string,
  amount:        Number(row.amount),
  createdAt:     row.created_at as string,
})

const budgetToDb = (b: Budget) => ({
  id:              b.id,
  year_month:      b.yearMonth,
  fin_category_id: b.finCategoryId,
  amount:          b.amount,
  created_at:      b.createdAt,
})

export async function loadBudgets(): Promise<Budget[]> {
  const data = await fetchAllRows('budgets')
  return data.map(rowToBudget)
}

export async function syncBudgets(prev: Budget[], curr: Budget[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('budgets').delete().in('id', deletedIds)
      .then(({ error }) => { if (error) console.error('syncBudgets delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('budgets').upsert(upserted.map(b => withUser(budgetToDb(b), userId)))
      .then(({ error }) => { if (error) console.error('syncBudgets upsert:', error) }))
  await Promise.all(ops)
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

const rowToTask = (row: Record<string, unknown>): Task => ({
  id:          row.id as string,
  title:       row.title as string,
  description: row.description as string | undefined,
  status:      row.status as Task['status'],
  categoryId:  row.category_id as string | undefined,
  priority:    row.priority as Task['priority'],
  deadline:    row.deadline as string | undefined,
  goalId:      row.goal_id ? (row.goal_id as string) : undefined,
  sortOrder:   row.sort_order != null ? Number(row.sort_order) : 0,
  createdAt:   row.created_at as string,
  startedAt:   row.started_at as string | undefined,
  completedAt: row.completed_at as string | undefined,
})

const taskToDb = (t: Task) => ({
  id:           t.id,
  title:        t.title,
  description:  t.description ?? null,
  status:       t.status,
  category_id:  t.categoryId ?? null,
  priority:     t.priority,
  deadline:     t.deadline ?? null,
  goal_id:      t.goalId ?? null,
  sort_order:   t.sortOrder ?? 0,
  created_at:   t.createdAt,
  started_at:   t.startedAt ?? null,
  completed_at: t.completedAt ?? null,
})

export async function loadTasks(): Promise<Task[]> {
  const data = await fetchAllRows('tasks')
  return data.map(rowToTask)
}

export async function syncTasks(prev: Task[], curr: Task[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('tasks').delete().in('id', deletedIds)
      .then(({ error }) => { if (error) console.error('syncTasks delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('tasks').upsert(upserted.map(t => withUser(taskToDb(t), userId)))
      .then(({ error }) => { if (error) console.error('syncTasks upsert:', error) }))
  await Promise.all(ops)
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST ITEMS
// ─────────────────────────────────────────────────────────────────────────────

const rowToChecklistItem = (row: Record<string, unknown>): ChecklistItem => ({
  id:        row.id as string,
  taskId:    row.task_id as string,
  text:      row.text as string,
  done:      row.done as boolean,
  order:     row.order as number,
  createdAt: row.created_at as string,
})

const checklistItemToDb = (c: ChecklistItem) => ({
  id:         c.id,
  task_id:    c.taskId,
  text:       c.text,
  done:       c.done,
  order:      c.order,
  created_at: c.createdAt,
})

export async function loadChecklistItems(): Promise<ChecklistItem[]> {
  const data = await fetchAllRows('checklist_items')
  return data.map(rowToChecklistItem)
}

export async function syncChecklistItems(prev: ChecklistItem[], curr: ChecklistItem[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('checklist_items').delete().in('id', deletedIds)
      .then(({ error }) => { if (error) console.error('syncChecklistItems delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('checklist_items').upsert(upserted.map(c => withUser(checklistItemToDb(c), userId)))
      .then(({ error }) => { if (error) console.error('syncChecklistItems upsert:', error) }))
  await Promise.all(ops)
}

/** Carga todos los datos en paralelo. */
export async function loadAllData() {
  const [
    events, categories, transactions, finCategories, goals,
    savings, monthBalances, savingsWithdrawals, savingsPockets,
    pocketFundings, savingsYearBalances, loans, loanPayments, budgets,
    tasks, checklistItems, habits, habitLogs, reminders,
  ] = await Promise.all([
    loadEvents(), loadCategories(), loadTransactions(), loadFinCategories(),
    loadGoals(), loadSavings(), loadMonthBalances(), loadSavingsWithdrawals(),
    loadSavingsPockets(), loadPocketFundings(), loadSavingsYearBalances(),
    loadLoans(), loadLoanPayments(), loadBudgets(),
    loadTasks(), loadChecklistItems(),
    loadHabits(), loadHabitLogs(), loadReminders(),
  ])

  return {
    events, categories, transactions, finCategories, goals,
    savings, monthBalances, savingsWithdrawals, savingsPockets,
    pocketFundings, savingsYearBalances, loans, loanPayments, budgets,
    tasks, checklistItems, habits, habitLogs, reminders,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZACIÓN (diff entre estado anterior y actual)
// ─────────────────────────────────────────────────────────────────────────────

export async function syncEvents(prev: Events, curr: Events, userId: string) {
  const prevFlat = flattenEvents(prev)
  const currFlat = flattenEvents(curr)
  const { upserted, deletedIds } = diffArrays(prevFlat, currFlat)

  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('events').delete().in('id', deletedIds).then(({ error }) => {
      if (error) { console.error('syncEvents delete:', error); toast.error('Error al eliminar actividad: ' + error.message) }
    }))
  if (upserted.length > 0)
    ops.push(supabase.from('events').upsert(upserted.map(e => withUser(eventToDb(e), userId))).then(({ error }) => {
      if (error) { console.error('syncEvents upsert:', error); toast.error('Error al guardar actividad: ' + error.message) }
    }))

  await Promise.all(ops)
}

export async function syncCategories(prev: Categories, curr: Categories, userId: string) {
  const prevArr = Object.values(prev)
  const currArr = Object.values(curr)
  const { upserted, deletedIds } = diffArrays(prevArr, currArr)

  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('categories').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncCategories delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('categories').upsert(upserted.map(c => withUser(categoryToDb(c), userId))).then(({ error }) => { if (error) console.error('syncCategories upsert:', error) }))

  await Promise.all(ops)
}

export async function syncTransactions(prev: Transaction[], curr: Transaction[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)

  // Guarda: nunca borrar todo el historial si curr quedó vacío accidentalmente
  if (deletedIds.length > 0 && curr.length === 0 && prev.length > 0) {
    console.warn('syncTransactions: curr está vacío con prev no vacío, abortando para evitar borrado masivo.')
    return
  }

  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('transactions').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncTransactions delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('transactions').upsert(upserted.map(t => withUser(transactionToDb(t), userId))).then(({ error }) => { if (error) console.error('syncTransactions upsert:', error) }))
  await Promise.all(ops)
}

export async function syncFinCategories(prev: FinCategory[], curr: FinCategory[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)

  // Guarda 1: nunca procesar si curr está vacío accidentalmente.
  if (curr.length === 0 && prev.length > 0) {
    console.warn('syncFinCategories: curr está vacío, abortando para evitar borrado masivo.')
    return
  }

  // Guarda 2: desde la UI, NUNCA se añaden y se borran categorías en la misma acción
  // (solo se añade, o solo se edita, o solo se borra una). Si el diff muestra ambas
  // operaciones a la vez es señal de que prevFinCategories.current está desactualizado.
  // En ese caso solo aplicamos el upsert (nunca el delete) para ser conservadores.
  if (deletedIds.length > 0 && upserted.length > 0) {
    console.warn(`syncFinCategories: delete+upsert simultáneo detectado (${deletedIds.length} deletes, ${upserted.length} upserts) — solo aplicando upserts para evitar pérdida de datos.`)
    await supabase
      .from('fin_categories')
      .upsert(upserted.map(c => withUser(finCategoryToDb(c), userId)))
      .then(({ error }) => { if (error) console.error('syncFinCategories upsert:', error) })
    return
  }

  // Guarda 3: nunca borrar TODAS las categorías sin añadir ninguna (borrado masivo accidental).
  if (deletedIds.length > 0 && deletedIds.length >= prev.length && upserted.length === 0) {
    console.warn('syncFinCategories: intento de borrar todas las categorías sin añadir ninguna, abortando.')
    return
  }

  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('fin_categories').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncFinCategories delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('fin_categories').upsert(upserted.map(c => withUser(finCategoryToDb(c), userId))).then(({ error }) => { if (error) console.error('syncFinCategories upsert:', error) }))
  await Promise.all(ops)
}

export async function syncHabits(prev: Habit[], curr: Habit[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('habits').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncHabits delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('habits').upsert(upserted.map(h => withUser(habitToDb(h), userId))).then(({ error }) => { if (error) console.error('syncHabits upsert:', error) }))
  await Promise.all(ops)
}

export async function syncHabitLogs(prev: HabitLog[], curr: HabitLog[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('habit_logs').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncHabitLogs delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('habit_logs').upsert(upserted.map(l => withUser(habitLogToDb(l), userId))).then(({ error }) => { if (error) console.error('syncHabitLogs upsert:', error) }))
  await Promise.all(ops)
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS
// ─────────────────────────────────────────────────────────────────────────────

const rowToReminder = (row: Record<string, unknown>): Reminder => ({
  id:        row.id as string,
  title:     row.title as string,
  date:      row.date as string,
  time:      row.time as string,
  done:      row.done as boolean,
  snoozedTo: row.snoozed_to as string | undefined,
  createdAt: row.created_at as string,
})

const reminderToDb = (r: Reminder) => ({
  id:         r.id,
  title:      r.title,
  date:       r.date,
  time:       r.time,
  done:       r.done,
  snoozed_to: r.snoozedTo ?? null,
  created_at: r.createdAt,
})

export async function loadReminders(): Promise<Reminder[]> {
  const data = await fetchAllRows('reminders')
  return data.map(rowToReminder)
}

export async function syncReminders(prev: Reminder[], curr: Reminder[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('reminders').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncReminders delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('reminders').upsert(upserted.map(r => withUser(reminderToDb(r), userId))).then(({ error }) => { if (error) console.error('syncReminders upsert:', error) }))
  await Promise.all(ops)
}

export async function syncGoals(prev: Goal[], curr: Goal[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('goals').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncGoals delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('goals').upsert(upserted.map(g => withUser(goalToDb(g), userId))).then(({ error }) => { if (error) console.error('syncGoals upsert:', error) }))
  await Promise.all(ops)
}

export async function syncSavings(prev: Savings[], curr: Savings[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('savings').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncSavings delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('savings').upsert(upserted.map(s => withUser(savingsToDb(s), userId))).then(({ error }) => { if (error) console.error('syncSavings upsert:', error) }))
  await Promise.all(ops)
}

export async function syncMonthBalances(prev: MonthBalance[], curr: MonthBalance[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('month_balances').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncMonthBalances delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('month_balances').upsert(upserted.map(m => withUser(monthBalanceToDb(m), userId))).then(({ error }) => { if (error) console.error('syncMonthBalances upsert:', error) }))
  await Promise.all(ops)
}

export async function syncSavingsWithdrawals(prev: SavingsWithdrawal[], curr: SavingsWithdrawal[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('savings_withdrawals').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncSavingsWithdrawals delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('savings_withdrawals').upsert(upserted.map(w => withUser(savingsWithdrawalToDb(w), userId))).then(({ error }) => { if (error) console.error('syncSavingsWithdrawals upsert:', error) }))
  await Promise.all(ops)
}

export async function syncSavingsPockets(prev: SavingsPocket[], curr: SavingsPocket[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('savings_pockets').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncSavingsPockets delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('savings_pockets').upsert(upserted.map(p => withUser(savingsPocketToDb(p), userId))).then(({ error }) => { if (error) console.error('syncSavingsPockets upsert:', error) }))
  await Promise.all(ops)
}

export async function syncPocketFundings(prev: PocketFunding[], curr: PocketFunding[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('pocket_fundings').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncPocketFundings delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('pocket_fundings').upsert(upserted.map(f => withUser(pocketFundingToDb(f), userId))).then(({ error }) => { if (error) console.error('syncPocketFundings upsert:', error) }))
  await Promise.all(ops)
}

export async function syncSavingsYearBalances(prev: SavingsYearBalance[], curr: SavingsYearBalance[], userId: string) {
  const { upserted, deletedIds } = diffArrays(prev, curr)
  const ops: Promise<unknown>[] = []
  if (deletedIds.length > 0)
    ops.push(supabase.from('savings_year_balances').delete().in('id', deletedIds).then(({ error }) => { if (error) console.error('syncSavingsYearBalances delete:', error) }))
  if (upserted.length > 0)
    ops.push(supabase.from('savings_year_balances').upsert(upserted.map(b => withUser(savingsYearBalanceToDb(b), userId))).then(({ error }) => { if (error) console.error('syncSavingsYearBalances upsert:', error) }))
  await Promise.all(ops)
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN desde localStorage (se ejecuta solo si Supabase está vacío)
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEYS = {
  events:               'lifeflow-events',
  categories:           'lifeflow-categories',
  transactions:         'lifeos-transactions',
  finCategories:        'lifeos-fin-categories-v2',
  goals:                'lifeos-goals',
  savings:              'lifeos-savings',
  monthBalances:        'lifeos-month-balances',
  savingsWithdrawals:   'lifeos-savings-withdrawals',
  savingsPockets:       'lifeos-savings-pockets',
  pocketFundings:       'lifeos-pocket-fundings',
  savingsYearBalances:  'lifeos-savings-year-balances',
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

/**
 * Si la DB está vacía, carga los datos existentes en localStorage y los inserta.
 * Esto garantiza que no se pierda información al migrar.
 */
export async function migrateFromLocalStorage(
  userId: string,
  initialCategories: Categories,
  initialFinCategories: FinCategory[],
) {
  const lsCategories: Categories = lsGet(LS_KEYS.categories, initialCategories)
  const lsFinCategories: FinCategory[] = lsGet(LS_KEYS.finCategories, initialFinCategories)
  const lsEvents: Events = lsGet(LS_KEYS.events, {})
  const lsTransactions: Transaction[] = lsGet(LS_KEYS.transactions, [])
  const lsGoals: Goal[] = lsGet(LS_KEYS.goals, [])
  const lsSavings: Savings[] = lsGet(LS_KEYS.savings, [])
  const lsMonthBalances: MonthBalance[] = lsGet(LS_KEYS.monthBalances, [])
  const lsSavingsWithdrawals: SavingsWithdrawal[] = lsGet(LS_KEYS.savingsWithdrawals, [])
  const lsSavingsPockets: SavingsPocket[] = lsGet(LS_KEYS.savingsPockets, [])
  const lsPocketFundings: PocketFunding[] = lsGet(LS_KEYS.pocketFundings, [])
  const lsSavingsYearBalances: SavingsYearBalance[] = lsGet(LS_KEYS.savingsYearBalances, [])
  const lsLoans: Loan[] = lsGet('lifeos-loans', [])
  const lsLoanPayments: LoanPayment[] = lsGet('lifeos-loan-payments', [])

  const u = (row: object) => withUser(row, userId)

  // Insertar en orden correcto (respetando referencias)
  const catRows = Object.values(lsCategories).map(c => u(categoryToDb(c)))
  if (catRows.length) await supabase.from('categories').upsert(catRows)

  const finCatRows = lsFinCategories.map(c => u(finCategoryToDb(c)))
  if (finCatRows.length) await supabase.from('fin_categories').upsert(finCatRows)

  const pocketRows = lsSavingsPockets.map(p => u(savingsPocketToDb(p)))
  if (pocketRows.length) await supabase.from('savings_pockets').upsert(pocketRows)

  const mbRows = lsMonthBalances.map(m => u(monthBalanceToDb(m)))
  if (mbRows.length) await supabase.from('month_balances').upsert(mbRows)

  const sybRows = lsSavingsYearBalances.map(b => u(savingsYearBalanceToDb(b)))
  if (sybRows.length) await supabase.from('savings_year_balances').upsert(sybRows)

  const eventRows = flattenEvents(lsEvents).map(e => u(eventToDb(e)))
  if (eventRows.length) await supabase.from('events').upsert(eventRows)

  const txRows = lsTransactions.map(t => u(transactionToDb(t)))
  if (txRows.length) await supabase.from('transactions').upsert(txRows)

  const goalRows = lsGoals.map(g => u(goalToDb(g)))
  if (goalRows.length) await supabase.from('goals').upsert(goalRows)

  const savingsRows = lsSavings.map(s => u(savingsToDb(s)))
  if (savingsRows.length) await supabase.from('savings').upsert(savingsRows)

  const swRows = lsSavingsWithdrawals.map(w => u(savingsWithdrawalToDb(w)))
  if (swRows.length) await supabase.from('savings_withdrawals').upsert(swRows)

  const pfRows = lsPocketFundings.map(f => u(pocketFundingToDb(f)))
  if (pfRows.length) await supabase.from('pocket_fundings').upsert(pfRows)

  const loanRows = lsLoans.map(l => u(loanToDb(l)))
  if (loanRows.length) await supabase.from('loans').upsert(loanRows)

  const lpRows = lsLoanPayments.map(p => u(loanPaymentToDb(p)))
  if (lpRows.length) await supabase.from('loan_payments').upsert(lpRows)

  return {
    events: lsEvents,
    categories: lsCategories,
    transactions: lsTransactions,
    finCategories: lsFinCategories,
    goals: lsGoals,
    savings: lsSavings,
    monthBalances: lsMonthBalances,
    savingsWithdrawals: lsSavingsWithdrawals,
    savingsPockets: lsSavingsPockets,
    pocketFundings: lsPocketFundings,
    savingsYearBalances: lsSavingsYearBalances,
    loans: lsLoans,
    loanPayments: lsLoanPayments,
    budgets: [] as Budget[],
    tasks: [] as Task[],
    checklistItems: [] as ChecklistItem[],
  }
}
