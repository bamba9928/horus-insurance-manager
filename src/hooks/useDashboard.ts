/**
 * Hooks TanStack Query pour le dashboard.
 * Expose les KPI et les données des vues SQL (échéances 30j, impayés).
 *
 * @module hooks/useDashboard
 */

import { useQuery } from "@tanstack/react-query";
import { getDashboardKPI, getEcheances30j, getImpayes } from "../lib/ipc";

const DASHBOARD_KEY = ["dashboard"] as const;

/** KPI du dashboard (polices actives, échéances, impayés, nouveaux clients). */
export function useDashboardKPI() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "kpi"],
    queryFn: () => getDashboardKPI(),
    // Rafraîchir toutes les minutes
    refetchInterval: 60_000,
  });
}

/** Liste des échéances dans la fenêtre -7 à +30 jours (vue SQL v_echeances_30j). */
export function useEcheances30j() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "echeances30j"],
    queryFn: () => getEcheances30j(),
  });
}

/** Liste des impayés (vue SQL v_impayes). */
export function useImpayes() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "impayes"],
    queryFn: () => getImpayes(),
  });
}
