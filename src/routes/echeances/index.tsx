/**
 * Page Échéances — Liste filtrée par fenêtre (J-7, J+30, J+60, J+90, Expirées)
 * avec export PDF/XLSX.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../components/data-table/DataTable";
import { Header } from "../../components/layout";
import { type EcheancePreset, useEcheances } from "../../hooks/useEcheances";
import { formatDateDisplay } from "../../lib/date-utils";
import { exportEcheancesToPDF, exportEcheancesToXLSX } from "../../lib/export";
import type { EcheanceRow } from "../../lib/ipc";

/** Libellés utilisateur des presets. */
const PRESET_LABELS: Record<EcheancePreset, string> = {
  "J-7": "7 derniers jours",
  "J+30": "30 prochains jours",
  "J+60": "60 prochains jours",
  "J+90": "90 prochains jours",
  EXPIREES: "Expirées",
};

const PRESETS: EcheancePreset[] = ["J-7", "J+30", "J+60", "J+90", "EXPIREES"];

/** Badge de couleur selon jours_restants. */
function urgenceBadge(jours: number): { className: string; label: string } {
  if (jours < 0) {
    return {
      className: "bg-red-100 text-red-800",
      label: `Expirée (${Math.abs(jours)}j)`,
    };
  }
  if (jours === 0) return { className: "bg-red-100 text-red-800", label: "Aujourd'hui" };
  if (jours <= 7) return { className: "bg-red-50 text-red-700", label: `Dans ${jours}j` };
  if (jours <= 15) return { className: "bg-orange-100 text-orange-800", label: `Dans ${jours}j` };
  if (jours <= 30) return { className: "bg-orange-50 text-orange-700", label: `Dans ${jours}j` };
  return { className: "bg-green-50 text-green-700", label: `Dans ${jours}j` };
}

export function EcheancesPage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<EcheancePreset>("J+30");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: echeances = [], isLoading } = useEcheances(preset);

  // Filtrage texte
  const filtered = useMemo(() => {
    if (!search) return echeances;
    const s = search.toLowerCase();
    return echeances.filter(
      (e) =>
        e.nom_prenom.toLowerCase().includes(s) ||
        e.immatriculation.toLowerCase().includes(s) ||
        (e.marque?.toLowerCase().includes(s) ?? false) ||
        (e.numero_police?.toLowerCase().includes(s) ?? false) ||
        (e.telephone?.toLowerCase().includes(s) ?? false),
    );
  }, [echeances, search]);

  const columns = useMemo<ColumnDef<EcheanceRow, unknown>[]>(
    () => [
      {
        accessorKey: "nom_prenom",
        header: "Client",
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
        accessorKey: "immatriculation",
        header: t("vehicules.immatriculation"),
      },
      {
        accessorKey: "marque",
        header: t("vehicules.marque"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "numero_police",
        header: t("polices.numero"),
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "type_carte",
        header: t("polices.typeCarte"),
        cell: ({ getValue }) => {
          const v = getValue<string>();
          const cls =
            v === "VERTE" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
          return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{v}</span>;
        },
      },
      {
        accessorKey: "date_echeance",
        header: t("polices.dateEcheance"),
        cell: ({ getValue }) => formatDateDisplay(new Date(getValue<string>())),
      },
      {
        accessorKey: "jours_restants",
        header: t("echeances.joursRestants"),
        cell: ({ getValue }) => {
          const { className, label } = urgenceBadge(getValue<number>());
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
          );
        },
      },
    ],
    [t],
  );

  const handleExportPDF = async () => {
    if (filtered.length === 0) return;
    setIsExporting(true);
    try {
      await exportEcheancesToPDF(filtered, `Échéances — ${PRESET_LABELS[preset]}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXLSX = async () => {
    if (filtered.length === 0) return;
    setIsExporting(true);
    try {
      await exportEcheancesToXLSX(filtered, `Échéances — ${PRESET_LABELS[preset]}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Header title={t("echeances.title")}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting || filtered.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {t("common.export")} PDF
          </button>
          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={isExporting || filtered.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {t("common.export")} XLSX
          </button>
        </div>
      </Header>
      <div className="overflow-auto p-6">
        {/* Filtres par période */}
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                preset === p
                  ? "border-[#614e1a] bg-[#614e1a] text-white"
                  : "border-gray-300 text-gray-700 hover:bg-[#614e1a] hover:text-white"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche sur nom client, immatriculation, marque, N° police..."
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
          />
        </div>

        {/* Compteur */}
        <p className="mb-3 text-sm text-gray-600">
          <span className="font-semibold">{filtered.length}</span> échéance
          {filtered.length > 1 ? "s" : ""} — {PRESET_LABELS[preset]}
        </p>

        {isLoading ? (
          <p className="text-sm text-gray-500">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">{t("common.noData")}</p>
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </div>
    </>
  );
}
