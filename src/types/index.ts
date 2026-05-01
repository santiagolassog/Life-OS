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
