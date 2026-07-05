/**
 * Normalisation automatique de toutes les saisies texte de l'application.
 *
 * Monté une seule fois (dans App), ce hook écoute les évènements `input` en
 * phase capture — donc AVANT les gestionnaires React — et réécrit la valeur
 * du champ avant que React (et react-hook-form) ne la lisent. Cela couvre
 * aussi bien les inputs non contrôlés (react-hook-form) que contrôlés
 * (barres de recherche en useState), sans toucher chaque formulaire.
 *
 * Règles :
 * - `<input type="tel">` → normalisé en téléphone (chiffres, 9 max).
 * - `<input type="text|search">` → mis en MAJUSCULES.
 * - `<textarea>`, email, mot de passe, nombre, date… → inchangés.
 * - Tout champ portant `data-no-upper` est exclu (ex : identifiant, mot de
 *   passe affiché en clair).
 *
 * @module hooks/useAutoNormalizeInputs
 */

import { useEffect } from "react";
import { normalizePhone } from "../lib/normalize";

/** Calcule la valeur normalisée d'un input, ou `null` si aucun changement requis. */
function normalizedValue(el: HTMLInputElement): string | null {
  if (el.dataset.noUpper !== undefined) return null;
  const type = el.type.toLowerCase();
  if (type === "tel") return normalizePhone(el.value);
  if (type === "text" || type === "search") return el.value.toUpperCase();
  return null; // email, password, number, date, checkbox, etc. : inchangés
}

export function useAutoNormalizeInputs(): void {
  useEffect(() => {
    // Setter natif : écrit la valeur SANS passer par le setter patché par React,
    // donc sans mettre à jour son value-tracker. Ainsi React détecte toujours un
    // changement et déclenche onChange (indispensable pour les inputs contrôlés
    // comme les barres de recherche ; sinon leur state ne se met jamais à jour).
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    const handler = (e: Event) => {
      const el = e.target;
      // Exclut <textarea> (les notes gardent leur casse) et tout non-input.
      if (!(el instanceof HTMLInputElement)) return;

      const next = normalizedValue(el);
      if (next === null || next === el.value) return;

      const caret = el.selectionStart ?? next.length;
      const removed = Math.max(0, el.value.length - next.length);
      if (nativeSetter) nativeSetter.call(el, next);
      else el.value = next;

      // Restaure la position du curseur (décalée du nombre de caractères retirés).
      const pos = Math.max(0, caret - removed);
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* certains types d'input n'autorisent pas setSelectionRange */
      }
    };

    // Phase capture : s'exécute avant les gestionnaires onChange de React.
    document.addEventListener("input", handler, true);
    return () => document.removeEventListener("input", handler, true);
  }, []);
}
