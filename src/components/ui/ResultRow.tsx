import { formatFCFA } from "../../lib/tarification";

interface ResultRowProps {
  label: string;
  value: number;
  muted?: boolean;
  highlight?: boolean;
  variant?: "success";
}

/** Ligne de résultat d'un calcul de tarif (libellé + montant en FCFA). */
export function ResultRow({ label, value, muted, highlight, variant }: ResultRowProps) {
  const base = "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors";
  const tone = muted
    ? "bg-gray-50 text-gray-600 dark:bg-slate-700/50 dark:text-slate-400"
    : highlight
      ? variant === "success"
        ? "bg-green-50 text-green-800 font-semibold dark:bg-green-900/30 dark:text-green-200"
        : "bg-[#614e1a]/10 text-[#614e1a] font-semibold dark:bg-[#d4b85a]/10 dark:text-[#d4b85a]"
      : "bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100";
  return (
    <div className={`${base} ${tone}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatFCFA(value)} FCFA</span>
    </div>
  );
}
