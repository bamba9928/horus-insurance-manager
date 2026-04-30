/**
 * Moteur de calcul tarifaire — assurance auto Sénégal.
 *
 * Le barème (tables RC, surprimes, taux fiscaux, etc.) est externalisé
 * dans `tarification-bareme.ts` ; ce module ne contient que la logique
 * de calcul.
 *
 * Formules communes (toutes catégories) :
 *  - R. Civil  = ROUND(RC_annuel × coeffMensuel × mois × (1 − bonus))   pour 1 ≤ mois ≤ 11
 *                ROUND(RC_annuel × (1 − bonus))                         pour mois = 12
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
  /** Durée en mois (1 à 12) */
  dureeMois: number;
  /** Frais de police / coût de police */
  frais: number;
  /** Bonus accordé (0.2 = 20 %) ; si non fourni, valeur par défaut du barème */
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
export function computeTarif(input: TarifInput): TarifResult {
  const { categorie, dureeMois, frais, bonus = BAREME_CONSTANTS.bonusDefaut } = input;

  if (!Number.isFinite(dureeMois) || dureeMois < 1 || dureeMois > 12)
    throw new TarifError("Durée invalide (1 à 12 mois).");
  if (!Number.isFinite(frais) || frais < 0) throw new TarifError("Frais invalide.");

  const rcAnnuel = resolveRcAnnuel(input);

  let rCivil: number;
  if (dureeMois === 12) {
    rCivil = Math.round(rcAnnuel * (1 - bonus));
  } else {
    rCivil = Math.round(rcAnnuel * BAREME_CONSTANTS.coeffMensuel * dureeMois * (1 - bonus));
  }

  const primeNette = rCivil;

  const taxe = Math.round((primeNette + frais) * BAREME_CONSTANTS.tauxTaxe);
  const fga = Math.round(rCivil * BAREME_CONSTANTS.tauxFga);

  const tpv = isTpv(categorie);
  const carteBrune = tpv ? 0 : BAREME_CONSTANTS.carteBrune;
  const tauxCommission = tpv ? BAREME_CONSTANTS.commissionTpv : BAREME_CONSTANTS.commissionStandard;

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
  return isTpv(cat) ? BAREME_CONSTANTS.fraisTpvDefaut : BAREME_CONSTANTS.fraisStandardDefaut;
}

/** Formate un montant en FCFA avec séparateur de milliers. */
export function formatFCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
