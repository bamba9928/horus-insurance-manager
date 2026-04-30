/**
 * Moteur de calcul tarifaire — assurance auto Sénégal.
 *
 * Basé sur la grille fournie par le courtier (TARIFICATION.xlsx).
 *
 * Formules communes (toutes catégories) :
 *  - R. Civil  = ROUND(RC_annuel × 0.0875 × mois × (1 − bonus))   pour 1 ≤ mois ≤ 11
 *                ROUND(RC_annuel × (1 − bonus))                   pour mois = 12
 *  - P. Nette  = R. Civil (P. Trans = 0)
 *  - Taxe      = ROUND((P_Nette + Frais) × 14%)
 *  - FGA       = ROUND(R_Civil × 2.5%)
 *  - Prime T.  = P_Nette + Frais + Taxe + FGA + Carte brune
 *  - COM       = ROUND(R_Civil × taux_commission)
 *  - NAV       = Prime T. − Frais − COM
 *
 * Spécificités TPV (CAT 4 Taxi / Autocar / Minicar) :
 *  - Commission : 8 % (vs 20 % ailleurs)
 *  - Pas de carte brune (+0 au lieu de +300)
 *  - Frais par défaut : 1 000 (vs 3 000)
 *
 * @module lib/tarification
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
interface CvBracket {
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
const RC_TABLES: Partial<Record<TarifCategorie, CvBracket[]>> = {
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
const AUTOCAR_BASE_RC: CvBracket[] = [
  { min: 2, max: 4, rc: 100565 },
  { min: 5, max: 7, rc: 117587 },
  { min: 8, max: 10, rc: 167760 },
  { min: 11, max: 16, rc: 224110 },
  { min: 17, rc: 261832 },
];

/** CAT 5 — RC annuel par cylindrée */
const CAT_05_RC: Record<Cylindree, number> = {
  LT_125: 18780,
  GT_125: 29448,
  SIDE_CAR: 34021,
};

/** TRICYCLE — RC annuel unique */
const TRICYCLE_RC = 40880;

function findBracket(brackets: CvBracket[], cv: number): CvBracket | null {
  for (const b of brackets) {
    if (cv >= b.min && (b.max === undefined || cv <= b.max)) return b;
  }
  return null;
}

export interface TarifInput {
  categorie: TarifCategorie;
  /** Puissance fiscale en CV — requis si needsPuissance */
  puissance?: number;
  /** Nombre de places — requis pour CAT 4 Autocar/Minicar */
  places?: number;
  /** Cylindrée — requis pour CAT 5 */
  cylindree?: Cylindree;
  /** Durée en mois (1 à 12) */
  dureeMois: number;
  /** Frais de police / coût de police */
  frais: number;
  /** Bonus accordé (0.2 = 20 %) ; si non fourni, 0.2 par défaut */
  bonus?: number;
}

export interface TarifResult {
  /** RC annuel utilisé */
  rcAnnuel: number;
  /** Responsabilité civile (prorata durée + bonus) */
  rCivil: number;
  /** Prime Nette */
  primeNette: number;
  /** Frais (coût police) */
  frais: number;
  /** Taxe 14 % */
  taxe: number;
  /** Fonds de Garantie Automobile (2.5 % RC) */
  fga: number;
  /** Prime Totale TTC */
  primeTotale: number;
  /** Commission courtier */
  commission: number;
  /** Net à Verser (reversé à la compagnie) */
  netAVerser: number;
  /** Carte brune appliquée (300 ou 0) */
  carteBrune: number;
  /** Taux commission appliqué */
  tauxCommission: number;
}

export class TarifError extends Error {}

function isTpv(cat: TarifCategorie): boolean {
  return (
    cat === "CAT_04_TAXI_URBAIN" ||
    cat === "CAT_04_TAXI_INTERURBAIN" ||
    cat === "CAT_04_AUTOCAR_MINICAR"
  );
}

