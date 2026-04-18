/**
 * Wrapper typé pour les commandes IPC Tauri.
 * Les CRUD passent par tauri-plugin-sql (requêtes paramétrées).
 * Les commandes métier complexes passent par invoke().
 *
 * @module ipc
 */

import { invoke } from "@tauri-apps/api/core";
import type { Assureur, AssureurCreate, AssureurUpdate } from "../schemas/assureur";
import type { Client, ClientCreate, ClientUpdate } from "../schemas/client";
import type { Paiement, PaiementCreate, PaiementUpdate } from "../schemas/paiement";
import type { Police, PoliceCreate, PoliceUpdate } from "../schemas/police";
import type { Vehicule, VehiculeCreate, VehiculeUpdate } from "../schemas/vehicule";
import { execute, select, transaction } from "./db";

// ============ Commandes Rust (invoke) ============

/** Commande de test : salutation depuis le backend Rust. */
export async function greet(name: string): Promise<string> {
  return invoke<string>("greet", { name });
}

/** Lit le fichier SQLite de l'application et renvoie ses octets. */
export async function backupDatabase(): Promise<Uint8Array> {
  const arr = await invoke<number[]>("backup_database");
  return new Uint8Array(arr);
}

/** Remplace le fichier SQLite de l'application par les octets fournis. */
export async function restoreDatabase(bytes: Uint8Array): Promise<string> {
  return invoke<string>("restore_database", { bytes: Array.from(bytes) });
}

// ============ CLIENTS ============

/** Paramètres de pagination et recherche */
export interface ListParams {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
}

/** Liste les clients avec pagination et recherche optionnelle. */
export async function listClients(params: ListParams = {}): Promise<Client[]> {
  const { search, limit = 50, offset = 0, orderBy = "nom_prenom", orderDir = "ASC" } = params;
  let query = "SELECT * FROM clients";
  const binds: unknown[] = [];

  if (search) {
    query += " WHERE nom_prenom LIKE ? OR telephone LIKE ? OR email LIKE ?";
    const pattern = `%${search}%`;
    binds.push(pattern, pattern, pattern);
  }

  query += ` ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  return select<Client>(query, binds);
}

/** Compte le nombre total de clients (avec recherche optionnelle). */
export async function countClients(search?: string): Promise<number> {
  let query = "SELECT COUNT(*) as count FROM clients";
  const binds: unknown[] = [];

  if (search) {
    query += " WHERE nom_prenom LIKE ? OR telephone LIKE ? OR email LIKE ?";
    const pattern = `%${search}%`;
    binds.push(pattern, pattern, pattern);
  }

  const result = await select<{ count: number }>(query, binds);
  return result[0]?.count ?? 0;
}

/** Récupère un client par son ID. */
export async function getClient(id: number): Promise<Client | undefined> {
  const result = await select<Client>("SELECT * FROM clients WHERE id = ?", [id]);
  return result[0];
}

/** Crée un nouveau client. */
export async function createClient(data: ClientCreate): Promise<number> {
  const result = await execute(
    "INSERT INTO clients (nom_prenom, adresse, telephone, email, notes) VALUES (?, ?, ?, ?, ?)",
    [
      data.nomPrenom,
      data.adresse ?? null,
      data.telephone ?? null,
      data.email ?? null,
      data.notes ?? null,
    ],
  );
  return result.lastInsertId ?? 0;
}

/** Met à jour un client existant. */
export async function updateClient(data: ClientUpdate): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];

  if (data.nomPrenom !== undefined) {
    fields.push("nom_prenom = ?");
    binds.push(data.nomPrenom);
  }
  if (data.adresse !== undefined) {
    fields.push("adresse = ?");
    binds.push(data.adresse);
  }
  if (data.telephone !== undefined) {
    fields.push("telephone = ?");
    binds.push(data.telephone);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    binds.push(data.email);
  }
  if (data.notes !== undefined) {
    fields.push("notes = ?");
    binds.push(data.notes);
  }

  if (fields.length === 0) return;

  binds.push(data.id);
  await execute(`UPDATE clients SET ${fields.join(", ")} WHERE id = ?`, binds);
}

/** Supprime un client par son ID (cascade sur véhicules et polices). */
export async function deleteClient(id: number): Promise<void> {
  await execute("DELETE FROM clients WHERE id = ?", [id]);
}

// ============ VÉHICULES ============

/** Liste les véhicules (optionnellement filtrés par client). */
export async function listVehicules(clientId?: number): Promise<Vehicule[]> {
  if (clientId) {
    return select<Vehicule>(
      "SELECT * FROM vehicules WHERE client_id = ? ORDER BY immatriculation",
      [clientId],
    );
  }
  return select<Vehicule>("SELECT * FROM vehicules ORDER BY immatriculation");
}

/** Récupère un véhicule par son ID. */
export async function getVehicule(id: number): Promise<Vehicule | undefined> {
  const result = await select<Vehicule>("SELECT * FROM vehicules WHERE id = ?", [id]);
  return result[0];
}

/** Crée un nouveau véhicule. */
export async function createVehicule(data: VehiculeCreate): Promise<number> {
  const result = await execute(
    `INSERT INTO vehicules (client_id, immatriculation, marque, modele, genre, type_vehicule, puissance, places)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.clientId,
      data.immatriculation,
      data.marque ?? null,
      data.modele ?? null,
      data.genre ?? null,
      data.typeVehicule ?? null,
      data.puissance ?? null,
      data.places ?? null,
    ],
  );
  return result.lastInsertId ?? 0;
}

