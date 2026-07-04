/**
 * Couche métier : portage 1:1 de src/lib/ipc.ts (desktop) vers better-sqlite3.
 * Le SQL est identique ; seuls les appels passent de l'IPC Tauri asynchrone
 * aux méthodes synchrones de better-sqlite3. Chaque fonction opère sur la
 * base d'UN utilisateur (tenant) passée en premier argument.
 *
 * @module db/queries
 */

import type Database from "better-sqlite3";
import type {
  AssureurCreateInput,
  AssureurUpdateInput,
  ClientCreateInput,
  ClientUpdateInput,
  DossierCreateInput,
  PaiementCreateInput,
  PaiementUpdateInput,
  PoliceCreateInput,
  PoliceUpdateInput,
  VehiculeCreateInput,
  VehiculeUpdateInput,
} from "../schemas.js";

type Db = Database.Database;

// ============ Types de lignes (lecture) ============

export interface ClientRow {
  id: number;
  nom_prenom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface VehiculeRow {
  id: number;
  client_id: number;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  genre: string | null;
  type_vehicule: string | null;
  puissance: number | null;
  places: number | null;
  created_at: string | null;
}

export interface AssureurRow {
  id: number;
  nom: string;
  contact: string | null;
  adresse: string | null;
  code: string | null;
  integration_type: "MANUAL" | "MOCK" | "API" | null;
  api_base_url: string | null;
  portal_url: string | null;
  technical_contact: string | null;
  integration_enabled: number | null;
  last_connection_status: string | null;
  last_connection_at: string | null;
}

export interface PoliceRow {
  id: number;
  vehicule_id: number;
  assureur_id: number | null;
  numero_police: string | null;
  type_carte: string;
  date_effet: string;
  duree_mois: number;
  date_echeance: string | null;
  appreciation: string | null;
  statut: string | null;
  external_reference: string | null;
  integration_status: string | null;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaiementRow {
  id: number;
  police_id: number;
  montant_du: number;
  paye: number;
  avance: number;
  reste: number | null;
  date_paiement: string | null;
  mode: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string | null;
}

// ============ CLIENTS ============

export interface ListClientsParams {
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  orderBy?: string | undefined;
  orderDir?: "ASC" | "DESC" | undefined;
}

const CLIENT_ORDER_COLUMNS = new Set(["nom_prenom", "created_at", "telephone", "email"]);

export function listClients(db: Db, params: ListClientsParams = {}): ClientRow[] {
  const { search, limit = 50, offset = 0, orderBy = "nom_prenom", orderDir = "ASC" } = params;
  // Liste blanche : orderBy est interpolé, jamais paramétrable en SQL.
  const col = CLIENT_ORDER_COLUMNS.has(orderBy) ? orderBy : "nom_prenom";
  const dir = orderDir === "DESC" ? "DESC" : "ASC";

  let query = "SELECT * FROM clients";
  const binds: unknown[] = [];
  if (search) {
    query += " WHERE nom_prenom LIKE ? OR telephone LIKE ? OR email LIKE ?";
    const pattern = `%${search}%`;
    binds.push(pattern, pattern, pattern);
  }
  query += ` ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  return db.prepare(query).all(...binds) as ClientRow[];
}

export function countClients(db: Db, search?: string): number {
  let query = "SELECT COUNT(*) as count FROM clients";
  const binds: unknown[] = [];
  if (search) {
    query += " WHERE nom_prenom LIKE ? OR telephone LIKE ? OR email LIKE ?";
    const pattern = `%${search}%`;
    binds.push(pattern, pattern, pattern);
  }
  const row = db.prepare(query).get(...binds) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getClient(db: Db, id: number): ClientRow | undefined {
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as ClientRow | undefined;
}

export function createClient(db: Db, data: ClientCreateInput): number {
  const result = db
    .prepare(
      "INSERT INTO clients (nom_prenom, adresse, telephone, email, notes) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      data.nomPrenom,
      data.adresse ?? null,
      data.telephone ?? null,
      data.email ?? null,
      data.notes ?? null,
    );
  return Number(result.lastInsertRowid);
}

export function updateClient(db: Db, data: ClientUpdateInput): void {
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
  db.prepare(`UPDATE clients SET ${fields.join(", ")} WHERE id = ?`).run(...binds);
}

export function deleteClient(db: Db, id: number): void {
  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
}

// ============ VÉHICULES ============

export function listVehicules(db: Db, clientId?: number): VehiculeRow[] {
  if (clientId) {
    return db
      .prepare("SELECT * FROM vehicules WHERE client_id = ? ORDER BY immatriculation")
      .all(clientId) as VehiculeRow[];
  }
  return db.prepare("SELECT * FROM vehicules ORDER BY immatriculation").all() as VehiculeRow[];
}

export function getVehicule(db: Db, id: number): VehiculeRow | undefined {
  return db.prepare("SELECT * FROM vehicules WHERE id = ?").get(id) as VehiculeRow | undefined;
}

export function createVehicule(db: Db, data: VehiculeCreateInput): number {
  const result = db
    .prepare(
      `INSERT INTO vehicules (client_id, immatriculation, marque, modele, genre, type_vehicule, puissance, places)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.clientId,
      data.immatriculation,
      data.marque ?? null,
      data.modele ?? null,
      data.genre ?? null,
      data.typeVehicule ?? null,
      data.puissance ?? null,
      data.places ?? null,
    );
  return Number(result.lastInsertRowid);
}

export function updateVehicule(db: Db, data: VehiculeUpdateInput): void {
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
  db.prepare(`UPDATE vehicules SET ${fields.join(", ")} WHERE id = ?`).run(...binds);
}

export function deleteVehicule(db: Db, id: number): void {
  db.prepare("DELETE FROM vehicules WHERE id = ?").run(id);
}

// ============ ASSUREURS ============

export function listAssureurs(db: Db): AssureurRow[] {
  return db.prepare("SELECT * FROM assureurs ORDER BY nom").all() as AssureurRow[];
}

export function createAssureur(db: Db, data: AssureurCreateInput): number {
  const result = db
    .prepare(
      `INSERT INTO assureurs (
        nom, contact, adresse, code, integration_type, api_base_url, portal_url,
        technical_contact, integration_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.nom,
      data.contact ?? null,
      data.adresse ?? null,
      data.code ?? null,
      data.integrationType ?? "MANUAL",
      data.apiBaseUrl ?? null,
      data.portalUrl ?? null,
      data.technicalContact ?? null,
      data.integrationEnabled ? 1 : 0,
    );
  return Number(result.lastInsertRowid);
}

export function updateAssureur(db: Db, data: AssureurUpdateInput): void {
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
  if (data.code !== undefined) {
    fields.push("code = ?");
    binds.push(data.code);
  }
  if (data.integrationType !== undefined) {
    fields.push("integration_type = ?");
    binds.push(data.integrationType);
  }
  if (data.apiBaseUrl !== undefined) {
    fields.push("api_base_url = ?");
    binds.push(data.apiBaseUrl);
  }
  if (data.portalUrl !== undefined) {
    fields.push("portal_url = ?");
    binds.push(data.portalUrl);
  }
  if (data.technicalContact !== undefined) {
    fields.push("technical_contact = ?");
    binds.push(data.technicalContact);
  }
  if (data.integrationEnabled !== undefined) {
    fields.push("integration_enabled = ?");
    binds.push(data.integrationEnabled ? 1 : 0);
  }
  if (fields.length === 0) return;
  binds.push(data.id);
  db.prepare(`UPDATE assureurs SET ${fields.join(", ")} WHERE id = ?`).run(...binds);
}

export function deleteAssureur(db: Db, id: number): void {
  db.prepare("DELETE FROM assureurs WHERE id = ?").run(id);
}

export interface IntegrationOverviewRow {
  assureur_id: number;
  nom: string;
  code: string | null;
  integration_type: "MANUAL" | "MOCK" | "API" | null;
  api_base_url: string | null;
  portal_url: string | null;
  technical_contact: string | null;
  integration_enabled: number | null;
  last_connection_status: string | null;
  last_connection_at: string | null;
  total_polices: number;
  synced_polices: number;
  error_polices: number;
  last_exchange_at: string | null;
  last_error: string | null;
}

export function listIntegrationOverview(db: Db): IntegrationOverviewRow[] {
  return db
    .prepare(`
    SELECT
      a.id AS assureur_id, a.nom, a.code, a.integration_type, a.api_base_url,
      a.portal_url, a.technical_contact, a.integration_enabled,
      a.last_connection_status, a.last_connection_at,
      COUNT(p.id) AS total_polices,
      SUM(CASE WHEN p.integration_status = 'SYNCED' THEN 1 ELSE 0 END) AS synced_polices,
      SUM(CASE WHEN p.integration_status = 'ERROR' THEN 1 ELSE 0 END) AS error_polices,
      MAX(l.created_at) AS last_exchange_at,
      (
        SELECT l2.error_message FROM integration_exchange_logs l2
        WHERE l2.assureur_id = a.id AND l2.error_message IS NOT NULL
        ORDER BY l2.created_at DESC LIMIT 1
      ) AS last_error
    FROM assureurs a
    LEFT JOIN polices p ON p.assureur_id = a.id
    LEFT JOIN integration_exchange_logs l ON l.assureur_id = a.id
    GROUP BY a.id
    ORDER BY a.nom ASC
  `)
    .all() as IntegrationOverviewRow[];
}

export interface IntegrationExchangeLogRow {
  id: number;
  assureur_id: number | null;
  police_id: number | null;
  assureur_nom: string | null;
  action: string;
  direction: "IN" | "OUT";
  status: "SUCCESS" | "ERROR" | "PENDING";
  request_payload: string | null;
  response_payload: string | null;
  external_reference: string | null;
  error_message: string | null;
  created_at: string | null;
}

export function listIntegrationExchangeLogs(db: Db, limit = 20): IntegrationExchangeLogRow[] {
  return db
    .prepare(`
    SELECT l.*, a.nom AS assureur_nom
    FROM integration_exchange_logs l
    LEFT JOIN assureurs a ON a.id = l.assureur_id
    ORDER BY l.created_at DESC
    LIMIT ?`)
    .all(limit) as IntegrationExchangeLogRow[];
}

/** Teste (à blanc) l'intégration d'un assureur et journalise l'échange. */
export function testAssureurIntegration(db: Db, assureurId: number): void {
  const assureur = db.prepare("SELECT * FROM assureurs WHERE id = ?").get(assureurId) as
    | AssureurRow
    | undefined;
  if (!assureur) throw new Error(`Assureur ${assureurId} introuvable`);

  const integrationType = assureur.integration_type ?? "MANUAL";
  const now = new Date().toISOString();

  if (integrationType === "API") {
    const error = assureur.api_base_url
      ? "Connecteur API réel non implémenté pour cette compagnie."
      : "URL API manquante pour cette compagnie.";
    db.prepare(
      `INSERT INTO integration_exchange_logs (assureur_id, action, direction, status, request_payload, error_message)
       VALUES (?, 'TEST_CONNECTION', 'OUT', 'ERROR', ?, ?)`,
    ).run(assureurId, JSON.stringify({ apiBaseUrl: assureur.api_base_url }), error);
    db.prepare(
      "UPDATE assureurs SET last_connection_status = ?, last_connection_at = ? WHERE id = ?",
    ).run("ERROR", now, assureurId);
    throw new Error(error);
  }

  const status = integrationType === "MOCK" ? "SUCCESS" : "PENDING";
  const message =
    integrationType === "MOCK"
      ? "Connecteur mock disponible."
      : "Mode manuel : aucune API à tester.";

  db.prepare(
    `INSERT INTO integration_exchange_logs (assureur_id, action, direction, status, request_payload, response_payload)
     VALUES (?, 'TEST_CONNECTION', 'OUT', ?, ?, ?)`,
  ).run(
    assureurId,
    status,
    JSON.stringify({ integrationType }),
    JSON.stringify({ message, checkedAt: now }),
  );
  db.prepare(
    "UPDATE assureurs SET last_connection_status = ?, last_connection_at = ? WHERE id = ?",
  ).run(status, now, assureurId);
}

// ============ POLICES ============

export interface ListPolicesFilters {
  vehiculeId?: number | undefined;
  statut?: string | undefined;
  typeCarte?: string | undefined;
}

export function listPolices(db: Db, filters?: ListPolicesFilters): PoliceRow[] {
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
  return db.prepare(query).all(...binds) as PoliceRow[];
}

export function getPolice(db: Db, id: number): PoliceRow | undefined {
  return db.prepare("SELECT * FROM polices WHERE id = ?").get(id) as PoliceRow | undefined;
}

export function createPolice(db: Db, data: PoliceCreateInput): number {
  const result = db
    .prepare(
      `INSERT INTO polices (
        vehicule_id, assureur_id, numero_police, type_carte, date_effet, duree_mois,
        appreciation, external_reference, integration_status, sync_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.vehiculeId,
      data.assureurId ?? null,
      data.numeroPolice ?? null,
      data.typeCarte,
      data.dateEffet,
      data.dureeMois,
      data.appreciation ?? null,
      data.externalReference ?? null,
      data.integrationStatus ?? "LOCAL",
      data.syncError ?? null,
    );
  return Number(result.lastInsertRowid);
}

export function updatePolice(db: Db, data: PoliceUpdateInput): void {
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
  if (data.externalReference !== undefined) {
    fields.push("external_reference = ?");
    binds.push(data.externalReference);
  }
  if (data.integrationStatus !== undefined) {
    fields.push("integration_status = ?");
    binds.push(data.integrationStatus);
  }
  if (data.syncError !== undefined) {
    fields.push("sync_error = ?");
    binds.push(data.syncError);
  }
  if (fields.length === 0) return;
  binds.push(data.id);
  db.prepare(`UPDATE polices SET ${fields.join(", ")} WHERE id = ?`).run(...binds);
}

export function deletePolice(db: Db, id: number): void {
  db.prepare("DELETE FROM polices WHERE id = ?").run(id);
}

/**
 * Renouvelle une police : nouvelle police à date_effet = ancienne échéance + 1
 * jour, ancienne marquée RENOUVELÉE. Transactionnel.
 */
export function renewPolice(db: Db, policeId: number): number {
  const tx = db.transaction((id: number) => {
    const old = db.prepare("SELECT * FROM polices WHERE id = ?").get(id) as PoliceRow | undefined;
    if (!old) throw new Error(`Police ${id} introuvable`);
    if (!old.date_echeance) throw new Error("Date d'échéance manquante");

    const newDate = db.prepare("SELECT date(?, '+1 day') as d").get(old.date_echeance) as
      | { d: string }
      | undefined;
    if (!newDate) throw new Error("Erreur calcul date");

    const result = db
      .prepare(
        `INSERT INTO polices (vehicule_id, assureur_id, numero_police, type_carte, date_effet, duree_mois, appreciation)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        old.vehicule_id,
        old.assureur_id,
        null,
        old.type_carte,
        newDate.d,
        old.duree_mois,
        old.appreciation,
      );

    db.prepare("UPDATE polices SET statut = 'RENOUVELÉE' WHERE id = ?").run(id);
    return Number(result.lastInsertRowid);
  });
  return tx(policeId);
}

// ============ PAIEMENTS ============

export function listPaiements(db: Db, policeId?: number): PaiementRow[] {
  if (policeId) {
    return db
      .prepare("SELECT * FROM paiements WHERE police_id = ? ORDER BY created_at DESC")
      .all(policeId) as PaiementRow[];
  }
  return db.prepare("SELECT * FROM paiements ORDER BY created_at DESC").all() as PaiementRow[];
}

export function createPaiement(db: Db, data: PaiementCreateInput): number {
  const result = db
    .prepare(
      `INSERT INTO paiements (police_id, montant_du, paye, avance, date_paiement, mode, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.policeId,
      data.montantDu,
      data.paye ?? 0,
      data.avance ?? 0,
      data.datePaiement ?? null,
      data.mode ?? null,
      data.reference ?? null,
      data.notes ?? null,
    );
  return Number(result.lastInsertRowid);
}

export function updatePaiement(db: Db, data: PaiementUpdateInput): void {
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
  db.prepare(`UPDATE paiements SET ${fields.join(", ")} WHERE id = ?`).run(...binds);
}

export function deletePaiement(db: Db, id: number): void {
  db.prepare("DELETE FROM paiements WHERE id = ?").run(id);
}

// ============ DOSSIER COMPLET ============

export interface DossierCreated {
  clientId: number;
  vehiculeId: number;
  policeId: number;
  paiementId: number | null;
}

/** Enregistre un dossier complet (client + véhicule + police + paiement) en une transaction. */
export function createDossier(db: Db, data: DossierCreateInput): DossierCreated {
  const tx = db.transaction((): DossierCreated => {
    const clientId =
      data.client.mode === "existant" ? data.client.clientId : createClient(db, data.client.data);

    const vehiculeId =
      data.vehicule.mode === "existant"
        ? data.vehicule.vehiculeId
        : createVehicule(db, { ...data.vehicule.data, clientId });

    const policeId = createPolice(db, { ...data.police, vehiculeId });

    let paiementId: number | null = null;
    if (data.paiement) {
      paiementId = createPaiement(db, { ...data.paiement, policeId });
    }
    return { clientId, vehiculeId, policeId, paiementId };
  });
  return tx();
}

// ============ DASHBOARD (vues SQL) ============

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

export function getEcheances30j(db: Db): EcheanceRow[] {
  return db.prepare("SELECT * FROM v_echeances_30j").all() as EcheanceRow[];
}

export interface EcheancesRangeParams {
  fromDays?: number | undefined;
  toDays?: number | undefined;
  expiredOnly?: boolean | undefined;
}

export function getEcheancesRange(db: Db, params: EcheancesRangeParams): EcheanceRow[] {
  const { fromDays, toDays, expiredOnly } = params;
  let where = "p.statut = 'ACTIVE'";
  const binds: unknown[] = [];

  if (expiredOnly) {
    where += " AND date(p.date_echeance) < date('now')";
  } else {
    if (fromDays !== undefined) {
      where += " AND date(p.date_echeance) >= date('now', ?)";
      binds.push(`${fromDays >= 0 ? "+" : ""}${fromDays} days`);
    }
    if (toDays !== undefined) {
      where += " AND date(p.date_echeance) <= date('now', ?)";
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
  return db.prepare(query).all(...binds) as EcheanceRow[];
}

export function getImpayes(db: Db): ImpayeRow[] {
  return db.prepare("SELECT * FROM v_impayes").all() as ImpayeRow[];
}

export interface DashboardKPI {
  policesActives: number;
  echeances30j: number;
  totalImpayes: number;
  nouveauxClientsMois: number;
}

export function getDashboardKPI(db: Db): DashboardKPI {
  const actives = db
    .prepare("SELECT COUNT(*) as count FROM polices WHERE statut = 'ACTIVE'")
    .get() as { count: number } | undefined;
  const echeances = db.prepare("SELECT COUNT(*) as count FROM v_echeances_30j").get() as
    | { count: number }
    | undefined;
  const impayes = db.prepare("SELECT COALESCE(SUM(reste), 0) as total FROM v_impayes").get() as
    | { total: number }
    | undefined;
  const nouveaux = db
    .prepare(
      "SELECT COUNT(*) as count FROM clients WHERE created_at >= date('now', 'start of month')",
    )
    .get() as { count: number } | undefined;

  return {
    policesActives: actives?.count ?? 0,
    echeances30j: echeances?.count ?? 0,
    totalImpayes: impayes?.total ?? 0,
    nouveauxClientsMois: nouveaux?.count ?? 0,
  };
}

export interface DashboardRecapRow {
  client_id: number;
  vehicule_id: number;
  police_id: number | null;
  nom_prenom: string;
  telephone: string | null;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  numero_police: string | null;
  type_carte: string | null;
  date_effet: string | null;
  date_echeance: string | null;
  police_statut: string | null;
  assureur_nom: string | null;
  paiements_count: number;
  montant_du_total: number;
  paye_total: number;
  avance_total: number;
  reste_total: number;
  derniere_date_paiement: string | null;
}

export function getDashboardRecap(db: Db): DashboardRecapRow[] {
  return db
    .prepare(`
    SELECT
      c.id AS client_id,
      v.id AS vehicule_id,
      p.id AS police_id,
      c.nom_prenom,
      c.telephone,
      v.immatriculation,
      v.marque,
      v.modele,
      p.numero_police,
      p.type_carte,
      p.date_effet,
      p.date_echeance,
      p.statut AS police_statut,
      a.nom AS assureur_nom,
      COUNT(pa.id) AS paiements_count,
      COALESCE(SUM(pa.montant_du), 0) AS montant_du_total,
      COALESCE(SUM(pa.paye), 0) AS paye_total,
      COALESCE(SUM(pa.avance), 0) AS avance_total,
      COALESCE(SUM(pa.reste), 0) AS reste_total,
      MAX(pa.date_paiement) AS derniere_date_paiement
    FROM clients c
    JOIN vehicules v ON v.client_id = c.id
    LEFT JOIN polices p ON p.vehicule_id = v.id
    LEFT JOIN assureurs a ON a.id = p.assureur_id
    LEFT JOIN paiements pa ON pa.police_id = p.id
    GROUP BY
      c.id, v.id, p.id, c.nom_prenom, c.telephone, v.immatriculation, v.marque,
      v.modele, p.numero_police, p.type_carte, p.date_effet, p.date_echeance, p.statut, a.nom
    ORDER BY
      CASE WHEN p.date_echeance IS NULL THEN 1 ELSE 0 END,
      p.date_echeance ASC,
      c.nom_prenom ASC,
      v.immatriculation ASC
  `)
    .all() as DashboardRecapRow[];
}
