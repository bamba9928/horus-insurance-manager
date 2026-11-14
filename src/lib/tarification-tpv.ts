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

/**
 * Famille de genre Pool TPV : elle fixe les tranches de puissance.
 *  - TAXI : TAXI-JAUNE NOIR, TAXI-INTER-URBAIN, VTC
 *  - CAR  : MINI-CAR, MINI-BUS, CAR RAPIDE, CAR NDIAGA NDIAYE, TATA, ASHOK LEYLAND,
 *           BUS INTER-URBAIN, BUS RAPID TRANSIT, BUS DEM DIKK
 * Relevé sur le Pool TPV le 14/11/2026 (12 genres, 2 à 30 CV).
 */
export type TpvFamille = "TAXI" | "CAR";

export const TPV_FAMILLES: { value: TpvFamille; label: string }[] = [
  { value: "TAXI", label: "Taxi / VTC" },
  { value: "CAR", label: "Car, minicar, bus" },
];

/** Sans famille indiquée : taxi jusqu'à 9 places, car au-delà. */
export const TPV_FAMILLE_PLACES_MAX_TAXI = 9;

/** Base RC annuelle par puissance fiscale : mêmes montants, tranches selon la famille. */
export const TPV_BASE_RC: Record<TpvFamille, CvBracket[]> = {
  TAXI: [
    { min: 2, max: 2, rc: 84736 },
    { min: 3, max: 6, rc: 100565 },
    { min: 7, max: 10, rc: 117587 },
    { min: 11, max: 14, rc: 167760 },
    { min: 15, max: 23, rc: 224110 },
    { min: 24, rc: 261832 },
  ],
  CAR: [
    { min: 2, max: 2, rc: 84736 },
    { min: 3, max: 4, rc: 100565 },
    { min: 5, max: 7, rc: 117587 },
    { min: 8, max: 10, rc: 167760 },
    { min: 11, max: 16, rc: 224110 },
    { min: 17, rc: 261832 },
  ],
};

/** Nombre de places minimal couvert par le barème. */
export const TPV_PLACES_MIN = 4;

/**
 * Surprime forfaitaire des taxis, par nombre total de places (conducteur compris).
 * Relevée sur le Pool TPV le 14/11/2026 ; la grille du courtier décalait les
 * montants d'une place (6 → 74 064, 7 → 98 552, 8 → 131 402) et n'avait pas 49 278.
 */
export const TPV_SURPRIME_TAXI: Readonly<Record<number, number>> = {
  4: 28243,
  5: 28373,
  6: 49278,
  7: 74064,
  8: 98552,
  9: 131402,
};

/**
 * Minicar (10 à 20 places) : surprime forfaitaire, quel que soit le nombre réel de places.
 * Relevée sur le Pool TPV ; la grille du courtier indiquait 20 × 9 415 = 188 300.
 */
export const TPV_MINICAR = {
  placesMax: 20,
  surprime: 188274,
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
  { min: 7, max: 9, label: "Taxi inter-urbain" },
  { min: 10, max: 20, label: "Minicar" },
  { min: 21, label: "Autocar" },
];