/** Met à jour un véhicule existant. */
export async function updateVehicule(data: VehiculeUpdate): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];

  if (data.clientId !== undefined) {
    fields.push("client_id = ?");
    binds.push(data.clientId);
  }
  if (data.immatriculation !== undefined) {
    fields.push("immatriculation = ?");
    binds.push(data.immatriculation);
  }
  if (data.marque !== undefined) {
    fields.push("marque = ?");
    binds.push(data.marque);
  }
  if (data.modele !== undefined) {
    fields.push("modele = ?");
    binds.push(data.modele);
  }
  if (data.genre !== undefined) {
    fields.push("genre = ?");
    binds.push(data.genre);
  }
  if (data.typeVehicule !== undefined) {
    fields.push("type_vehicule = ?");
    binds.push(data.typeVehicule);
  }
  if (data.puissance !== undefined) {
    fields.push("puissance = ?");
    binds.push(data.puissance);
  }
  if (data.places !== undefined) {
    fields.push("places = ?");
    binds.push(data.places);
  }

  if (fields.length === 0) return;
  binds.push(data.id);
  await execute(`UPDATE vehicules SET ${fields.join(", ")} WHERE id = ?`, binds);
}

/** Supprime un véhicule. */
export async function deleteVehicule(id: number): Promise<void> {
  await execute("DELETE FROM vehicules WHERE id = ?", [id]);
}

// ============ ASSUREURS ============

/** Liste tous les assureurs. */
export async function listAssureurs(): Promise<Assureur[]> {
  return select<Assureur>("SELECT * FROM assureurs ORDER BY nom");
}

/** Crée un assureur. */
export async function createAssureur(data: AssureurCreate): Promise<number> {
  const result = await execute("INSERT INTO assureurs (nom, contact, adresse) VALUES (?, ?, ?)", [
    data.nom,
    data.contact ?? null,
    data.adresse ?? null,
  ]);
  return result.lastInsertId ?? 0;
}

/** Met à jour un assureur. */
export async function updateAssureur(data: AssureurUpdate): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];

  if (data.nom !== undefined) {
    fields.push("nom = ?");
    binds.push(data.nom);
  }
  if (data.contact !== undefined) {
    fields.push("contact = ?");
    binds.push(data.contact);
  }
  if (data.adresse !== undefined) {
    fields.push("adresse = ?");
    binds.push(data.adresse);
  }

  if (fields.length === 0) return;
  binds.push(data.id);
  await execute(`UPDATE assureurs SET ${fields.join(", ")} WHERE id = ?`, binds);
}

/** Supprime un assureur. */
export async function deleteAssureur(id: number): Promise<void> {
  await execute("DELETE FROM assureurs WHERE id = ?", [id]);
}

// ============ POLICES ============

/** Liste les polices (optionnellement filtrées par véhicule ou statut). */
export async function listPolices(filters?: {
  vehiculeId?: number;
  statut?: string;
  typeCarte?: string;
}): Promise<Police[]> {
  let query = "SELECT * FROM polices WHERE 1=1";
  const binds: unknown[] = [];

  if (filters?.vehiculeId) {
    query += " AND vehicule_id = ?";
    binds.push(filters.vehiculeId);
  }
  if (filters?.statut) {
    query += " AND statut = ?";
    binds.push(filters.statut);
  }
  if (filters?.typeCarte) {
    query += " AND type_carte = ?";
    binds.push(filters.typeCarte);
  }

  query += " ORDER BY date_echeance DESC";
  return select<Police>(query, binds);
}

/** Récupère une police par son ID. */
export async function getPolice(id: number): Promise<Police | undefined> {
  const result = await select<Police>("SELECT * FROM polices WHERE id = ?", [id]);
  return result[0];
}

