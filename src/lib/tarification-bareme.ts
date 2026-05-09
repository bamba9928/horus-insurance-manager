/**
 * Barème de tarification auto Sénégal — données pures.
 *
 * Source : grille fournie par le courtier (TARIFICATION.xlsx).
 * Ce fichier ne contient aucune logique, uniquement des constantes —
 * pour mettre à jour les tarifs, modifier les valeurs ici puis
 * vérifier les tests `tarification.test.ts`.
 *
 * @module lib/tarification-bareme
 */

export type TarifCategorie =
  | "CAT_01_VP"
  | "CAT_02_TPC_LT3T5_FGTTE"
  | "CAT_02_TPC_LT3T5_CAMIONNETTE"
  | "CAT_02_TPC_GT3T5"
  | "CAT_03_TPM_LT3T5"
  | "CAT_03_TPM_GT3T5"
  | "CAT_04_TAXI_URBAIN"
  | "CAT_04_TAXI_INTERURBAIN"
  | "CAT_04_AUTOCAR_MINICAR"
  | "CAT_05_2R"
  | "TRICYCLE";

export interface TarifCategorieOption {
  value: TarifCategorie;
  label: string;
  /** Requiert nombre de places ? */
  needsPlaces: boolean;
  /** Requiert puissance fiscale ? (false pour CAT 5 et TRICYCLE) */
  needsPuissance: boolean;
  /** Requiert cylindrée (CAT 5) ? */
  needsCylindree: boolean;
  /** Plafond CV (ex: CAT 4 Taxi limité à 16 CV) */
  maxCV?: number;
}

export const TARIF_CATEGORIES: TarifCategorieOption[] = [
  {
    value: "CAT_01_VP",
    label: "CAT 01 — Véhicule Particulier (VP)",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_02_TPC_LT3T5_FGTTE",
    label: "CAT 02 — TPC -3T500 · Fourgonnette / Break (u2)",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_02_TPC_LT3T5_CAMIONNETTE",
    label: "CAT 02 — TPC -3T500 · Camionnette (u21)",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_02_TPC_GT3T5",
    label: "CAT 02 — TPC +3T500 · Camion (u22)",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_03_TPM_LT3T5",
    label: "CAT 03 — TPM -3T500 · Marchandises",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_03_TPM_GT3T5",
    label: "CAT 03 — TPM +3T500 · Marchandises",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_04_TAXI_URBAIN",
    label: "CAT 04 — TPV · Taxi Urbain (4/5 places)",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
    maxCV: 16,
  },
  {
    value: "CAT_04_TAXI_INTERURBAIN",
    label: "CAT 04 — TPV · Taxi Inter-Urbain (7/8 places)",
    needsPlaces: false,
    needsPuissance: true,
    needsCylindree: false,
    maxCV: 16,
  },
  {
    value: "CAT_04_AUTOCAR_MINICAR",
    label: "CAT 04 — TPV · Autocar / Minicar",
    needsPlaces: true,
    needsPuissance: true,
    needsCylindree: false,
  },
  {
    value: "CAT_05_2R",
    label: "CAT 05 — Véhicule 2 roues (Scooter / Moto)",
    needsPlaces: false,
    needsPuissance: false,
    needsCylindree: true,
  },
  {
    value: "TRICYCLE",
    label: "Tricycle (CAT 5)",
    needsPlaces: false,
    needsPuissance: false,
    needsCylindree: false,
  },
];

/** Tranches puissance fiscale pour une catégorie donnée (bornes inclusives) */
export interface CvBracket {
  min: number;
  /** undefined = ∞ */
  max?: number;
  rc: number;
}

/** Cylindrée CAT 5 */
export type Cylindree = "LT_125" | "GT_125" | "SIDE_CAR";

export const CYLINDREE_OPTIONS: { value: Cylindree; label: string }[] = [
  { value: "LT_125", label: "Scooter et Vélomoteurs -125 cm³" },
  { value: "GT_125", label: "Motocyclettes et Scooter +125 cm³" },
  { value: "SIDE_CAR", label: "Tandem, Triporteur et Side-cars" },
];

