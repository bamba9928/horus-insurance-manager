/**
 * Dialog « Encaisser un versement » : complète un paiement existant.
 * Le montant s'ajoute au champ « payé », la date/mode/référence du dernier
 * versement sont mis à jour et l'opération est tracée dans les notes.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { useUpdatePaiement } from "../../hooks/usePaiements";
import { formatDateDisplay, formatFCFA } from "../../lib/date-utils";
import { cn } from "../../lib/utils";
import type { Paiement } from "../../schemas/paiement";
import { MODES_PAIEMENT } from "../../schemas/paiement";
import { Dialog } from "../ui/Dialog";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none";

interface EncaissementDialogProps {
  /** Paiement à compléter (null = dialog fermé) */
  paiement: Paiement | null;
  /** Callback de fermeture */
  onClose: () => void;
}

export function EncaissementDialog({ paiement, onClose }: EncaissementDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={paiement != null} onClose={onClose} title={t("encaissement.title")}>
      {paiement && <EncaissementForm paiement={paiement} onClose={onClose} />}
    </Dialog>
  );
}

interface EncaissementFormValues {
  montant: number;
  date: string;
  mode?: (typeof MODES_PAIEMENT)[number];
  reference?: string;
}

function EncaissementForm({ paiement, onClose }: { paiement: Paiement; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const updateMutation = useUpdatePaiement();

  const reste = Math.max(0, paiement.montant_du - paiement.paye - paiement.avance);

  const schema = z.object({
    montant: z
      .number("Montant requis")
      .int()
      .min(1, "Le montant doit être supérieur à 0")
      .max(reste, "Le montant dépasse le reste à payer"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)"),
    mode: z.enum(MODES_PAIEMENT).optional(),
    reference: z.string().max(200).optional(),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EncaissementFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  const watchedMontant = useWatch({ control, name: "montant" });
  const montantSaisi = Number.isFinite(watchedMontant) ? (watchedMontant ?? 0) : 0;
  const nouveauReste = Math.max(0, reste - montantSaisi);

  const onSubmit = (data: EncaissementFormValues) => {
    // Trace du versement conservée dans les notes (historique)
    const trace = [
      `+${formatFCFA(data.montant)} le ${formatDateDisplay(data.date)}`,
      data.mode ? ` — ${data.mode.replace("_", " ")}` : "",
      data.reference ? ` (réf. ${data.reference})` : "",
    ].join("");

    updateMutation.mutate(
      {
        id: paiement.id,
        paye: paiement.paye + data.montant,
        datePaiement: data.date,
        ...(data.mode ? { mode: data.mode } : {}),
        ...(data.reference ? { reference: data.reference } : {}),
        notes: paiement.notes ? `${paiement.notes}\n${trace}` : trace,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {/* Situation actuelle */}
      <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">{t("paiements.montantDu")}</span>
          <span className="font-medium text-gray-900">{formatFCFA(paiement.montant_du)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">{t("paiements.paye")}</span>
          <span className="font-medium text-green-700">{formatFCFA(paiement.paye)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">{t("encaissement.resteActuel")}</span>
          <span className="font-bold text-red-700">{formatFCFA(reste)}</span>
        </div>
      </div>

      {/* Montant + Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="enc-montant" className="block text-sm font-medium text-gray-700">
            {t("encaissement.montant")} *
          </label>
          <input
            id="enc-montant"
            type="number"
            {...register("montant", { valueAsNumber: true })}
            className={inputClass}
            placeholder={String(reste)}
            min={1}
            max={reste}
          />
          {errors.montant && <p className="mt-1 text-xs text-red-600">{errors.montant.message}</p>}
        </div>
        <div>
          <label htmlFor="enc-date" className="block text-sm font-medium text-gray-700">
            {t("common.date")}
          </label>
          <input id="enc-date" type="date" {...register("date")} className={inputClass} />
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
        </div>
      </div>

      {/* Mode + Référence */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="enc-mode" className="block text-sm font-medium text-gray-700">
            {t("paiements.mode")}
          </label>
          <select
            id="enc-mode"
            {...register("mode", { setValueAs: (v) => (v === "" ? undefined : v) })}
            className={inputClass}
          >
            <option value="">— Sélectionner —</option>
            {MODES_PAIEMENT.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="enc-reference" className="block text-sm font-medium text-gray-700">
            {t("paiements.reference")}
          </label>
          <input
            id="enc-reference"
            type="text"
            {...register("reference")}
            className={inputClass}
            placeholder="N° reçu, chèque..."
          />
        </div>
      </div>

      {/* Nouveau reste en temps réel */}
      <div
        className={cn(
          "rounded-lg border px-4 py-3",
          nouveauReste === 0
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-orange-200 bg-orange-50 text-orange-800",
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {t("encaissement.nouveauReste")} :{" "}
            <span className="font-bold">{formatFCFA(nouveauReste)}</span>
          </p>
          <span className="rounded-full px-3 py-1 text-xs font-bold">
            {nouveauReste === 0 ? t("paiements.solde") : t("paiements.partiel")}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
        >
          {updateMutation.isPending ? t("common.loading") : t("encaissement.bouton")}
        </button>
      </div>
    </form>
  );
}
