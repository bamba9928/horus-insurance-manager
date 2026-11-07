/**
 * Utilitaires de dates pour le calcul d'échéances et le formatage.
 * Toutes les dates sont en timezone Africa/Dakar (UTC+0, pas de DST).
 *
 * @module date-utils
 */

import {
  addMonths,
  differenceInCalendarDays,
  differenceInDays,
  format,
  isSameDay,
  isValid,
  parseISO,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";

/** Timezone du Sénégal */
export const TZ_DAKAR = "Africa/Dakar";

const DUREES_ECHEANCE_ACCEPTEES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24] as const;
const DUREES_DEDUCTION_ACCEPTEES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Calcule la date d'échéance d'une police.
 * Règle métier : date_effet + N mois - 1 jour.
 *
 * @param dateEffet - Date d'effet au format ISO (YYYY-MM-DD) ou Date
 * @param dureeMois - Durée en mois (1 à 12 ; 24 toléré pour les anciennes données)
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
  if (!(DUREES_ECHEANCE_ACCEPTEES as readonly number[]).includes(dureeMois)) {
    throw new Error(`Durée invalide : ${dureeMois} mois. Valeurs acceptées : 1 à 12 mois`);
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
 * Formate une date pour l'affichage utilisateur (ex: "15/01/2025").
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy");
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
 * @returns Durée en mois la plus proche entre 1 et 12, ou 12 par défaut
 */
export function deduireDureeMois(dateEffet: string, dateEcheance: string): number {
  const effet = parseISO(dateEffet);
  const echeance = parseISO(dateEcheance);
  const diffJours = differenceInDays(echeance, effet) + 1; // +1 car echeance = effet + N mois - 1 jour
  const diffMois = diffJours / 30.44; // Moyenne jours/mois

  let meilleur = 12;
  let minEcart = Number.POSITIVE_INFINITY;

  for (const v of DUREES_DEDUCTION_ACCEPTEES) {
    const ecart = Math.abs(diffMois - v);
    if (ecart < minEcart) {
      minEcart = ecart;
      meilleur = v;
    }
  }

  return meilleur;
}

/** Jour d'une date d'API (« AAAA-MM-JJ », avec ou sans heure), ou null. */
function parseApiDay(value: string | null | undefined): Date | null {
  const day = value?.trim().slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = parseISO(day);
  return isValid(date) ? date : null;
}

/**
 * Durée lisible d'une couverture lue chez un assureur (API AAS Diotali).
 *
 * Le champ `duree` de cette API n'a pas d'unité fiable : selon la compagnie,
 * il compte des mois (3) ou des jours (31). Affiché tel quel avec « mois », un
 * contrat d'un mois apparaissait en « 31 mois ». Les dates d'effet et
 * d'expiration font donc foi : un nombre entier de mois si la période en
 * couvre un (fin le même jour, ou la veille), sinon le nombre de jours,
 * bornes comprises. Sans dates, `duree` ne sert qu'en repli : jusqu'à 12 on
 * lit des mois, au-delà des jours.
 *
 * @example
 * coverageDuration("2026-10-12", "2026-11-11", 31) // → "1 mois"
 * coverageDuration("2026-10-12", "2026-10-26", 15) // → "15 jours"
 */
export function coverageDuration(
  dateEffet: string | null | undefined,
  dateExpiration: string | null | undefined,
  duree?: number | null,
): string | null {
  const effet = parseApiDay(dateEffet);
  const fin = parseApiDay(dateExpiration);
  if (effet && fin && fin >= effet) {
    for (let mois = 1; mois <= 36; mois++) {
      const terme = addMonths(effet, mois);
      if (isSameDay(terme, fin) || isSameDay(subDays(terme, 1), fin)) return `${mois} mois`;
      if (subDays(terme, 1) > fin) break;
    }
    const jours = differenceInCalendarDays(fin, effet) + 1;
    return `${jours} jour${jours > 1 ? "s" : ""}`;
  }
  if (duree != null && duree > 0) {
    return duree <= 12 ? `${duree} mois` : `${duree} jour${duree > 1 ? "s" : ""}`;
  }
  return null;
}
