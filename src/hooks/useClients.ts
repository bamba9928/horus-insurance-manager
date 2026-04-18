/**
 * Hooks TanStack Query pour la gestion des clients.
 *
 * @module hooks/useClients
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countClients,
  createClient,
  deleteClient,
  getClient,
  type ListParams,
  listClients,
  updateClient,
} from "../lib/ipc";
import type { ClientCreate, ClientUpdate } from "../schemas/client";

const CLIENTS_KEY = ["clients"] as const;

/** Liste des clients avec pagination et recherche. */
export function useClients(params: ListParams = {}) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, params],
    queryFn: () => listClients(params),
  });
}

/** Nombre total de clients. */
export function useClientsCount(search?: string) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, "count", search],
    queryFn: () => countClients(search),
  });
}

/** Détail d'un client par ID. */
export function useClient(id: number | null) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, id],
    queryFn: () => (id ? getClient(id) : undefined),
    enabled: id !== null,
  });
}

/** Mutation : créer un client. */
export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientCreate) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

/** Mutation : modifier un client. */
export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientUpdate) => updateClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

/** Mutation : supprimer un client. */
export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}
