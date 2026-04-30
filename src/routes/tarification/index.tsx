/**
 * Page Tarification — calcule le tarif d'une police selon la grille
 * assurance auto Sénégal.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "../../components/layout";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import {
  CYLINDREE_OPTIONS,
  type Cylindree,
  computeTarif,
  formatFCFA,
  getDefaultFrais,
  TARIF_CATEGORIES,
  type TarifCategorie,
  type TarifResult,
} from "../../lib/tarification";

export function TarificationPage() {
  const { t } = useTranslation();

  const [categorie, setCategorie] = useState<TarifCategorie | null>(null);
  const [puissance, setPuissance] = useState<string>("");
  const [places, setPlaces] = useState<string>("");
  const [cylindree, setCylindree] = useState<Cylindree | null>(null);
  const [dureeMois, setDureeMois] = useState<string>("12");
  const [frais, setFrais] = useState<string>("3000");
  const [bonusPct, setBonusPct] = useState<string>("20");

  const [result, setResult] = useState<TarifResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(
    () => TARIF_CATEGORIES.find((c) => c.value === categorie) ?? null,
    [categorie],
  );

  const handleCategorieChange = (v: TarifCategorie | null) => {
    setCategorie(v);
    setResult(null);
    setError(null);
    // Ajuste les frais par défaut selon la catégorie (TPV = 1000)
    if (v) setFrais(String(getDefaultFrais(v)));
  };

  const handleCompute = () => {
    setError(null);
    setResult(null);
    if (!categorie) {
      setError("Sélectionnez une catégorie.");
      return;
    }
    const duree = Number(dureeMois);
    const fraisN = Number(frais);
    const bonus = Number(bonusPct) / 100;
    try {
      const r = computeTarif({
        categorie,
        ...(meta?.needsPuissance ? { puissance: Number(puissance) } : {}),
        ...(meta?.needsPlaces ? { places: Number(places) } : {}),
        ...(meta?.needsCylindree && cylindree ? { cylindree } : {}),
        dureeMois: duree,
        frais: fraisN,
        bonus,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de calcul.");
    }
  };

  const handleReset = () => {
    setCategorie(null);
    setPuissance("");
    setPlaces("");
    setCylindree(null);
    setDureeMois("12");
    setFrais("3000");
    setBonusPct("20");
    setResult(null);
    setError(null);
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <>
      <Header title={t("tarification.title")} />
      <div className="flex-1 overflow-hidden p-4">
        <div className="mx-auto grid h-full max-w-6xl gap-4 lg:grid-cols-2">
          {/* Formulaire */}
          <div className="overflow-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">
              Paramètres
            </h3>

            {/* Catégorie */}
            <div className="mb-3">
              <label htmlFor="tarif-cat" className={labelClass}>
                Catégorie *
              </label>
              <SearchableSelect
                id="tarif-cat"
                value={categorie}
                onChange={(v) => handleCategorieChange(v as TarifCategorie | null)}
                options={TARIF_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                placeholder="— Sélectionner une catégorie —"
              />
            </div>

            {/* Cylindrée (CAT 5) */}
            {meta?.needsCylindree && (
              <div className="mb-3">
                <label htmlFor="tarif-cyl" className={labelClass}>
                  Type de véhicule 2-roues *
                </label>
                <SearchableSelect
                  id="tarif-cyl"
                  value={cylindree}
                  onChange={(v) => setCylindree(v as Cylindree | null)}
                  options={CYLINDREE_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
                  placeholder="— Sélectionner —"
                />
              </div>
            )}

            {/* Puissance fiscale */}
            {meta?.needsPuissance && (
              <div className="mb-3">
                <label htmlFor="tarif-puiss" className={labelClass}>
                  Puissance fiscale (CV) *
                  {meta.maxCV !== undefined && (
                    <span className="ml-1 text-xs text-gray-500">(max {meta.maxCV} CV)</span>
                  )}
                </label>
                <input
                  id="tarif-puiss"
                  type="number"
                  min={1}
                  max={meta.maxCV ?? 100}
                  value={puissance}
                  onChange={(e) => setPuissance(e.target.value)}
                  className={inputClass}
                  placeholder="7"
                />
              </div>
            )}

            {/* Nombre de places (CAT 4 Autocar/Minicar) */}
            {meta?.needsPlaces && (
              <div className="mb-3">
                <label htmlFor="tarif-places" className={labelClass}>
                  Nombre de places *
                </label>
                <input
                  id="tarif-places"
                  type="number"
                  min={2}
                  max={100}
                  value={places}
                  onChange={(e) => setPlaces(e.target.value)}
                  className={inputClass}
                  placeholder="32"
                />
              </div>
            )}

            {/* Durée + bonus */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tarif-duree" className={labelClass}>
                  Durée (mois) *
                </label>
                <input
                  id="tarif-duree"
                  type="number"
                  min={1}
                  max={12}
                  value={dureeMois}
                  onChange={(e) => setDureeMois(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="tarif-bonus" className={labelClass}>
                  Bonus (%)
                </label>
                <input
                  id="tarif-bonus"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={bonusPct}
                  onChange={(e) => setBonusPct(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Frais */}
            <div className="mb-4">
              <label htmlFor="tarif-frais" className={labelClass}>
                Coût de police / Frais (FCFA) *
              </label>
              <input
                id="tarif-frais"
                type="number"
                min={0}
                value={frais}
                onChange={(e) => setFrais(e.target.value)}
                className={inputClass}
                placeholder="3000"
              />
              <p className="mt-1 text-xs text-gray-500">
                Varie selon la compagnie. Défaut : 3 000 (2 000 pour TPV).
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCompute}
                className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b7335]"
              >
                Valider le calcul
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Réinitialiser
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
          </div>

          {/* Résultats */}
          <div className="flex flex-col overflow-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-slate-100">
              Résultat
            </h3>

            {!result ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Complétez le formulaire puis cliquez sur « Valider le calcul » pour afficher le
                tarif détaillé.
              </p>
            ) : (
              <div className="space-y-1.5">
                <ResultRow label="RC Annuel (base)" value={result.rcAnnuel} muted />
                <ResultRow label="R. Civil (prorata)" value={result.rCivil} muted />
                <div className="my-1 border-t border-gray-200 dark:border-slate-700" />
                <ResultRow label="Prime Nette" value={result.primeNette} />
                <ResultRow label="Frais" value={result.frais} />
                <ResultRow label="Taxe (14 %)" value={result.taxe} />
                <ResultRow label="FGA (2,5 %)" value={result.fga} />
                {result.carteBrune > 0 && (
                  <ResultRow label="Carte brune" value={result.carteBrune} muted />
                )}
                <ResultRow label="Prime Totale" value={result.primeTotale} highlight />
                <ResultRow
                  label={`Commission (${Math.round(result.tauxCommission * 100)} %)`}
                  value={result.commission}
                />
                <ResultRow
                  label="Net à Verser"
                  value={result.netAVerser}
                  highlight
                  variant="success"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

interface ResultRowProps {
  label: string;
  value: number;
  muted?: boolean;
  highlight?: boolean;
  variant?: "success";
}

function ResultRow({ label, value, muted, highlight, variant }: ResultRowProps) {
  const base = "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors";
  const tone = muted
    ? "bg-gray-50 text-gray-600 dark:bg-slate-700/50 dark:text-slate-400"
    : highlight
      ? variant === "success"
        ? "bg-green-50 text-green-800 font-semibold dark:bg-green-900/30 dark:text-green-200"
        : "bg-[#614e1a]/10 text-[#614e1a] font-semibold dark:bg-[#d4b85a]/10 dark:text-[#d4b85a]"
      : "bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100";
  return (
    <div className={`${base} ${tone}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatFCFA(value)} FCFA</span>
    </div>
  );
}
