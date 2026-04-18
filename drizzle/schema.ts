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
