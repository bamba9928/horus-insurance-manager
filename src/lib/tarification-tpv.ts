/**
 * Barème CAT 04 — TPV (transport public de voyageurs) : données pures.
 *
 * RC annuelle = base selon la puissance + surprime selon le nombre de places.
 * Source : grille du courtier (TARIFICATION.xlsx), voir docs/BAREME_TARIFICATION.md §2.
 * Le calcul reste dans `tarification.ts`.
 *
 * @module lib/tarification-tpv
 */

import type { CvBracket } from "./tarification-bareme";

/** Base RC annuelle par puissance fiscale (taxis, minicars, autocars). */
export const TPV_BASE_RC: CvBracket[] = [
  { min: 2, max: 2, rc: 84736 },
  { min: 3, max: 4, rc: 100565 },
  { min: 5, max: 7, rc: 117587 },
  { min: 8, max: 10, rc: 167760 },
  { min: 11, max: 16, rc: 224110 },
  { min: 17, rc: 261832 },
];

/** Nombre de places minimal couvert par le barème. */
export const TPV_PLACES_MIN = 4;

/** Surprime forfaitaire des taxis, par nombre de places. */
export const TPV_SURPRIME_TAXI: Readonly<Record<number, number>> = {
  4: 28373,
  5: 28373,
  6: 74064,
  7: 98552,
  8: 131402,
};

/** Minicar : surprime forfaitaire, quel que soit le nombre réel de places. */
export const TPV_MINICAR = {
  placesMax: 20,
  placesForfait: 20,
};

/** Surprime autocar, par passager (places − 1). */
export const TPV_SURPRIME_PLACE = {
  /** Par passager jusqu'à 30. */
  jusqua30: 9415,
  /** Par passager au-delà de 30. */
  audela30: 6726,
};

/** Individuelle Conducteur : prime fixe, quelle que soit la durée (Pool TPV). */
export const TPV_INDIVIDUELLE_CONDUCTEUR = 1000;

/** Libellés affichés selon le nombre de places (bornes inclusives). */
export const TPV_SEGMENTS: { min: number; max?: number; label: string }[] = [
  { min: 4, max: 5, label: "Taxi urbain" },
  { min: 6, max: 6, label: "Taxi 6 places" },
  { min: 7, max: 8, label: "Taxi inter-urbain" },
  { min: 9, max: 20, label: "Minicar" },
  { min: 21, label: "Autocar" },
];
