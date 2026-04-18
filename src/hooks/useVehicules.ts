/**
 * Hooks TanStack Query pour la gestion des véhicules.
 *
 * @module hooks/useVehicules
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVehicule,
  deleteVehicule,
  getVehicule,
  listVehicules,
  updateVehicule,
} from "../lib/ipc";
import type { VehiculeCreate, VehiculeUpdate } from "../schemas/vehicule";

const VEHICULES_KEY = ["vehicules"] as const;

/** Liste des véhicules (tous ou filtrés par client). */
export function useVehicules(clientId?: number) {
  return useQuery({
    queryKey: [...VEHICULES_KEY, { clientId }],
    queryFn: () => listVehicules(clientId),
  });
}

/** Détail d'un véhicule par ID. */
export function useVehicule(id: number | null) {
  return useQuery({
    queryKey: [...VEHICULES_KEY, id],
    queryFn: () => (id ? getVehicule(id) : undefined),
    enabled: id !== null,
  });
}

/** Mutation : créer un véhicule. */
export function useCreateVehicule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VehiculeCreate) => createVehicule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICULES_KEY });
    },
  });
}

/** Mutation : modifier un véhicule. */
export function useUpdateVehicule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VehiculeUpdate) => updateVehicule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICULES_KEY });
    },
  });
}

/** Mutation : supprimer un véhicule. */
export function useDeleteVehicule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteVehicule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICULES_KEY });
    },
  });
}
