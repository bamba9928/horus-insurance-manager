/**
 * Layout principal de l'application.
 * Sidebar fixe à gauche + zone de contenu scrollable à droite.
 */

import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-auto dark:text-slate-100">
        <Outlet />
      </main>
    </div>
  );
}
