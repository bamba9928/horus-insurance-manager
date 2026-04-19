/**
 * Formulaire de création / édition d'une police d'assurance.
 * Affiche le calcul de la date d'échéance en temps réel.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAssureurs } from "../../hooks/useAssureurs";
import { useVehicules } from "../../hooks/useVehicules";
import { calcEcheance, formatDateDisplay, joursRestants } from "../../lib/date-utils";
import type { Police, PoliceCreate } from "../../schemas/police";
import { DUREES_MOIS, policeCreateSchema } from "../../schemas/police";
import { SearchableSelect } from "../ui/SearchableSelect";

/** Form-level type — dureeMois is `number` here; Zod refine handles the validation */
type PoliceFormValues = Omit<PoliceCreate, "dureeMois"> & { dureeMois: number };

interface PoliceFormProps {
  /** Police existante pour le mode édition */
  defaultValues?: Police;
  /** Pré-sélectionner un véhicule */
  preselectedVehiculeId?: number;
  /** Callback de soumission */
  onSubmit: (data: PoliceCreate) => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Formulaire en cours de soumission */
  isSubmitting?: boolean;
}

export function PoliceForm({
  defaultValues,
  preselectedVehiculeId,
  onSubmit,
  onCancel,
  isSubmitting,
}: PoliceFormProps) {
  const { t } = useTranslation();
  const { data: vehicules = [] } = useVehicules();
  const { data: assureurs = [] } = useAssureurs();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PoliceFormValues>({
    resolver: zodResolver(policeCreateSchema) as never,
    ...(defaultValues
      ? {
          defaultValues: {
            vehiculeId: defaultValues.vehicule_id,
            typeCarte: defaultValues.type_carte,
            dateEffet: defaultValues.date_effet,
            dureeMois: defaultValues.duree_mois,
            ...(defaultValues.assureur_id != null ? { assureurId: defaultValues.assureur_id } : {}),
            ...(defaultValues.numero_police != null
              ? { numeroPolice: defaultValues.numero_police }
              : {}),
            ...(defaultValues.appreciation != null
              ? { appreciation: defaultValues.appreciation }
              : {}),
          },
        }
      : {
          defaultValues: {
            typeCarte: "VERTE" as const,
            dureeMois: 12 as const,
            dateEffet: new Date().toISOString().slice(0, 10),
            ...(preselectedVehiculeId != null ? { vehiculeId: preselectedVehiculeId } : {}),
          },
        }),
  });

  // Watch dateEffet et dureeMois pour le calcul temps réel
  const watchedDateEffet = useWatch({ control, name: "dateEffet" });
  const watchedDureeMois = useWatch({ control, name: "dureeMois" });

  // Calcul de l'échéance en temps réel
  const echeanceInfo = (() => {
    try {
      if (!watchedDateEffet || !watchedDureeMois) return null;
      const echeance = calcEcheance(watchedDateEffet, watchedDureeMois);
      const jours = joursRestants(echeance);
      return {
        date: formatDateDisplay(echeance),
        jours,
        isExpired: jours < 0,
        isUrgent: jours >= 0 && jours <= 30,
      };
    } catch {
      return null;
    }
  })();

  const onFormSubmit = (data: PoliceFormValues) => onSubmit(data as unknown as PoliceCreate);

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Véhicule */}
      <div>
        <label htmlFor="vehiculeId" className="block text-sm font-medium text-gray-700">
          Véhicule *
        </label>
        <Controller
          name="vehiculeId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              id="vehiculeId"
              value={field.value ?? null}
              onChange={(v) => field.onChange(v == null ? undefined : Number(v))}
              options={vehicules.map((v) => ({
                value: v.id,
                label: v.immatriculation,
                ...(v.marque ? { sublabel: `${v.marque}${v.modele ? ` — ${v.modele}` : ""}` } : {}),
              }))}
              placeholder="— Sélectionner un véhicule —"
              allowClear={false}
            />
          )}
        />
        {errors.vehiculeId && (
          <p className="mt-1 text-xs text-red-600">{errors.vehiculeId.message}</p>
        )}
      </div>

      {/* N° Police */}
      <div className="grid grid-cols-1 gap-4">
        {/* Champ typeCarte maintenu en hidden : donnée DB conservée (VERTE par défaut) */}
        <input type="hidden" {...register("typeCarte")} />
        <div>
          <label htmlFor="numeroPolice" className="block text-sm font-medium text-gray-700">
            {t("polices.numero")}
          </label>
          <input
            id="numeroPolice"
            type="text"
            {...register("numeroPolice")}
            className={inputClass}
            placeholder="POL-2025-001"
          />
        </div>
      </div>

      {/* Date d'effet + Durée (2 colonnes) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dateEffet" className="block text-sm font-medium text-gray-700">
            {t("polices.dateEffet")} *
          </label>
          <input id="dateEffet" type="date" {...register("dateEffet")} className={inputClass} />
          {errors.dateEffet && (
            <p className="mt-1 text-xs text-red-600">{errors.dateEffet.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="dureeMois" className="block text-sm font-medium text-gray-700">
            {t("polices.dureeMois")} *
          </label>
          <select
            id="dureeMois"
            {...register("dureeMois", { valueAsNumber: true })}
            className={inputClass}
          >
            {DUREES_MOIS.map((d) => (
              <option key={d} value={d}>
                {d} mois
              </option>
            ))}
          </select>
          {errors.dureeMois && (
            <p className="mt-1 text-xs text-red-600">{errors.dureeMois.message}</p>
          )}
        </div>
      </div>

      {/* Échéance calculée en temps réel */}
      {echeanceInfo && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            echeanceInfo.isExpired
              ? "border-red-200 bg-red-50"
              : echeanceInfo.isUrgent
                ? "border-orange-200 bg-orange-50"
                : "border-green-200 bg-green-50"
          }`}
        >
          <p className="text-sm font-medium text-gray-700">
            {t("polices.dateEcheance")} :{" "}
            <span
              className={`font-bold ${
                echeanceInfo.isExpired
                  ? "text-red-700"
                  : echeanceInfo.isUrgent
                    ? "text-orange-700"
                    : "text-green-700"
              }`}
            >
              {echeanceInfo.date}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {echeanceInfo.isExpired
              ? `Expirée depuis ${Math.abs(echeanceInfo.jours)} jours`
              : `${echeanceInfo.jours} jours restants`}
          </p>
        </div>
      )}

      {/* Assureur */}
      <div>
        <label htmlFor="assureurId" className="block text-sm font-medium text-gray-700">
          {t("polices.assureur")}
        </label>
        <Controller
          name="assureurId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              id="assureurId"
              value={field.value ?? null}
              onChange={(v) => field.onChange(v == null ? undefined : Number(v))}
              options={assureurs.map((a) => ({ value: a.id, label: a.nom }))}
              placeholder="— Aucun assureur —"
            />
          )}
        />
      </div>

      {/* Appréciation */}
      <div>
        <label htmlFor="appreciation" className="block text-sm font-medium text-gray-700">
          Appréciation
        </label>
        <textarea
          id="appreciation"
          {...register("appreciation")}
          rows={3}
          className={inputClass}
          placeholder="Notes sur la police..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
        >
          {isSubmitting ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </form>
  );
}
