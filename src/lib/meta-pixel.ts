/**
 * Pixel Meta (Facebook Ads).
 *
 * Chargé uniquement en mode web : l'app desktop (Tauri) ne doit émettre aucune
 * requête vers Facebook. L'identifiant est public par nature (visible dans le
 * bundle) ; il reste surchargeable au build via `VITE_META_PIXEL_ID`, et une
 * valeur vide désactive complètement le pixel.
 *
 * Rien n'est chargé tant que le visiteur n'a pas accepté (cf. lib/consent) :
 * `initMetaPixel` n'est appelé que par le bandeau de consentement.
 *
 * Seule la page publique est suivie (PageView + conversions). Les écrans
 * authentifiés ne sont pas tracés : leurs URLs porteraient des données métier.
 *
 * @module lib/meta-pixel
 */

import { isWebMode } from "./auth";

/** Identifiant du pixel Horus Assurances (compte Meta Business). */
const DEFAULT_PIXEL_ID = "1547738733519656";

const PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID ?? DEFAULT_PIXEL_ID).trim();

/** Événements standards Meta utilisés par l'app. */
export type MetaStandardEvent = "PageView" | "Lead" | "CompleteRegistration";

type FbqArgs = unknown[];

interface Fbq {
  (...args: FbqArgs): void;
  callMethod?: (...args: FbqArgs) => void;
  queue: FbqArgs[];
  push: Fbq;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** `fbevents.js` injecté et pixel initialisé au moins une fois. */
let loaded = false;
/** Suivi autorisé : passe à faux dès que le consentement est retiré. */
let tracking = false;

/**
 * Installe le stub `fbq` qui met les appels en file d'attente tant que
 * `fbevents.js` n'est pas chargé (équivalent du snippet officiel de Meta,
 * écrit en TypeScript pour éviter un script inline bloqué par la CSP).
 */
function ensureFbq(): Fbq {
  const existing = window.fbq;
  if (existing) return existing;

  const fbq = ((...args: FbqArgs) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as Fbq;

  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";

  window.fbq = fbq;
  window._fbq ??= fbq;
  return fbq;
}

function injectPixelScript(): void {
  if (document.querySelector(`script[src="${PIXEL_SRC}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = PIXEL_SRC;
  document.head.appendChild(script);
}

/**
 * Initialise le pixel et envoie le PageView d'entrée. À n'appeler qu'une fois
 * le consentement obtenu. Sans effet en desktop, sans identifiant configuré,
 * ou si le suivi est déjà actif.
 */
export function initMetaPixel(): void {
  if (tracking || !isWebMode || !PIXEL_ID) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const fbq = ensureFbq();
  tracking = true;

  // Consentement redonné dans la même session : le pixel est déjà en place,
  // il suffit de rouvrir le robinet (un PageView a déjà été compté).
  if (loaded) {
    fbq("consent", "grant");
    return;
  }

  loaded = true;
  injectPixelScript();
  fbq("init", PIXEL_ID);
  fbq("track", "PageView");
}

/** Retire le consentement : plus aucun événement n'est envoyé à Meta. */
export function revokeMetaPixel(): void {
  if (!tracking) return;
  tracking = false;
  window.fbq?.("consent", "revoke");
}

/**
 * Remonte une conversion à Meta Ads (ignoré si le pixel n'est pas actif).
 *
 * @param event Événement standard Meta.
 * @param params Paramètres optionnels (valeur, devise, contenu…).
 */
export function trackMetaEvent(event: MetaStandardEvent, params?: Record<string, unknown>): void {
  if (!tracking) return;
  window.fbq?.("track", event, params);
}
