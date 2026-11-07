/**
 * Moteur de calcul tarifaire — assurance auto Sénégal.
 *
 * Le barème (tables RC, surprimes, taux fiscaux, etc.) est externalisé
 * dans `tarification-bareme.ts` ; ce module ne contient que la logique
 * de calcul.
 *
 * Formules communes (alignées sur ASS — voir docs/BAREME_TARIFICATION.md) :
 *  - Coef durée = coeffMensuel × mois (1 ≤ mois ≤ 11), 1 pour 12 mois,
 *                 ou ROUND(jours / 365 ; 3) pour une durée en jours
 *  - RC prorata = ROUND(RC_annuel × coef durée)
 *  - R. Civil  = ROUND(RC prorata × (1 − réduction effective))
 *                réduction effective = réduction × facteurReductionTpc pour les TPC
 *  - P. Nette  = R. Civil (P. Trans = 0)
 *  - Taxe      = ROUND((P_Nette + Frais) × tauxTaxe)
 *  - FGA       = ROUND(R_Civil × tauxFga)
 *  - Prime T.  = P_Nette + Frais + Taxe + FGA + Carte brune
 *  - COM       = ROUND(R_Civil × taux_commission)
 *  - NAV       = Prime T. − Frais − COM
 *
 * Spécificités TPV (CAT 4 Taxi / Autocar / Minicar) :
 *  - Commission : commissionTpv (vs commissionStandard ailleurs)
 *  - Pas de carte brune
 *  - Frais par défaut : fraisTpvDefaut
 *
 * @module lib/tarification
 */

import {
  AUTOCAR_BASE_RC,
  AUTOCAR_SURPRIME,
  BAREME_CONSTANTS,
  CAT_05_RC,
  type CvBracket,
  type Cylindree,
  RC_TABLES,
  TARIF_CATEGORIES,
  type TarifCategorie,
  TRICYCLE_RC,
} from "./tarification-bareme";

export {
  CYLINDREE_OPTIONS,
  type Cylindree,
  TARIF_CATEGORIES,
  type TarifCategorie,
  type TarifCategorieOption,
} from "./tarification-bareme";

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
  /** Durée en mois (1 à 12) — ignorée si dureeJours est fourni */
  dureeMois?: number;
  /** Durée en jours (1 à 365) — prorata ASS ROUND(jours / 365 ; 3) */
  dureeJours?: number;
  /** Frais de police / coût de police */
  frais: number;
  /** Réduction accordée (0.2 = 20 %) ; si non fourni, valeur par défaut de la catégorie */
  bonus?: number;
  /**
   * Prime de base RÉELLE d'ASS (RC au prorata, avant réduction), lue via
   * Horus. Fournie, elle remplace celle du barème local : c'est la donnée qui
   * dérive quand ASS change ses tables. Réduction, frais, taxe et FGA restent
   * calculés ici avec les règles du guichet.
   */
  rcProrataAss?: number;
}

