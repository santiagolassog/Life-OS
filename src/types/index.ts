export interface EventEntry {
  id: string
  startHour: string
  endHour: string
  category: string
  task: string
  completed: boolean
  energy?: number
  impact?: number
}

export type Events = Record<string, EventEntry[]>

export interface Category {
  id: string
  label: string
  color: string
  short: string
  presets: string[]
  sortOrder?: number   // orden manual definido por el usuario
}

export type Categories = Record<string, Category>

export interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  amount: number
  finCategoryId: string
  description: string
  linkedEventId?: string
}

export interface FinCategory {
  id: string
  label: string
  color: string
  type: 'income' | 'expense' | 'both'
  description?: string
}

export interface MonthBalance {
  id: string
  yearMonth: string  // "2026-01"
  openingBalance: number
}

export interface Goal {
  id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  scope: 'weekly' | 'daily'
  weekId: string
  dateId?: string
  category?: string
  deadline?: string   // "YYYY-MM-DD" — fecha límite para lograr el objetivo
  completed: boolean
  completedAt?: string
  createdAt: string
}

export interface Savings {
  id: string
  amount: number
  date: string
  description: string
  sourceTransactionId?: string
}

export interface SavingsWithdrawal {
  id: string
  date: string
  amount: number
  description: string
  fromPocketId?: string
}

export interface SavingsPocket {
  id: string
  name: string
  color: string
  emoji: string
}

export interface PocketFunding {
  id: string
  pocketId: string
  date: string
  amount: number  // positive = general → pocket, negative = pocket → general
  description: string
}

export interface SavingsYearBalance {
  id: string
  year: number
  savingsOpening: number   // savings balance at start of this year
  generalOpening?: number  // general money balance at start of this year (optional, backed by monthBalances)
}

// IDs fijos de las categorías financieras especiales de préstamos
export const LOAN_OUT_CAT_ID = 'finc-loan-out'  // egreso: dinero prestado
export const LOAN_IN_CAT_ID  = 'finc-loan-in'   // ingreso: reintegro recibido

export interface Loan {
  id: string
  personName: string
  amount: number
  date: string            // "YYYY-MM-DD"
  description?: string
  transactionId?: string  // referencia al egreso registrado
  status: 'active' | 'completed'
  completedAt?: string
  createdAt: string
}

export interface LoanPayment {
  id: string
  loanId: string
  amount: number
  date: string            // "YYYY-MM-DD"
  description?: string
  transactionId?: string  // referencia al ingreso registrado
  createdAt: string
}

export interface Budget {
  id: string
  yearMonth: string       // "2026-05"
  finCategoryId: string
  amount: number
  createdAt: string
}

export type TaskStatus   = 'backlog' | 'todo' | 'inprogress' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  categoryId?: string     // id de área (Category)
  priority: TaskPriority
  deadline?: string       // "YYYY-MM-DD"
  goalId?: string         // id de objetivo asociado (Goal) — opcional
  sortOrder: number       // para orden manual en el kanban (Date.now() al crear)
  createdAt: string       // "YYYY-MM-DD"
  startedAt?: string      // "YYYY-MM-DD" — se registra al pasar a inprogress
  completedAt?: string    // "YYYY-MM-DD" — se registra al pasar a done
}

export interface ChecklistItem {
  id: string
  taskId: string
  text: string
  done: boolean
  order: number
  createdAt: string
}

// ────────────────────────────────────────────────────────
// HÁBITOS
// ────────────────────────────────────────────────────────

export interface Habit {
  id: string
  name: string
  target: number          // días por semana (1-7)
  color: string           // 'bg-indigo-500', 'bg-emerald-500', etc.
  startDate: string       // "YYYY-MM-DD"
  createdAt: string       // ISO timestamp
}

export interface HabitLog {
  id: string
  habitId: string
  date: string            // "YYYY-MM-DD"
}