/** Retourne le RC annuel total (base + surprime place s'il y a lieu). */
function resolveRcAnnuel(input: TarifInput): number {
  const { categorie, puissance, places, cylindree } = input;

  if (categorie === "TRICYCLE") return TRICYCLE_RC;

  if (categorie === "CAT_05_2R") {
    if (!cylindree) throw new TarifError("Cylindrée requise pour CAT 5.");
    return CAT_05_RC[cylindree];
  }

  if (categorie === "CAT_04_AUTOCAR_MINICAR") {
    if (puissance == null || puissance <= 0) throw new TarifError("Puissance fiscale requise.");
    if (places == null || places <= 0)
      throw new TarifError("Nombre de places requis pour Autocar/Minicar.");
    const bracket = findBracket(AUTOCAR_BASE_RC, puissance);
    if (!bracket) throw new TarifError(`Aucune tranche définie pour ${puissance} CV (Autocar).`);
    // Surprime places :
    //  - jusqu'à 30 passagers : (places − 1) × 9415 (plafonné à 30)
    //  - au-delà de 30 passagers : + (places − 31) × 6726
    const passagers = Math.max(0, places - 1);
    const surprime30 = Math.min(passagers, 30) * 9415;
    const surprimeExtra = Math.max(0, places - 31) * 6726;
    return bracket.rc + surprime30 + surprimeExtra;
  }

  // Catégories à tranches CV
  const table = RC_TABLES[categorie];
  if (!table) throw new TarifError(`Catégorie non tarifée : ${categorie}`);
  if (puissance == null || puissance <= 0) throw new TarifError("Puissance fiscale requise.");

  const meta = TARIF_CATEGORIES.find((c) => c.value === categorie);
  if (meta?.maxCV !== undefined && puissance > meta.maxCV) {
    throw new TarifError(
      `Puissance ${puissance} CV hors barème — ${meta.label} est limité à ${meta.maxCV} CV.`,
    );
  }

  const bracket = findBracket(table, puissance);
  if (!bracket) throw new TarifError(`Aucune tranche définie pour ${puissance} CV.`);
  return bracket.rc;
}

/**
 * Calcule le tarif complet.
 * Tous les montants retournés sont arrondis à l'entier (FCFA).
 */
export function computeTarif(input: TarifInput): TarifResult {
  const { categorie, dureeMois, frais, bonus = 0.2 } = input;

  if (!Number.isFinite(dureeMois) || dureeMois < 1 || dureeMois > 12)
    throw new TarifError("Durée invalide (1 à 12 mois).");
  if (!Number.isFinite(frais) || frais < 0) throw new TarifError("Frais invalide.");

  const rcAnnuel = resolveRcAnnuel(input);

  // R. Civil
  let rCivil: number;
  if (dureeMois === 12) {
    rCivil = Math.round(rcAnnuel * (1 - bonus));
  } else {
    rCivil = Math.round((rcAnnuel / 100) * 8.75 * dureeMois * (1 - bonus));
  }

  const primeNette = rCivil; // P_Trans = 0 pour toutes catégories actuelles

  const taxe = Math.round((primeNette + frais) * 0.14);
  const fga = Math.round(rCivil * 0.025);

  const tpv = isTpv(categorie);
  const carteBrune = tpv ? 0 : 300;
  const tauxCommission = tpv ? 0.08 : 0.2;

  const primeTotale = primeNette + frais + taxe + fga + carteBrune;
  const commission = Math.round(rCivil * tauxCommission);
  const netAVerser = primeTotale - frais - commission;

  return {
    rcAnnuel,
    rCivil,
    primeNette,
    frais,
    taxe,
    fga,
    primeTotale,
    commission,
    netAVerser,
    carteBrune,
    tauxCommission,
  };
}

/** Frais par défaut selon catégorie (modifiable par l'utilisateur). */
export function getDefaultFrais(cat: TarifCategorie): number {
  return isTpv(cat) ? 2000 : 3000;
}

/** Formate un montant en FCFA avec séparateur de milliers. */
export function formatFCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
