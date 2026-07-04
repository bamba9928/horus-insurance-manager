/**
 * Page d'accueil publique + formulaire de connexion (mode web).
 * Seule page visible sans session ; toute autre route est protégée.
 */

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";

const LOGO_SRC = "/horus-manager-logo.png";
const LOGO_SRC_SET = "/horus-manager-logo.png 1x, /horus-manager-logo@2x.png 2x";
const SUPPORT_EMAIL = "contact@horus-assur.digital";

function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function LoginPage() {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loginInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLoginName("");
        setPassword("");
        setError(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const message = err.message.toLowerCase();
      if (message.includes("network") || message.includes("fetch")) {
        return "Erreur réseau. Vérifiez votre connexion internet.";
      }
      if (message.includes("timeout")) {
        return "Le serveur ne répond pas. Réessayez dans quelques instants.";
      }
      return err.message || "Identifiant ou mot de passe incorrect.";
    }
    return "Une erreur inattendue s'est produite. Réessayez.";
  };

  const isFormValid = loginName.trim().length > 0 && password.length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginName.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#f6f2e8] to-[#ece3cd] p-4 sm:p-6 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-sm">
        {/* Logo / Titre */}
        <div className="mb-8 text-center">
          <img
            src={LOGO_SRC}
            srcSet={LOGO_SRC_SET}
            alt="Horus Assurances"
            className="mx-auto h-auto w-52 max-w-full object-contain drop-shadow-lg sm:w-64"
          />
          <h1 className="sr-only">HORUS</h1>
        </div>

        {/* Carte de connexion */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-700 dark:bg-slate-800">
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
                ref={loginInputRef}
                id="login"
                type="text"
                autoComplete="username"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="votre identifiant"
                disabled={submitting}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                  Mot de passe
                </label>
                <a
                  href={supportMailto("Mot de passe oublié")}
                  className="text-xs font-medium text-[#614e1a] underline-offset-4 hover:underline dark:text-[#c2a65b]"
                >
                  Mot de passe oublié ?
                </a>
              </div>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 pr-24 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-2 rounded px-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  disabled={submitting}
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#614e1a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] disabled:cursor-not-allowed disabled:opacity-50"
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
