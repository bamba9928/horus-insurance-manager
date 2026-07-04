/**
 * Bouton « Nouveau dossier » + dialog de l'assistant par étapes.
 * Point d'entrée UNIQUE pour créer client / véhicule / police / paiement.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateDossier } from "../../hooks/useDossier";
import type { DossierCreate } from "../../schemas/dossier";
import { Dialog } from "../ui/Dialog";
import { DossierWizard } from "./DossierWizard";

interface NouveauDossierButtonProps {
  /** Classes du bouton (défaut : style des en-têtes de page) */
  className?: string | undefined;
}

export function NouveauDossierButton({ className }: NouveauDossierButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createDossierMutation = useCreateDossier();

  const handleOpen = () => {
    createDossierMutation.reset();
    setOpen(true);
  };

  const handleSubmit = (data: DossierCreate) => {
    createDossierMutation.mutate(data, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ??
          "rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b7335]"
        }
      >
        + {t("dossier.bouton")}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("dossier.title")}
        maxWidth="max-w-2xl"
      >
        <DossierWizard
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
          isSubmitting={createDossierMutation.isPending}
          submitError={createDossierMutation.isError ? String(createDossierMutation.error) : null}
        />
      </Dialog>
    </>
  );
}
