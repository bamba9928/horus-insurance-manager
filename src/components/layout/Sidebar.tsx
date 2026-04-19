/**
 * Sidebar de navigation principale.
 * Couleur bronze (#614e1a) avec icônes et labels.
 * Pliable/dépliable via bouton — état persisté dans localStorage.
 */

import { Link, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: "\u{1F4CA}" },
  { path: "/clients", labelKey: "nav.clients", icon: "\u{1F465}" },
  { path: "/vehicules", labelKey: "nav.vehicules", icon: "\u{1F697}" },
  { path: "/polices", labelKey: "nav.polices", icon: "\u{1F4C4}" },
  { path: "/paiements", labelKey: "nav.paiements", icon: "\u{1F4B0}" },
  { path: "/echeances", labelKey: "nav.echeances", icon: "\u{1F4C5}" },
  { path: "/parametres", labelKey: "nav.parametres", icon: "\u{2699}\u{FE0F}" },
];

const STORAGE_KEY = "ham-sidebar-collapsed";

export function Sidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[#614e1a] text-white transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Bouton pli en haut */}
      <div
        className={cn(
          "flex items-center border-b border-white/20",
          collapsed ? "justify-center px-2 py-3" : "justify-end px-2 py-2",
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Déplier le menu" : "Plier le menu"}
          title={collapsed ? "Déplier le menu" : "Plier le menu"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="text-lg leading-none">{collapsed ? "\u{00BB}" : "\u{00AB}"}</span>
        </button>
      </div>

      {/* Logo / Titre */}
      <div
        className={cn(
          "flex items-center border-b border-white/20 py-5",
          collapsed ? "justify-center px-2" : "gap-3 px-4",
        )}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 text-xl font-bold">
          H
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold leading-tight">HORUS</h1>
            <p className="whitespace-nowrap text-xs text-white/70">Assurances Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 py-4", collapsed ? "px-2" : "px-2")}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? matchRoute({ to: "/", fuzzy: false })
              : matchRoute({ to: item.path, fuzzy: true });

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? t(item.labelKey) : undefined}
              className={cn(
                "flex items-center rounded-lg py-2.5 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive
                  ? "bg-white/20 font-semibold text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span className="whitespace-nowrap">{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/20 px-4 py-3">
          <p className="text-xs text-white/50">v0.1.0</p>
        </div>
      )}
    </aside>
  );
}
