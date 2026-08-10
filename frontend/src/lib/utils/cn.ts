import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The only way to conditionally apply Tailwind classes (DESIGN.md §7.2).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
