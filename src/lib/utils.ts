import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);

export const formatDateId = (date: Date): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const getWeekId = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const weekNum = Math.ceil(((monday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
};

export const getWeekDays = (date: Date): Date[] => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
};

export const GRID_HOURS: string[] = (() => {
  const hours: string[] = [];
  for (let h = 0; h <= 23; h++) {
    ["00", "15", "30", "45"].forEach((m) =>
      hours.push(`${h.toString().padStart(2, "0")}:${m}`)
    );
  }
  hours.push("23:59");
  return hours;
})();

/**
 * Returns the current date in "YYYY-MM-DD" format using the user's local timezone.
 * Solves the UTC offset issue where evening hours would show tomorrow's date.
 */
export const getLocalISODate = (): string => {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
};

export const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/**
 * Parses a Colombian-formatted number string (e.g. "1.500.000") into a plain number.
 * Also handles plain numeric strings.
 */
export const parseCOPNumber = (str: string): number => {
  // Remove all dots (thousands sep) then parse
  const cleaned = str.replace(/\./g, '').replace(/,/g, '.').trim();
  return parseFloat(cleaned) || 0;
};

/**
 * Formats a raw number-string-in-progress into Colombian thousands format.
 * Allows only digits while typing.
 */
export const formatCOPInput = (raw: string): string => {
  // Keep only digits
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

export const PRIORITY_CONFIG = {
  high:   { label: "Alta",  color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200",   dot: "bg-red-500",   badge: "bg-red-500" },
  medium: { label: "Media", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", badge: "bg-amber-500" },
  low:    { label: "Baja",  color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400", badge: "bg-slate-400" },
} as const;
