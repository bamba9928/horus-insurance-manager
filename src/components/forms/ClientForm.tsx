/**
 * Formulaire de création / édition d'un client.
 * Utilise react-hook-form + Zod pour la validation.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { Client, ClientCreate } from "../../schemas/client";
import { clientCreateSchema } from "../../schemas/client";

interface ClientFormProps {
  /** Client existant pour le mode édition */
  defaultValues?: Client;
  /** Callback de soumission */
  onSubmit: (data: ClientCreate) => void;
  /** Callback d'annulation */
  onCancel: () => void;
  /** Formulaire en cours de soumission */
  isSubmitting?: boolean;
}

export function ClientForm({ defaultValues, onSubmit, onCancel, isSubmitting }: ClientFormProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientCreate>({
    resolver: zodResolver(clientCreateSchema),
    ...(defaultValues
      ? {
          defaultValues: {
            nomPrenom: defaultValues.nom_prenom,
            adresse: defaultValues.adresse ?? undefined,
            telephone: defaultValues.telephone ?? undefined,
            email: defaultValues.email ?? undefined,
            notes: defaultValues.notes ?? undefined,
          },
        }
      : {}),
  });

  const onFormSubmit = (data: ClientCreate) => onSubmit(data);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Nom & Prénom */}
      <div>
        <label htmlFor="nomPrenom" className="block text-sm font-medium text-gray-700">
          {t("clients.nomPrenom")} *
        </label>
        <input
          id="nomPrenom"
          type="text"
          {...register("nomPrenom")}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
          placeholder="Ex: Mamadou Diallo"
        />
        {errors.nomPrenom && (
          <p className="mt-1 text-xs text-red-600">{errors.nomPrenom.message}</p>
        )}
      </div>

      {/* Téléphone */}
      <div>
        <label htmlFor="telephone" className="block text-sm font-medium text-gray-700">
          {t("clients.telephone")}
        </label>
        <input
          id="telephone"
          type="tel"
          {...register("telephone")}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
          placeholder="77 123 45 67"
        />
        {errors.telephone && (
          <p className="mt-1 text-xs text-red-600">{errors.telephone.message}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t("clients.email")}
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
          placeholder="client@example.com"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>

      {/* Adresse */}
      <div>
        <label htmlFor="adresse" className="block text-sm font-medium text-gray-700">
          {t("clients.adresse")}
        </label>
        <input
          id="adresse"
          type="text"
          {...register("adresse")}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
          placeholder="Dakar, Sénégal"
        />
        {errors.adresse && <p className="mt-1 text-xs text-red-600">{errors.adresse.message}</p>}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          {t("clients.notes")}
        </label>
        <textarea
          id="notes"
          {...register("notes")}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none"
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
