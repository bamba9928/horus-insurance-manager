/**
 * Page Paramètres — Assureurs CRUD, backup/restore, langue.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Header } from "../../components/layout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import {
  useAssureurs,
  useCreateAssureur,
  useDeleteAssureur,
  useUpdateAssureur,
} from "../../hooks/useAssureurs";
import { type Theme, useTheme } from "../../hooks/useTheme";
import { backupDatabase, restoreDatabase } from "../../lib/ipc";
import {
  type ImportReport,
  importClientsCSV,
  importPaiementsCSV,
  importPolicesCSV,
  importVehiculesCSV,
} from "../../lib/migrate";
import type { Assureur, AssureurCreate } from "../../schemas/assureur";
import { assureurCreateSchema } from "../../schemas/assureur";

export function ParametresPage() {
  const { t, i18n } = useTranslation();

  return (
    <>
      <Header title={t("nav.parametres")} />
      <div className="space-y-6 overflow-auto p-6">
        <AssureursSection />
        <ImportSection />
        <BackupSection />
        <AppearanceSection
          currentLang={i18n.language}
          onLangChange={(lng) => i18n.changeLanguage(lng)}
        />
      </div>
    </>
  );
}

// ─── Section Assureurs ───

function AssureursSection() {
  const { data: assureurs = [], isLoading } = useAssureurs();
  const createMutation = useCreateAssureur();
  const updateMutation = useUpdateAssureur();
  const deleteMutation = useDeleteAssureur();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assureur | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assureur | null>(null);

  const handleSubmit = (data: AssureurCreate) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data }, { onSuccess: () => closeForm() });
    } else {
      createMutation.mutate(data, { onSuccess: () => closeForm() });
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Gestion des assureurs
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Ajouter, modifier ou supprimer des compagnies d'assurance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setIsFormOpen(true);
          }}
          className="rounded-lg bg-[#614e1a] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b7335]"
        >
          + Nouvel assureur
        </button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Chargement...</p>
        ) : assureurs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Aucun assureur. Cliquez sur « + Nouvel assureur ».
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-700 dark:border-slate-700">
            {assureurs.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                    {a.nom}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
                    {a.contact ?? "—"}
                    {a.adresse && ` · ${a.adresse}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(a);
                      setIsFormOpen(true);
                    }}
                    className="rounded px-2 py-1 text-xs text-[#614e1a] hover:bg-[#614e1a]/10 dark:text-[#c9a961] dark:hover:bg-[#c9a961]/10"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(a)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={isFormOpen}
        onClose={closeForm}
        title={editing ? "Modifier l'assureur" : "Nouvel assureur"}
      >
        <AssureurForm
          defaultValues={editing}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        title="Supprimer l'assureur"
        message={`Supprimer définitivement « ${deleteTarget?.nom ?? ""} » ?`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </section>
  );
}

// ─── Formulaire Assureur ───

interface AssureurFormProps {
  defaultValues: Assureur | null;
  onSubmit: (data: AssureurCreate) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function AssureurForm({ defaultValues, onSubmit, onCancel, isSubmitting }: AssureurFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssureurCreate>({
    resolver: zodResolver(assureurCreateSchema),
    defaultValues: defaultValues
      ? {
          nom: defaultValues.nom,
          ...(defaultValues.contact != null ? { contact: defaultValues.contact } : {}),
          ...(defaultValues.adresse != null ? { adresse: defaultValues.adresse } : {}),
        }
      : { nom: "" },
  });

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-slate-300";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="nom" className={labelClass}>
          Nom *
        </label>
        <input id="nom" type="text" {...register("nom")} className={inputClass} />
        {errors.nom && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nom.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="contact" className={labelClass}>
          Contact
        </label>
        <input
          id="contact"
          type="text"
          {...register("contact")}
          className={inputClass}
          placeholder="Téléphone, email..."
        />
      </div>
      <div>
        <label htmlFor="adresse" className={labelClass}>
          Adresse
        </label>
        <input id="adresse" type="text" {...register("adresse")} className={inputClass} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// ─── Section Backup & Restore ───

function BackupSection() {
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setIsBusy(true);
    setStatus(null);
    try {
      const bytes = await backupDatabase();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/x-sqlite3" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `ham-backup-${ts}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: "success", msg: "Sauvegarde téléchargée." });
    } catch (e) {
      setStatus({ type: "error", msg: `Sauvegarde échouée : ${String(e)}` });
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    // reset pour permettre de re-sélectionner le même fichier
    e.target.value = "";
  };

  const handleRestoreConfirm = async () => {
    if (!pendingFile) return;
    setIsBusy(true);
    setStatus(null);
    try {
      const buffer = await pendingFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const msg = await restoreDatabase(bytes);
      setStatus({
        type: "success",
        msg: `${msg} — Redémarrez l'application pour prendre en compte la restauration.`,
      });
    } catch (e) {
      setStatus({ type: "error", msg: `Restauration échouée : ${String(e)}` });
    } finally {
      setPendingFile(null);
      setIsBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
        Sauvegarde & Restauration
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Télécharger la base de données complète ou la restaurer depuis un fichier `.db`. Un backup
        de sécurité (`assurauto.db.bak`) est créé automatiquement avant toute restauration.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleBackup}
          disabled={isBusy}
          className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b7335] disabled:opacity-50"
        >
          {isBusy ? "..." : "Sauvegarder maintenant"}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Restaurer depuis un fichier
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".db,.sqlite,.sqlite3"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>

      {status && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            status.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          {status.msg}
        </div>
      )}

      <ConfirmDialog
        open={pendingFile !== null}
        onClose={() => setPendingFile(null)}
        onConfirm={handleRestoreConfirm}
        title="Confirmer la restauration"
        message={`Remplacer la base actuelle par « ${pendingFile?.name ?? ""} » ? Cette action est irréversible (un backup .bak sera créé automatiquement).`}
        confirmLabel="Restaurer"
        variant="danger"
      />
    </section>
  );
}

// ─── Section Import CSV (migration .accdb) ───

type ImportKind = "clients" | "vehicules" | "polices" | "paiements";

const IMPORT_LABELS: Record<ImportKind, { title: string; hint: string }> = {
  clients: {
    title: "1. Clients",
    hint: "Colonnes : nom_prenom (requis), telephone, email, adresse, notes",
  },
  vehicules: {
    title: "2. Véhicules",
    hint: "Colonnes : client_nom (requis), immatriculation (requis), marque, modele, genre, type_vehicule, puissance, places",
  },
  polices: {
    title: "3. Polices",
    hint: "Colonnes : immatriculation (requis), numero_police, date_effet (YYYY-MM-DD ou DD/MM/YYYY), duree_mois, assureur",
  },
  paiements: {
    title: "4. Paiements",
    hint: "Colonnes : numero_police (requis), montant_du (requis), paye, avance, date_paiement, mode, reference, notes",
  },
};

/** Rapport augmenté d'un identifiant stable pour la liste React. */
type ReportEntry = ImportReport & { uid: string };

