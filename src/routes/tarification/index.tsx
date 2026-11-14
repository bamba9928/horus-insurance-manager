/**
 * Page Tarification — calcule le tarif d'une police selon la grille
 * assurance auto Sénégal.
 *
 * La prime de base (RC au prorata, avant réduction) est relevée chez ASS en
 * direct, via Horus, quand c'est possible : c'est elle qui dérive quand ASS
 * change ses tables. Réduction, frais, taxe et FGA restent les règles du
 * guichet. Sans réponse d'ASS (version bureau, durée en jours, Horus
 * injoignable), le barème local sert d'estimation, signalée comme telle.
 *
 * Le TPV a sa propre page : `routes/tarification/tpv.tsx`.
 */

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "../../components/layout";
import { ResultRow } from "../../components/ui/ResultRow";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { getAssPrimeBase } from "../../lib/ipc";
import {
  CYLINDREE_OPTIONS,
  type Cylindree,
  computeTarif,
  formatFCFA,
  getDefaultBonus,
  getDefaultFrais,
  isTpv,
  TARIF_CATEGORIES,
  type TarifCategorie,
  type TarifResult,
} from "../../lib/tarification";

const CATEGORIES_GENERALES = TARIF_CATEGORIES.filter((c) => !isTpv(c.value));

