/**
 * Utilitaires de dates pour le calcul d'échéances et le formatage.
 * Toutes les dates sont en timezone Africa/Dakar (UTC+0, pas de DST).
 *
 * @module date-utils
 */

import { addMonths, differenceInDays, format, isValid, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";

/** Timezone du Sénégal */
export const TZ_DAKAR = "Africa/Dakar";

/**
 * Calcule la date d'échéance d'une police.
 * Règle métier : date_effet + N mois - 1 jour.
 *
 * @param dateEffet - Date d'effet au format ISO (YYYY-MM-DD) ou Date
 * @param dureeMois - Durée en mois (1, 3, 6, 9, 12 ou 24)
 * @returns Date d'échéance
 *
 * @example
 * calcEcheance("2025-01-15", 12) // → Date(2026-01-14)
 * calcEcheance("2025-03-31", 1)  // → Date(2025-04-29)
 */
export function calcEcheance(dateEffet: string | Date, dureeMois: number): Date {
  const effet = typeof dateEffet === "string" ? parseISO(dateEffet) : dateEffet;
  if (!isValid(effet)) {
    throw new Error(`Date d'effet invalide : ${String(dateEffet)}`);
  }
  if (![1, 3, 6, 9, 12, 24].includes(dureeMois)) {
    throw new Error(`Durée invalide : ${dureeMois} mois. Valeurs acceptées : 1, 3, 6, 9, 12, 24`);
  }
  return subDays(addMonths(effet, dureeMois), 1);
}

/**
 * Formate une date d'échéance au format ISO (YYYY-MM-DD) pour la DB.
 */
export function formatDateISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Formate une date pour l'affichage utilisateur (ex: "15 janv. 2025").
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy", { locale: fr });
}

/**
 * Formate une date au format long (ex: "15 janvier 2025").
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMMM yyyy", { locale: fr });
}

/**
 * Calcule le nombre de jours restants avant l'échéance.
 *
 * @returns Nombre positif = jours restants, négatif = jours de retard
 */
export function joursRestants(dateEcheance: string | Date): number {
  const echeance = typeof dateEcheance === "string" ? parseISO(dateEcheance) : dateEcheance;
  return differenceInDays(echeance, new Date());
}

/**
 * Détermine le statut d'urgence d'une échéance.
 */
export type UrgenceStatus = "EXPIREE" | "URGENTE" | "PROCHAINE" | "OK";

/**
 * Retourne le statut d'urgence basé sur les jours restants.
 *
 * @param jours - Nombre de jours restants (négatif = expiré)
 * @returns Statut d'urgence
 */
export function getUrgenceStatus(jours: number): UrgenceStatus {
  if (jours < 0) return "EXPIREE";
  if (jours <= 7) return "URGENTE";
  if (jours <= 30) return "PROCHAINE";
  return "OK";
}

/**
 * Formate un montant en FCFA.
 *
 * @param montant - Montant en entier (pas de centimes)
 * @returns Chaîne formatée (ex: "1 500 000 FCFA")
 */
export function formatFCFA(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant)} FCFA`;
}

/**
 * Déduit la durée en mois à partir de l'écart entre deux dates.
 * Utilisé lors de la migration depuis .accdb.
 *
 * @param dateEffet - Date de début
 * @param dateEcheance - Date de fin
 * @returns Durée en mois la plus proche parmi les valeurs acceptées, ou 12 par défaut
 */
export function deduireDureeMois(dateEffet: string, dateEcheance: string): number {
  const effet = parseISO(dateEffet);
  const echeance = parseISO(dateEcheance);
  const diffJours = differenceInDays(echeance, effet) + 1; // +1 car echeance = effet + N mois - 1 jour
  const diffMois = diffJours / 30.44; // Moyenne jours/mois

  const valeursAcceptees = [1, 3, 6, 9, 12, 24];
  let meilleur = 12;
  let minEcart = Number.POSITIVE_INFINITY;

  for (const v of valeursAcceptees) {
    const ecart = Math.abs(diffMois - v);
    if (ecart < minEcart) {
      minEcart = ecart;
      meilleur = v;
    }
  }

  return meilleur;
}
