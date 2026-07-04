/**
 * Hook TanStack Query pour l'enregistrement d'un dossier complet
 * (client + véhicule + police + paiement) en une transaction.
 *
 * @module hooks/useDossier
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDossier } from "../lib/ipc";
import type { DossierCreate } from "../schemas/dossier";

/** Mutation : créer un dossier complet. Invalide tous les caches concernés. */
export function useCreateDossier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DossierCreate) => createDossier(data),
    onSuccess: () => {
      for (const key of ["clients", "vehicules", "polices", "paiements", "dashboard"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
