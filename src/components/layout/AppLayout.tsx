/**
 * Layout principal de l'application.
 * Sidebar fixe à gauche + zone de contenu scrollable à droite.
 */

import { Outlet } from "@tanstack/react-router";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex flex-1 flex-col overflow-auto pb-20 md:pb-0 dark:text-slate-100">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