/** Tables RC annuel par catégorie et puissance fiscale. */
export const RC_TABLES: Partial<Record<TarifCategorie, CvBracket[]>> = {
  CAT_01_VP: [
    { min: 3, max: 6, rc: 45181 },
    { min: 7, max: 10, rc: 51078 },
    { min: 11, max: 14, rc: 65677 },
    { min: 15, max: 23, rc: 86456 },
    { min: 24, rc: 104143 },
  ],
  CAT_02_TPC_LT3T5_FGTTE: [
    { min: 5, max: 7, rc: 78974 },
    { min: 8, max: 10, rc: 113944 },
    { min: 11, max: 16, rc: 146969 },
    { min: 17, rc: 174491 },
  ],
  CAT_02_TPC_LT3T5_CAMIONNETTE: [
    { min: 5, max: 7, rc: 127880 },
    { min: 8, max: 10, rc: 168085 },
    { min: 11, max: 16, rc: 206063 },
    { min: 17, rc: 237710 },
  ],
  CAT_02_TPC_GT3T5: [
    { min: 5, max: 7, rc: 130415 },
    { min: 8, max: 10, rc: 170617 },
    { min: 11, max: 16, rc: 208597 },
    { min: 17, rc: 240245 },
  ],
  CAT_03_TPM_LT3T5: [
    { min: 5, max: 7, rc: 165601 },
    { min: 8, max: 10, rc: 222270 },
    { min: 11, max: 16, rc: 283130 },
    { min: 17, rc: 328955 },
  ],
  CAT_03_TPM_GT3T5: [
    { min: 5, max: 7, rc: 167982 },
    { min: 8, max: 10, rc: 224650 },
    { min: 11, max: 16, rc: 285510 },
    { min: 17, rc: 331336 },
  ],
  CAT_04_TAXI_URBAIN: [
    { min: 5, max: 7, rc: 145960 },
    { min: 8, max: 10, rc: 196133 },
    { min: 11, max: 16, rc: 252483 },
  ],
  CAT_04_TAXI_INTERURBAIN: [
    { min: 5, max: 7, rc: 216139 },
    { min: 8, max: 10, rc: 266312 },
    { min: 11, max: 16, rc: 322662 },
  ],
};

/** Base RC par puissance pour CAT 4 Autocar/Minicar (à additionner avec surprime places) */
export const AUTOCAR_BASE_RC: CvBracket[] = [
  { min: 2, max: 4, rc: 100565 },
  { min: 5, max: 7, rc: 117587 },
  { min: 8, max: 10, rc: 167760 },
  { min: 11, max: 16, rc: 224110 },
  { min: 17, rc: 261832 },
];

/** Surprimes Autocar/Minicar par passager. */
export const AUTOCAR_SURPRIME = {
  /** Par passager jusqu'à 30 (places − 1, plafonné). */
  jusqua30: 9415,
  /** Par passager au-delà de 30. */
  audela30: 6726,
};

/** CAT 5 — RC annuel par cylindrée */
export const CAT_05_RC: Record<Cylindree, number> = {
  LT_125: 18780,
  GT_125: 29448,
  SIDE_CAR: 34021,
};

/** TRICYCLE — RC annuel unique */
export const TRICYCLE_RC = 40880;

/** Constantes fiscales et commerciales (toutes catégories sauf override). */
export const BAREME_CONSTANTS = {
  /** Réduction par défaut (20 %) */
  bonusDefaut: 0.2,
  /** Taxe sur (P_Nette + Frais) */
  tauxTaxe: 0.14,
  /** Fonds de Garantie Auto (% R_Civil) */
  tauxFga: 0.025,
  /** Coefficient mensuel pour le prorata 1..11 mois */
  coeffMensuel: 0.0875,
  /** Carte brune (hors TPV) */
  carteBrune: 300,
  /** Taux commission standard */
  commissionStandard: 0.2,
  /** Taux commission TPV */
  commissionTpv: 0.08,
  /** Frais de police par défaut (hors TPV) */
  fraisStandardDefaut: 3000,
  /** Frais de police par défaut (TPV) */
  fraisTpvDefaut: 2000,
};
