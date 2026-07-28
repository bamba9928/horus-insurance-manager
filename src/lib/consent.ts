/**
 * Consentement aux cookies de mesure (pixel Meta Ads).
 *
 * Le choix est mémorisé localement ; tant qu'il n'a pas été fait, rien n'est
 * chargé côté Facebook. Petit store externe plutôt qu'un contexte : le bandeau
 * et le lien « Cookies » du pied de page vivent dans deux arbres distincts.
 *
 * @module lib/consent
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "horus.consent.mesure";

/** `null` = pas encore choisi (le bandeau doit être affiché). */
export type ConsentChoice = "granted" | "denied";

function readStoredChoice(): ConsentChoice | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Stockage indisponible (navigation privée stricte) : on redemandera.
    return null;
  }
}

let choice: ConsentChoice | null = typeof window === "undefined" ? null : readStoredChoice();

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ConsentChoice | null {
  return choice;
}

/** Enregistre le choix ; `null` rouvre le bandeau (l'utilisateur se ravise). */
export function setConsentChoice(next: ConsentChoice | null): void {
  choice = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sans stockage, le choix ne vaut que pour la session en cours.
  }
  for (const listener of listeners) listener();
}

export function getConsentChoice(): ConsentChoice | null {
  return choice;
}

/** Rouvre le bandeau pour permettre de revenir sur un choix. */
export function reopenConsentBanner(): void {
  setConsentChoice(null);
}

export function useConsentChoice(): ConsentChoice | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
