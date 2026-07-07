/**
 * Règles commerciales du devis rapide affiché sur l'accueil.
 *
 * Le calcul technique reste dans `tarification.ts`; ce module applique les
 * ajustements demandés pour un devis client simplifié.
 */

import { computeTarif, getDefaultFrais, TARIF_CATEGORIES, type TarifResult } from "./tarification";
import { BAREME_CONSTANTS, type Cylindree, type TarifCategorie } from "./tarification-bareme";

export const DEVIS_WHATSAPP_PHONE = "221773409658";

export const DEVIS_CATEGORY_GROUPS = [
  {
    value: "CAT_01",
    label: "CAT 01 : Véhicule Particulier (VP)",
    genres: ["CAT_01_VP"],
  },
  {
    value: "CAT_02",
    label: "CAT 02 : Véhicules Utilitaires (TPC)",
    genres: ["CAT_02_TPC_LT3T5_FGTTE", "CAT_02_TPC_LT3T5_CAMIONNETTE", "CAT_02_TPC_GT3T5"],
  },
  {
    value: "CAT_03",
    label: "CAT 03 : Véhicules Transports (TPM)",
    genres: ["CAT_03_TPM_LT3T5", "CAT_03_TPM_GT3T5"],
  },
  {
    value: "CAT_04",
    label: "CAT 04 : Transport de Personnes (TPV)",
    genres: ["CAT_04_TAXI_URBAIN", "CAT_04_TAXI_INTERURBAIN", "CAT_04_AUTOCAR_MINICAR"],
  },
  {
    value: "CAT_05",
    label: "CAT 05 : 2 roues / 3 roues",
    genres: ["CAT_05_2R", "TRICYCLE"],
  },
] as const;

export type DevisCategorieCode = (typeof DEVIS_CATEGORY_GROUPS)[number]["value"];

export interface DevisRapideInput {
  genre: TarifCategorie;
  puissance?: number;
  places?: number;
  cylindree?: Cylindree;
  dureeMois: number;
}

export interface DevisRapideResult {
  tarif: TarifResult;
  aPayer: number;
  remiseAPayer: number;
  bonus: number;
  frais: number;
  isTpc: boolean;
}

export interface WhatsAppDevisPayload {
  categorieLabel: string;
  genreLabel: string;
  dureeMois: number;
  aPayer: number;
  puissance?: number;
  places?: number;
  cylindreeLabel?: string;
}

function isTpcCategorie(categorie: TarifCategorie): boolean {
  return categorie.startsWith("CAT_02_TPC");
}

export function getDevisGenresByCategorie(categorie: DevisCategorieCode | null) {
  const group = DEVIS_CATEGORY_GROUPS.find((item) => item.value === categorie);
  if (!group) return [];
  return TARIF_CATEGORIES.filter((item) =>
    (group.genres as readonly TarifCategorie[]).includes(item.value),
  );
}

export function getDevisCommercialParams(genre: TarifCategorie, dureeMois: number) {
  const isTpc = isTpcCategorie(genre);
  return {
    isTpc,
    bonus: isTpc ? 0.3 : BAREME_CONSTANTS.bonusDefaut,
    frais: isTpc ? 3000 : getDefaultFrais(genre),
    remiseAPayer: !isTpc && dureeMois > 3 ? 2000 : 0,
  };
}

export function computeDevisRapide(input: DevisRapideInput): DevisRapideResult {
  const params = getDevisCommercialParams(input.genre, input.dureeMois);
  const tarif = computeTarif({
    categorie: input.genre,
    ...(input.puissance !== undefined ? { puissance: input.puissance } : {}),
    ...(input.places !== undefined ? { places: input.places } : {}),
    ...(input.cylindree !== undefined ? { cylindree: input.cylindree } : {}),
    dureeMois: input.dureeMois,
    frais: params.frais,
    bonus: params.bonus,
  });

  return {
    tarif,
    aPayer: Math.max(0, tarif.primeTotale - params.remiseAPayer),
    remiseAPayer: params.remiseAPayer,
    bonus: params.bonus,
    frais: params.frais,
    isTpc: params.isTpc,
  };
}

export function buildWhatsAppDevisUrl(payload: WhatsAppDevisPayload): string {
  const details = [
    "Bonjour, je souhaite valider ce devis pour qu'on le prenne en charge.",
    `Catégorie : ${payload.categorieLabel}`,
    `Genre : ${payload.genreLabel}`,
    ...(payload.puissance !== undefined ? [`Puissance : ${payload.puissance} CV`] : []),
    ...(payload.places !== undefined ? [`Places : ${payload.places}`] : []),
    ...(payload.cylindreeLabel ? [`Cylindrée : ${payload.cylindreeLabel}`] : []),
    `Durée : ${payload.dureeMois} mois`,
    `À payer : ${new Intl.NumberFormat("fr-FR").format(payload.aPayer)} FCFA`,
  ];

  return `https://wa.me/${DEVIS_WHATSAPP_PHONE}?text=${encodeURIComponent(details.join("\n"))}`;
}
