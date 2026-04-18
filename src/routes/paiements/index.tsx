/**
 * Page Paiements — Liste, CRUD, vue maître-détail.
 * Affiche le statut (SOLDE/PARTIEL/IMPAYE) et le montant formaté en FCFA.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../components/data-table/DataTable";
import { PaiementForm } from "../../components/forms/PaiementForm";
import { Header } from "../../components/layout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import { useClients } from "../../hooks/useClients";
import {
  useCreatePaiement,
  useDeletePaiement,
  usePaiements,
  useUpdatePaiement,
} from "../../hooks/usePaiements";
import { usePolices } from "../../hooks/usePolices";
import { useVehicules } from "../../hooks/useVehicules";
import { formatFCFA } from "../../lib/date-utils";
import type { Paiement, PaiementCreate } from "../../schemas/paiement";
import { getPaiementStatut } from "../../schemas/paiement";

/** Couleur de badge par statut paiement */
function statutBadge(statut: string) {
  switch (statut) {
    case "SOLDE":
      return "bg-green-100 text-green-800";
    case "PARTIEL":
      return "bg-orange-100 text-orange-800";
    case "IMPAYE":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function PaiementsPage() {
  const { t } = useTranslation();

  // State
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("");
  const [selectedPaiement, setSelectedPaiement] = useState<Paiement | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Paiement | null>(null);

  // Queries & Mutations
  const { data: paiements = [], isLoading } = usePaiements();
  const { data: polices = [] } = usePolices();
  const { data: vehicules = [] } = useVehicules();
  const { data: clients = [] } = useClients();
  const createMutation = useCreatePaiement();
  const updateMutation = useUpdatePaiement();
  const deleteMutation = useDeletePaiement();

  /** Résout policeId → {numero, vehiculeId} */
  const policeMap = useMemo(() => {
    const map = new Map<number, { numero: string; vehiculeId: number; typeCarte: string }>();
    for (const p of polices) {
      map.set(p.id, {
        numero: p.numero_police ?? `#${p.id}`,
        vehiculeId: p.vehicule_id,
        typeCarte: p.type_carte,
      });
    }
    return map;
  }, [polices]);

  /** Résout vehiculeId → {immatriculation, clientId} */
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

  /** Résout un paiement vers le nom du client */
  const getClientName = useCallback(
    (paiement: Paiement) => {
      const pol = policeMap.get(paiement.police_id);
      if (!pol) return "—";
      const veh = vehiculeMap.get(pol.vehiculeId);
      if (!veh) return "—";
      return clientNameMap.get(veh.clientId) ?? "—";
    },
    [policeMap, vehiculeMap, clientNameMap],
  );

  /** Résout un paiement vers l'immatriculation du véhicule */
  const getImmatriculation = useCallback(
    (paiement: Paiement) => {
      const pol = policeMap.get(paiement.police_id);
      if (!pol) return "";
      return vehiculeMap.get(pol.vehiculeId)?.immatriculation ?? "";
    },
    [policeMap, vehiculeMap],
  );

  // Filtrage par statut côté client
  const filteredByStatut = useMemo(() => {
    if (!filterStatut) return paiements;
    return paiements.filter((p) => {
      const reste = p.reste ?? p.montant_du - p.paye - p.avance;
      return getPaiementStatut(reste, p.montant_du) === filterStatut;
    });
  }, [paiements, filterStatut]);

  // Filtrage texte
  const filteredPaiements = useMemo(() => {
    if (!search) return filteredByStatut;
    const s = search.toLowerCase();
    return filteredByStatut.filter(
      (p) =>
        (policeMap.get(p.police_id)?.numero ?? "").toLowerCase().includes(s) ||
        getClientName(p).toLowerCase().includes(s) ||
        getImmatriculation(p).toLowerCase().includes(s) ||
        p.reference?.toLowerCase().includes(s),
    );
  }, [filteredByStatut, search, policeMap, getClientName, getImmatriculation]);

  // Colonnes du tableau
  const columns = useMemo<ColumnDef<Paiement, unknown>[]>(
    () => [
      {
        accessorKey: "police_id",
        header: "Police",
        cell: ({ getValue }) => {
          const pol = policeMap.get(getValue<number>());
          return <span className="font-medium text-gray-900">{pol?.numero ?? "—"}</span>;
        },
      },
      {
        id: "client",
        header: "Client",
        cell: ({ row }) => getClientName(row.original),
      },
      {
        accessorKey: "montant_du",
        header: t("paiements.montantDu"),
        cell: ({ getValue }) => formatFCFA(getValue<number>()),
      },
      {
        accessorKey: "paye",
        header: t("paiements.paye"),
        cell: ({ getValue }) => (
          <span className="text-green-700">{formatFCFA(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: "avance",
        header: t("paiements.avance"),
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return v > 0 ? <span className="text-blue-700">{formatFCFA(v)}</span> : "—";
        },
      },
      {
        id: "reste",
        header: t("paiements.reste"),
        cell: ({ row }) => {
          const p = row.original;
          const reste = p.reste ?? p.montant_du - p.paye - p.avance;
          return (
            <span className={reste > 0 ? "font-medium text-red-700" : "text-green-700"}>
              {formatFCFA(reste)}
            </span>
          );
        },
      },
      {
        id: "statut",
        header: "Statut",
        cell: ({ row }) => {
          const p = row.original;
          const reste = p.reste ?? p.montant_du - p.paye - p.avance;
          const statut = getPaiementStatut(reste, p.montant_du);
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${statutBadge(statut)}`}>
              {t(`paiements.${statut.toLowerCase()}`)}
            </span>
          );
        },
      },
      {
        accessorKey: "mode",
        header: t("paiements.mode"),
        cell: ({ getValue }) => getValue<string | null>()?.replace("_", " ") ?? "—",
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPaiement(row.original);
                setIsEditOpen(true);
              }}
              className="rounded px-2 py-1 text-xs text-[#614e1a] hover:bg-[#614e1a]/10"
            >
              {t("common.edit")}
            </button>
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
    [t, policeMap, getClientName],
  );

  // Handlers
  const handleCreate = (data: PaiementCreate) => {
    createMutation.mutate(data, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: PaiementCreate) => {
    if (!selectedPaiement) return;
    updateMutation.mutate(
      { id: selectedPaiement.id, ...data },
      { onSuccess: () => setIsEditOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  return (
    <>
      <Header title={t("paiements.title")}>
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
        <div
          className={`flex-1 overflow-auto p-6 ${selectedPaiement && !isEditOpen ? "w-1/2" : ""}`}
        >
          {/* Barre de recherche + filtres */}
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche sur N° police, nom client, immatriculation, référence..."
              className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
            />
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Filtrer par statut de paiement"
            >
              <option value="">Tous les statuts</option>
              <option value="SOLDE">{t("paiements.solde")}</option>
              <option value="PARTIEL">{t("paiements.partiel")}</option>
              <option value="IMPAYE">{t("paiements.impaye")}</option>
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">{t("common.loading")}</p>
          ) : (
            <DataTable
              columns={columns}
              data={filteredPaiements}
              onRowClick={(paiement) => setSelectedPaiement(paiement)}
            />
          )}
        </div>

        {/* Panneau détail */}
        {selectedPaiement && !isEditOpen && (
          <PaiementDetailPanel
            paiement={selectedPaiement}
            policeMap={policeMap}
            vehiculeMap={vehiculeMap}
            clientNameMap={clientNameMap}
            onClose={() => setSelectedPaiement(null)}
            onEdit={() => setIsEditOpen(true)}
            onDelete={() => setDeleteTarget(selectedPaiement)}
            t={t}
          />
        )}
      </div>

      {/* Modal création */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouveau paiement">
        <PaiementForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isPending}
        />
      </Dialog>

      {/* Modal édition */}
      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier le paiement">
        {selectedPaiement && (
          <PaiementForm
            defaultValues={selectedPaiement}
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
        title="Supprimer le paiement"
        message={`Êtes-vous sûr de vouloir supprimer ce paiement de ${deleteTarget ? formatFCFA(deleteTarget.montant_du) : ""} ?`}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </>
  );
}

// ─── Panneau détail ───

interface PaiementDetailPanelProps {
  paiement: Paiement;
  policeMap: Map<number, { numero: string; vehiculeId: number; typeCarte: string }>;
  vehiculeMap: Map<number, { immatriculation: string; clientId: number }>;
  clientNameMap: Map<number, string>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

function PaiementDetailPanel({
  paiement,
  policeMap,
  vehiculeMap,
  clientNameMap,
  onClose,
  onEdit,
  onDelete,
  t,
}: PaiementDetailPanelProps) {
  const pol = policeMap.get(paiement.police_id);
  const veh = pol ? vehiculeMap.get(pol.vehiculeId) : undefined;
  const clientName = veh ? clientNameMap.get(veh.clientId) : undefined;

  const reste = paiement.reste ?? paiement.montant_du - paiement.paye - paiement.avance;
  const statut = getPaiementStatut(reste, paiement.montant_du);

  const statutColors = {
    SOLDE: "bg-green-100 text-green-800",
    PARTIEL: "bg-orange-100 text-orange-800",
    IMPAYE: "bg-red-100 text-red-800",
  };

  return (
    <div className="w-96 shrink-0 overflow-auto border-l border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Détail paiement</h3>
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
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statutColors[statut]}`}>
          {t(`paiements.${statut.toLowerCase()}`)}
        </span>
      </div>

      {/* Montants */}
      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">{t("paiements.montantDu")}</p>
            <p className="text-lg font-bold text-gray-900">{formatFCFA(paiement.montant_du)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("paiements.paye")}</p>
            <p className="text-lg font-bold text-green-700">{formatFCFA(paiement.paye)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("paiements.avance")}</p>
            <p className="text-sm font-medium text-blue-700">{formatFCFA(paiement.avance)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("paiements.reste")}</p>
            <p className={`text-lg font-bold ${reste > 0 ? "text-red-700" : "text-green-700"}`}>
              {formatFCFA(reste)}
            </p>
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="mt-4 space-y-3">
        <DetailField label="Police" value={pol?.numero} />
        <DetailField label="Client" value={clientName} />
        <DetailField label="Véhicule" value={veh?.immatriculation} />
        <DetailField label={t("paiements.mode")} value={paiement.mode?.replace("_", " ")} />
        <DetailField label={t("paiements.reference")} value={paiement.reference} />
        <DetailField label="Date" value={paiement.date_paiement} />
        <DetailField label="Notes" value={paiement.notes} />
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 rounded-lg bg-[#614e1a] px-3 py-2 text-sm font-medium text-white hover:bg-[#8b7335]"
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          {t("common.delete")}
        </button>
      </div>
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
