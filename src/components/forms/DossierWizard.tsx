/**
 * Assistant par étapes « Nouveau dossier » :
 * Client → Véhicule → Police → Paiement, enregistrés en une seule transaction.
 * Les étapes client et véhicule permettent de réutiliser une entité existante.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAssureurs } from "../../hooks/useAssureurs";
import { useClients } from "../../hooks/useClients";
import { useVehicules } from "../../hooks/useVehicules";
import { calcEcheance, formatDateDisplay, formatFCFA, joursRestants } from "../../lib/date-utils";
import { REFERENTIEL_MARQUES } from "../../lib/referentiel-marques";
import { cn, normalizeBrand, normalizeText, uniqueSorted } from "../../lib/utils";
import type { ClientCreate } from "../../schemas/client";
import { clientCreateSchema } from "../../schemas/client";
import type {
  DossierClientStep,
  DossierCreate,
  DossierPaiement,
  DossierPolice,
  DossierVehicule,
  DossierVehiculeStep,
} from "../../schemas/dossier";
import {
  dossierPaiementSchema,
  dossierPoliceSchema,
  dossierVehiculeSchema,
} from "../../schemas/dossier";
import { getPaiementStatut, MODES_PAIEMENT } from "../../schemas/paiement";
import { DUREES_MOIS } from "../../schemas/police";
import { CATEGORIES_VEHICULE, getSousCategoriesByCategorie } from "../../schemas/vehicule";
import { SearchableSelect } from "../ui/SearchableSelect";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";

/** Normalise un téléphone pour comparaison : chiffres uniquement, sans indicatif 221. */
function normalizePhone(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.startsWith("221") ? digits.slice(3) : digits;
}

