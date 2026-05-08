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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200/80 bg-white/95 px-5 shadow-[0_1px_0_0_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
        {title?.trim() ? title : ""}
      </h2>
      <div className="flex items-center gap-2.5">
        {children}
        {!isOnTarification && (
          <Link
            to="/tarification"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#614e1a] px-3 text-xs font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/40"
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