/** Crée une police. */
export async function createPolice(data: PoliceCreate): Promise<number> {
  const result = await execute(
    `INSERT INTO polices (vehicule_id, assureur_id, numero_police, type_carte, date_effet, duree_mois, appreciation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.vehiculeId,
      data.assureurId ?? null,
      data.numeroPolice ?? null,
      data.typeCarte,
      data.dateEffet,
      data.dureeMois,
      data.appreciation ?? null,
    ],
  );
  return result.lastInsertId ?? 0;
}

/** Met à jour une police. */
export async function updatePolice(data: PoliceUpdate): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];

  if (data.vehiculeId !== undefined) {
    fields.push("vehicule_id = ?");
    binds.push(data.vehiculeId);
  }
  if (data.assureurId !== undefined) {
    fields.push("assureur_id = ?");
    binds.push(data.assureurId);
  }
  if (data.numeroPolice !== undefined) {
    fields.push("numero_police = ?");
    binds.push(data.numeroPolice);
  }
  if (data.typeCarte !== undefined) {
    fields.push("type_carte = ?");
    binds.push(data.typeCarte);
  }
  if (data.dateEffet !== undefined) {
    fields.push("date_effet = ?");
    binds.push(data.dateEffet);
  }
  if (data.dureeMois !== undefined) {
    fields.push("duree_mois = ?");
    binds.push(data.dureeMois);
  }
  if (data.appreciation !== undefined) {
    fields.push("appreciation = ?");
    binds.push(data.appreciation);
  }
  if (data.statut !== undefined) {
    fields.push("statut = ?");
    binds.push(data.statut);
  }

  if (fields.length === 0) return;
  binds.push(data.id);
  await execute(`UPDATE polices SET ${fields.join(", ")} WHERE id = ?`, binds);
}

/** Supprime une police. */
export async function deletePolice(id: number): Promise<void> {
  await execute("DELETE FROM polices WHERE id = ?", [id]);
}

/**
 * Renouvelle une police : crée une nouvelle police avec date_effet = ancienne_echeance + 1 jour.
 * Marque l'ancienne police comme RENOUVELÉE.
 */
export async function renewPolice(policeId: number): Promise<number> {
  return transaction(async ({ execute: exec, select: sel }) => {
    const [old] = await sel<Police>("SELECT * FROM polices WHERE id = ?", [policeId]);
    if (!old) throw new Error(`Police ${policeId} introuvable`);
    if (!old.date_echeance) throw new Error("Date d'échéance manquante");

    // Nouvelle date d'effet = ancienne échéance + 1 jour
    const [newDate] = await sel<{ d: string }>("SELECT date(?, '+1 day') as d", [
      old.date_echeance,
    ]);
    if (!newDate) throw new Error("Erreur calcul date");

    // Créer la nouvelle police
    const result = await exec(
      `INSERT INTO polices (vehicule_id, assureur_id, numero_police, type_carte, date_effet, duree_mois, appreciation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        old.vehicule_id,
        old.assureur_id,
        null,
        old.type_carte,
        newDate.d,
        old.duree_mois,
        old.appreciation,
      ],
    );

    // Marquer l'ancienne comme renouvelée
    await exec("UPDATE polices SET statut = 'RENOUVELÉE' WHERE id = ?", [policeId]);

    return result.lastInsertId ?? 0;
  });
}

// ============ PAIEMENTS ============

/** Liste les paiements (optionnellement filtrés par police). */
export async function listPaiements(policeId?: number): Promise<Paiement[]> {
  if (policeId) {
    return select<Paiement>(
      "SELECT * FROM paiements WHERE police_id = ? ORDER BY created_at DESC",
      [policeId],
    );
  }
  return select<Paiement>("SELECT * FROM paiements ORDER BY created_at DESC");
}

