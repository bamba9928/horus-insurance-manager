/**
 * Formulaire de création / édition d'un véhicule.
 * Utilise react-hook-form + Zod pour la validation.
 * Inclut un sélecteur de client.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useClients } from "../../hooks/useClients";
import { useVehicules } from "../../hooks/useVehicules";
import { REFERENTIEL_MARQUES } from "../../lib/referentiel-marques";
import { normalizeBrand, normalizeText, uniqueSorted } from "../../lib/utils";
import type { Vehicule, VehiculeCreate } from "../../schemas/vehicule";
import {
  CATEGORIES_VEHICULE,
  getSousCategoriesByCategorie,
  vehiculeCreateSchema,
} from "../../schemas/vehicule";
import { SearchableSelect } from "../ui/SearchableSelect";

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
  const { data: vehicules = [] } = useVehicules();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    clearErrors,
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

  const selectedMarque = watch("marque");
  const selectedCategorie = watch("genre");
  const selectedTypeVehicule = watch("typeVehicule");

  const marqueOptions = useMemo(() => {
    const marquesSaisies = vehicules.map((vehicule) => normalizeBrand(vehicule.marque));
    return uniqueSorted([...REFERENTIEL_MARQUES, ...marquesSaisies]).map((marque) => ({
      value: marque,
      label: marque,
    }));
  }, [vehicules]);

  const modeleOptions = useMemo(() => {
    const marque = normalizeBrand(selectedMarque);
    if (!marque) return [];
    return uniqueSorted(
      vehicules
        .filter((vehicule) => normalizeBrand(vehicule.marque) === marque)
        .map((vehicule) => normalizeText(vehicule.modele)),
    ).map((modele) => ({
      value: modele,
      label: modele,
    }));
  }, [selectedMarque, vehicules]);

  const genreOptions = useMemo(() => {
    const options = getSousCategoriesByCategorie(selectedCategorie).map((genre) => ({
      value: genre,
      label: genre,
    }));
    if (selectedTypeVehicule && !options.some((option) => option.value === selectedTypeVehicule)) {
      return [
        {
          value: selectedTypeVehicule,
          label: selectedTypeVehicule,
          sublabel: t("vehicules.existingValue"),
        },
        ...options,
      ];
    }
    return options;
  }, [selectedCategorie, selectedTypeVehicule, t]);

  const onFormSubmit = (data: VehiculeCreate) =>
    onSubmit({
      ...data,
      marque: normalizeBrand(data.marque) || undefined,
      modele: normalizeText(data.modele) || undefined,
    } as VehiculeCreate);

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      {/* Client */}
      <div>
        <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
          Client *
        </label>
        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              id="clientId"
              value={field.value ?? null}
              onChange={(v) => field.onChange(v == null ? undefined : Number(v))}
              options={clients.map((c) => ({
                value: c.id,
                label: c.nom_prenom,
                ...(c.telephone ? { sublabel: c.telephone } : {}),
              }))}
              placeholder={t("vehicules.selectClient")}
              allowClear={false}
            />
          )}
        />
        {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId.message}</p>}
      </div>

      {/* Catégorie */}
      <div>
        <label htmlFor="genre" className="block text-sm font-medium text-gray-700">
          {t("vehicules.categorie")} *
        </label>
        <Controller
          name="genre"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              id="genre"
              value={field.value ?? null}
              onChange={(v) => {
                const nextCategorie = v == null ? undefined : (v as VehiculeCreate["genre"]);
                if (field.value !== nextCategorie) {
                  setValue("typeVehicule", "", {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }
                if (nextCategorie) {
                  setValue("genre", nextCategorie, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  clearErrors("genre");
                } else {
                  field.onChange(undefined);
                }
              }}
              options={CATEGORIES_VEHICULE.map((c) => ({ value: c.value, label: c.label }))}
              placeholder="— Sélectionner une catégorie —"
            />
          )}
        />
        {errors.genre && <p className="mt-1 text-xs text-red-600">{errors.genre.message}</p>}
      </div>

      {/* Genre */}
      <div>
        <label htmlFor="typeVehicule" className="block text-sm font-medium text-gray-700">
          {t("vehicules.typeVehicule")} *
        </label>
        <Controller
          name="typeVehicule"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              id="typeVehicule"
              value={field.value ?? null}
              onChange={(v) => {
                const nextTypeVehicule = v == null ? undefined : String(v);
                if (nextTypeVehicule) {
                  setValue("typeVehicule", nextTypeVehicule, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  clearErrors("typeVehicule");
                } else {
                  field.onChange(undefined);
                }
              }}
              options={genreOptions}
              placeholder={
                selectedCategorie ? t("vehicules.selectGenre") : t("vehicules.selectCategorieFirst")
              }
              emptyText={t("vehicules.noGenre")}
              disabled={!selectedCategorie}
            />
          )}
        />
        {errors.typeVehicule && (
          <p className="mt-1 text-xs text-red-600">{errors.typeVehicule.message}</p>
        )}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="marque" className="block text-sm font-medium text-gray-700">
            {t("vehicules.marque")}
          </label>
          <Controller
            name="marque"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                id="marque"
                value={field.value ?? null}
                onChange={(v) => field.onChange(v == null ? undefined : normalizeBrand(String(v)))}
                options={marqueOptions}
                placeholder="— Sélectionner une marque —"
                emptyText="Aucune marque trouvée"
                allowCustomValue
                getCustomValueLabel={(value) => `Ajouter "${normalizeBrand(value)}"`}
              />
            )}
          />
        </div>
        <div>
          <label htmlFor="modele" className="block text-sm font-medium text-gray-700">
            {t("vehicules.modele")}
          </label>
          <Controller
            name="modele"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                id="modele"
                value={field.value ?? null}
                onChange={(v) => field.onChange(v == null ? undefined : normalizeText(String(v)))}
                options={modeleOptions}
                placeholder={
                  selectedMarque ? "— Sélectionner ou ajouter un modèle —" : "Choisir une marque"
                }
                emptyText="Aucun modèle enregistré"
                disabled={!selectedMarque}
                allowCustomValue
                getCustomValueLabel={(value) => `Ajouter "${normalizeText(value)}"`}
              />
            )}
          />
        </div>
      </div>

      {/* Puissance + Places (2 colonnes) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-black hover:bg-gray-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
        >
          {isSubmitting ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </form>
  );
}
