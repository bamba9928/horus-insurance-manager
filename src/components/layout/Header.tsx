/**
 * Header de l'application avec titre de page et actions globales.
 * Inclut un bouton TARIFICATION toujours visible à droite (accès rapide
 * au calculateur de tarif depuis n'importe quelle page).
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  /** Titre de la page courante */
  title?: string;
  /** Actions optionnelles affichées à droite (avant le bouton Tarification) */
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isOnTarification = pathname === "/tarification";

  return (
    <header className="sticky top-0 z-30 flex min-h-12 flex-col items-stretch gap-2 border-b border-gray-200/80 bg-white/95 px-3 py-2 shadow-[0_1px_0_0_rgba(15,23,42,0.08)] backdrop-blur-sm sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-0 dark:border-slate-700 dark:bg-slate-800/95">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
        {title?.trim() ? title : ""}
      </h2>
      <div className="no-scrollbar flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-0.5 sm:w-auto sm:gap-2.5 sm:overflow-visible sm:pb-0">
        {children}
        {!isOnTarification && (
          <Link
            to="/tarification"
            className="inline-flex h-10 min-w-[8.75rem] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#614e1a] px-3 text-sm font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/40 sm:h-8 sm:min-w-0 sm:flex-none sm:text-xs"
            aria-label={t("tarification.button")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 3h6v2H7V5zm0 4h2v2H7V9zm4 0h2v2h-2V9zm-4 4h2v2H7v-2zm4 0h2v2h-2v-2z" />
            </svg>
            {t("tarification.button")}
          </Link>
        )}
      </div>
    </header>
  );
}
