/**
 * Bouton « Nouveau dossier » + dialog de l'assistant par étapes.
 * Point d'entrée UNIQUE pour créer client / véhicule / police / paiement.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateDossier } from "../../hooks/useDossier";
import { useAuth } from "../../lib/auth";
import type { DossierCreate } from "../../schemas/dossier";
import { AccountPendingNotice } from "../ui/AccountPendingNotice";
import { Dialog } from "../ui/Dialog";
import { DossierWizard } from "./DossierWizard";

interface NouveauDossierButtonProps {
  /** Classes du bouton (défaut : style des en-têtes de page) */
  className?: string | undefined;
}

export function NouveauDossierButton({ className }: NouveauDossierButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const createDossierMutation = useCreateDossier();

  // Compte auto-inscrit non validé : la fonction reste bloquée (le serveur
  // renvoie 403 de toute façon ; ici on l'explique clairement en amont).
  const isPending = user != null && !user.approved;

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
          "rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#8b7335]"
        }
      >
        + {t("dossier.bouton")}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isPending ? "Fonction indisponible" : t("dossier.title")}
        maxWidth={isPending ? "max-w-md" : "max-w-2xl"}
      >
        {isPending ? (
          <AccountPendingNotice feature="Nouveau dossier" />
        ) : (
          <DossierWizard
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            isSubmitting={createDossierMutation.isPending}
            submitError={createDossierMutation.isError ? String(createDossierMutation.error) : null}
          />
        )}
      </Dialog>
    </>
  );
}
