/**
 * Page d'accueil publique + formulaire de connexion (mode web).
 * Seule page visible sans session ; toute autre route est protégée.
 */

import { type FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";

const LOGO_SRC = "/horus-manager-logo.png";
const LOGO_SRC_SET = "/horus-manager-logo.png 1x, /horus-manager-logo@2x.png 2x";
const SUPPORT_EMAIL = "contact@horus-assur.digital";

export function LoginPage() {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginName.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la connexion");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f6f2e8] to-[#ece3cd] p-4 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-sm">
        {/* Logo / Titre */}
        <div className="mb-8 text-center">
          <img
            src={LOGO_SRC}
            srcSet={LOGO_SRC_SET}
            alt="Horus Assurances"
            className="mx-auto h-auto w-64 max-w-full object-contain drop-shadow-lg"
          />
          <h1 className="sr-only">HORUS</h1>
        </div>

        {/* Carte de connexion */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-slate-100">
            Connectez-vous
          </h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Identifiant
              </label>
              <input
                id="login"
                type="text"
                autoComplete="username"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="votre identifiant"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#614e1a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] disabled:opacity-50"
            >
              {submitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-slate-500">
          Accès réservé. Contact :{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-[#614e1a] underline-offset-4 hover:underline dark:text-[#c2a65b]"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