/** Normalise une immatriculation pour comparaison : majuscules, sans espaces. */
function normalizeImmat(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const secondaryButtonClass =
  "rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50";

const primaryButtonClass =
  "rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50";

interface DossierWizardProps {
  /** Callback de soumission du dossier complet */
  onSubmit: (data: DossierCreate) => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Enregistrement en cours */
  isSubmitting?: boolean;
  /** Erreur renvoyée par l'enregistrement (affichée à la dernière étape) */
  submitError?: string | null;
}

export function DossierWizard({
  onSubmit,
  onCancel,
  isSubmitting,
  submitError,
}: DossierWizardProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [clientStep, setClientStep] = useState<DossierClientStep | null>(null);
  const [vehiculeStep, setVehiculeStep] = useState<DossierVehiculeStep | null>(null);
  const [policeStep, setPoliceStep] = useState<DossierPolice | null>(null);

  const stepLabels = [
    t("dossier.steps.client"),
    t("dossier.steps.vehicule"),
    t("dossier.steps.police"),
    t("dossier.steps.paiement"),
  ];

  const handleClientNext = (value: DossierClientStep) => {
    const clientChanged =
      clientStep == null ||
      clientStep.mode !== value.mode ||
      (clientStep.mode === "existant" &&
        value.mode === "existant" &&
        clientStep.clientId !== value.clientId);
    // Un véhicule existant appartient au client précédent : on le désélectionne
    if (clientChanged && vehiculeStep?.mode === "existant") {
      setVehiculeStep(null);
    }
    setClientStep(value);
    setStep(1);
  };

  const handleFinish = (paiement: DossierPaiement | undefined) => {
    if (!clientStep || !vehiculeStep || !policeStep) return;
    onSubmit({
      client: clientStep,
      vehicule: vehiculeStep,
      police: policeStep,
      ...(paiement ? { paiement } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <StepperHeader labels={stepLabels} current={step} />

      {step === 0 && (
        <ClientStep initial={clientStep} onNext={handleClientNext} onCancel={onCancel} />
      )}
      {step === 1 && clientStep && (
        <VehiculeStep
          clientStep={clientStep}
          initial={vehiculeStep}
          onNext={(value) => {
            setVehiculeStep(value);
            setStep(2);
          }}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <PoliceStep
          initial={policeStep}
          onNext={(value) => {
            setPoliceStep(value);
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <PaiementStep
          onFinish={handleFinish}
          onBack={() => setStep(2)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}
    </div>
  );
}

// ============ Stepper ============

function StepperHeader({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {labels.map((label, index) => (
        <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              index < current
                ? "bg-[#614e1a] text-white"
                : index === current
                  ? "bg-[#614e1a]/15 text-[#614e1a] ring-1 ring-[#614e1a]"
                  : "bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-400",
            )}
          >
            {index < current ? "✓" : index + 1}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              index === current
                ? "text-[#614e1a] dark:text-amber-200"
                : "text-gray-500 dark:text-slate-400",
            )}
          >
            {label}
          </span>
          {index < labels.length - 1 && (
            <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
          )}
        </li>
      ))}
    </ol>
  );
}

// ============ Bascule existant / nouveau ============

function ModeToggle({
  value,
  onChange,
  existingLabel,
  newLabel,
}: {
  value: "existant" | "nouveau";
  onChange: (value: "existant" | "nouveau") => void;
  existingLabel: string;
  newLabel: string;
}) {
  const options = [
    { value: "existant" as const, label: existingLabel },
    { value: "nouveau" as const, label: newLabel },
  ];
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition-colors",
            value === option.value
              ? "border-[#614e1a] bg-[#614e1a]/10 font-medium text-[#614e1a] dark:text-amber-200"
              : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ============ Étape 1 : Client ============

function ClientStep({
  initial,
  onNext,
  onCancel,
}: {
  initial: DossierClientStep | null;
  onNext: (value: DossierClientStep) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { data: clients = [] } = useClients();

  const [mode, setMode] = useState<"existant" | "nouveau">(initial?.mode ?? "existant");
  const [clientId, setClientId] = useState<number | null>(
    initial?.mode === "existant" ? initial.clientId : null,
  );
  const [clientIdError, setClientIdError] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ClientCreate>({
    resolver: zodResolver(clientCreateSchema),
    ...(initial?.mode === "nouveau" ? { defaultValues: initial.data } : {}),
  });

  const handleExistingNext = () => {
    if (clientId == null) {
      setClientIdError(true);
      return;
    }
    onNext({ mode: "existant", clientId });
  };

  /** Anti-doublon : refuse un nouveau client dont le nom ou le téléphone existe déjà. */
  const handleNewClient = (data: ClientCreate) => {
    const nom = normalizeText(data.nomPrenom).toLowerCase();
    const nomDoublon = clients.find((c) => normalizeText(c.nom_prenom).toLowerCase() === nom);
    if (nomDoublon) {
      setError("nomPrenom", {
        type: "duplicate",
        message: t("dossier.clientDoublon", { nom: nomDoublon.nom_prenom }),
      });
      return;
    }
    const tel = normalizePhone(data.telephone);
    const telDoublon = tel ? clients.find((c) => normalizePhone(c.telephone) === tel) : undefined;
    if (telDoublon) {
      setError("telephone", {
        type: "duplicate",
        message: t("dossier.telephoneDoublon", { nom: telDoublon.nom_prenom }),
      });
      return;
    }
    onNext({ mode: "nouveau", data });
  };

  return (
    <form onSubmit={handleSubmit(handleNewClient)} className="space-y-3">
      <ModeToggle
        value={mode}
        onChange={setMode}
        existingLabel={t("dossier.clientExistant")}
        newLabel={t("dossier.nouveauClient")}
      />

      {mode === "existant" ? (
        <div>
          <label htmlFor="dossier-client" className="block text-sm font-medium text-gray-700">
            Client *
          </label>
          <SearchableSelect
            id="dossier-client"
            value={clientId}
            onChange={(v) => {
              setClientId(v == null ? null : Number(v));
              setClientIdError(false);
            }}
            options={clients.map((c) => ({
              value: c.id,
              label: c.nom_prenom,
              ...(c.telephone ? { sublabel: c.telephone } : {}),
            }))}
            placeholder={t("vehicules.selectClient")}
            allowClear={false}
          />
          {clientIdError && (
            <p className="mt-1 text-xs text-red-600">{t("dossier.clientRequis")}</p>
          )}
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="nomPrenom" className="block text-sm font-medium text-gray-700">
              {t("clients.nomPrenom")} *
            </label>
            <input
              id="nomPrenom"
              type="text"
              {...register("nomPrenom")}
              className={inputClass}
              placeholder="Ex: Mamadou Diallo"
            />
            {errors.nomPrenom && (
              <p className="mt-1 text-xs text-red-600">{errors.nomPrenom.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700">
                {t("clients.telephone")}
              </label>
              <input
                id="telephone"
                type="tel"
                {...register("telephone")}
                className={inputClass}
                placeholder="77 123 45 67"
              />
              {errors.telephone && (
                <p className="mt-1 text-xs text-red-600">{errors.telephone.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t("clients.email")}
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className={inputClass}
                placeholder="client@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="adresse" className="block text-sm font-medium text-gray-700">
              {t("clients.adresse")}
            </label>
            <input
              id="adresse"
              type="text"
              {...register("adresse")}
              className={inputClass}
              placeholder="Dakar, Sénégal"
            />
            {errors.adresse && (
              <p className="mt-1 text-xs text-red-600">{errors.adresse.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              {t("clients.notes")}
            </label>
            <textarea
              id="notes"
              {...register("notes")}
              rows={2}
              className={inputClass}
              placeholder="Notes optionnelles..."
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          {t("common.cancel")}
        </button>
        {mode === "existant" ? (
          <button type="button" onClick={handleExistingNext} className={primaryButtonClass}>
            {t("dossier.suivant")}
          </button>
        ) : (
          <button type="submit" className={primaryButtonClass}>
            {t("dossier.suivant")}
          </button>
        )}
      </div>
    </form>
  );
}

// ============ Étape 2 : Véhicule ============

function VehiculeStep({
  clientStep,
  initial,
  onNext,
  onBack,
}: {
  clientStep: DossierClientStep;
  initial: DossierVehiculeStep | null;
  onNext: (value: DossierVehiculeStep) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { data: vehicules = [] } = useVehicules();

  // Un véhicule existant n'est proposé que pour un client existant
  const canUseExisting = clientStep.mode === "existant";
  const [mode, setMode] = useState<"existant" | "nouveau">(
    initial?.mode ?? (canUseExisting ? "existant" : "nouveau"),
  );
  const effectiveMode = canUseExisting ? mode : "nouveau";

  const [vehiculeId, setVehiculeId] = useState<number | null>(
    initial?.mode === "existant" ? initial.vehiculeId : null,
  );
  const [vehiculeIdError, setVehiculeIdError] = useState(false);

  const clientVehicules = useMemo(
    () => (canUseExisting ? vehicules.filter((v) => v.client_id === clientStep.clientId) : []),
    [canUseExisting, clientStep, vehicules],
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<DossierVehicule>({
    resolver: zodResolver(dossierVehiculeSchema),
    ...(initial?.mode === "nouveau" ? { defaultValues: initial.data } : {}),
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

  const handleExistingNext = () => {
    if (vehiculeId == null) {
      setVehiculeIdError(true);
      return;
    }
    onNext({ mode: "existant", vehiculeId });
  };

  const onFormSubmit = (data: DossierVehicule) => {
    // Anti-doublon : refuse une immatriculation déjà enregistrée
    const immat = normalizeImmat(data.immatriculation);
    const doublon = vehicules.find((v) => normalizeImmat(v.immatriculation) === immat);
    if (doublon) {
      setError("immatriculation", {
        type: "duplicate",
        message: t("dossier.vehiculeDoublon", { immatriculation: doublon.immatriculation }),
      });
      return;
    }
    onNext({
      mode: "nouveau",
      data: {
        ...data,
        marque: normalizeBrand(data.marque) || undefined,
        modele: normalizeText(data.modele) || undefined,
      } as DossierVehicule,
    });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      {canUseExisting && (
        <ModeToggle
          value={effectiveMode}
          onChange={setMode}
          existingLabel={t("dossier.vehiculeExistant")}
          newLabel={t("dossier.nouveauVehicule")}
        />
      )}

      {effectiveMode === "existant" ? (
        <div>
          <label htmlFor="dossier-vehicule" className="block text-sm font-medium text-gray-700">
            Véhicule *
          </label>
          <SearchableSelect
            id="dossier-vehicule"
            value={vehiculeId}
            onChange={(v) => {
              setVehiculeId(v == null ? null : Number(v));
              setVehiculeIdError(false);
            }}
            options={clientVehicules.map((v) => ({
              value: v.id,
              label: v.immatriculation,
              ...(v.marque ? { sublabel: `${v.marque}${v.modele ? ` — ${v.modele}` : ""}` } : {}),
            }))}
            placeholder="— Sélectionner un véhicule —"
            emptyText={t("dossier.aucunVehiculeClient")}
            allowClear={false}
          />
          {vehiculeIdError && (
            <p className="mt-1 text-xs text-red-600">{t("dossier.vehiculeRequis")}</p>
          )}
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-700">
              {t("vehicules.categorie")}
            </label>
            <Controller
              name="genre"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  id="genre"
                  value={field.value ?? null}
                  onChange={(v) => {
                    const nextCategorie = v == null ? undefined : (v as DossierVehicule["genre"]);
                    if (field.value !== nextCategorie) {
                      setValue("typeVehicule", undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                    field.onChange(nextCategorie);
                  }}
                  options={CATEGORIES_VEHICULE.map((c) => ({ value: c.value, label: c.label }))}
                  placeholder="— Sélectionner une catégorie —"
                />
              )}
            />
          </div>

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
                    onChange={(v) =>
                      field.onChange(v == null ? undefined : normalizeBrand(String(v)))
                    }
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
                    onChange={(v) =>
                      field.onChange(v == null ? undefined : normalizeText(String(v)))
                    }
                    options={modeleOptions}
                    placeholder={
                      selectedMarque
                        ? "— Sélectionner ou ajouter un modèle —"
                        : "Choisir une marque"
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

          <div>
            <label htmlFor="typeVehicule" className="block text-sm font-medium text-gray-700">
              {t("vehicules.typeVehicule")}
            </label>
            <Controller
              name="typeVehicule"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  id="typeVehicule"
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v == null ? undefined : String(v))}
                  options={genreOptions}
                  placeholder={
                    selectedCategorie
                      ? t("vehicules.selectGenre")
                      : t("vehicules.selectCategorieFirst")
                  }
                  emptyText={t("vehicules.noGenre")}
                  disabled={!selectedCategorie}
                />
              )}
            />
          </div>

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
              {errors.places && (
                <p className="mt-1 text-xs text-red-600">{errors.places.message}</p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          {t("dossier.precedent")}
        </button>
        {effectiveMode === "existant" ? (
          <button type="button" onClick={handleExistingNext} className={primaryButtonClass}>
            {t("dossier.suivant")}
          </button>
        ) : (
          <button type="submit" className={primaryButtonClass}>
            {t("dossier.suivant")}
          </button>
        )}
      </div>
    </form>
  );
}

// ============ Étape 3 : Police ============

/** Type formulaire — dureeMois est `number` ici ; le refine Zod valide */
type PoliceStepValues = Omit<DossierPolice, "dureeMois"> & { dureeMois: number };

function PoliceStep({
  initial,
  onNext,
  onBack,
}: {
  initial: DossierPolice | null;
  onNext: (value: DossierPolice) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { data: assureurs = [] } = useAssureurs();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PoliceStepValues>({
    resolver: zodResolver(dossierPoliceSchema) as never,
    defaultValues: initial ?? {
      typeCarte: "VERTE" as const,
      dureeMois: 12,
      dateEffet: new Date().toISOString().slice(0, 10),
    },
  });

  const watchedDateEffet = useWatch({ control, name: "dateEffet" });
  const watchedDureeMois = useWatch({ control, name: "dureeMois" });

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

  const onFormSubmit = (data: PoliceStepValues) => onNext(data as unknown as DossierPolice);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {echeanceInfo && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            echeanceInfo.isExpired
              ? "border-red-200 bg-red-50"
              : echeanceInfo.isUrgent
                ? "border-orange-200 bg-orange-50"
                : "border-green-200 bg-green-50",
          )}
        >
          <p className="text-sm font-medium text-gray-700">
            {t("polices.dateEcheance")} :{" "}
            <span
              className={cn(
                "font-bold",
                echeanceInfo.isExpired
                  ? "text-red-700"
                  : echeanceInfo.isUrgent
                    ? "text-orange-700"
                    : "text-green-700",
              )}
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

      <div>
        <label htmlFor="appreciation" className="block text-sm font-medium text-gray-700">
          Appréciation
        </label>
        <textarea
          id="appreciation"
          {...register("appreciation")}
          rows={2}
          className={inputClass}
          placeholder="Notes sur la police..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          {t("dossier.precedent")}
        </button>
        <button type="submit" className={primaryButtonClass}>
          {t("dossier.suivant")}
        </button>
      </div>
    </form>
  );
}

// ============ Étape 4 : Paiement ============

/** Type formulaire — paye/avance ont un .default() dans Zod */
type PaiementStepValues = Omit<DossierPaiement, "paye" | "avance"> & {
  paye?: number;
  avance?: number;
};

function PaiementStep({
  onFinish,
  onBack,
  isSubmitting,
  submitError,
}: {
  onFinish: (paiement: DossierPaiement | undefined) => void;
  onBack: () => void;
  isSubmitting?: boolean | undefined;
  submitError?: string | null | undefined;
}) {
  const { t } = useTranslation();
  const [withPaiement, setWithPaiement] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PaiementStepValues>({
    resolver: zodResolver(dossierPaiementSchema) as never,
    defaultValues: {
      montantDu: 0,
      paye: 0,
      avance: 0,
      datePaiement: new Date().toISOString().slice(0, 10),
    },
  });

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

  const onFormSubmit = (data: PaiementStepValues) => onFinish(data as unknown as DossierPaiement);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={withPaiement}
          onChange={(e) => setWithPaiement(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 accent-[#614e1a]"
        />
        {t("dossier.enregistrerPaiement")}
      </label>

      {withPaiement && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              {errors.avance && (
                <p className="mt-1 text-xs text-red-600">{errors.avance.message}</p>
              )}
            </div>
          </div>

          <div className={cn("rounded-lg border px-4 py-3", statutColors[statut])}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t("paiements.reste")} : <span className="font-bold">{formatFCFA(reste)}</span>
              </p>
              <span className="rounded-full px-3 py-1 text-xs font-bold">
                {t(`paiements.${statut.toLowerCase()}`)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </>
      )}

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          {t("dossier.precedent")}
        </button>
        {withPaiement ? (
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? t("common.loading") : t("dossier.enregistrerDossier")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onFinish(undefined)}
            disabled={isSubmitting}
            className={primaryButtonClass}
          >
            {isSubmitting ? t("common.loading") : t("dossier.enregistrerDossier")}
          </button>
        )}
      </div>
    </form>
  );
}
