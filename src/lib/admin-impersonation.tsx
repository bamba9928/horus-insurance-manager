/**
 * Mode « agir en tant que » (admin, mode web).
 *
 * Un administrateur peut consulter et modifier les données d'un utilisateur :
 * l'id cible est propagé à la couche IPC ([setActingTenantId]) qui préfixe
 * alors toutes les requêtes métier vers `/api/admin/tenants/:id`. Le serveur
 * revalide systématiquement le rôle ADMIN — ce mode est un confort d'UI, pas
 * une frontière de sécurité.
 *
 * L'état est mémorisé en `sessionStorage` pour survivre à un rechargement,
 * et le cache React Query est purgé à chaque bascule pour éviter tout mélange
 * de données entre tenants.
 *
 * @module admin-impersonation
 */

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setActingTenantId } from "./ipc.http";

export interface ActingUser {
  id: number;
  label: string;
}

interface ImpersonationState {
  actingUser: ActingUser | null;
  startActing: (user: ActingUser) => void;
  stopActing: () => void;
}

const STORAGE_KEY = "horus_acting_tenant";

const ImpersonationContext = createContext<ImpersonationState>({
  actingUser: null,
  startActing: () => {},
  stopActing: () => {},
});

export function useImpersonation(): ImpersonationState {
  return useContext(ImpersonationContext);
}

function readStored(): ActingUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActingUser;
    return parsed && Number.isInteger(parsed.id) && parsed.id > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const [actingUser, setActingUser] = useState<ActingUser | null>(() => {
    const stored = readStored();
    // Réapplique l'état persisté à la couche IPC dès le premier rendu, avant
    // que les pages ne déclenchent leurs requêtes.
    setActingTenantId(stored?.id ?? null);
    return stored;
  });

  // Réinitialise TOUTES les requêtes (actives + inactives) et refait celles
  // qui sont montées. On n'appelle PAS `clear()` avant : cela viderait le
  // cache, si bien que `resetQueries()` ne trouverait plus aucune requête
  // active à rafraîchir (ex. bouton « Revenir » sans changement de route, où
  // le tableau de bord reste monté). Le reset seul purge les données d'un
  // tenant et recharge immédiatement celles de l'autre.
  const refreshAllData = useCallback(() => {
    void queryClient.resetQueries();
  }, [queryClient]);

  const startActing = useCallback(
    (user: ActingUser) => {
      setActingTenantId(user.id);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } catch {
        // sessionStorage indisponible : le mode reste actif en mémoire.
      }
      setActingUser(user);
      refreshAllData();
    },
    [refreshAllData],
  );

  const stopActing = useCallback(() => {
    setActingTenantId(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setActingUser(null);
    refreshAllData();
  }, [refreshAllData]);

  const value = useMemo(
    () => ({ actingUser, startActing, stopActing }),
    [actingUser, startActing, stopActing],
  );

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}
