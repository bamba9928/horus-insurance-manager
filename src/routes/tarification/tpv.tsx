/**
 * Page Tarification TPV — CAT 04, transport public de voyageurs
 * (taxis, minicars, autocars).
 *
 * RC annuelle = base selon la puissance + surprime selon le nombre de places.
 * Le calcul reste celui de `computeTarif`. ASS ne tarifant pas le TPV en ligne,
 * le barème local est ici la seule source.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "../../components/layout";
import { ResultRow } from "../../components/ui/ResultRow";
import { computeTarif, getDefaultFrais, type TarifResult } from "../../lib/tarification";
import { TPV_PLACES_MIN, TPV_SEGMENTS } from "../../lib/tarification-tpv";

const CATEGORIE_TPV = "CAT_04_TPV";
const FRAIS_DEFAUT = String(getDefaultFrais(CATEGORIE_TPV));

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";
const labelClass = "block text-sm font-medium text-gray-700";

function findSegmentLabel(places: number): string | null {
  const segment = TPV_SEGMENTS.find(
    (s) => places >= s.min && (s.max === undefined || places <= s.max),
  );
  return segment?.label ?? null;
}

export function TarificationTpvPage() {
  const { t } = useTranslation();

  const [puissance, setPuissance] = useState("");
  const [places, setPlaces] = useState("");
  const [duree, setDuree] = useState("");
  const [dureeUnite, setDureeUnite] = useState<"mois" | "jours">("mois");
  const [frais, setFrais] = useState(FRAIS_DEFAUT);

  const [result, setResult] = useState<TarifResult | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompute = () => {
    setError(null);
    setResult(null);
    if (!duree) {
      setError("Indiquez une durée.");
      return;
    }
    if (frais.trim() === "") {
      setError("Indiquez les frais.");
      return;
    }
    const nbPlaces = Number(places);
    try {
      setResult(
        computeTarif({
          categorie: CATEGORIE_TPV,
          puissance: Number(puissance),
          places: nbPlaces,
          ...(dureeUnite === "jours"
            ? { dureeJours: Number(duree) }
            : { dureeMois: Number(duree) }),
          frais: Number(frais),
        }),
      );
      setSegment(findSegmentLabel(nbPlaces));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de calcul.");
    }
  };

  const handleReset = () => {
    setPuissance("");
    setPlaces("");
    setDuree("");
    setDureeUnite("mois");
    setFrais(FRAIS_DEFAUT);
    setResult(null);
    setSegment(null);
    setError(null);
  };

  return (
    <>
      <Header title={t("tarification.tpvTitle")} />
      <div className="flex-1 overflow-auto p-4 lg:overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-4 lg:h-full lg:grid-cols-2">
          {/* Formulaire */}
          <div className="overflow-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">
              Taxi, minicar, autocar
            </h3>

            <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tpv-puissance" className={labelClass}>
                  Puissance fiscale (CV) *
                </label>
                <input
                  id="tpv-puissance"
                  type="number"
                  min={2}
                  max={100}
                  value={puissance}
                  onChange={(e) => setPuissance(e.target.value)}
                  className={inputClass}
                  placeholder="7"
                />
              </div>
              <div>
                <label htmlFor="tpv-places" className={labelClass}>
                  Nombre de places *
                </label>
                <input
                  id="tpv-places"
                  type="number"
                  min={TPV_PLACES_MIN}
                  max={100}
                  value={places}
                  onChange={(e) => setPlaces(e.target.value)}
                  className={inputClass}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tpv-duree" className={labelClass}>
                  Durée *
                </label>
                <div className="flex gap-2">
                  <input
                    id="tpv-duree"
                    type="number"
                    min={1}
                    max={dureeUnite === "jours" ? 365 : 12}
                    value={duree}
                    onChange={(e) => setDuree(e.target.value)}
                    className={inputClass}
                    placeholder={dureeUnite === "jours" ? "20" : "12"}
                  />
                  <select
                    aria-label="Unité de durée"
                    value={dureeUnite}
                    onChange={(e) => setDureeUnite(e.target.value as "mois" | "jours")}
                    className={`${inputClass} w-24`}
                  >
                    <option value="mois">mois</option>
                    <option value="jours">jours</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="tpv-frais" className={labelClass}>
                  Coût de police / Frais (FCFA) *
                </label>
                <input
                  id="tpv-frais"
                  type="number"
                  min={0}
                  value={frais}
                  onChange={(e) => setFrais(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCompute}
                className="rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#8b7335]"
              >
                Valider le calcul
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Réinitialiser
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">{error}</p>
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
                {segment && (
                  <p className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-slate-700/50 dark:text-slate-200">
                    {segment}
                  </p>
                )}
                <ResultRow label="RC Annuel (barème)" value={result.rcAnnuel} muted />
                <div className="my-1 border-t border-gray-200 dark:border-slate-700" />
                <ResultRow label="Prime RC" value={result.rCivil} />
                <ResultRow label="Individuelle Conducteur" value={result.individuelleConducteur} />
                <ResultRow label="Prime Nette" value={result.primeNette} />
                <ResultRow label="Frais" value={result.frais} />
                <ResultRow label="Taxe (14 %)" value={result.taxe} />
                <ResultRow label="FGA (2,5 %)" value={result.fga} />
                <ResultRow label="Carte brune" value={result.carteBrune} />
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
