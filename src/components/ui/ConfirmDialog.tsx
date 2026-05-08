/**
 * Dialog de confirmation (suppression, etc.)
 */

import { useState } from "react";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmer",
  variant = "default",
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const result = await onConfirm();
      if (result !== false) onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-gray-600 dark:text-slate-300">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isConfirming}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#614e1a] hover:bg-[#8b7335]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isConfirming ? "..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
