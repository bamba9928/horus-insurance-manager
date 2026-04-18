/**
 * Sidebar de navigation principale.
 * Couleur bronze (#614e1a) avec icônes et labels.
 */

import { Link, useMatchRoute } from "@tanstack/react-router";
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

export function Sidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <aside className="flex h-full w-60 flex-col bg-[#614e1a] text-white">
      {/* Logo / Titre */}
      <div className="flex items-center gap-3 border-b border-white/20 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-xl font-bold">
          H
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">HORUS</h1>
          <p className="text-xs text-white/70">Assurances Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? matchRoute({ to: "/", fuzzy: false })
              : matchRoute({ to: item.path, fuzzy: true });

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-white/20 font-semibold text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/20 px-4 py-3">
        <p className="text-xs text-white/50">v0.1.0</p>
      </div>
    </aside>
  );
}
