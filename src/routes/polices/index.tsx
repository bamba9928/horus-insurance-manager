/**
 * Page Polices — Liste, CRUD, vue maître-détail, renouvellement.
 * Affiche l'immatriculation du véhicule et le nom du client.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../components/data-table/DataTable";
import { PoliceForm } from "../../components/forms/PoliceForm";
import { Header } from "../../components/layout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import { useAssureurs } from "../../hooks/useAssureurs";
import { useClients } from "../../hooks/useClients";
import { usePaiements } from "../../hooks/usePaiements";
import {
  useCreatePolice,
  useDeletePolice,
  usePolices,
  useRenewPolice,
  useUpdatePolice,
} from "../../hooks/usePolices";
import { useVehicules } from "../../hooks/useVehicules";
import { calcEcheance, formatDateDisplay, formatFCFA, joursRestants } from "../../lib/date-utils";
import { getPaiementStatut } from "../../schemas/paiement";
import type { Police, PoliceCreate } from "../../schemas/police";
import { STATUTS_POLICE } from "../../schemas/police";

/** Couleur de badge par statut */
function statutBadge(statut: string | null) {
  switch (statut) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "EXPIRÉE":
      return "bg-red-100 text-red-800";
    case "ANNULÉE":
      return "bg-gray-100 text-gray-600";
    case "RENOUVELÉE":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/** Couleur d'urgence pour les jours restants */
function urgenceBadge(jours: number) {
  if (jours < 0) return "text-red-700 bg-red-50";
  if (jours <= 7) return "text-red-600 bg-red-50";
  if (jours <= 30) return "text-orange-600 bg-orange-50";
  return "text-green-700 bg-green-50";
}

export function PolicesPage() {
  const { t } = useTranslation();

  // State
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("");
  const [selectedPolice, setSelectedPolice] = useState<Police | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Police | null>(null);
  const [renewTarget, setRenewTarget] = useState<Police | null>(null);

  // Queries & Mutations
  const filters = useMemo(
    () => ({
      ...(filterStatut ? { statut: filterStatut } : {}),
    }),
    [filterStatut],
  );
  const { data: polices = [], isLoading } = usePolices(filters);
  const { data: vehicules = [] } = useVehicules();
  const { data: clients = [] } = useClients();
  const { data: assureurs = [] } = useAssureurs();
  const createMutation = useCreatePolice();
  const updateMutation = useUpdatePolice();
  const deleteMutation = useDeletePolice();
  const renewMutation = useRenewPolice();

  /** Résout immatriculation → {immat, clientId} */
  const vehiculeMap = useMemo(() => {
    const map = new Map<number, { immatriculation: string; clientId: number }>();
    for (const v of vehicules) {
      map.set(v.id, { immatriculation: v.immatriculation, clientId: v.client_id });
    }
    return map;
  }, [vehicules]);

  /** Résout clientId → nom */
  const clientNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of clients) {
      map.set(c.id, c.nom_prenom);
    }
    return map;
  }, [clients]);

  /** Résout assureurId → nom */
  const assureurNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of assureurs) {
      map.set(a.id, a.nom);
    }
    return map;
  }, [assureurs]);

  /** Obtient le nom du client d'une police via véhicule */
  const getClientName = useCallback(
    (police: Police) => {
      const veh = vehiculeMap.get(police.vehicule_id);
      if (!veh) return "—";
      return clientNameMap.get(veh.clientId) ?? "—";
    },
    [vehiculeMap, clientNameMap],
  );

  // Colonnes du tableau
  const columns = useMemo<ColumnDef<Police, unknown>[]>(
    () => [
      {
        accessorKey: "numero_police",
        header: t("polices.numero"),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue<string | null>() ?? "—"}</span>
        ),
      },
      {
        accessorKey: "vehicule_id",
        header: "Véhicule",
        cell: ({ getValue }) => vehiculeMap.get(getValue<number>())?.immatriculation ?? "—",
      },
      {
        id: "client",
        header: "Client",
        cell: ({ row }) => getClientName(row.original),
      },
      {
        accessorKey: "date_effet",
        header: t("polices.dateEffet"),
        cell: ({ getValue }) => formatDateDisplay(new Date(getValue<string>())),
      },
      {
        accessorKey: "date_echeance",
        header: t("polices.dateEcheance"),
        cell: ({ getValue }) => {
          const d = getValue<string | null>();
          if (!d) return "—";
          const jours = joursRestants(new Date(d));
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${urgenceBadge(jours)}`}>
              {formatDateDisplay(new Date(d))} ({jours}j)
            </span>
          );
        },
      },
      {
        accessorKey: "statut",
        header: t("polices.statut"),
        cell: ({ getValue }) => {
          const s = getValue<string | null>() ?? "ACTIVE";
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${statutBadge(s)}`}>{s}</span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPolice(row.original);
                setIsEditOpen(true);
              }}
              className="rounded px-2 py-1 text-xs text-[#614e1a] hover:bg-[#614e1a]/10"
            >
              {t("common.edit")}
            </button>
            {row.original.statut === "ACTIVE" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenewTarget(row.original);
                }}
                className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
              >
                {t("polices.renouveler")}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              {t("common.delete")}
            </button>
          </div>
        ),
      },
    ],
    [t, vehiculeMap, getClientName],
  );

  // Filtrage texte côté client
  const filteredPolices = useMemo(() => {
    if (!search) return polices;
    const s = search.toLowerCase();
    return polices.filter(
      (p) =>
        p.numero_police?.toLowerCase().includes(s) ||
        (vehiculeMap.get(p.vehicule_id)?.immatriculation ?? "").toLowerCase().includes(s) ||
        getClientName(p).toLowerCase().includes(s),
    );
  }, [polices, search, vehiculeMap, getClientName]);

  // Handlers
  const handleCreate = (data: PoliceCreate) => {
    createMutation.mutate(data, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: PoliceCreate) => {
    if (!selectedPolice) return;
    updateMutation.mutate(
      { id: selectedPolice.id, ...data },
      { onSuccess: () => setIsEditOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const handleRenew = () => {
    if (!renewTarget) return;
    renewMutation.mutate(renewTarget.id, {
      onSuccess: () => setRenewTarget(null),
    });
  };

  return (
    <>
      <Header title={t("polices.title")}>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b7335]"
        >
          + {t("common.create")}
        </button>
      </Header>

      <div className="flex flex-1 overflow-hidden">
        {/* Liste principale */}
        <div className={`flex-1 overflow-auto p-6 ${selectedPolice && !isEditOpen ? "w-1/2" : ""}`}>
          {/* Barre de recherche + filtres */}
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t("common.search")}...`}
              className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
            />
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              {STATUTS_POLICE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">{t("common.loading")}</p>
          ) : (
            <DataTable
              columns={columns}
              data={filteredPolices}
              onRowClick={(police) => setSelectedPolice(police)}
            />
          )}
        </div>

        {/* Panneau détail */}
        {selectedPolice && !isEditOpen && (
          <PoliceDetailPanel
            police={selectedPolice}
            vehiculeMap={vehiculeMap}
            clientNameMap={clientNameMap}
            assureurNameMap={assureurNameMap}
            onClose={() => setSelectedPolice(null)}
            onEdit={() => setIsEditOpen(true)}
            onDelete={() => setDeleteTarget(selectedPolice)}
            onRenew={() => setRenewTarget(selectedPolice)}
            t={t}
          />
        )}
      </div>

      {/* Modal création */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouvelle police">
        <PoliceForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isPending}
        />
      </Dialog>

      {/* Modal édition */}
      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier la police">
        {selectedPolice && (
          <PoliceForm
            defaultValues={selectedPolice}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditOpen(false)}
            isSubmitting={updateMutation.isPending}
          />
        )}
      </Dialog>

      {/* Dialog suppression */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la police"
        message={`Êtes-vous sûr de vouloir supprimer la police "${deleteTarget?.numero_police ?? `#${deleteTarget?.id}`}" ? Les paiements associés seront aussi supprimés.`}
        confirmLabel={t("common.delete")}
        variant="danger"
      />

      {/* Dialog renouvellement */}
      <ConfirmDialog
        open={renewTarget !== null}
        onClose={() => setRenewTarget(null)}
        onConfirm={handleRenew}
        title="Renouveler la police"
        message={`Renouveler la police "${renewTarget?.numero_police ?? `#${renewTarget?.id}`}" ? Une nouvelle police sera créée avec la même configuration et l'ancienne sera marquée RENOUVELÉE.`}
        confirmLabel={t("polices.renouveler")}
      />
    </>
  );
}

// ─── Panneau détail extrait ───

interface PoliceDetailPanelProps {
  police: Police;
  vehiculeMap: Map<number, { immatriculation: string; clientId: number }>;
  clientNameMap: Map<number, string>;
  assureurNameMap: Map<number, string>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRenew: () => void;
  t: (key: string) => string;
}

function PoliceDetailPanel({
  police,
  vehiculeMap,
  clientNameMap,
  assureurNameMap,
  onClose,
  onEdit,
  onDelete,
  onRenew,
  t,
}: PoliceDetailPanelProps) {
  const veh = vehiculeMap.get(police.vehicule_id);
  const clientName = veh ? clientNameMap.get(veh.clientId) : undefined;
  const assureurName = police.assureur_id ? assureurNameMap.get(police.assureur_id) : undefined;

  // Calcul échéance avec jours restants
  let echeanceDisplay = "—";
  let joursDisplay = "";
  let joursClass = "";
  try {
    const echeance = calcEcheance(police.date_effet, police.duree_mois);
    echeanceDisplay = formatDateDisplay(echeance);
    const jours = joursRestants(echeance);
    joursDisplay = jours < 0 ? `(expiré depuis ${Math.abs(jours)}j)` : `(${jours}j restants)`;
    joursClass = jours < 0 ? "text-red-600" : jours <= 30 ? "text-orange-600" : "text-green-600";
  } catch {
    // ignore
  }

  return (
    <div className="w-96 shrink-0 overflow-auto border-l border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {police.numero_police ?? `Police #${police.id}`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>

      {/* Badge statut */}
      <div className="mt-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statutBadge(police.statut)}`}
        >
          {police.statut ?? "ACTIVE"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <DetailField label="Client" value={clientName} />
        <DetailField label="Véhicule" value={veh?.immatriculation} />
        <DetailField
          label={t("polices.dateEffet")}
          value={formatDateDisplay(new Date(police.date_effet))}
        />
        <DetailField label={t("polices.dureeMois")} value={`${police.duree_mois} mois`} />
        <div>
          <p className="text-xs font-medium text-gray-500">{t("polices.dateEcheance")}</p>
          <p className="text-sm text-gray-900">
            {echeanceDisplay} <span className={`text-xs ${joursClass}`}>{joursDisplay}</span>
          </p>
        </div>
        <DetailField label={t("polices.assureur")} value={assureurName} />
        <DetailField label="Appréciation" value={police.appreciation} />
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 rounded-lg bg-[#614e1a] px-3 py-2 text-sm font-medium text-white hover:bg-[#8b7335]"
        >
          {t("common.edit")}
        </button>
        {police.statut === "ACTIVE" && (
          <button
            type="button"
            onClick={onRenew}
            className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
          >
            {t("polices.renouveler")}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          {t("common.delete")}
        </button>
      </div>

      {/* Paiements de la police */}
      <PolicePaiementsList policeId={police.id} t={t} />
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}

/** Sous-composant : liste des paiements d'une police */
function PolicePaiementsList({ policeId, t }: { policeId: number; t: (key: string) => string }) {
  const { data: paiements = [] } = usePaiements(policeId);

  const statutColors: Record<string, string> = {
    SOLDE: "bg-green-100 text-green-800",
    PARTIEL: "bg-orange-100 text-orange-800",
    IMPAYE: "bg-red-100 text-red-800",
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h4 className="text-sm font-semibold text-gray-700">Paiements ({paiements.length})</h4>
      {paiements.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">Aucun paiement enregistré.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {paiements.map((p) => {
            const reste = p.reste ?? p.montant_du - p.paye - p.avance;
            const statut = getPaiementStatut(reste, p.montant_du);
            return (
              <li key={p.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{formatFCFA(p.montant_du)}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${statutColors[statut] ?? "bg-gray-100"}`}
                  >
                    {t(`paiements.${statut.toLowerCase()}`)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Payé : {formatFCFA(p.paye)} — Reste : {formatFCFA(reste)}
                  {p.mode && <span className="ml-1">({p.mode.replace("_", " ")})</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
