import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatOdds(value: number): string {
  return value.toFixed(2)
}

export function formatROI(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function getGradeLabel(grade: string): string {
  const map: Record<string, string> = {
    high:   'Alto Valor',
    medium: 'Valor Medio',
    low:    'Bajo Valor',
    none:   'Sin Valor',
  }
  return map[grade] ?? grade
}

export function getConfidenceLabel(level: number): string {
  const map: Record<number, string> = {
    5: 'Muy Alta',
    4: 'Alta',
    3: 'Media',
    2: 'Baja',
    1: 'Muy Baja',
  }
  return map[level] ?? 'N/A'
}
