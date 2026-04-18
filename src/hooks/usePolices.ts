/**
 * Hooks TanStack Query pour la gestion des polices d'assurance.
 *
 * @module hooks/usePolices
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPolice,
  deletePolice,
  getPolice,
  listPolices,
  renewPolice,
  updatePolice,
} from "../lib/ipc";
import type { PoliceCreate, PoliceUpdate } from "../schemas/police";

const POLICES_KEY = ["polices"] as const;

/** Liste des polices avec filtres optionnels. */
export function usePolices(filters?: { vehiculeId?: number; statut?: string; typeCarte?: string }) {
  return useQuery({
    queryKey: [...POLICES_KEY, filters],
    queryFn: () => listPolices(filters),
  });
}

/** Détail d'une police par ID. */
export function usePolice(id: number | null) {
  return useQuery({
    queryKey: [...POLICES_KEY, id],
    queryFn: () => (id ? getPolice(id) : undefined),
    enabled: id !== null,
  });
}

/** Mutation : créer une police. */
export function useCreatePolice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PoliceCreate) => createPolice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLICES_KEY });
    },
  });
}

/** Mutation : modifier une police. */
export function useUpdatePolice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PoliceUpdate) => updatePolice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLICES_KEY });
    },
  });
}

/** Mutation : supprimer une police. */
export function useDeletePolice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePolice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLICES_KEY });
    },
  });
}

/** Mutation : renouveler une police (crée une nouvelle + marque l'ancienne RENOUVELÉE). */
export function useRenewPolice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policeId: number) => renewPolice(policeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POLICES_KEY });
    },
  });
}
