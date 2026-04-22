/**
 * Composant Dialog (modal) réutilisable.
 * Overlay + centrage + animation.
 */

import { useEffect, useRef } from "react";

interface DialogProps {
  /** Contrôle l'ouverture */
  open: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Titre du dialog */
  title: string;
  /** Contenu du dialog */
  children: React.ReactNode;
  /** Largeur max (défaut: max-w-lg) */
  maxWidth?: string;
}

export function Dialog({ open, onClose, title, children, maxWidth = "max-w-lg" }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`${maxWidth} w-full rounded-xl border-none bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-slate-800 dark:text-slate-100`}
      onClose={onClose}
    >
      {open && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <span className="text-xl leading-none">&times;</span>
            </button>
          </div>
          {/* Content */}
          <div className="px-4 py-4">{children}</div>
        </>
      )}
    </dialog>
  );
}
