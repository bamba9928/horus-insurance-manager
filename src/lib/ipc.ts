/**
 * Façade de l'API métier. Sélectionne l'implémentation selon le mode de build :
 *   - "tauri" (défaut) : SQLite local via le plugin Tauri (app desktop)
 *   - "http"           : API REST du serveur (app web)
 * Défini par `VITE_API_MODE` au build. Les hooks/pages importent ce module
 * sans se soucier du backend.
 *
 * @module ipc
 */

import * as http from "./ipc.http";
import * as tauri from "./ipc.tauri";

// Types canoniques (identiques quel que soit le backend).
export type {
  DashboardKPI,
  DashboardRecapRow,
  EcheanceRow,
  ImpayeRow,
  IntegrationExchangeLog,
  IntegrationOverview,
  ListParams,
  VerificationApiResponse,
  VerificationData,
} from "./ipc.tauri";

const backend = import.meta.env.VITE_API_MODE === "http" ? http : tauri;

// Commandes hors-SQL
export const greet = backend.greet;
export const backupDatabase = backend.backupDatabase;
export const restoreDatabase = backend.restoreDatabase;
export const verifyContract = backend.verifyContract;
export const openExternalUrl = backend.openExternalUrl;

// Clients
export const listClients = backend.listClients;
export const countClients = backend.countClients;
export const getClient = backend.getClient;
export const createClient = backend.createClient;
export const updateClient = backend.updateClient;
export const deleteClient = backend.deleteClient;

// Véhicules
export const listVehicules = backend.listVehicules;
export const getVehicule = backend.getVehicule;
export const createVehicule = backend.createVehicule;
export const updateVehicule = backend.updateVehicule;
export const deleteVehicule = backend.deleteVehicule;

// Assureurs & intégrations
export const listAssureurs = backend.listAssureurs;
export const createAssureur = backend.createAssureur;
export const updateAssureur = backend.updateAssureur;
export const deleteAssureur = backend.deleteAssureur;
export const listIntegrationOverview = backend.listIntegrationOverview;
export const listIntegrationExchangeLogs = backend.listIntegrationExchangeLogs;
export const testAssureurIntegration = backend.testAssureurIntegration;

// Polices
export const listPolices = backend.listPolices;
export const getPolice = backend.getPolice;
export const createPolice = backend.createPolice;
export const updatePolice = backend.updatePolice;
export const deletePolice = backend.deletePolice;
export const renewPolice = backend.renewPolice;

// Paiements
export const listPaiements = backend.listPaiements;
export const createPaiement = backend.createPaiement;
export const updatePaiement = backend.updatePaiement;
export const deletePaiement = backend.deletePaiement;

// Dossier complet
export const createDossier = backend.createDossier;

// Dashboard
export const getEcheances30j = backend.getEcheances30j;
export const getEcheancesRange = backend.getEcheancesRange;
export const getImpayes = backend.getImpayes;
export const getDashboardKPI = backend.getDashboardKPI;
export const getDashboardRecap = backend.getDashboardRecap;
