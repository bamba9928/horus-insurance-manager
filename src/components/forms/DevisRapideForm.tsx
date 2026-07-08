import { MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { formatFCFA } from "../../lib/date-utils";
import {
  buildWhatsAppDevisUrl,
  computeDevisRapide,
  DEVIS_CATEGORY_GROUPS,
  type DevisCategorieCode,
  type DevisRapideResult,
  getDevisGenreLabel,
  getDevisGenresByCategorie,
} from "../../lib/devis";
import {
  CYLINDREE_OPTIONS,
  type Cylindree,
  TARIF_CATEGORIES,
  type TarifCategorie,
} from "../../lib/tarification";
import { DUREES_MOIS } from "../../schemas/police";
import { SearchableSelect } from "../ui/SearchableSelect";

type DevisState =
  | {
      result: DevisRapideResult;
      error: null;
    }
  | {
      result: null;
      error: string | null;
    };

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

const labelClass = "block text-sm font-medium text-green-700 dark:text-green-400";

export function DevisRapideForm() {
  const [categorie, setCategorie] = useState<DevisCategorieCode | null>(null);
  const [genre, setGenre] = useState<TarifCategorie | null>(null);
  const [puissance, setPuissance] = useState("");
  const [places, setPlaces] = useState("");
  const [cylindree, setCylindree] = useState<Cylindree | null>(null);
  const [dureeMois, setDureeMois] = useState("");

  const genreOptions = useMemo(() => getDevisGenresByCategorie(categorie), [categorie]);
  const selectedGenre = useMemo(
    () => TARIF_CATEGORIES.find((item) => item.value === genre) ?? null,
    [genre],
  );
  const selectedCategorieLabel =
    DEVIS_CATEGORY_GROUPS.find((item) => item.value === categorie)?.label ?? "";
  const selectedCylindreeLabel =
    CYLINDREE_OPTIONS.find((item) => item.value === cylindree)?.label ?? "";

  const devis = useMemo<DevisState>(() => {
    if (!genre || !selectedGenre || !dureeMois) return { result: null, error: null };

    const duree = Number(dureeMois);
    if (!Number.isFinite(duree)) return { result: null, error: "Durée invalide." };

    if (selectedGenre.needsPuissance && !puissance) return { result: null, error: null };
    if (selectedGenre.needsPlaces && !places) return { result: null, error: null };
    if (selectedGenre.needsCylindree && !cylindree) return { result: null, error: null };

    try {
      return {
        result: computeDevisRapide({
          genre,
          ...(selectedGenre.needsPuissance ? { puissance: Number(puissance) } : {}),
          ...(selectedGenre.needsPlaces ? { places: Number(places) } : {}),
          ...(selectedGenre.needsCylindree && cylindree ? { cylindree } : {}),
          dureeMois: duree,
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Erreur de calcul du devis.",
      };
    }
  }, [cylindree, dureeMois, genre, places, puissance, selectedGenre]);

  const whatsappUrl =
    devis.result && selectedGenre
      ? buildWhatsAppDevisUrl({
          categorieLabel: selectedCategorieLabel,
          genreLabel: getDevisGenreLabel(selectedGenre.label),
          dureeMois: Number(dureeMois),
          aPayer: devis.result.aPayer,
          ...(selectedGenre.needsPuissance ? { puissance: Number(puissance) } : {}),
          ...(selectedGenre.needsPlaces ? { places: Number(places) } : {}),
          ...(selectedGenre.needsCylindree && selectedCylindreeLabel
            ? { cylindreeLabel: selectedCylindreeLabel }
            : {}),
        })
      : null;

  const handleCategorieChange = (value: string | number | null) => {
    const nextCategorie = value == null ? null : (value as DevisCategorieCode);
    const nextGenres = getDevisGenresByCategorie(nextCategorie);
    const [onlyGenre] = nextGenres;
    setCategorie(nextCategorie);
    setGenre(nextGenres.length === 1 && onlyGenre ? onlyGenre.value : null);
    setPuissance("");
    setPlaces("");
    setCylindree(null);
  };

  const handleGenreChange = (value: string | number | null) => {
    setGenre(value == null ? null : (value as TarifCategorie));
    setPuissance("");
    setPlaces("");
    setCylindree(null);
  };

  const handleReset = () => {
    setCategorie(null);
    setGenre(null);
    setPuissance("");
    setPlaces("");
    setCylindree(null);
    setDureeMois("");
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-xl shadow-black/5 dark:border-slate-700 dark:bg-slate-800">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-stretch">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Demande de devis
            </h3>
            <span className="inline-flex w-fit rounded-full bg-[#614e1a]/10 px-2.5 py-1 text-xs font-semibold text-[#614e1a] dark:bg-amber-300/10 dark:text-amber-200">
              Devis auto
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="devis-categorie" className={labelClass}>
                Catégorie véhicule *
              </label>
              <SearchableSelect
                id="devis-categorie"
                value={categorie}
                onChange={handleCategorieChange}
                options={DEVIS_CATEGORY_GROUPS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                className="py-2"
                placeholder="— Sélectionner —"
                allowClear={false}
              />
            </div>

            <div>
              <label htmlFor="devis-genre" className={labelClass}>
                Genre *
              </label>
              <SearchableSelect
                id="devis-genre"
                value={genre}
                onChange={handleGenreChange}
                options={genreOptions.map((item) => ({
                  value: item.value,
                  label: getDevisGenreLabel(item.label),
                }))}
                className="py-2"
                placeholder={categorie ? "— Sélectionner —" : "Catégorie d'abord"}
                emptyText="Aucun genre tarifé"
                disabled={!categorie}
                allowClear={false}
              />
            </div>

            {selectedGenre?.needsPuissance && (
              <div>
                <label htmlFor="devis-puissance" className={labelClass}>
                  Puissance fiscale *
                  {selectedGenre.maxCV !== undefined && (
                    <span className="ml-1 text-xs text-gray-500">(max {selectedGenre.maxCV})</span>
                  )}
                </label>
                <input
                  id="devis-puissance"
                  type="number"
                  min={1}
                  max={selectedGenre.maxCV ?? 100}
                  value={puissance}
                  onChange={(event) => setPuissance(event.target.value)}
                  className={inputClass}
                  placeholder="7"
                />
              </div>
            )}

            {selectedGenre?.needsPlaces && (
              <div>
                <label htmlFor="devis-places" className={labelClass}>
                  Places *
                </label>
                <input
                  id="devis-places"
                  type="number"
                  min={2}
                  max={100}
                  value={places}
                  onChange={(event) => setPlaces(event.target.value)}
                  className={inputClass}
                  placeholder="32"
                />
              </div>
            )}

            {selectedGenre?.needsCylindree && (
              <div>
                <label htmlFor="devis-cylindree" className={labelClass}>
                  Cylindrée *
                </label>
                <SearchableSelect
                  id="devis-cylindree"
                  value={cylindree}
                  onChange={(value) => setCylindree(value == null ? null : (value as Cylindree))}
                  options={CYLINDREE_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  className="py-2"
                  placeholder="— Sélectionner —"
                  allowClear={false}
                />
              </div>
            )}

            <div>
              <label htmlFor="devis-duree" className={labelClass}>
                Choisir une validité *
              </label>
              <SearchableSelect
                id="devis-duree"
                value={dureeMois}
                onChange={(value) => setDureeMois(value == null ? "" : String(value))}
                options={DUREES_MOIS.map((duree) => ({
                  value: String(duree),
                  label: `${duree} mois`,
                }))}
                className="py-2"
                placeholder="— Choisir une validité —"
                allowClear={false}
              />
            </div>
          </div>

          {devis.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {devis.error}
            </p>
          )}
        </div>

        <div className="flex min-h-full flex-col justify-between rounded-lg border border-[#614e1a]/15 bg-[#f8f4ea] p-4 text-center lg:text-left dark:border-amber-300/15 dark:bg-slate-900">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
              À payer
            </p>
            <p className="mt-2 min-h-9 text-2xl font-bold text-[#614e1a] tabular-nums dark:text-amber-200">
              {devis.result ? formatFCFA(devis.result.aPayer) : "—"}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/40"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Valider le devis
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 dark:bg-slate-700 dark:text-slate-400"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Valider le devis
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#614e1a]/30 bg-white px-4 py-2 text-sm font-semibold text-[#614e1a] transition-colors hover:bg-[#614e1a]/10 dark:border-amber-300/30 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-300/10"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
