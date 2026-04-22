/**
 * Formulaire de création / édition d'un paiement.
 * Affiche le calcul du reste et du statut en temps réel.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { usePolices } from "../../hooks/usePolices";
import { useVehicules } from "../../hooks/useVehicules";
import { formatFCFA } from "../../lib/date-utils";
import type { Paiement, PaiementCreate } from "../../schemas/paiement";
import { getPaiementStatut, MODES_PAIEMENT, paiementCreateSchema } from "../../schemas/paiement";
import { SearchableSelect } from "../ui/SearchableSelect";

/** Form-level type — paye/avance are required here (have .default() in Zod) */
type PaiementFormValues = Omit<PaiementCreate, "paye" | "avance"> & {
  paye?: number;
  avance?: number;
};

interface PaiementFormProps {
  /** Paiement existant pour le mode édition */
  defaultValues?: Paiement;
  /** Pré-sélectionner une police */
  preselectedPoliceId?: number;
  /** Callback de soumission */
  onSubmit: (data: PaiementCreate) => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Formulaire en cours de soumission */
  isSubmitting?: boolean;
}

export function PaiementForm({
  defaultValues,
  preselectedPoliceId,
  onSubmit,
  onCancel,
  isSubmitting,
}: PaiementFormProps) {
  const { t } = useTranslation();
  const { data: polices = [] } = usePolices();
  const { data: vehicules = [] } = useVehicules();

  /** Résout vehicule_id → immatriculation */
  const vehiculeImmatMap = new Map<number, string>();
  for (const v of vehicules) {
    vehiculeImmatMap.set(v.id, v.immatriculation);
  }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PaiementFormValues>({
    resolver: zodResolver(paiementCreateSchema) as never,
    ...(defaultValues
      ? {
          defaultValues: {
            policeId: defaultValues.police_id,
            montantDu: defaultValues.montant_du,
            paye: defaultValues.paye,
            avance: defaultValues.avance,
            ...(defaultValues.date_paiement != null
              ? { datePaiement: defaultValues.date_paiement }
              : {}),
            ...(defaultValues.mode != null
              ? { mode: defaultValues.mode as PaiementCreate["mode"] }
              : {}),
            ...(defaultValues.reference != null ? { reference: defaultValues.reference } : {}),
            ...(defaultValues.notes != null ? { notes: defaultValues.notes } : {}),
          },
        }
      : {
          defaultValues: {
            montantDu: 0,
            paye: 0,
            avance: 0,
            datePaiement: new Date().toISOString().slice(0, 10),
            ...(preselectedPoliceId != null ? { policeId: preselectedPoliceId } : {}),
          },
        }),
  });

  // Watch pour le calcul temps réel
  const watchedMontantDu = useWatch({ control, name: "montantDu" }) ?? 0;
  const watchedPaye = useWatch({ control, name: "paye" }) ?? 0;
  const watchedAvance = useWatch({ control, name: "avance" }) ?? 0;

  const reste = Math.max(0, watchedMontantDu - watchedPaye - watchedAvance);
  const statut = getPaiementStatut(reste, watchedMontantDu);

  const statutColors = {
    SOLDE: "border-green-200 bg-green-50 text-green-800",
    PARTIEL: "border-orange-200 bg-orange-50 text-orange-800",
    IMPAYE: "border-red-200 bg-red-50 text-red-800",
  };

  const onFormSubmit = (data: PaiementFormValues) => onSubmit(data as unknown as PaiementCreate);

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      {/* Police */}
      <div>
        <label htmlFor="policeId" className="block text-sm font-medium text-gray-700">
          Police *
        </label>
        <Controller
          name="policeId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              id="policeId"
              value={field.value ?? null}
              onChange={(v) => field.onChange(v == null ? undefined : Number(v))}
              options={polices.map((p) => ({
                value: p.id,
                label: p.numero_police ?? `#${p.id}`,
                sublabel: vehiculeImmatMap.get(p.vehicule_id) ?? "?",
              }))}
              placeholder="— Sélectionner une police —"
              allowClear={false}
            />
          )}
        />
        {errors.policeId && <p className="mt-1 text-xs text-red-600">{errors.policeId.message}</p>}
      </div>

      {/* Montant dû + Payé + Avance (3 colonnes) */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="montantDu" className="block text-sm font-medium text-gray-700">
            {t("paiements.montantDu")} *
          </label>
          <input
            id="montantDu"
            type="number"
            {...register("montantDu", { valueAsNumber: true })}
            className={inputClass}
            placeholder="100000"
            min={0}
          />
          {errors.montantDu && (
            <p className="mt-1 text-xs text-red-600">{errors.montantDu.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="paye" className="block text-sm font-medium text-gray-700">
            {t("paiements.paye")}
          </label>
          <input
            id="paye"
            type="number"
            {...register("paye", { valueAsNumber: true })}
            className={inputClass}
            placeholder="50000"
            min={0}
          />
          {errors.paye && <p className="mt-1 text-xs text-red-600">{errors.paye.message}</p>}
        </div>
        <div>
          <label htmlFor="avance" className="block text-sm font-medium text-gray-700">
            {t("paiements.avance")}
          </label>
          <input
            id="avance"
            type="number"
            {...register("avance", { valueAsNumber: true })}
            className={inputClass}
            placeholder="0"
            min={0}
          />
          {errors.avance && <p className="mt-1 text-xs text-red-600">{errors.avance.message}</p>}
        </div>
      </div>

      {/* Calcul temps réel : reste + statut */}
      <div className={`rounded-lg border px-4 py-3 ${statutColors[statut]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {t("paiements.reste")} : <span className="font-bold">{formatFCFA(reste)}</span>
            </p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold">
            {t(`paiements.${statut.toLowerCase()}`)}
          </span>
        </div>
      </div>

      {/* Date de paiement + Mode (2 colonnes) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="datePaiement" className="block text-sm font-medium text-gray-700">
            Date de paiement
          </label>
          <input
            id="datePaiement"
            type="date"
            {...register("datePaiement")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="mode" className="block text-sm font-medium text-gray-700">
            {t("paiements.mode")}
          </label>
          <select id="mode" {...register("mode")} className={inputClass}>
            <option value="">— Sélectionner —</option>
            {MODES_PAIEMENT.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Référence */}
      <div>
        <label htmlFor="reference" className="block text-sm font-medium text-gray-700">
          {t("paiements.reference")}
        </label>
        <input
          id="reference"
          type="text"
          {...register("reference")}
          className={inputClass}
          placeholder="N° reçu, chèque..."
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          id="notes"
          {...register("notes")}
          rows={2}
          className={inputClass}
          placeholder="Notes optionnelles..."
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
