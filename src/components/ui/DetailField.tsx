/**
 * Champ de détail (résumé) : libellé + valeur, centré, aux couleurs du projet.
 * Utilisé dans les panneaux maître-détail (clients, véhicules, polices,
 * paiements) et le résumé du tableau de bord.
 */

interface DetailFieldProps {
  label: string;
  value: string | null | undefined;
}

export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="rounded-lg border border-[#614e1a]/15 bg-[#614e1a]/5 px-3 py-2 text-center dark:border-[#c9a961]/20 dark:bg-[#614e1a]/10">
      <p className="text-[11px] font-semibold tracking-wide text-[#614e1a] uppercase dark:text-[#c9a961]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium break-words text-gray-900 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}