export function TarificationPage() {
  const { t } = useTranslation();

  const [categorie, setCategorie] = useState<TarifCategorie | null>(null);
  const [puissance, setPuissance] = useState<string>("");
  const [cylindree, setCylindree] = useState<Cylindree | null>(null);
  const [dureeMois, setDureeMois] = useState<string>("");
  const [dureeUnite, setDureeUnite] = useState<"mois" | "jours">("mois");
  const [frais, setFrais] = useState<string>("3000");
  const [bonusPct, setBonusPct] = useState<string>("20");
  const [carteBrune, setCarteBrune] = useState(true);

  const [result, setResult] = useState<TarifResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Statut de la prime de base ASS : en cours, relevée, indisponible, erreur.
  const [assStatus, setAssStatus] = useState<"idle" | "loading" | "ok" | "local" | "error">("idle");
  const [assError, setAssError] = useState<string | null>(null);
  // Ignore la réponse d'un calcul précédent si l'utilisateur a relancé entre-temps.
  const computeId = useRef(0);

  const meta = useMemo(
    () => CATEGORIES_GENERALES.find((c) => c.value === categorie) ?? null,
    [categorie],
  );

  const handleCategorieChange = (v: TarifCategorie | null) => {
    setCategorie(v);
    setResult(null);
    setError(null);
    // Ajuste frais et réduction par défaut selon la catégorie (TPC 40 %, autres 20 %)
    if (v) {
      setFrais(String(getDefaultFrais(v)));
      setBonusPct(String(getDefaultBonus(v) * 100));
    }
  };

  const handleCompute = async () => {
    const id = ++computeId.current;
    setError(null);
    setResult(null);
    setAssStatus("idle");
    setAssError(null);
    if (!categorie) {
      setError("Sélectionnez une catégorie.");
      return;
    }
    if (!dureeMois) {
      setError("Sélectionnez une durée.");
      return;
    }
    const duree = Number(dureeMois);
    const fraisN = Number(frais);
    const bonus = Number(bonusPct) / 100;
    const tarifInput = {
      categorie,
      ...(meta?.needsPuissance ? { puissance: Number(puissance) } : {}),
      ...(meta?.needsCylindree && cylindree ? { cylindree } : {}),
      ...(dureeUnite === "jours" ? { dureeJours: duree } : { dureeMois: duree }),
      frais: fraisN,
      bonus,
      carteBrune,
    };
    try {
      setResult(computeTarif(tarifInput));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de calcul.");
      return;
    }

    // ASS ne tarifie en ligne que des durées en mois.
    if (dureeUnite !== "mois") {
      setAssStatus("local");
      return;
    }
    setAssStatus("loading");
    try {
      const ass = await getAssPrimeBase({
        categorie,
        ...(meta?.needsPuissance ? { puissance: Number(puissance) } : {}),
        ...(meta?.needsCylindree && cylindree ? { cylindree } : {}),
        dureeMois: duree,
      });
      if (id !== computeId.current) return;
      if (!ass) {
        setAssStatus("local");
        return;
      }
      setResult(computeTarif({ ...tarifInput, rcProrataAss: ass.primeBase }));
      setAssStatus("ok");
    } catch (e) {
      if (id !== computeId.current) return;
      setAssStatus("error");
      setAssError(e instanceof Error ? e.message : "Tarif ASS injoignable.");
    }
  };

  const handleReset = () => {
    setCategorie(null);
    setPuissance("");
    setCylindree(null);
    setDureeMois("");
    setDureeUnite("mois");
    setFrais("3000");
    setBonusPct("20");
    setCarteBrune(true);
    setResult(null);
    setError(null);
    setAssStatus("idle");
    setAssError(null);
    computeId.current += 1;
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";
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
                options={CATEGORIES_GENERALES.map((c) => ({ value: c.value, label: c.label }))}
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
                </label>
                <input
                  id="tarif-puiss"
                  type="number"
                  min={1}
                  max={100}
                  value={puissance}
                  onChange={(e) => setPuissance(e.target.value)}
                  className={inputClass}
                  placeholder="7"
                />
              </div>
            )}

            {/* Durée + réduction */}
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tarif-duree" className={labelClass}>
                  Durée *
                </label>
                <div className="flex gap-2">
                  <input
                    id="tarif-duree"
                    type="number"
                    min={1}
                    max={dureeUnite === "jours" ? 365 : 12}
                    value={dureeMois}
                    onChange={(e) => setDureeMois(e.target.value)}
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
                <label htmlFor="tarif-bonus" className={labelClass}>
                  Réduction (%)
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
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
              <input
                id="tarif-carte-brune"
                type="checkbox"
                checked={carteBrune}
                onChange={(e) => setCarteBrune(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-[#614e1a]"
              />
              Carte brune CEDEAO (+300 FCFA sur le TTC)
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleCompute()}
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
                <SourceNotice result={result} status={assStatus} error={assError} />
                <ResultRow label="RC Annuel (barème)" value={result.rcAnnuel} muted />
                <ResultRow
                  label={
                    result.source === "ASS"
                      ? "Prime de base ASS (avant réduction)"
                      : "RC prorata (avant réduction)"
                  }
                  value={result.rcProrata}
                  muted
                />
                <ResultRow
                  label={`Réduction (${Math.round(result.tauxReductionEffectif * 1000) / 10} %)`}
                  value={result.reduction}
                  muted
                />
                <div className="my-1 border-t border-gray-200 dark:border-slate-700" />
                <ResultRow label="Prime RC / Prime Nette" value={result.primeNette} />
                <ResultRow label="Frais" value={result.frais} />
                <ResultRow label="Taxe (14 %)" value={result.taxe} />
                <ResultRow label="FGA (2,5 %)" value={result.fga} />
                {result.carteBrune > 0 && (
                  <ResultRow label="CEDEAO" value={result.carteBrune} muted />
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

/** Indique d'où vient la prime de base, et signale un barème local périmé. */
function SourceNotice({
  result,
  status,
  error,
}: {
  result: TarifResult;
  status: "idle" | "loading" | "ok" | "local" | "error";
  error: string | null;
}) {
  const base = "mb-2 rounded-lg px-3 py-2 text-xs";
  if (status === "loading") {
    return (
      <p className={`${base} bg-gray-50 text-gray-600 dark:bg-slate-700/50 dark:text-slate-300`}>
        Vérification de la prime de base auprès d'ASS…
      </p>
    );
  }
  if (result.source === "ASS") {
    const gap = result.rcProrata - result.rcProrataBareme;
    return (
      <div className="space-y-1">
        <p
          className={`${base} bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200`}
        >
          Prime de base relevée chez ASS en direct (via Horus).
        </p>
        {gap !== 0 && (
          <p
            className={`${base} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200`}
          >
            Le barème local donnait {formatFCFA(result.rcProrataBareme)} FCFA ({gap > 0 ? "+" : ""}
            {formatFCFA(gap)} FCFA chez ASS) : barème à mettre à jour.
          </p>
        )}
      </div>
    );
  }
  if (status === "error") {
    return (
      <p className={`${base} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200`}>
        Tarif ASS injoignable ({error}) : estimation sur le barème local.
      </p>
    );
  }
  if (status === "local") {
    return (
      <p className={`${base} bg-gray-50 text-gray-600 dark:bg-slate-700/50 dark:text-slate-300`}>
        Estimation sur le barème local (tarif ASS en direct indisponible pour ce cas).
      </p>
    );
  }
  return null;
}
