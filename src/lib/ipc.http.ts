/**
 * Implémentation HTTP de l'API métier (mode web).
 * Mêmes signatures que ipc.tauri.ts : les hooks/pages ne changent pas.
 * Toutes les requêtes portent le cookie de session (credentials: include).
 *
 * @module ipc.http
 */

import type { Assureur, AssureurCreate, AssureurUpdate } from "../schemas/assureur";
import type { Client, ClientCreate, ClientUpdate } from "../schemas/client";
import type { DossierCreate, DossierCreated } from "../schemas/dossier";
import type { Paiement, PaiementCreate, PaiementUpdate } from "../schemas/paiement";
import type { Police, PoliceCreate, PoliceUpdate } from "../schemas/police";
import type { Vehicule, VehiculeCreate, VehiculeUpdate } from "../schemas/vehicule";
import { csrfHeaders } from "./csrf";
import type {
  DashboardKPI,
  DashboardRecapRow,
  EcheanceRow,
  ImpayeRow,
  IntegrationExchangeLog,
  IntegrationOverview,
  ListParams,
  VerificationApiResponse,
} from "./ipc.tauri";

/** Base de l'API : même origine par défaut (le backend sert le frontend). */
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/** Erreur HTTP portant le code de statut. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...csrfHeaders(method),
  };
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    credentials: "include",
    ...(body !== undefined
      ? { headers, body: JSON.stringify(body) }
      : Object.keys(headers).length > 0
        ? { headers }
        : {}),
  });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // corps non-JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ============ Commandes hors-SQL ============

export async function greet(name: string): Promise<string> {
  return `Bonjour ${name}`;
}

/** Sauvegarde : télécharge la base de l'utilisateur via l'API. */
export async function backupDatabase(): Promise<Uint8Array> {
  const res = await fetch(`${BASE}/api/backup`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, `Erreur ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function restoreDatabase(bytes: Uint8Array): Promise<string> {
  const res = await fetch(`${BASE}/api/restore`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/octet-stream", ...csrfHeaders("POST") },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new ApiError(res.status, `Erreur ${res.status}`);
  return "Base restaurée";
}

export async function verifyContract(immatriculation: string): Promise<VerificationApiResponse> {
  return request<VerificationApiResponse>("GET", `/verify/${encodeURIComponent(immatriculation)}`);
}

export async function openExternalUrl(url: string): Promise<void> {
  window.open(url, "_blank", "noopener,noreferrer");
}

// ============ CLIENTS ============

export async function listClients(params: ListParams = {}): Promise<Client[]> {
  return request<Client[]>("GET", `/clients${qs({ ...params })}`);
}

export async function countClients(search?: string): Promise<number> {
  const res = await request<{ count: number }>("GET", `/clients/count${qs({ search })}`);
  return res.count;
}

export async function getClient(id: number): Promise<Client | undefined> {
  try {
    return await request<Client>("GET", `/clients/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createClient(data: ClientCreate): Promise<number> {
  return (await request<{ id: number }>("POST", "/clients", data)).id;
}

export async function updateClient(data: ClientUpdate): Promise<void> {
  await request<{ ok: true }>("PATCH", `/clients/${data.id}`, data);
}

export async function deleteClient(id: number): Promise<void> {
  await request<{ ok: true }>("DELETE", `/clients/${id}`);
}

// ============ VÉHICULES ============

export async function listVehicules(clientId?: number): Promise<Vehicule[]> {
  return request<Vehicule[]>("GET", `/vehicules${qs({ clientId })}`);
}

export async function getVehicule(id: number): Promise<Vehicule | undefined> {
  try {
    return await request<Vehicule>("GET", `/vehicules/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createVehicule(data: VehiculeCreate): Promise<number> {
  return (await request<{ id: number }>("POST", "/vehicules", data)).id;
}

export async function updateVehicule(data: VehiculeUpdate): Promise<void> {
  await request<{ ok: true }>("PATCH", `/vehicules/${data.id}`, data);
}

export async function deleteVehicule(id: number): Promise<void> {
  await request<{ ok: true }>("DELETE", `/vehicules/${id}`);
}

// ============ ASSUREURS ============

export async function listAssureurs(): Promise<Assureur[]> {
  return request<Assureur[]>("GET", "/assureurs");
}

export async function createAssureur(data: AssureurCreate): Promise<number> {
  return (await request<{ id: number }>("POST", "/assureurs", data)).id;
}

export async function updateAssureur(data: AssureurUpdate): Promise<void> {
  await request<{ ok: true }>("PATCH", `/assureurs/${data.id}`, data);
}

export async function deleteAssureur(id: number): Promise<void> {
  await request<{ ok: true }>("DELETE", `/assureurs/${id}`);
}

export async function listIntegrationOverview(): Promise<IntegrationOverview[]> {
  return request<IntegrationOverview[]>("GET", "/integrations/overview");
}

export async function listIntegrationExchangeLogs(limit = 20): Promise<IntegrationExchangeLog[]> {
  return request<IntegrationExchangeLog[]>("GET", `/integrations/logs${qs({ limit })}`);
}

export async function testAssureurIntegration(assureurId: number): Promise<void> {
  await request<{ ok: true }>("POST", `/integrations/${assureurId}/test`);
}

// ============ POLICES ============

export async function listPolices(filters?: {
  vehiculeId?: number;
  statut?: string;
  typeCarte?: string;
}): Promise<Police[]> {
  return request<Police[]>("GET", `/polices${qs({ ...(filters ?? {}) })}`);
}

export async function getPolice(id: number): Promise<Police | undefined> {
  try {
    return await request<Police>("GET", `/polices/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function createPolice(data: PoliceCreate): Promise<number> {
  return (await request<{ id: number }>("POST", "/polices", data)).id;
}

export async function updatePolice(data: PoliceUpdate): Promise<void> {
  await request<{ ok: true }>("PATCH", `/polices/${data.id}`, data);
}

export async function deletePolice(id: number): Promise<void> {
  await request<{ ok: true }>("DELETE", `/polices/${id}`);
}

export async function renewPolice(policeId: number): Promise<number> {
  return (await request<{ id: number }>("POST", `/polices/${policeId}/renew`)).id;
}

// ============ PAIEMENTS ============

export async function listPaiements(policeId?: number): Promise<Paiement[]> {
  return request<Paiement[]>("GET", `/paiements${qs({ policeId })}`);
}

export async function createPaiement(data: PaiementCreate): Promise<number> {
  return (await request<{ id: number }>("POST", "/paiements", data)).id;
}

export async function updatePaiement(data: PaiementUpdate): Promise<void> {
  await request<{ ok: true }>("PATCH", `/paiements/${data.id}`, data);
}

export async function deletePaiement(id: number): Promise<void> {
  await request<{ ok: true }>("DELETE", `/paiements/${id}`);
}

// ============ DOSSIER COMPLET ============

export async function createDossier(data: DossierCreate): Promise<DossierCreated> {
  return request<DossierCreated>("POST", "/dossiers", data);
}

// ============ DASHBOARD ============

export async function getEcheances30j(): Promise<EcheanceRow[]> {
  return request<EcheanceRow[]>("GET", "/dashboard/echeances30j");
}

export async function getEcheancesRange(params: {
  fromDays?: number;
  toDays?: number;
  expiredOnly?: boolean;
}): Promise<EcheanceRow[]> {
  return request<EcheanceRow[]>("GET", `/dashboard/echeances-range${qs({ ...params })}`);
}

export async function getImpayes(): Promise<ImpayeRow[]> {
  return request<ImpayeRow[]>("GET", "/dashboard/impayes");
}

export async function getDashboardKPI(): Promise<DashboardKPI> {
  return request<DashboardKPI>("GET", "/dashboard/kpi");
}

export async function getDashboardRecap(): Promise<DashboardRecapRow[]> {
  return request<DashboardRecapRow[]>("GET", "/dashboard/recap");
}
