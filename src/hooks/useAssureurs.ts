/**
 * Hooks TanStack Query pour la gestion des assureurs.
 *
 * @module hooks/useAssureurs
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAssureur, deleteAssureur, listAssureurs, updateAssureur } from "../lib/ipc";
import type { AssureurCreate, AssureurUpdate } from "../schemas/assureur";

const ASSUREURS_KEY = ["assureurs"] as const;
const INTEGRATIONS_KEY = ["integrations"] as const;

/** Liste de tous les assureurs. */
export function useAssureurs() {
  return useQuery({
    queryKey: [...ASSUREURS_KEY],
    queryFn: () => listAssureurs(),
  });
}

/** Crée un assureur. */
export function useCreateAssureur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssureurCreate) => createAssureur(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...ASSUREURS_KEY] });
      void qc.invalidateQueries({ queryKey: [...INTEGRATIONS_KEY] });
    },
  });
}

/** Met à jour un assureur. */
export function useUpdateAssureur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssureurUpdate) => updateAssureur(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...ASSUREURS_KEY] });
      void qc.invalidateQueries({ queryKey: [...INTEGRATIONS_KEY] });
    },
  });
}

/** Supprime un assureur. */
export function useDeleteAssureur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAssureur(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...ASSUREURS_KEY] });
      void qc.invalidateQueries({ queryKey: [...INTEGRATIONS_KEY] });
    },
  });
}
