/**
 * Import de données depuis des fichiers CSV (export .accdb → CSV).
 *
 * Workflow recommandé :
 *   1. Ouvrir la base .accdb dans Microsoft Access.
 *   2. Pour chaque table (clients, vehicules, polices, paiements) :
 *      clic droit → Exporter → Fichier texte → CSV, délimiteur virgule,
 *      première ligne contient les en-têtes.
 *   3. Dans HAM, Paramètres → Import, sélectionner les 4 CSV *dans l'ordre*
 *      (clients → véhicules → polices → paiements) car les foreign keys
 *      sont résolues par lookup.
 *
 * La résolution des clés étrangères se fait par :
 *   - véhicule → client via `nom_prenom`
 *   - police → véhicule via `immatriculation`, police → assureur via `nom`
 *   - paiement → police via `numero_police`
 *
 * Les doublons (même immatriculation / numéro police) sont ignorés silencieusement.
 *
 * @module migrate
 */

import Papa from "papaparse";
import {
  createAssureur,
  createClient,
  createPaiement,
  createPolice,
  createVehicule,
  listAssureurs,
  listClients,
  listPolices,
  listVehicules,
} from "./ipc";

/** Rapport d'une étape d'import. */
export interface ImportReport {
  entity: "clients" | "vehicules" | "polices" | "paiements";
  read: number;
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

/** Parse un CSV avec en-têtes en une liste d'objets. */
async function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normalizeKey(h),
      complete: (result) => resolve(result.data),
      error: (err) => reject(err),
    });
  });
}

/** Normalise une clé : minuscules, sans accents, underscores au lieu d'espaces. */
function normalizeKey(k: string): string {
  return k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

/** Récupère une valeur en testant plusieurs clés possibles. */
function getField(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[normalizeKey(k)];
    if (v !== undefined && v !== "") return v.trim();
  }
  return undefined;
}

/** Convertit une valeur en nombre entier, renvoie undefined si vide/invalide. */
function toInt(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Normalise une date Access (MM/DD/YYYY ou DD/MM/YYYY) vers YYYY-MM-DD. */
function normalizeDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  // Déjà au bon format ISO ?
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // DD/MM/YYYY ou DD-MM-YYYY (format français/Access FR)
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  return undefined;
}

// ─── Imports par entité ───

export async function importClientsCSV(file: File): Promise<ImportReport> {
  const rows = await parseCSV(file);
  const existing = await listClients({ limit: 100_000 });
  const existingByName = new Set(existing.map((c) => c.nom_prenom.toLowerCase()));

  const report: ImportReport = {
    entity: "clients",
    read: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    try {
      const nomPrenom = getField(r, "nom_prenom", "nomprenom", "nom", "client");
      if (!nomPrenom) {
        report.errors.push({ row: i + 2, message: "nom_prenom manquant" });
        continue;
      }
      if (existingByName.has(nomPrenom.toLowerCase())) {
        report.skipped++;
        continue;
      }
      await createClient({
        nomPrenom,
        ...(getField(r, "telephone", "tel") ? { telephone: getField(r, "telephone", "tel")! } : {}),
        ...(getField(r, "email", "mail") ? { email: getField(r, "email", "mail")! } : {}),
        ...(getField(r, "adresse") ? { adresse: getField(r, "adresse")! } : {}),
        ...(getField(r, "notes") ? { notes: getField(r, "notes")! } : {}),
      });
      existingByName.add(nomPrenom.toLowerCase());
      report.inserted++;
    } catch (e) {
      report.errors.push({ row: i + 2, message: String(e) });
    }
  }
  return report;
}

export async function importVehiculesCSV(file: File): Promise<ImportReport> {
  const rows = await parseCSV(file);
  const [clients, vehicules] = await Promise.all([
    listClients({ limit: 100_000 }),
    listVehicules(),
  ]);
  const clientIdByName = new Map(clients.map((c) => [c.nom_prenom.toLowerCase(), c.id]));
  const existingImmats = new Set(vehicules.map((v) => v.immatriculation.toUpperCase()));

  const report: ImportReport = {
    entity: "vehicules",
    read: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    try {
      const immat = getField(r, "immatriculation", "immat")?.toUpperCase();
      if (!immat) {
        report.errors.push({ row: i + 2, message: "immatriculation manquante" });
        continue;
      }
      if (existingImmats.has(immat)) {
        report.skipped++;
        continue;
      }
      const clientNom = getField(r, "client_nom", "nom_prenom", "client", "nom");
      if (!clientNom) {
        report.errors.push({ row: i + 2, message: "client_nom manquant" });
        continue;
      }
      const clientId = clientIdByName.get(clientNom.toLowerCase());
      if (!clientId) {
        report.errors.push({
          row: i + 2,
          message: `Client introuvable : ${clientNom}`,
        });
        continue;
      }
      const puissance = toInt(getField(r, "puissance", "cv"));
      const places = toInt(getField(r, "places"));
      await createVehicule({
        clientId,
        immatriculation: immat,
        ...(getField(r, "marque") ? { marque: getField(r, "marque")! } : {}),
        ...(getField(r, "modele") ? { modele: getField(r, "modele")! } : {}),
        ...(getField(r, "genre") ? { genre: getField(r, "genre") as never } : {}),
        ...(getField(r, "type_vehicule", "type")
          ? { typeVehicule: getField(r, "type_vehicule", "type")! }
          : {}),
        ...(puissance !== undefined ? { puissance } : {}),
        ...(places !== undefined ? { places } : {}),
      });
      existingImmats.add(immat);
      report.inserted++;
    } catch (e) {
      report.errors.push({ row: i + 2, message: String(e) });
    }
  }
  return report;
}

