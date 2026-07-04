import { Link, useMatchRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/utils";
import { getNavigationItems, type NavItem } from "./navigation";

const PRIMARY_PATHS = new Set(["/", "/clients", "/polices", "/paiements"]);

export function MobileNav() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = useMemo(() => getNavigationItems(user), [user]);
  const primaryItems = navItems.filter((item) => PRIMARY_PATHS.has(item.path));
  const overflowItems = navItems.filter((item) => !PRIMARY_PATHS.has(item.path));

  useEffect(() => {
    if (pathname) setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/", replace: true });
  };

  const itemLabel = (item: NavItem) => (item.path === "/" ? t("nav.home") : t(item.labelKey));

  return (
    <div className="md:hidden">
      {menuOpen && (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-40 rounded-lg border border-gray-200 bg-white p-2 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-1">
            {overflowItems.map((item) => (
              <MobileMenuLink key={item.path} item={item} />
            ))}
          </div>

          {user && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              <span aria-hidden="true">{"\u{23FB}"}</span>
              Se déconnecter
            </button>
          )}
        </div>
      )}

      {menuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-30 bg-slate-950/20"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="grid grid-cols-5 gap-1">
          {primaryItems.map((item) => {
            const active =
              item.path === "/"
                ? matchRoute({ to: "/", fuzzy: false })
                : matchRoute({ to: item.path, fuzzy: true });
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={itemLabel(item)}
                className={cn(
                  "flex h-12 min-w-0 flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-colors",
                  active
                    ? "bg-[#614e1a]/10 text-[#614e1a] dark:bg-[#c2a65b]/15 dark:text-[#c2a65b]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                )}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="mt-0.5 max-w-full truncate">{itemLabel(item)}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Plus de navigation"
            className={cn(
              "flex h-12 min-w-0 flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-colors",
              menuOpen
                ? "bg-[#614e1a]/10 text-[#614e1a] dark:bg-[#c2a65b]/15 dark:text-[#c2a65b]"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            )}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {"\u{22EF}"}
            </span>
            <span className="mt-0.5">Plus</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function MobileMenuLink({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const active =
    item.path === "/"
      ? matchRoute({ to: "/", fuzzy: false })
      : matchRoute({ to: item.path, fuzzy: true });

  return (
    <Link
      to={item.path}
      className={cn(
        "flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-[#614e1a]/10 text-[#614e1a] dark:bg-[#c2a65b]/15 dark:text-[#c2a65b]"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
      )}
    >
      <span className="text-lg leading-none" aria-hidden="true">
        {item.icon}
      </span>
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}