function ImportSection() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<ImportKind | null>(null);
  const [reports, setReports] = useState<ReportEntry[]>([]);

  const handleFile = async (kind: ImportKind, file: File) => {
    setBusy(kind);
    try {
      let report: ImportReport;
      switch (kind) {
        case "clients":
          report = await importClientsCSV(file);
          break;
        case "vehicules":
          report = await importVehiculesCSV(file);
          break;
        case "polices":
          report = await importPolicesCSV(file);
          break;
        case "paiements":
          report = await importPaiementsCSV(file);
          break;
      }
      setReports((prev) => [...prev, { ...report, uid: crypto.randomUUID() }]);
      // Invalider toutes les queries pour rafraîchir les listes
      qc.invalidateQueries();
    } catch (e) {
      setReports((prev) => [
        ...prev,
        {
          uid: crypto.randomUUID(),
          entity: kind,
          read: 0,
          inserted: 0,
          skipped: 0,
          errors: [{ row: 0, message: String(e) }],
        },
      ]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
        Import de données (.accdb → CSV)
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Ouvrez votre base{" "}
        <code className="rounded bg-gray-100 px-1 dark:bg-slate-700 dark:text-slate-200">
          .accdb
        </code>{" "}
        dans Microsoft Access, exportez chaque table en CSV (délimiteur virgule, en-têtes sur la
        première ligne), puis chargez-les ci-dessous dans l'ordre. Les doublons (même nom,
        immatriculation ou N° police) sont ignorés automatiquement.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(IMPORT_LABELS) as ImportKind[]).map((kind) => (
          <ImportFilePicker
            key={kind}
            kind={kind}
            disabled={busy !== null}
            busy={busy === kind}
            onFile={(file) => handleFile(kind, file)}
          />
        ))}
      </div>

      {reports.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Rapports d'import
            </h4>
            <button
              type="button"
              onClick={() => setReports([])}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Effacer
            </button>
          </div>
          {reports.map((r) => (
            <ImportReportCard key={r.uid} report={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function ImportFilePicker({
  kind,
  disabled,
  busy,
  onFile,
}: {
  kind: ImportKind;
  disabled: boolean;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { title, hint } = IMPORT_LABELS[kind];

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{hint}</p>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {busy ? "Import en cours..." : "Sélectionner un CSV"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}

function ImportReportCard({ report }: { report: ImportReport }) {
  const hasErrors = report.errors.length > 0;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        hasErrors
          ? "border-orange-200 bg-orange-50 dark:border-orange-800/40 dark:bg-orange-900/20"
          : "border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/20"
      }`}
    >
      <p className="font-medium capitalize text-gray-900 dark:text-slate-100">{report.entity}</p>
      <p className="mt-0.5 text-xs text-gray-700 dark:text-slate-300">
        Lues : <strong>{report.read}</strong> · Insérées :{" "}
        <strong className="text-green-700 dark:text-green-400">{report.inserted}</strong> · Ignorées
        (doublons) : <strong className="text-blue-700 dark:text-blue-400">{report.skipped}</strong>{" "}
        · Erreurs :{" "}
        <strong
          className={
            hasErrors ? "text-red-700 dark:text-red-400" : "text-gray-500 dark:text-slate-400"
          }
        >
          {report.errors.length}
        </strong>
      </p>
      {hasErrors && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200">
            Voir les erreurs ({report.errors.length})
          </summary>
          <ul className="mt-1 max-h-32 overflow-auto text-xs text-red-700 dark:text-red-400">
            {report.errors.slice(0, 50).map((e) => (
              <li key={`${e.row}-${e.message}`}>
                Ligne {e.row} : {e.message}
              </li>
            ))}
            {report.errors.length > 50 && (
              <li className="italic text-gray-500 dark:text-slate-400">
                … {report.errors.length - 50} erreur(s) supplémentaire(s) non affichée(s)
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── Section Apparence & Langue ───

function AppearanceSection({
  currentLang,
  onLangChange,
}: {
  currentLang: string;
  onLangChange: (lng: string) => void;
}) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const selectClass =
    "mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
        {t("parametres.language.title")}
      </h3>
      <div className="mt-4 flex flex-wrap gap-6">
        <div>
          <label
            htmlFor="lang-select"
            className="text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            {t("parametres.language.label")}
          </label>
          <select
            id="lang-select"
            value={currentLang.slice(0, 2)}
            onChange={(e) => onLangChange(e.target.value)}
            className={selectClass}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="theme-select"
            className="text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            {t("parametres.theme.title")}
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className={selectClass}
          >
            <option value="light">{t("parametres.theme.light")}</option>
            <option value="dark">{t("parametres.theme.dark")}</option>
            <option value="system">{t("parametres.theme.system")}</option>
          </select>
        </div>
      </div>
    </section>
  );
}
