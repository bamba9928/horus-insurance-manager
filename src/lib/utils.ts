import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trim + espaces multiples réduits à un seul. */
export function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

/** Normalisation d'une marque de véhicule (majuscules). */
export function normalizeBrand(value: string | null | undefined): string {
  return normalizeText(value).toUpperCase();
}

/** Déduplique et trie (ordre alphabétique français). */
export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
}