export async function importPolicesCSV(file: File): Promise<ImportReport> {
  const rows = await parseCSV(file);
  const [vehicules, assureurs, polices] = await Promise.all([
    listVehicules(),
    listAssureurs(),
    listPolices(),
  ]);
  const vehiculeIdByImmat = new Map(vehicules.map((v) => [v.immatriculation.toUpperCase(), v.id]));
  const assureurIdByName = new Map(assureurs.map((a) => [a.nom.toLowerCase(), a.id]));
  const existingNumeros = new Set(
    polices.map((p) => p.numero_police?.toLowerCase()).filter((n): n is string => !!n),
  );

  const report: ImportReport = {
    entity: "polices",
    read: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    try {
      const immat = getField(r, "immatriculation", "immat")?.toUpperCase();
      if (!immat) {
        report.errors.push({ row: i + 2, message: "immatriculation manquante" });
        continue;
      }
      const vehiculeId = vehiculeIdByImmat.get(immat);
      if (!vehiculeId) {
        report.errors.push({ row: i + 2, message: `Véhicule introuvable : ${immat}` });
        continue;
      }
      const numero = getField(r, "numero_police", "numero", "n_police", "num_police");
      if (numero && existingNumeros.has(numero.toLowerCase())) {
        report.skipped++;
        continue;
      }
      const typeCarte = (getField(r, "type_carte", "type") ?? "VERTE").toUpperCase();
      if (typeCarte !== "VERTE" && typeCarte !== "JAUNE") {
        report.errors.push({ row: i + 2, message: `type_carte invalide : ${typeCarte}` });
        continue;
      }
      const dateEffet = normalizeDate(getField(r, "date_effet", "dateeffet", "effet"));
      if (!dateEffet) {
        report.errors.push({ row: i + 2, message: "date_effet manquante ou invalide" });
        continue;
      }
      const dureeMois = toInt(getField(r, "duree_mois", "duree", "dureemois")) ?? 12;
      if (![1, 3, 6, 9, 12, 24].includes(dureeMois)) {
        report.errors.push({
          row: i + 2,
          message: `duree_mois invalide : ${dureeMois}`,
        });
        continue;
      }

      // Assureur : optionnel, création à la volée si seul le nom est fourni
      let assureurId: number | undefined;
      const assureurNom = getField(r, "assureur", "assureur_nom", "compagnie");
      if (assureurNom) {
        assureurId = assureurIdByName.get(assureurNom.toLowerCase());
        if (!assureurId) {
          assureurId = await createAssureur({ nom: assureurNom });
          assureurIdByName.set(assureurNom.toLowerCase(), assureurId);
        }
      }

      await createPolice({
        vehiculeId,
        typeCarte: typeCarte as "VERTE" | "JAUNE",
        dateEffet,
        dureeMois: dureeMois as 1 | 3 | 6 | 9 | 12 | 24,
        ...(numero ? { numeroPolice: numero } : {}),
        ...(assureurId !== undefined ? { assureurId } : {}),
        ...(getField(r, "appreciation") ? { appreciation: getField(r, "appreciation")! } : {}),
      });
      if (numero) existingNumeros.add(numero.toLowerCase());
      report.inserted++;
    } catch (e) {
      report.errors.push({ row: i + 2, message: String(e) });
    }
  }
  return report;
}

export async function importPaiementsCSV(file: File): Promise<ImportReport> {
  const rows = await parseCSV(file);
  const polices = await listPolices();
  const policeIdByNumero = new Map(
    polices.filter((p) => p.numero_police).map((p) => [p.numero_police!.toLowerCase(), p.id]),
  );

  const report: ImportReport = {
    entity: "paiements",
    read: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  const modesValides = new Set(["ESPECES", "CHEQUE", "VIREMENT", "MOBILE_MONEY", "CARTE"]);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    try {
      const numero = getField(r, "numero_police", "numero", "n_police");
      if (!numero) {
        report.errors.push({ row: i + 2, message: "numero_police manquant" });
        continue;
      }
      const policeId = policeIdByNumero.get(numero.toLowerCase());
      if (!policeId) {
        report.errors.push({ row: i + 2, message: `Police introuvable : ${numero}` });
        continue;
      }
      const montantDu = toInt(getField(r, "montant_du", "montant", "du"));
      if (montantDu === undefined) {
        report.errors.push({ row: i + 2, message: "montant_du manquant" });
        continue;
      }
      const paye = toInt(getField(r, "paye", "regle")) ?? 0;
      const avance = toInt(getField(r, "avance")) ?? 0;
      const modeRaw = getField(r, "mode", "mode_paiement")?.toUpperCase().replace(/\s+/g, "_");
      const mode = modeRaw && modesValides.has(modeRaw) ? modeRaw : undefined;
      const datePaiement = normalizeDate(getField(r, "date_paiement", "date"));
      const reference = getField(r, "reference", "ref");
      const notes = getField(r, "notes");

      await createPaiement({
        policeId,
        montantDu,
        paye,
        avance,
        ...(datePaiement ? { datePaiement } : {}),
        ...(mode ? { mode: mode as never } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      });
      report.inserted++;
    } catch (e) {
      report.errors.push({ row: i + 2, message: String(e) });
    }
  }
  return report;
}
