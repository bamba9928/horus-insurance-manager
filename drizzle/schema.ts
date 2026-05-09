import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ============ CLIENTS ============

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nomPrenom: text("nom_prenom").notNull(),
    adresse: text("adresse"),
    telephone: text("telephone"),
    email: text("email"),
    notes: text("notes"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_clients_nom").on(table.nomPrenom),
    index("idx_clients_tel").on(table.telephone),
  ],
);

// ============ VÉHICULES ============

export const vehicules = sqliteTable(
  "vehicules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    immatriculation: text("immatriculation").notNull().unique(),
    marque: text("marque"),
    modele: text("modele"),
    genre: text("genre", {
      enum: ["VP", "VP/CI", "TPV", "TPC", "TPM", "MOTO"],
    }),
    typeVehicule: text("type_vehicule"),
    puissance: integer("puissance"),
    places: integer("places"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_veh_imm").on(table.immatriculation),
    index("idx_veh_client").on(table.clientId),
  ],
);

// ============ ASSUREURS ============

export const assureurs = sqliteTable("assureurs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nom: text("nom").notNull().unique(),
  contact: text("contact"),
  adresse: text("adresse"),
  code: text("code"),
  integrationType: text("integration_type", { enum: ["MANUAL", "MOCK", "API"] }).default("MANUAL"),
  apiBaseUrl: text("api_base_url"),
  portalUrl: text("portal_url"),
  technicalContact: text("technical_contact"),
  integrationEnabled: integer("integration_enabled").default(0),
  lastConnectionStatus: text("last_connection_status"),
  lastConnectionAt: text("last_connection_at"),
});

// ============ POLICES (cœur métier) ============

export const polices = sqliteTable(
  "polices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vehiculeId: integer("vehicule_id")
      .notNull()
      .references(() => vehicules.id, { onDelete: "cascade" }),
    assureurId: integer("assureur_id").references(() => assureurs.id),
    numeroPolice: text("numero_police").unique(),
    typeCarte: text("type_carte", { enum: ["VERTE", "JAUNE"] }).notNull(),
    dateEffet: text("date_effet").notNull(),
    dureeMois: integer("duree_mois").notNull(),
    /** Calculé côté DB : date(date_effet, '+N months', '-1 day') — STORED */
    dateEcheance: text("date_echeance"),
    appreciation: text("appreciation"),
    statut: text("statut", {
      enum: ["ACTIVE", "EXPIRÉE", "ANNULÉE", "RENOUVELÉE"],
    }).default("ACTIVE"),
    externalReference: text("external_reference"),
    integrationStatus: text("integration_status", {
      enum: ["LOCAL", "PENDING", "SYNCED", "ERROR"],
    }).default("LOCAL"),
    lastSyncAt: text("last_sync_at"),
    syncError: text("sync_error"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_pol_echeance").on(table.dateEcheance),
    index("idx_pol_statut").on(table.statut),
    index("idx_pol_veh").on(table.vehiculeId),
  ],
);

// ============ PAIEMENTS ============

export const paiements = sqliteTable("paiements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  policeId: integer("police_id")
    .notNull()
    .references(() => polices.id, { onDelete: "cascade" }),
  montantDu: integer("montant_du").notNull(),
  paye: integer("paye").default(0),
  avance: integer("avance").default(0),
  /** Calculé côté DB : montant_du - paye - avance — STORED */
  reste: integer("reste"),
  datePaiement: text("date_paiement"),
  mode: text("mode", {
    enum: ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"],
  }),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ============ AUDIT LOG ============

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action", { enum: ["CREATE", "UPDATE", "DELETE"] }).notNull(),
  diff: text("diff"),
  user: text("user").default("system"),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
});

// ============ INTEGRATION EXCHANGE LOGS ============

export const integrationExchangeLogs = sqliteTable(
  "integration_exchange_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assureurId: integer("assureur_id").references(() => assureurs.id, { onDelete: "set null" }),
    policeId: integer("police_id").references(() => polices.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    direction: text("direction", { enum: ["IN", "OUT"] }).notNull(),
    status: text("status", { enum: ["SUCCESS", "ERROR", "PENDING"] }).notNull(),
    requestPayload: text("request_payload"),
    responsePayload: text("response_payload"),
    externalReference: text("external_reference"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_exchange_logs_assureur").on(table.assureurId),
    index("idx_exchange_logs_police").on(table.policeId),
    index("idx_exchange_logs_created").on(table.createdAt),
  ],
);
