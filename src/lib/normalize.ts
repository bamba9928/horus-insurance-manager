/**
 * Normalisation des saisies utilisateur.
 *
 * - Téléphone (Sénégal) : 9 chiffres commençant par 70, 71, 75, 76, 77 ou 78.
 *   Les espaces et caractères spéciaux sont retirés automatiquement.
 * - Majuscules : appliquées globalement à la frappe par le hook
 *   `useAutoNormalizeInputs` (voir src/hooks). Ce module ne contient que
 *   la logique pure, réutilisable côté schémas Zod comme côté UI.
 *
 * @module lib/normalize
 */

/** Préfixes mobiles sénégalais autorisés. */
export const PHONE_PREFIXES = ["70", "71", "75", "76", "77", "78"] as const;

/** Un numéro valide : 9 chiffres commençant par un préfixe autorisé. */
export const PHONE_REGEX = /^(70|71|75|76|77|78)\d{7}$/;

/** Message d'erreur standard pour un téléphone invalide. */
export const PHONE_ERROR =
  "Téléphone invalide : 9 chiffres commençant par 70, 71, 75, 76, 77 ou 78";

/**
 * Retire tout ce qui n'est pas un chiffre, enlève l'indicatif pays 221
 * (aucun mobile local ne commence par 2) et limite à 9 chiffres.
 * Ex : "+221 77-123 45 67" → "771234567".
 */
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("221")) digits = digits.slice(3);
  return digits.slice(0, 9);
}