export interface TarifResult {
  /** Origine de la prime de base : relevée chez ASS, ou barème local. */
  source: "ASS" | "BAREME";
  /** Prime de base selon le barème local, pour signaler un écart avec ASS. */
  rcProrataBareme: number;
  /** RC annuel utilisé */
  rcAnnuel: number;
  /** Coefficient de durée appliqué au RC annuel */
  coefficientDuree: number;
  /** RC au prorata de la durée, avant réduction */
  rcProrata: number;
  /** Montant de la réduction (RC prorata − R. Civil) */
  reduction: number;
  /** Taux de réduction réellement appliqué */
  tauxReductionEffectif: number;
  /** Responsabilité civile (prorata durée + réduction) */
  rCivil: number;
  /** Prime Nette */
  primeNette: number;
  /** Frais (coût police) */
  frais: number;
  /** Taxe */
  taxe: number;
  /** Fonds de Garantie Automobile */
  fga: number;
  /** Prime Totale TTC */
  primeTotale: number;
  /** Commission courtier */
  commission: number;
  /** Net à Verser (reversé à la compagnie) */
  netAVerser: number;
  /** Carte brune appliquée */
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

function isTpc(cat: TarifCategorie): boolean {
  return cat.startsWith("CAT_02_TPC");
}

/** Réduction par défaut selon catégorie : TPV 0 %, TPC 40 %, autres 20 %. */
export function getDefaultBonus(cat: TarifCategorie): number {
  if (isTpv(cat)) return BAREME_CONSTANTS.bonusTpvDefaut;
  if (isTpc(cat)) return BAREME_CONSTANTS.bonusTpcDefaut;
  return BAREME_CONSTANTS.bonusDefaut;
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
    const passagers = Math.max(0, places - 1);
    const surprime30 = Math.min(passagers, 30) * AUTOCAR_SURPRIME.jusqua30;
    const surprimeExtra = Math.max(0, places - 31) * AUTOCAR_SURPRIME.audela30;
    return bracket.rc + surprime30 + surprimeExtra;
  }

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
/**
 * Arrondi d'un rapport d'entiers positifs au plus proche, les « ,5 » allant au
 * nombre PAIR — exactement comme ASS.
 *
 * Relevé sur 1 688 contrats ASS (2026-11-07) : sur les 528 dont la taxe tombe
 * sur ,5, ASS arrondit 528 fois au pair (527 vers le bas, 1 vers le haut). Il
 * calcule aussi en valeur EXACTE : `Math.round(4575 * 0.14)` donne 641 (le
 * flottant vaut 640,50000000000006) quand ASS facture 640. D'où des entiers
 * de bout en bout plutôt que des multiplications par des taux décimaux.
 */
export function roundHalfEven(numerator: number, denominator: number): number {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  if (remainder * 2 > denominator) return quotient + 1;
  if (remainder * 2 < denominator) return quotient;
  return quotient % 2 === 0 ? quotient : quotient + 1;
}

/** Taux exprimé en millièmes (0,2 → 200), pour calculer en entiers. */
function toMillis(rate: number): number {
  return Math.round(rate * 1000);
}

export function computeTarif(input: TarifInput): TarifResult {
  const { categorie, dureeMois, dureeJours, bonus = getDefaultBonus(categorie) } = input;

  // Coefficient de durée sous forme de fraction exacte (numérateur / dénominateur).
  let durationNum: number;
  let durationDen: number;
  if (dureeJours !== undefined) {
    if (!Number.isInteger(dureeJours) || dureeJours < 1 || dureeJours > 365)
      throw new TarifError("Durée invalide (1 à 365 jours).");
    // ROUND(jours / 365 ; 3) : jamais un « ,5 » exact, Math.round suffit.
    durationNum = Math.round((dureeJours * 1000) / 365);
    durationDen = 1000;
  } else {
    if (dureeMois === undefined || !Number.isInteger(dureeMois) || dureeMois < 1 || dureeMois > 12)
      throw new TarifError("Durée invalide (1 à 12 mois).");
    // 8,75 % par mois = 875 / 10 000 ; 12 mois = 100 %.
    durationNum = dureeMois === 12 ? 1 : toMillis(BAREME_CONSTANTS.coeffMensuel * 10) * dureeMois;
    durationDen = dureeMois === 12 ? 1 : 10_000;
  }
  const coefficientDuree = durationNum / durationDen;
  if (!Number.isFinite(input.frais) || input.frais < 0) throw new TarifError("Frais invalide.");
  if (!Number.isFinite(bonus) || bonus < 0 || bonus > 1)
    throw new TarifError("Réduction invalide (0 à 100 %).");
  const frais = Math.round(input.frais);

  const rcAnnuel = resolveRcAnnuel(input);

  // ASS arrondit le prorata avant d'appliquer la réduction.
  const rcProrataBareme = roundHalfEven(rcAnnuel * durationNum, durationDen);
  const fromAss = input.rcProrataAss !== undefined;
  if (fromAss && (!Number.isInteger(input.rcProrataAss) || (input.rcProrataAss ?? 0) <= 0))
    throw new TarifError("Prime de base ASS invalide.");
  const rcProrata = fromAss ? (input.rcProrataAss as number) : rcProrataBareme;

  // Réduction effective en millièmes : TPC à 98 % du taux affiché (40 % → 392).
  const reductionMillis = isTpc(categorie)
    ? Math.round(toMillis(bonus) * BAREME_CONSTANTS.facteurReductionTpc)
    : toMillis(bonus);
  const tauxReductionEffectif = reductionMillis / 1000;
  const rCivil = roundHalfEven(rcProrata * (1000 - reductionMillis), 1000);
  const reduction = rcProrata - rCivil;

  const primeNette = rCivil;

  const taxe = roundHalfEven((primeNette + frais) * toMillis(BAREME_CONSTANTS.tauxTaxe), 1000);
  const fga = roundHalfEven(rCivil * toMillis(BAREME_CONSTANTS.tauxFga), 1000);

  const tpv = isTpv(categorie);
  const carteBrune = tpv ? 0 : BAREME_CONSTANTS.carteBrune;
  const tauxCommission = tpv ? BAREME_CONSTANTS.commissionTpv : BAREME_CONSTANTS.commissionStandard;

  const primeTotale = primeNette + frais + taxe + fga + carteBrune;
  const commission = roundHalfEven(rCivil * toMillis(tauxCommission), 1000);
  const netAVerser = primeTotale - frais - commission;

  return {
    source: fromAss ? "ASS" : "BAREME",
    rcProrataBareme,
    rcAnnuel,
    coefficientDuree,
    rcProrata,
    reduction,
    tauxReductionEffectif,
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
  return isTpv(cat) ? BAREME_CONSTANTS.fraisTpvDefaut : BAREME_CONSTANTS.fraisStandardDefaut;
}

/** Formate un montant en FCFA avec séparateur de milliers. */
export function formatFCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
