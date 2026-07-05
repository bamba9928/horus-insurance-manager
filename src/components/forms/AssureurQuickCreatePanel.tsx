import { type KeyboardEvent, useState } from "react";
import { useCreateAssureur } from "../../hooks/useAssureurs";
import type { Assureur, AssureurCreate } from "../../schemas/assureur";
import { assureurCreateSchema } from "../../schemas/assureur";

interface AssureurQuickCreatePanelProps {
  assureurs: Assureur[];
  onCreated: (id: number) => void;
  onCancel: () => void;
}

function normalizeAssureurName(value: string): string {
  return value.trim().toLowerCase();
}

export function AssureurQuickCreatePanel({
  assureurs,
  onCreated,
  onCancel,
}: AssureurQuickCreatePanelProps) {
  const createMutation = useCreateAssureur();
  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNom("");
    setContact("");
    setCode("");
    setError(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleCreate = async () => {
    setError(null);
    const payload: AssureurCreate = {
      nom: nom.trim(),
      ...(contact.trim() ? { contact: contact.trim() } : {}),
      ...(code.trim() ? { code: code.trim() } : {}),
      integrationType: "MANUAL",
      integrationEnabled: false,
    };
    const parsed = assureurCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Données invalides");
      return;
    }

    const existing = assureurs.find(
      (assureur) => normalizeAssureurName(assureur.nom) === normalizeAssureurName(parsed.data.nom),
    );
    if (existing) {
      onCreated(existing.id);
      reset();
      return;
    }

    try {
      const id = await createMutation.mutateAsync(parsed.data);
      onCreated(id);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter la compagnie");
    }
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreate();
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label htmlFor="quick-assureur-nom" className="block text-sm font-medium text-gray-700">
            Nom de la compagnie *
          </label>
          <input
            id="quick-assureur-nom"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="quick-assureur-contact"
            className="block text-sm font-medium text-gray-700"
          >
            Contact
          </label>
          <input
            id="quick-assureur-contact"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className={inputClass}
            placeholder="Téléphone, email..."
          />
        </div>
        <div>
          <label htmlFor="quick-assureur-code" className="block text-sm font-medium text-gray-700">
            Code
          </label>
          <input
            id="quick-assureur-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className={inputClass}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={createMutation.isPending}
          className="rounded-lg bg-[#614e1a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
        >
          {createMutation.isPending ? "Ajout..." : "Ajouter et sélectionner"}
        </button>
      </div>
    </div>
  );
}
