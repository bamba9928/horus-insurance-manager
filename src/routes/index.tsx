/**
 * Page Dashboard — Tableau de bord principal.
 * Affiche les KPI, les échéances urgentes (30j) et les impayés à partir des vues SQL.
 */

import { useTranslation } from "react-i18next";
import { Header } from "../components/layout";
import { useDashboardKPI, useEcheances30j, useImpayes } from "../hooks/useDashboard";
import { formatDateDisplay, formatFCFA } from "../lib/date-utils";
import type { EcheanceRow, ImpayeRow } from "../lib/ipc";

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: kpi, isLoading: kpiLoading } = useDashboardKPI();
  const { data: echeances = [], isLoading: echeancesLoading } = useEcheances30j();
  const { data: impayes = [], isLoading: impayesLoading } = useImpayes();

  return (
    <>
      <Header title={t("dashboard.title")} />
      <div className="overflow-auto p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Deux colonnes : Échéances urgentes + Impayés */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Échéances urgentes */}
          <section className="rounded-lg border border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {t("dashboard.echeancesUrgentes")}
              </h3>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                {echeances.length}
              </span>
            </header>
            <div className="max-h-96 overflow-auto">
              {echeancesLoading ? (
                <p className="p-6 text-sm text-gray-500">{t("common.loading")}</p>
              ) : echeances.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Aucune échéance dans les 30 jours.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {echeances.map((e) => (
                    <EcheanceItem key={e.id} echeance={e} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Impayés */}
          <section className="rounded-lg border border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Impayés</h3>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                {impayes.length}
              </span>
            </header>
            <div className="max-h-96 overflow-auto">
              {impayesLoading ? (
                <p className="p-6 text-sm text-gray-500">{t("common.loading")}</p>
              ) : impayes.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Aucun impayé. 🎉</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {impayes.map((i) => (
                    <ImpayeItem key={i.id} impaye={i} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ─── Sous-composants ───

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
      className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 ${COLOR_MAP[color]}`}
    >
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/** Élément d'échéance avec couleur selon l'urgence */
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
    <li className="px-6 py-3 transition-colors hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{echeance.nom_prenom}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {echeance.immatriculation}
            {echeance.marque && ` — ${echeance.marque}`} · {echeance.type_carte}
          </p>
          {echeance.telephone && (
            <p className="mt-0.5 text-xs text-gray-400">☎ {echeance.telephone}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-500">
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

/** Élément d'impayé */
function ImpayeItem({ impaye }: { impaye: ImpayeRow }) {
  const ratio = impaye.montant_du > 0 ? (impaye.paye / impaye.montant_du) * 100 : 0;

  return (
    <li className="px-6 py-3 transition-colors hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{impaye.nom_prenom}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {impaye.immatriculation}
            {impaye.numero_police && ` · ${impaye.numero_police}`}
          </p>
          {/* Barre de progression */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${Math.min(100, ratio)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {formatFCFA(impaye.paye)} / {formatFCFA(impaye.montant_du)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-red-700">{formatFCFA(impaye.reste)}</p>
          {impaye.date_echeance && (
            <p className="mt-0.5 text-xs text-gray-400">
              {formatDateDisplay(new Date(impaye.date_echeance))}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