/** Crée un paiement. */
export async function createPaiement(data: PaiementCreate): Promise<number> {
  const result = await execute(
    `INSERT INTO paiements (police_id, montant_du, paye, avance, date_paiement, mode, reference, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.policeId,
      data.montantDu,
      data.paye ?? 0,
      data.avance ?? 0,
      data.datePaiement ?? null,
      data.mode ?? null,
      data.reference ?? null,
      data.notes ?? null,
    ],
  );
  return result.lastInsertId ?? 0;
}

/** Met à jour un paiement. */
export async function updatePaiement(data: PaiementUpdate): Promise<void> {
  const fields: string[] = [];
  const binds: unknown[] = [];

  if (data.policeId !== undefined) {
    fields.push("police_id = ?");
    binds.push(data.policeId);
  }
  if (data.montantDu !== undefined) {
    fields.push("montant_du = ?");
    binds.push(data.montantDu);
  }
  if (data.paye !== undefined) {
    fields.push("paye = ?");
    binds.push(data.paye);
  }
  if (data.avance !== undefined) {
    fields.push("avance = ?");
    binds.push(data.avance);
  }
  if (data.datePaiement !== undefined) {
    fields.push("date_paiement = ?");
    binds.push(data.datePaiement);
  }
  if (data.mode !== undefined) {
    fields.push("mode = ?");
    binds.push(data.mode);
  }
  if (data.reference !== undefined) {
    fields.push("reference = ?");
    binds.push(data.reference);
  }
  if (data.notes !== undefined) {
    fields.push("notes = ?");
    binds.push(data.notes);
  }

  if (fields.length === 0) return;
  binds.push(data.id);
  await execute(`UPDATE paiements SET ${fields.join(", ")} WHERE id = ?`, binds);
}

/** Supprime un paiement. */
export async function deletePaiement(id: number): Promise<void> {
  await execute("DELETE FROM paiements WHERE id = ?", [id]);
}

// ============ DASHBOARD (vues SQL) ============

/** Données d'échéance enrichie (vue v_echeances_30j) */
export interface EcheanceRow {
  id: number;
  nom_prenom: string;
  telephone: string | null;
  immatriculation: string;
  marque: string | null;
  date_effet: string;
  date_echeance: string;
  type_carte: string;
  numero_police: string | null;
  jours_restants: number;
}

/** Données d'impayé (vue v_impayes) */
export interface ImpayeRow {
  id: number;
  nom_prenom: string;
  immatriculation: string;
  numero_police: string | null;
  montant_du: number;
  paye: number;
  reste: number;
  date_echeance: string | null;
}

/** Récupère les échéances dans la fenêtre -7 à +30 jours. */
export async function getEcheances30j(): Promise<EcheanceRow[]> {
  return select<EcheanceRow>("SELECT * FROM v_echeances_30j");
}

/**
 * Récupère les échéances dans une fenêtre personnalisée (en jours par rapport à aujourd'hui).
 * `fromDays` et `toDays` sont relatifs à la date du jour (ex: -30 = il y a 30j, +60 = dans 60j).
 * Si `expiredOnly` est vrai, renvoie uniquement les polices ACTIVES échues (< aujourd'hui).
 */
export async function getEcheancesRange(params: {
  fromDays?: number;
  toDays?: number;
  expiredOnly?: boolean;
}): Promise<EcheanceRow[]> {
  const { fromDays, toDays, expiredOnly } = params;

  let where = "p.statut = 'ACTIVE'";
  const binds: unknown[] = [];

  if (expiredOnly) {
    where += " AND date(p.date_echeance) < date('now')";
  } else {
    if (fromDays !== undefined) {
      where += ` AND date(p.date_echeance) >= date('now', ?)`;
      binds.push(`${fromDays >= 0 ? "+" : ""}${fromDays} days`);
    }
    if (toDays !== undefined) {
      where += ` AND date(p.date_echeance) <= date('now', ?)`;
      binds.push(`${toDays >= 0 ? "+" : ""}${toDays} days`);
    }
  }

  const query = `
    SELECT p.id, c.nom_prenom, c.telephone, v.immatriculation, v.marque,
           p.date_effet, p.date_echeance, p.type_carte, p.numero_police,
           CAST(julianday(p.date_echeance) - julianday('now') AS INTEGER) AS jours_restants
    FROM polices p
    JOIN vehicules v ON v.id = p.vehicule_id
    JOIN clients   c ON c.id = v.client_id
    WHERE ${where}
    ORDER BY p.date_echeance ASC
  `;

  return select<EcheanceRow>(query, binds);
}

/** Récupère la liste des impayés. */
export async function getImpayes(): Promise<ImpayeRow[]> {
  return select<ImpayeRow>("SELECT * FROM v_impayes");
}

/** KPI du dashboard */
export interface DashboardKPI {
  policesActives: number;
  echeances30j: number;
  totalImpayes: number;
  nouveauxClientsMois: number;
}

/** Récupère les KPI pour le dashboard. */
export async function getDashboardKPI(): Promise<DashboardKPI> {
  const [actives] = await select<{ count: number }>(
    "SELECT COUNT(*) as count FROM polices WHERE statut = 'ACTIVE'",
  );
  const [echeances] = await select<{ count: number }>(
    "SELECT COUNT(*) as count FROM v_echeances_30j",
  );
  const [impayes] = await select<{ total: number }>(
    "SELECT COALESCE(SUM(reste), 0) as total FROM v_impayes",
  );
  const [nouveaux] = await select<{ count: number }>(
    "SELECT COUNT(*) as count FROM clients WHERE created_at >= date('now', 'start of month')",
  );

  return {
    policesActives: actives?.count ?? 0,
    echeances30j: echeances?.count ?? 0,
    totalImpayes: impayes?.total ?? 0,
    nouveauxClientsMois: nouveaux?.count ?? 0,
  };
}
