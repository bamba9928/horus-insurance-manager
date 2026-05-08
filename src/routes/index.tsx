/**
 * Page Dashboard — Tableau de bord principal.
 * Affiche les KPI, les échéances urgentes, les impayés et un tableau récapitulatif complet.
 */

import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../components/data-table/DataTable";
import { Header } from "../components/layout";
import {
  useDashboardKPI,
  useDashboardRecap,
  useEcheances30j,
  useImpayes,
} from "../hooks/useDashboard";
import { formatDateDisplay, formatFCFA } from "../lib/date-utils";
import type { DashboardRecapRow, EcheanceRow, ImpayeRow } from "../lib/ipc";
import { setPrefillSearch } from "../lib/prefill-search";
import { getPaiementStatut } from "../schemas/paiement";

function paiementBadge(statut: string) {
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

function policeBadge(statut: string | null) {
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

type QuickAction = {
  label: string;
  to:
    | "/clients"
    | "/vehicules"
    | "/polices"
    | "/paiements"
    | "/echeances"
    | "/verification"
    | "/parametres";
  tone: "bronze" | "blue" | "green" | "orange" | "slate";
  icon: React.ReactNode;
};

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [recapSearch, setRecapSearch] = useState("");
  const [selectedRecap, setSelectedRecap] = useState<DashboardRecapRow | null>(null);

  const { data: kpi, isLoading: kpiLoading } = useDashboardKPI();
  const { data: echeances = [], isLoading: echeancesLoading } = useEcheances30j();
  const { data: impayes = [], isLoading: impayesLoading } = useImpayes();
  const { data: recapRows = [], isLoading: recapLoading } = useDashboardRecap();

  const quickActions: QuickAction[] = [
    {
      label: "Clients",
      to: "/clients",
      tone: "bronze",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M7 9a3 3 0 100-6 3 3 0 000 6zm6 1a2 2 0 100-4 2 2 0 000 4zM3 15a4 4 0 118 0v1H3v-1zm9 1v-1a5.98 5.98 0 00-1.1-3.45A4 4 0 0117 15v1h-5z" />
        </svg>
      ),
    },
    {
      label: "Véhicules",
      to: "/vehicules",
      tone: "blue",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M4 11l1.5-4.2A2 2 0 017.38 5h5.24a2 2 0 011.88 1.3L16 11v4h-1a1.5 1.5 0 01-3 0H8a1.5 1.5 0 01-3 0H4v-4zm2.1-1h7.8l-1-2.8a.5.5 0 00-.47-.32H7.57a.5.5 0 00-.47.33L6.1 10z" />
        </svg>
      ),
    },
    {
      label: "Polices",
      to: "/polices",
      tone: "green",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-5-5H6zm5 1.5L14.5 7H11V3.5zM7 9h6v1.5H7V9zm0 3h6v1.5H7V12z" />
        </svg>
      ),
    },
    {
      label: "Paiements",
      to: "/paiements",
      tone: "orange",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v1H3V5zm14 3v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8h14zM6 11h4v1.5H6V11z" />
        </svg>
      ),
    },
    {
      label: "Échéances",
      to: "/echeances",
      tone: "orange",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M6 2a.75.75 0 011.5 0v1h5V2a.75.75 0 011.5 0v1H15a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h1V2zm9.5 5h-11v7a.5.5 0 00.5.5h10a.5.5 0 00.5-.5V7zM8 10.25a.75.75 0 010 1.5H6.75a.75.75 0 010-1.5H8z" />
        </svg>
      ),
    },
    {
      label: "Vérification",
      to: "/verification",
      tone: "slate",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M8.5 3a5.5 5.5 0 104.39 8.82l2.64 2.65 1.06-1.06-2.64-2.64A5.5 5.5 0 008.5 3zm0 1.5a4 4 0 110 8 4 4 0 010-8z" />
        </svg>
      ),
    },
    {
      label: "Nouvel Assureur",
      to: "/parametres",
      tone: "slate",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v2.1a5.5 5.5 0 00-1.5-.5V4a.5.5 0 00-.5-.5H7a.5.5 0 00-.5.5v12c0 .28.22.5.5.5h2.8c.16.54.4 1.05.71 1.5H7a2 2 0 01-2-2V4zm8.5 4a4 4 0 100 8 4 4 0 000-8zm0 1.5c.41 0 .75.34.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5c0-.41.34-.75.75-.75z" />
        </svg>
      ),
    },
  ];

  const openModule = (
    target: "clients" | "vehicules" | "polices" | "paiements",
    to: "/clients" | "/vehicules" | "/polices" | "/paiements",
    value: string,
  ) => {
    setPrefillSearch(target, value);
    navigate({ to });
  };

  const filteredRecapRows = useMemo(() => {
    if (!recapSearch.trim()) return recapRows;

    const search = recapSearch.toLowerCase();
    return recapRows.filter((row) =>
      [
        row.nom_prenom,
        row.telephone,
        row.immatriculation,
        row.marque,
        row.modele,
        row.numero_police,
        row.assureur_nom,
        row.police_statut,
      ].some((value) => value?.toLowerCase().includes(search)),
    );
  }, [recapRows, recapSearch]);

  const recapColumns = useMemo<ColumnDef<DashboardRecapRow, unknown>[]>(
    () => [
      {
        accessorKey: "nom_prenom",
        header: "Client",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-slate-100">
              {row.original.nom_prenom}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {row.original.telephone ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "immatriculation",
        header: "Véhicule",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-slate-100">
              {row.original.immatriculation}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {[row.original.marque, row.original.modele].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "assureur_nom",
        header: "Assureur",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "date_echeance",
        header: "Échéance",
        cell: ({ row }) =>
          row.original.date_echeance ? formatDateDisplay(row.original.date_echeance) : "—",
      },
      {
        accessorKey: "montant_du_total",
        header: "Montant dû",
        cell: ({ getValue }) => formatFCFA(getValue<number>()),
      },
      {
        accessorKey: "paye_total",
        header: "Payé",
        cell: ({ getValue }) => (
          <span className="text-green-700 dark:text-green-400">
            {formatFCFA(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "reste_total",
        header: "Reste",
        cell: ({ row }) => {
          const reste = row.original.reste_total;
          return (
            <span
              className={
                reste > 0
                  ? "font-medium text-red-700 dark:text-red-400"
                  : "text-green-700 dark:text-green-400"
              }
            >
              {formatFCFA(reste)}
            </span>
          );
        },
      },
      {
        id: "paiement_statut",
        header: "Statut paiement",
        cell: ({ row }) => {
          const montantDu = row.original.montant_du_total;
          if (montantDu <= 0) {
            return (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                —
              </span>
            );
          }

          const statut = getPaiementStatut(row.original.reste_total, montantDu);
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${paiementBadge(statut)}`}>
              {statut}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openModule("clients", "/clients", row.original.nom_prenom);
              }}
              className="rounded px-2 py-1 text-xs text-[#614e1a] hover:bg-[#614e1a]/10"
            >
              Client
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openModule("vehicules", "/vehicules", row.original.immatriculation);
              }}
              className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              Véhicule
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!row.original.numero_police) return;
                openModule("polices", "/polices", row.original.numero_police);
              }}
              disabled={!row.original.numero_police}
              className="rounded px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-green-300 dark:hover:bg-green-900/20"
            >
              Police
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!row.original.numero_police) return;
                openModule("paiements", "/paiements", row.original.numero_police);
              }}
              disabled={!row.original.numero_police || row.original.paiements_count === 0}
              className="rounded px-2 py-1 text-xs text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-orange-300 dark:hover:bg-orange-900/20"
            >
              Paiements
            </button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  return (
    <>
      <Header title="">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 py-0.5">
            {quickActions.map((action) => (
              <button
                key={action.to}
                type="button"
                onClick={() => navigate({ to: action.to })}
                className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg transition-colors ${
                  action.tone === "bronze"
                    ? "bg-[#614e1a] px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/40"
                    : action.tone === "blue"
                      ? "border border-blue-400/70 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                      : action.tone === "green"
                        ? "border border-green-400/70 px-2.5 text-xs font-semibold text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20"
                        : action.tone === "orange"
                          ? "border border-orange-400/70 px-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                          : "border border-slate-400/60 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Header>
      <div className="overflow-auto p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label={t("dashboard.policesActives")}
            value={kpiLoading ? "…" : String(kpi?.policesActives ?? 0)}
            color="bronze"
          />
          <KPICard
            label={t("dashboard.echeances30j")}
            value={kpiLoading ? "…" : String(kpi?.echeances30j ?? 0)}
            color="orange"
          />
          <KPICard
            label={t("dashboard.impayes")}
            value={kpiLoading ? "…" : formatFCFA(kpi?.totalImpayes ?? 0)}
            color="red"
          />
          <KPICard
            label={t("dashboard.nouveauxClients")}
            value={kpiLoading ? "…" : String(kpi?.nouveauxClientsMois ?? 0)}
            color="green"
          />
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {t("dashboard.echeancesUrgentes")}
              </h3>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                {echeances.length}
              </span>
            </header>
            <div className="max-h-96 overflow-auto">
              {echeancesLoading ? (
                <p className="p-4 text-sm text-gray-500 dark:text-slate-400">
                  {t("common.loading")}
                </p>
              ) : echeances.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-slate-400">
                  Aucune échéance dans les 30 jours.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                  {echeances.map((e) => (
                    <EcheanceItem key={e.id} echeance={e} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Impayés</h3>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                {impayes.length}
              </span>
            </header>
            <div className="max-h-96 overflow-auto">
              {impayesLoading ? (
                <p className="p-4 text-sm text-gray-500 dark:text-slate-400">
                  {t("common.loading")}
                </p>
              ) : impayes.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-slate-400">Aucun impayé.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                  {impayes.map((i) => (
                    <ImpayeItem key={i.id} impaye={i} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section className="mt-7 rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Tableau récapitulatif complet
              </h3>
            </div>

            <div className="w-full sm:max-w-md">
              <input
                type="text"
                value={recapSearch}
                onChange={(e) => setRecapSearch(e.target.value)}
                placeholder="Rechercher client, véhicule, police, assureur..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row">
            <div className="min-w-0 flex-1">
              {recapLoading ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">{t("common.loading")}</p>
              ) : (
                <DataTable
                  columns={recapColumns}
                  data={filteredRecapRows}
                  pageSize={8}
                  onRowClick={(row) => setSelectedRecap(row)}
                />
              )}
            </div>

            {selectedRecap && (
              <RecapDetailPanel
                row={selectedRecap}
                onClose={() => setSelectedRecap(null)}
                onOpenClient={() => openModule("clients", "/clients", selectedRecap.nom_prenom)}
                onOpenVehicule={() =>
                  openModule("vehicules", "/vehicules", selectedRecap.immatriculation)
                }
                onOpenPolice={() => {
                  if (!selectedRecap.numero_police) return;
                  openModule("polices", "/polices", selectedRecap.numero_police);
                }}
                onOpenPaiements={() => {
                  if (!selectedRecap.numero_police) return;
                  openModule("paiements", "/paiements", selectedRecap.numero_police);
                }}
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  color: "bronze" | "orange" | "red" | "green";
}

const COLOR_MAP = {
  bronze: "border-l-[#614e1a] bg-[#614e1a]/5",
  orange: "border-l-orange-500 bg-orange-50",
  red: "border-l-red-500 bg-red-50",
  green: "border-l-green-500 bg-green-50",
};

function KPICard({ label, value, color }: KPICardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${COLOR_MAP[color]}`}
    >
      <p className="text-sm text-gray-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function EcheanceItem({ echeance }: { echeance: EcheanceRow }) {
  const { jours_restants: jours } = echeance;

  const urgenceClass =
    jours < 0
      ? "bg-red-100 text-red-800"
      : jours <= 7
        ? "bg-red-50 text-red-700"
        : jours <= 15
          ? "bg-orange-100 text-orange-800"
          : "bg-orange-50 text-orange-700";

  const urgenceText =
    jours < 0 ? `Expirée (${Math.abs(jours)}j)` : jours === 0 ? "Aujourd'hui" : `Dans ${jours}j`;

  return (
    <li className="px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
            {echeance.nom_prenom}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
            {echeance.immatriculation}
            {echeance.marque && ` - ${echeance.marque}`}
          </p>
          {echeance.telephone && (
            <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{echeance.telephone}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {formatDateDisplay(new Date(echeance.date_echeance))}
          </p>
          <span
            className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${urgenceClass}`}
          >
            {urgenceText}
          </span>
        </div>
      </div>
    </li>
  );
}

function ImpayeItem({ impaye }: { impaye: ImpayeRow }) {
  const ratio = impaye.montant_du > 0 ? (impaye.paye / impaye.montant_du) * 100 : 0;

  return (
    <li className="px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
            {impaye.nom_prenom}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
            {impaye.immatriculation}
            {impaye.numero_police && ` · ${impaye.numero_police}`}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${Math.min(100, ratio)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {formatFCFA(impaye.paye)} / {formatFCFA(impaye.montant_du)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-red-700 dark:text-red-400">
            {formatFCFA(impaye.reste)}
          </p>
          {impaye.date_echeance && (
            <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
              {formatDateDisplay(new Date(impaye.date_echeance))}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function RecapDetailPanel({
  row,
  onClose,
  onOpenClient,
  onOpenVehicule,
  onOpenPolice,
  onOpenPaiements,
}: {
  row: DashboardRecapRow;
  onClose: () => void;
  onOpenClient: () => void;
  onOpenVehicule: () => void;
  onOpenPolice: () => void;
  onOpenPaiements: () => void;
}) {
  const paiementStatut =
    row.montant_du_total > 0 ? getPaiementStatut(row.reste_total, row.montant_du_total) : null;

  return (
    <aside className="w-full shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-4 xl:w-80 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            {row.nom_prenom}
          </h4>
          <p className="text-sm text-gray-500 dark:text-slate-400">{row.immatriculation}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          ×
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <DetailField label="Téléphone" value={row.telephone} />
        <DetailField
          label="Véhicule"
          value={[row.immatriculation, row.marque, row.modele].filter(Boolean).join(" - ")}
        />
        <DetailField label="Police" value={row.numero_police} />
        <DetailField label="Type carte" value={row.type_carte} />
        <DetailField label="Assureur" value={row.assureur_nom} />
        <DetailField
          label="Date d'effet"
          value={row.date_effet ? formatDateDisplay(row.date_effet) : "—"}
        />
        <DetailField
          label="Date d'échéance"
          value={row.date_echeance ? formatDateDisplay(row.date_echeance) : "—"}
        />

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Statut police</p>
          <div className="mt-1">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${policeBadge(row.police_statut)}`}
            >
              {row.police_statut ?? "—"}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Paiements</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {paiementStatut ? (
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${paiementBadge(paiementStatut)}`}
              >
                {paiementStatut}
              </span>
            ) : (
              <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                Aucun paiement
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {row.paiements_count} enregistrement(s)
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">
            Dû: <strong>{formatFCFA(row.montant_du_total)}</strong>
          </p>
          <p className="text-sm text-green-700 dark:text-green-400">
            Payé: <strong>{formatFCFA(row.paye_total)}</strong>
          </p>
          <p className="text-sm text-red-700 dark:text-red-400">
            Reste: <strong>{formatFCFA(row.reste_total)}</strong>
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenClient}
          className="rounded-lg bg-[#614e1a] px-3 py-2 text-sm font-medium text-white hover:bg-[#8b7335]"
        >
          Ouvrir client
        </button>
        <button
          type="button"
          onClick={onOpenVehicule}
          className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
        >
          Ouvrir véhicule
        </button>
        <button
          type="button"
          onClick={onOpenPolice}
          disabled={!row.numero_police}
          className="rounded-lg border border-green-300 px-3 py-2 text-sm text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20"
        >
          Ouvrir police
        </button>
        <button
          type="button"
          onClick={onOpenPaiements}
          disabled={!row.numero_police || row.paiements_count === 0}
          className="rounded-lg border border-orange-300 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
        >
          Ouvrir paiements
        </button>
      </div>
    </aside>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
      <p className="text-sm text-gray-900 dark:text-slate-100">{value || "—"}</p>
    </div>
  );
}
