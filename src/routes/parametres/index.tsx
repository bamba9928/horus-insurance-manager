/**
 * Page Paramètres — Assureurs CRUD, backup/restore, langue.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  useIntegrationExchangeLogs,
  useIntegrationOverview,
  useTestAssureurIntegration,
} from "../../hooks/useIntegrations";
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
      <div className="space-y-5 overflow-auto p-5">
        <AssureursSection />
        <IntegrationsSection />
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
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const sortedAssureurs = useMemo(
    () => [...assureurs].sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })),
    [assureurs],
  );

  const handleSubmit = (data: AssureurCreate) => {
    const payload: AssureurCreate = {
      nom: data.nom.trim(),
      ...(data.contact?.trim() ? { contact: data.contact.trim() } : {}),
      ...(data.adresse?.trim() ? { adresse: data.adresse.trim() } : {}),
      ...(data.code?.trim() ? { code: data.code.trim().toUpperCase() } : { code: "" }),
      integrationType: data.integrationType ?? "MANUAL",
      ...(data.apiBaseUrl?.trim() ? { apiBaseUrl: data.apiBaseUrl.trim() } : { apiBaseUrl: "" }),
      ...(data.portalUrl?.trim() ? { portalUrl: data.portalUrl.trim() } : { portalUrl: "" }),
      ...(data.technicalContact?.trim()
        ? { technicalContact: data.technicalContact.trim() }
        : { technicalContact: "" }),
      integrationEnabled: data.integrationEnabled ?? false,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            setStatus({ type: "success", msg: "Assureur modifié avec succès." });
            closeForm();
          },
          onError: (e) => {
            setStatus({ type: "error", msg: `Échec de la modification : ${String(e)}` });
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setStatus({ type: "success", msg: "Assureur ajouté avec succès." });
          closeForm();
        },
        onError: (e) => {
          setStatus({ type: "error", msg: `Échec de la création : ${String(e)}` });
        },
      });
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
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

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Chargement...</p>
        ) : assureurs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Aucun assureur. Cliquez sur « + Nouvel assureur ».
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-700 dark:border-slate-700">
            {sortedAssureurs.map((a) => (
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
                    disabled={deleteMutation.isPending && deleteTarget?.id === a.id}
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
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMutation.mutateAsync(deleteTarget.id, {
              onSuccess: () => {
                setStatus({ type: "success", msg: "Assureur supprimé." });
              },
              onError: (e) => {
                setStatus({ type: "error", msg: `Échec de la suppression : ${String(e)}` });
              },
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
    reset,
    watch,
    formState: { errors },
  } = useForm<AssureurCreate>({
    resolver: zodResolver(assureurCreateSchema),
    defaultValues: defaultValues
      ? {
          nom: defaultValues.nom,
          ...(defaultValues.contact != null ? { contact: defaultValues.contact } : {}),
          ...(defaultValues.adresse != null ? { adresse: defaultValues.adresse } : {}),
          ...(defaultValues.code != null ? { code: defaultValues.code } : {}),
          integrationType: defaultValues.integration_type ?? "MANUAL",
          ...(defaultValues.api_base_url != null ? { apiBaseUrl: defaultValues.api_base_url } : {}),
          ...(defaultValues.portal_url != null ? { portalUrl: defaultValues.portal_url } : {}),
          ...(defaultValues.technical_contact != null
            ? { technicalContact: defaultValues.technical_contact }
            : {}),
          integrationEnabled: defaultValues.integration_enabled === 1,
        }
      : { nom: "", integrationType: "MANUAL", integrationEnabled: false },
  });

  useEffect(() => {
    reset(
      defaultValues
        ? {
            nom: defaultValues.nom,
            ...(defaultValues.contact != null ? { contact: defaultValues.contact } : {}),
            ...(defaultValues.adresse != null ? { adresse: defaultValues.adresse } : {}),
            ...(defaultValues.code != null ? { code: defaultValues.code } : {}),
            integrationType: defaultValues.integration_type ?? "MANUAL",
            ...(defaultValues.api_base_url != null
              ? { apiBaseUrl: defaultValues.api_base_url }
              : {}),
            ...(defaultValues.portal_url != null ? { portalUrl: defaultValues.portal_url } : {}),
            ...(defaultValues.technical_contact != null
              ? { technicalContact: defaultValues.technical_contact }
              : {}),
            integrationEnabled: defaultValues.integration_enabled === 1,
          }
        : {
            nom: "",
            contact: "",
            adresse: "",
            code: "",
            integrationType: "MANUAL",
            apiBaseUrl: "",
            portalUrl: "",
            technicalContact: "",
            integrationEnabled: false,
          },
    );
  }, [defaultValues, reset]);

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-slate-300";
  const integrationType = watch("integrationType") ?? "MANUAL";

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className={labelClass}>
            Code compagnie
          </label>
          <input id="code" type="text" {...register("code")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="integrationType" className={labelClass}>
            Type d'intégration
          </label>
          <select id="integrationType" {...register("integrationType")} className={inputClass}>
            <option value="MANUAL">Manuel</option>
            <option value="MOCK">Simulation API</option>
            <option value="API">API réelle</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="apiBaseUrl" className={labelClass}>
            URL API
          </label>
          <input
            id="apiBaseUrl"
            type="url"
            {...register("apiBaseUrl")}
            className={inputClass}
            disabled={integrationType === "MANUAL"}
          />
        </div>
        <div>
          <label htmlFor="portalUrl" className={labelClass}>
            Portail compagnie
          </label>
          <input id="portalUrl" type="url" {...register("portalUrl")} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="technicalContact" className={labelClass}>
          Contact technique
        </label>
        <input
          id="technicalContact"
          type="text"
          {...register("technicalContact")}
          className={inputClass}
          placeholder="Email ou téléphone support API"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
        <input
          type="checkbox"
          {...register("integrationEnabled")}
          className="h-4 w-4 rounded border-gray-300 text-[#614e1a] focus:ring-[#614e1a]"
        />
        Connecteur actif
      </label>
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

// ─── Section Intégrations Compagnies ───

function IntegrationsSection() {
  const { data: integrations = [], isLoading } = useIntegrationOverview();
  const { data: logs = [] } = useIntegrationExchangeLogs(8);
  const testMutation = useTestAssureurIntegration();
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleTest = async (assureurId: number, nom: string) => {
    setStatus(null);
    try {
      await testMutation.mutateAsync(assureurId);
      setStatus({ type: "success", msg: `Test de connexion enregistré pour ${nom}.` });
    } catch (e) {
      setStatus({ type: "error", msg: `Test échoué pour ${nom} : ${String(e)}` });
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Intégrations compagnies
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Préparation des connecteurs API, suivi des statuts et journal des échanges externes.
        </p>
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

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500 dark:text-slate-400">Chargement...</p>
        ) : integrations.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-slate-400">
            Ajoutez un assureur pour préparer son connecteur.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  Compagnie
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  Connecteur
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  Polices
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">
                  Dernier test
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {integrations.map((item) => (
                <tr key={item.assureur_id} className="dark:text-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{item.nom}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {item.code ?? "Code non défini"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <IntegrationBadge
                      type={item.integration_type ?? "MANUAL"}
                      enabled={item.integration_enabled === 1}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                    {item.synced_polices}/{item.total_polices} synchronisées
                    {item.error_polices > 0 && (
                      <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                        {item.error_polices} erreur(s)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                    {item.last_connection_status ?? "Jamais testé"}
                    {item.last_connection_at && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {new Date(item.last_connection_at).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleTest(item.assureur_id, item.nom)}
                      disabled={testMutation.isPending}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Tester
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Derniers échanges
          </h4>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-700 dark:border-slate-700">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                    {log.assureur_nom ?? "Assureur supprimé"} · {log.action}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                    {log.error_message ?? log.response_payload ?? "Échange enregistré"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                    log.status === "SUCCESS"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : log.status === "ERROR"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  }`}
                >
                  {log.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function IntegrationBadge({
  type,
  enabled,
}: {
  type: "MANUAL" | "MOCK" | "API";
  enabled: boolean;
}) {
  const label = type === "MANUAL" ? "Manuel" : type === "MOCK" ? "Simulation" : "API réelle";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        enabled
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
      }`}
    >
      {label} · {enabled ? "actif" : "inactif"}
    </span>
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
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
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
      void qc.invalidateQueries();
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
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
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
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
        {t("parametres.language.title")}
      </h3>
      <div className="mt-4 flex flex-wrap gap-4">
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
