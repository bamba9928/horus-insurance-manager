/**
 * Layout principal de l'application.
 * Sidebar fixe à gauche + zone de contenu scrollable à droite.
 */

import { Outlet } from "@tanstack/react-router";
import { useImpersonation } from "../../lib/admin-impersonation";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex flex-1 flex-col overflow-auto pb-20 md:pb-0 dark:text-slate-100">
        <ImpersonationBanner />
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}

/**
 * Rappel permanent lorsqu'un administrateur agit sur les données d'un autre
 * utilisateur — évite toute modification par mégarde du mauvais compte.
 */
function ImpersonationBanner() {
  const { actingUser, stopActing } = useImpersonation();
  if (!actingUser) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
      <span className="min-w-0">
        <span aria-hidden="true">⚠️ </span>
        Mode administrateur — vous consultez et modifiez les données de{" "}
        <strong className="font-semibold">{actingUser.label}</strong>.
      </span>
      <button
        type="button"
        onClick={stopActing}
        className="shrink-0 rounded-lg border border-amber-400 bg-white/70 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-white dark:border-amber-600 dark:bg-slate-800/60 dark:text-amber-100 dark:hover:bg-slate-800"
      >
        Revenir à mon compte
      </button>
    </div>
  );
}
