import { type AuthUser, isWebMode } from "../../lib/auth";

export interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: "\u{1F4CA}" },
  { path: "/verification", labelKey: "nav.verification", icon: "\u{1F50E}" },
  { path: "/clients", labelKey: "nav.clients", icon: "\u{1F465}" },
  { path: "/vehicules", labelKey: "nav.vehicules", icon: "\u{1F697}" },
  { path: "/polices", labelKey: "nav.polices", icon: "\u{1F4C4}" },
  { path: "/paiements", labelKey: "nav.paiements", icon: "\u{1F4B0}" },
  { path: "/echeances", labelKey: "nav.echeances", icon: "\u{1F4C5}" },
  { path: "/parametres", labelKey: "nav.parametres", icon: "\u{2699}\u{FE0F}" },
];

export function getNavigationItems(user: AuthUser | null): NavItem[] {
  if (!isWebMode || !user) return NAV_ITEMS;

  return [
    ...NAV_ITEMS,
    { path: "/profil", labelKey: "nav.profile", icon: "\u{1F464}" },
    ...(user.role === "ADMIN"
      ? [{ path: "/admin", labelKey: "nav.admin", icon: "\u{1F510}" }]
      : []),
  ];
}
