/**
 * Hook TanStack Query pour les échéances avec fenêtre personnalisable.
 *
 * @module hooks/useEcheances
 */

import { useQuery } from "@tanstack/react-query";
import { getEcheancesRange } from "../lib/ipc";

/** Presets de fenêtre pour filtrer les échéances. */
export type EcheancePreset = "J-7" | "J+30" | "J+60" | "J+90" | "EXPIREES";

const PRESET_PARAMS: Record<
  EcheancePreset,
  { fromDays?: number; toDays?: number; expiredOnly?: boolean }
> = {
  "J-7": { fromDays: -7, toDays: 0 },
  "J+30": { fromDays: 0, toDays: 30 },
  "J+60": { fromDays: 0, toDays: 60 },
  "J+90": { fromDays: 0, toDays: 90 },
  EXPIREES: { expiredOnly: true },
};

/** Récupère les échéances selon un preset. */
export function useEcheances(preset: EcheancePreset) {
  return useQuery({
    queryKey: ["echeances", preset] as const,
    queryFn: () => getEcheancesRange(PRESET_PARAMS[preset]),
  });
}
