/**
 * Bandeau de consentement aux cookies de mesure (pixel Meta Ads).
 *
 * Rendu par la seule page publique : les écrans authentifiés ne sont pas suivis.
 * Tant qu'aucun choix n'est fait, le pixel n'est pas chargé.
 */

import { Cookie } from "lucide-react";
import { useEffect } from "react";
import { setConsentChoice, useConsentChoice } from "../../lib/consent";
import { initMetaPixel, revokeMetaPixel } from "../../lib/meta-pixel";

export function CookieConsentBanner() {
  const choice = useConsentChoice();

  // Le choix mémorisé est réappliqué à chaque visite : accepté → le pixel
  // démarre ici (et nulle part ailleurs), refusé → le suivi reste coupé.
  useEffect(() => {
    if (choice === "granted") initMetaPixel();
    else revokeMetaPixel();
  }, [choice]);

  if (choice) return null;

  return (
    <section
      aria-label="Consentement aux cookies de mesure"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl shadow-black/10 sm:flex-row sm:items-center sm:gap-4 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg bg-[#614e1a]/10 text-[#614e1a] sm:self-auto dark:bg-amber-300/10 dark:text-amber-300">
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </span>

        <p className="flex-1 text-center text-sm leading-6 text-gray-600 sm:text-left dark:text-slate-300">
          Nous mesurons l'audience de nos publicités avec un cookie Meta (Facebook). Rien n'est
          déposé ni transmis tant que vous n'avez pas accepté, et votre espace privé n'est jamais
          suivi.
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsentChoice("denied")}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400/40 sm:flex-none dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => setConsentChoice("granted")}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/40 sm:flex-none"
          >
            Accepter
          </button>
        </div>
      </div>
    </section>
  );
}
