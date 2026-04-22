/**
 * Page Clients — Liste, CRUD, vue maître-détail.
 * Modèle de référence pour les autres modules.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../components/data-table/DataTable";
import { ClientForm } from "../../components/forms/ClientForm";
import { Header } from "../../components/layout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from "../../hooks/useClients";
import { useVehicules } from "../../hooks/useVehicules";
import type { Client, ClientCreate } from "../../schemas/client";

export function ClientsPage() {
  const { t } = useTranslation();

  // State
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  // Queries & Mutations
  const { data: clients = [], isLoading } = useClients({ search });
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();
  const { data: clientVehicules = [] } = useVehicules(selectedClient?.id ?? undefined);

  // Colonnes du tableau
  const columns = useMemo<ColumnDef<Client, unknown>[]>(
    () => [
      {
        accessorKey: "nom_prenom",
        header: t("clients.nomPrenom"),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "telephone",
        header: t("clients.telephone"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "email",
        header: t("clients.email"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "adresse",
        header: t("clients.adresse"),
        cell: ({ getValue }) => (
          <span className="max-w-[200px] truncate block">{getValue<string | null>() ?? "—"}</span>
        ),
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
                setSelectedClient(row.original);
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
    [t],
  );

  // Handlers
  const handleCreate = (data: ClientCreate) => {
    createMutation.mutate(data, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: ClientCreate) => {
    if (!selectedClient) return;
    updateMutation.mutate(
      { id: selectedClient.id, ...data },
      { onSuccess: () => setIsEditOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  return (
    <>
      <Header title={t("clients.title")}>
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
        <div className={`flex-1 overflow-auto p-4 ${selectedClient && !isEditOpen ? "w-1/2" : ""}`}>
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
              data={clients}
              globalFilter={search}
              onRowClick={(client) => setSelectedClient(client)}
            />
          )}
        </div>

        {/* Panneau détail (maître-détail) */}
        {selectedClient && !isEditOpen && (
          <div className="w-96 shrink-0 overflow-auto border-l border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Détail client</h3>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <DetailField label={t("clients.nomPrenom")} value={selectedClient.nom_prenom} />
              <DetailField label={t("clients.telephone")} value={selectedClient.telephone} />
              <DetailField label={t("clients.email")} value={selectedClient.email} />
              <DetailField label={t("clients.adresse")} value={selectedClient.adresse} />
              <DetailField label={t("clients.notes")} value={selectedClient.notes} />
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
                onClick={() => setDeleteTarget(selectedClient)}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                {t("common.delete")}
              </button>
            </div>

            {/* Véhicules du client */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Véhicules ({clientVehicules.length})
              </h4>
              {clientVehicules.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">Aucun véhicule enregistré.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {clientVehicules.map((v) => (
                    <li key={v.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">{v.immatriculation}</span>
                      {v.marque && (
                        <span className="ml-2 text-gray-500">
                          {v.marque} {v.modele ?? ""}
                        </span>
                      )}
                      {v.genre && (
                        <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {v.genre}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal création */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouveau client">
        <ClientForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isPending}
        />
      </Dialog>

      {/* Modal édition */}
      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier le client">
        {selectedClient && (
          <ClientForm
            defaultValues={selectedClient}
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
        title="Supprimer le client"
        message={`Êtes-vous sûr de vouloir supprimer "${deleteTarget?.nom_prenom}" ? Cette action supprimera aussi ses véhicules et polices associés.`}
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
