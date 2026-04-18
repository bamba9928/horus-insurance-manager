/**
 * Hooks TanStack Query pour la gestion des paiements.
 *
 * @module hooks/usePaiements
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPaiement, deletePaiement, listPaiements, updatePaiement } from "../lib/ipc";
import type { PaiementCreate, PaiementUpdate } from "../schemas/paiement";

const PAIEMENTS_KEY = ["paiements"] as const;

/** Liste des paiements (tous ou filtrés par police). */
export function usePaiements(policeId?: number) {
  return useQuery({
    queryKey: [...PAIEMENTS_KEY, { policeId }],
    queryFn: () => listPaiements(policeId),
  });
}

/** Mutation : créer un paiement. */
export function useCreatePaiement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PaiementCreate) => createPaiement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAIEMENTS_KEY });
    },
  });
}

/** Mutation : modifier un paiement. */
export function useUpdatePaiement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PaiementUpdate) => updatePaiement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAIEMENTS_KEY });
    },
  });
}

/** Mutation : supprimer un paiement. */
export function useDeletePaiement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePaiement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAIEMENTS_KEY });
    },
  });
}
