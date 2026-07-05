/**
 * Page Véhicules — Liste, CRUD, vue maître-détail.
 * Affiche le nom du client propriétaire via une jointure côté UI.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../components/data-table/DataTable";
import { NouveauDossierButton } from "../../components/forms/NouveauDossierButton";
import { VehiculeForm } from "../../components/forms/VehiculeForm";
import { Header } from "../../components/layout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DetailField } from "../../components/ui/DetailField";
import { Dialog } from "../../components/ui/Dialog";
import { Spinner } from "../../components/ui/Spinner";
import { useClients } from "../../hooks/useClients";
import { usePolices } from "../../hooks/usePolices";
import { useDeleteVehicule, useUpdateVehicule, useVehicules } from "../../hooks/useVehicules";
import { formatDateDisplay } from "../../lib/date-utils";
import { consumePrefillSearch } from "../../lib/prefill-search";
import type { Vehicule, VehiculeCreate } from "../../schemas/vehicule";
import { getCategorieLabel } from "../../schemas/vehicule";

export function VehiculesPage() {
  const { t } = useTranslation();

  // State
  const [search, setSearch] = useState(() => consumePrefillSearch("vehicules"));
  const [selectedVehicule, setSelectedVehicule] = useState<Vehicule | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicule | null>(null);

  // Queries & Mutations
  const { data: vehicules = [], isLoading } = useVehicules();
  const { data: clients = [] } = useClients();
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
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {getValue<string>()}
          </span>
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
        header: t("vehicules.categorie"),
        cell: ({ getValue }) => {
          const code = getValue<string | null>();
          if (!code) return "—";
          // Afficher le code court dans la table (lisibilité) — le libellé
          // complet reste visible dans la vue détail.
          return <span className="text-xs">{code.replace("_", " ")}</span>;
        },
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
        <div className="min-w-0 flex-1 sm:flex-none">
          <NouveauDossierButton className="inline-flex h-10 w-full min-w-[8.75rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#614e1a] px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/40 sm:h-8 sm:w-auto sm:min-w-0 sm:px-2.5 sm:text-xs" />
        </div>
      </Header>

      <div className="flex flex-1 overflow-hidden">
        {/* Liste principale */}
        <div
          className={`flex-1 overflow-auto p-4 ${selectedVehicule && !isEditOpen ? "hidden sm:block" : ""}`}
        >
          {/* Barre de recherche */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t("common.search")}...`}
              className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
            />
          </div>

          {isLoading ? (
            <Spinner logoWidth={0} size={28} className="py-6" />
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
          <div className="w-full overflow-auto border-t border-gray-200 bg-white p-4 sm:w-96 sm:shrink-0 sm:border-t-0 sm:border-l">
            <div className="relative">
              <h3 className="text-center text-lg font-semibold text-gray-900">
                {selectedVehicule.immatriculation}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVehicule(null)}
                className="absolute top-0 right-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100"
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
              <DetailField
                label={t("vehicules.categorie")}
                value={getCategorieLabel(selectedVehicule.genre)}
              />
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
                className="flex-1 rounded-lg bg-[#614e1a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335]"
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedVehicule)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
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
                    <li
                      key={p.id}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                    >
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
