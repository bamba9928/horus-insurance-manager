/**
 * Formulaire de création / édition d'un véhicule.
 * Utilise react-hook-form + Zod pour la validation.
 * Inclut un sélecteur de client.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useClients } from "../../hooks/useClients";
import type { Vehicule, VehiculeCreate } from "../../schemas/vehicule";
import { GENRES_VEHICULE, vehiculeCreateSchema } from "../../schemas/vehicule";

interface VehiculeFormProps {
  /** Véhicule existant pour le mode édition */
  defaultValues?: Vehicule;
  /** Pré-sélectionner un client (ex: depuis la page client) */
  preselectedClientId?: number;
  /** Callback de soumission */
  onSubmit: (data: VehiculeCreate) => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Formulaire en cours de soumission */
  isSubmitting?: boolean;
}

export function VehiculeForm({
  defaultValues,
  preselectedClientId,
  onSubmit,
  onCancel,
  isSubmitting,
}: VehiculeFormProps) {
  const { t } = useTranslation();
  const { data: clients = [] } = useClients();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehiculeCreate>({
    resolver: zodResolver(vehiculeCreateSchema),
    ...(defaultValues
      ? {
          defaultValues: {
            clientId: defaultValues.client_id,
            immatriculation: defaultValues.immatriculation,
            ...(defaultValues.marque != null ? { marque: defaultValues.marque } : {}),
            ...(defaultValues.modele != null ? { modele: defaultValues.modele } : {}),
            ...(defaultValues.genre != null
              ? { genre: defaultValues.genre as VehiculeCreate["genre"] }
              : {}),
            ...(defaultValues.type_vehicule != null
              ? { typeVehicule: defaultValues.type_vehicule }
              : {}),
            ...(defaultValues.puissance != null ? { puissance: defaultValues.puissance } : {}),
            ...(defaultValues.places != null ? { places: defaultValues.places } : {}),
          },
        }
      : preselectedClientId != null
        ? { defaultValues: { clientId: preselectedClientId } }
        : {}),
  });

  const onFormSubmit = (data: VehiculeCreate) => onSubmit(data as VehiculeCreate);

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Client */}
      <div>
        <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
          Client *
        </label>
        <select
          id="clientId"
          {...register("clientId", { valueAsNumber: true })}
          className={inputClass}
        >
          <option value="">{t("vehicules.selectClient")}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.nom_prenom}
            </option>
          ))}
        </select>
        {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>}
      </div>

      {/* Immatriculation */}
      <div>
        <label htmlFor="immatriculation" className="block text-sm font-medium text-gray-700">
          {t("vehicules.immatriculation")} *
        </label>
        <input
          id="immatriculation"
          type="text"
          {...register("immatriculation")}
          className={inputClass}
          placeholder="DK 1234 AB"
        />
        {errors.immatriculation && (
          <p className="mt-1 text-xs text-red-600">{errors.immatriculation.message}</p>
        )}
      </div>

      {/* Marque + Modèle (2 colonnes) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="marque" className="block text-sm font-medium text-gray-700">
            {t("vehicules.marque")}
          </label>
          <input
            id="marque"
            type="text"
            {...register("marque")}
            className={inputClass}
            placeholder="Toyota"
          />
        </div>
        <div>
          <label htmlFor="modele" className="block text-sm font-medium text-gray-700">
            {t("vehicules.modele")}
          </label>
          <input
            id="modele"
            type="text"
            {...register("modele")}
            className={inputClass}
            placeholder="Corolla"
          />
        </div>
      </div>

      {/* Genre */}
      <div>
        <label htmlFor="genre" className="block text-sm font-medium text-gray-700">
          {t("vehicules.genre")}
        </label>
        <select id="genre" {...register("genre")} className={inputClass}>
          <option value="">— Sélectionner —</option>
          {GENRES_VEHICULE.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* Type véhicule */}
      <div>
        <label htmlFor="typeVehicule" className="block text-sm font-medium text-gray-700">
          {t("vehicules.typeVehicule")}
        </label>
        <input
          id="typeVehicule"
          type="text"
          {...register("typeVehicule")}
          className={inputClass}
          placeholder="Berline, SUV, Pick-up..."
        />
      </div>

      {/* Puissance + Places (2 colonnes) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="puissance" className="block text-sm font-medium text-gray-700">
            {t("vehicules.puissance")}
          </label>
          <input
            id="puissance"
            type="number"
            {...register("puissance", { valueAsNumber: true })}
            className={inputClass}
            placeholder="7"
            min={1}
            max={1000}
          />
          {errors.puissance && (
            <p className="mt-1 text-xs text-red-600">{errors.puissance.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="places" className="block text-sm font-medium text-gray-700">
            {t("vehicules.places")}
          </label>
          <input
            id="places"
            type="number"
            {...register("places", { valueAsNumber: true })}
            className={inputClass}
            placeholder="5"
            min={1}
            max={100}
          />
          {errors.places && <p className="mt-1 text-xs text-red-600">{errors.places.message}</p>}
        </div>
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
