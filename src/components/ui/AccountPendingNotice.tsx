/**
 * Message affiché lorsqu'un compte doit encore être activé pour utiliser une
 * fonction réservée. Rappelle la marche à suivre + les contacts admin.
 */

import { useAuth } from "../../lib/auth";

interface AccountPendingNoticeProps {
  /** Nom de la fonction bloquée, ex. « Nouveau dossier ». */
  feature: string;
}

export function AccountPendingNotice({ feature }: AccountPendingNoticeProps) {
  const { config } = useAuth();
  const email = config.adminEmail;
  const whatsappLabel = "+221 77 249 05 30";
  const whatsappHref = `https://wa.me/221772490530?text=${encodeURIComponent(
    "Bonjour, je souhaite activer mon compte Horus.",
  )}`;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-700/50 dark:bg-amber-900/20">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl dark:bg-amber-800/40">
        <span aria-hidden="true">⏳</span>
      </div>
      <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
        Compte à activer
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-amber-800 dark:text-amber-200/90">
        La fonction <strong>{feature}</strong> sera disponible après activation de votre compte.
      </p>
      <p className="mt-3 text-sm text-amber-800 dark:text-amber-200/90">
        Contactez l'administrateur par email :{" "}
        <a
          href={`mailto:${email}?subject=${encodeURIComponent("Validation de mon compte Horus")}`}
          className="font-semibold text-green-700 underline-offset-4 hover:underline dark:text-green-400"
        >
          {email}
        </a>
      </p>
      <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">
        Ou via WhatsApp :{" "}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-green-700 underline-offset-4 hover:underline dark:text-green-400"
        >
          {whatsappLabel}
        </a>
      </p>
    </div>
  );
}
