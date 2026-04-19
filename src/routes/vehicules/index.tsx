/**
 * Page Véhicules — Liste, CRUD, vue maître-détail.
 * Affiche le nom du client propriétaire via une jointure côté UI.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../components/data-table/DataTable";
import { VehiculeForm } from "../../components/forms/VehiculeForm";
import { Header } from "../../components/layout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import { useClients } from "../../hooks/useClients";
import { usePolices } from "../../hooks/usePolices";
import {
  useCreateVehicule,
  useDeleteVehicule,
  useUpdateVehicule,
  useVehicules,
} from "../../hooks/useVehicules";
import { formatDateDisplay } from "../../lib/date-utils";
import type { Vehicule, VehiculeCreate } from "../../schemas/vehicule";

export function VehiculesPage() {
  const { t } = useTranslation();

  // State
  const [search, setSearch] = useState("");
  const [selectedVehicule, setSelectedVehicule] = useState<Vehicule | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicule | null>(null);

  // Queries & Mutations
  const { data: vehicules = [], isLoading } = useVehicules();
  const { data: clients = [] } = useClients();
  const createMutation = useCreateVehicule();
  const updateMutation = useUpdateVehicule();
  const deleteMutation = useDeleteVehicule();
  const { data: vehiculePolices = [] } = usePolices(
    selectedVehicule ? { vehiculeId: selectedVehicule.id } : undefined,
  );

  /** Résout le nom du client propriétaire */
  const clientNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of clients) {
      map.set(c.id, c.nom_prenom);
    }
    return map;
  }, [clients]);

  // Colonnes du tableau
  const columns = useMemo<ColumnDef<Vehicule, unknown>[]>(
    () => [
      {
        accessorKey: "immatriculation",
        header: t("vehicules.immatriculation"),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "marque",
        header: t("vehicules.marque"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "modele",
        header: t("vehicules.modele"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "genre",
        header: t("vehicules.genre"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "client_id",
        header: t("vehicules.client"),
        cell: ({ getValue }) => clientNameMap.get(getValue<number>()) ?? "—",
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
                setSelectedVehicule(row.original);
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
    [t, clientNameMap],
  );

  // Filtrage côté client sur immatriculation, marque, modèle
  const filteredVehicules = useMemo(() => {
    if (!search) return vehicules;
    const s = search.toLowerCase();
    return vehicules.filter(
      (v) =>
        v.immatriculation.toLowerCase().includes(s) ||
        v.marque?.toLowerCase().includes(s) ||
        v.modele?.toLowerCase().includes(s) ||
        (clientNameMap.get(v.client_id) ?? "").toLowerCase().includes(s),
    );
  }, [vehicules, search, clientNameMap]);

  // Handlers
  const handleCreate = (data: VehiculeCreate) => {
    createMutation.mutate(data, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: VehiculeCreate) => {
    if (!selectedVehicule) return;
    updateMutation.mutate(
      { id: selectedVehicule.id, ...data },
      { onSuccess: () => setIsEditOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  return (
    <>
      <Header title={t("vehicules.title")}>
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
          className={`flex-1 overflow-auto p-6 ${selectedVehicule && !isEditOpen ? "w-1/2" : ""}`}
        >
          {/* Barre de recherche */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t("common.search")}...`}
              className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">{t("common.loading")}</p>
          ) : (
            <DataTable
              columns={columns}
              data={filteredVehicules}
              onRowClick={(vehicule) => setSelectedVehicule(vehicule)}
            />
          )}
        </div>

        {/* Panneau détail (maître-détail) */}
        {selectedVehicule && !isEditOpen && (
          <div className="w-96 shrink-0 overflow-auto border-l border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedVehicule.immatriculation}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVehicule(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <DetailField
                label={t("vehicules.client")}
                value={clientNameMap.get(selectedVehicule.client_id)}
              />
              <DetailField
                label={t("vehicules.immatriculation")}
                value={selectedVehicule.immatriculation}
              />
              <DetailField label={t("vehicules.marque")} value={selectedVehicule.marque} />
              <DetailField label={t("vehicules.modele")} value={selectedVehicule.modele} />
              <DetailField label={t("vehicules.genre")} value={selectedVehicule.genre} />
              <DetailField
                label={t("vehicules.typeVehicule")}
                value={selectedVehicule.type_vehicule}
              />
              <DetailField
                label={t("vehicules.puissance")}
                value={selectedVehicule.puissance?.toString()}
              />
              <DetailField
                label={t("vehicules.places")}
                value={selectedVehicule.places?.toString()}
              />
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="flex-1 rounded-lg bg-[#614e1a] px-3 py-2 text-sm font-medium text-white hover:bg-[#8b7335]"
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedVehicule)}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                {t("common.delete")}
              </button>
            </div>

            {/* Polices du véhicule */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Polices ({vehiculePolices.length})
              </h4>
              {vehiculePolices.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">Aucune police enregistrée.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {vehiculePolices.map((p) => (
                    <li key={p.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {p.numero_police ?? `#${p.id}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateDisplay(new Date(p.date_effet))} — {p.duree_mois} mois
                        {p.statut && p.statut !== "ACTIVE" && (
                          <span className="ml-1 text-gray-400">({p.statut})</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal création */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouveau véhicule">
        <VehiculeForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isPending}
        />
      </Dialog>

      {/* Modal édition */}
      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier le véhicule">
        {selectedVehicule && (
          <VehiculeForm
            defaultValues={selectedVehicule}
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
        title="Supprimer le véhicule"
        message={`Êtes-vous sûr de vouloir supprimer le véhicule "${deleteTarget?.immatriculation}" ? Les polices associées seront aussi supprimées.`}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </>
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
