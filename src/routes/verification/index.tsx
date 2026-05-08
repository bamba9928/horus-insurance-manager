import { useState } from "react";
import { Header } from "../../components/layout";
import { formatDateDisplay } from "../../lib/date-utils";
import { openExternalUrl, type VerificationData, verifyContract } from "../../lib/ipc";

function normalizePlate(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function toFriendlyPlate(value: string): string {
  const normalized = normalizePlate(value);
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 5) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  return `${normalized.slice(0, 2)}-${normalized.slice(2, normalized.length - 2)}-${normalized.slice(-2)}`;
}

function buildAttestationUrl(attestationNumber: string): string {
  return `https://aas.diotali.com/#/attestation/${attestationNumber}`;
}

function buildCedeaoUrl(attestationNumber: string): string {
  return `https://aas.diotali.com/#/carte-brune/${attestationNumber}`;
}

function formatApiDate(value: string): string {
  const raw = value?.trim();
  if (!raw) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return formatDateDisplay(raw);
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const iso = raw.replace(" ", "T");
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return raw;
}

function extractCompagnie(operationMessage: string | null): string {
  if (!operationMessage) return "—";
  const match = operationMessage.match(/chez\s+([A-Za-z0-9 .'-]+)\s*$/i);
  return match?.[1]?.trim() || "—";
}

export function VerificationPage() {
  const [immatriculationInput, setImmatriculationInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationData | null>(null);

  const normalizedPlate = normalizePlate(immatriculationInput);

  function handleReset() {
    setImmatriculationInput("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setResult(null);
  }

  async function openExternalLink(url: string) {
    if (!url) return;
    try {
      await openExternalUrl(url);
    } catch (_error) {
      setErrorMessage("Impossible d'ouvrir le lien externe.");
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedPlate) {
      setErrorMessage("Veuillez renseigner une immatriculation valide.");
      setSuccessMessage(null);
      setResult(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setResult(null);

    try {
      const payload = await verifyContract(normalizedPlate);

      if (payload.operationStatus === "SUCCESS" && payload.data) {
        setResult(payload.data);
        setSuccessMessage(payload.operationMessage);
        return;
      }

      setErrorMessage(
        payload.operationMessage ||
          `Ce véhicule (${toFriendlyPlate(normalizedPlate)}) n'est pas assuré.`,
      );
    } catch (_error) {
      setErrorMessage(
        `La vérification a échoué. Vérifiez la connexion puis réessayez pour le véhicule ${toFriendlyPlate(
          normalizedPlate,
        )}.`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  const attestationUrl = result ? buildAttestationUrl(result.attestationNumber) : "";
  const cedeaoUrl = result ? buildCedeaoUrl(result.attestationNumber) : "";

  return (
    <>
      <Header title="Vérification de validité d'un contrat" />
      <div className="overflow-auto p-4">
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <form onSubmit={handleVerify} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full md:max-w-lg">
              <label
                htmlFor="immatriculation"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-200"
              >
                Immatriculation
              </label>
              <input
                id="immatriculation"
                type="text"
                value={immatriculationInput}
                onChange={(e) => setImmatriculationInput(e.target.value)}
                placeholder="Ex: AA149JD"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex h-10 items-center gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#614e1a] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Vérification..." : "Vérifier"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Réinitialiser
              </button>
            </div>
          </form>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {errorMessage.includes("n'est pas valide")
                ? "Ce véhicule n'est pas assuré (attestation non valide)."
                : errorMessage}
            </div>
          )}
        </section>

        {result && (
          <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Détails du contrat
            </h3>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="N° Attestation" value={result.attestationNumber} />
              <ReadonlyField
                label="Immatriculation"
                value={toFriendlyPlate(result.immatriculation)}
              />
              <ReadonlyField label="Compagnie" value={extractCompagnie(successMessage)} />
              <ReadonlyField label="Date d'effet" value={formatApiDate(result.dateEffet)} />
              <ReadonlyField label="Date d'échéance" value={formatApiDate(result.dateEcheance)} />
              <ReadonlyField label="Marque" value={result.marque} />
              <ReadonlyField label="Modèle" value={result.modele} />
              <div className="lg:col-span-2">
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                  Liens utiles
                </p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void openExternalLink(attestationUrl)}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#614e1a] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335]"
                  >
                    Ouvrir Attestation
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExternalLink(cedeaoUrl)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[#614e1a] px-3 text-sm font-semibold text-[#614e1a] transition-colors hover:bg-[#614e1a]/10 dark:text-[#c9b37f]"
                  >
                    Ouvrir CEDEAO
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
      <input
        type="text"
        readOnly
        value={value}
        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}
