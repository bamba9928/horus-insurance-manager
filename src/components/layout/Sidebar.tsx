/**
 * Sidebar de navigation principale.
 * Couleur bronze (#614e1a) avec icônes et labels.
 * Pliable/dépliable via bouton — état persisté dans localStorage.
 */

import { Link, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isWebMode, useAuth } from "../../lib/auth";
import { cn } from "../../lib/utils";

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: "\u{1F4CA}" },
  { path: "/verification", labelKey: "nav.verification", icon: "\u{1F50E}" },
  { path: "/clients", labelKey: "nav.clients", icon: "\u{1F465}" },
  { path: "/vehicules", labelKey: "nav.vehicules", icon: "\u{1F697}" },
  { path: "/polices", labelKey: "nav.polices", icon: "\u{1F4C4}" },
  { path: "/paiements", labelKey: "nav.paiements", icon: "\u{1F4B0}" },
  { path: "/echeances", labelKey: "nav.echeances", icon: "\u{1F4C5}" },
  { path: "/parametres", labelKey: "nav.parametres", icon: "\u{2699}\u{FE0F}" },
];

const STORAGE_KEY = "ham-sidebar-collapsed";
const LOGO_SRC = "/horus-manager-logo.png";
const LOGO_SRC_SET = "/horus-manager-logo.png 1x, /horus-manager-logo@2x.png 2x";

export function Sidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const { user, logout } = useAuth();

  // Le menu Administration n'apparaît qu'en mode web pour le super admin.
  const navItems =
    isWebMode && user?.role === "ADMIN"
      ? [...NAV_ITEMS, { path: "/admin", labelKey: "nav.admin", icon: "\u{1F510}" }]
      : NAV_ITEMS;

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
        "flex h-full flex-col border-r border-black/20 bg-[#614e1a] text-white transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-52",
      )}
    >
      {/* Bouton pli en haut */}
      <div
        className={cn(
          "flex items-center border-b border-white/20",
          collapsed ? "justify-center px-2 py-1.5" : "justify-end px-2 py-1.5",
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Déplier le menu" : "Plier le menu"}
          title={collapsed ? "Déplier le menu" : "Plier le menu"}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="text-lg leading-none">{collapsed ? "\u{00BB}" : "\u{00AB}"}</span>
        </button>
      </div>

      {/* Logo / Titre */}
      {collapsed ? (
        <div className="flex items-center justify-center border-b border-white/20 px-2 py-2">
          <img src="/favicon-32x32.png" alt="Horus Assurances" className="h-8 w-8 object-contain" />
        </div>
      ) : (
        <div className="flex items-center border-b border-white/20 px-4 py-3">
          <img
            src={LOGO_SRC}
            srcSet={LOGO_SRC_SET}
            alt="Horus Assurances"
            className="h-14 w-auto max-w-full rounded-md bg-white/95 px-2 py-1 shadow-sm"
          />
          <div className="sr-only">
            <h1>HORUS</h1>
            <p>Assurances Manager</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 pt-2 pb-2 px-2">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? matchRoute({ to: "/", fuzzy: false })
              : matchRoute({ to: item.path, fuzzy: true });
          const label = t(item.labelKey);

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                "group relative flex h-9 items-center rounded-xl text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-2.5 px-3",
                isActive
                  ? "bg-white/20 font-semibold text-white ring-1 ring-white/25"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {collapsed ? (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                  {label}
                </span>
              ) : (
                <span className="whitespace-nowrap">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Compte connecté + déconnexion (mode web) */}
      {isWebMode && user && (
        <div className={cn("border-t border-white/20", collapsed ? "px-2 py-1.5" : "px-4 py-2.5")}>
          {!collapsed && (
            <div className="mb-1.5 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{user.nom}</p>
              <p className="truncate text-xs text-white/60">{user.login}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className={cn(
              "flex h-9 items-center rounded-xl text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white",
              collapsed ? "w-full justify-center" : "w-full gap-2 px-2",
            )}
          >
            <span className="text-lg leading-none">{"\u{23FB}"}</span>
            {!collapsed && <span>Se déconnecter</span>}
          </button>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/20 px-4 py-2">
          <p className="text-xs text-white/50">v0.1.0</p>
        </div>
      )}
    </aside>
  );
}
