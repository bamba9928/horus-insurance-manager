/**
 * Page d'accueil publique + formulaire de connexion (mode web).
 * Seule page visible sans session ; toute autre route est protégée.
 */

import { type FormEvent, useState } from "react";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fa] px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(135deg,#614e1a_0%,#8b7335_42%,#172033_100%)]" />
      <div className="absolute inset-x-0 top-56 h-px bg-gradient-to-r from-transparent via-[#614e1a]/30 to-transparent" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-lg border border-white/70 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[0.9fr_1.1fr]">
        <section className="flex min-h-72 flex-col justify-between bg-[#614e1a] px-7 py-7 text-white md:min-h-[520px]">
          <div>
            <div className="inline-flex rounded-lg bg-white px-3 py-2 shadow-lg shadow-black/20">
              <img
                src={LOGO_SRC}
                srcSet={LOGO_SRC_SET}
                alt="Horus Assurances"
                className="h-auto w-52 max-w-full object-contain"
              />
            </div>
            <h1 className="mt-8 text-2xl font-semibold leading-tight">Espace sécurisé</h1>
            <p className="mt-3 max-w-xs text-sm leading-6 text-white/80">
              Horus Assurances Manager
            </p>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-4 text-sm text-white/85">
            <p className="font-medium text-white">Support</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-1 inline-block break-all text-white underline-offset-4 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </section>

        <section className="flex items-center px-6 py-8 sm:px-10">
          <div className="w-full">
            <div className="mb-7">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#614e1a] dark:text-[#c2a65b]">
                Connexion
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                Connectez-vous
              </h2>
            </div>

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
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-[#614e1a] focus:ring-2 focus:ring-[#614e1a]/20 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="votre identifiant"
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
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-[#614e1a] focus:ring-2 focus:ring-[#614e1a]/20 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#614e1a] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#614e1a]/20 transition-colors hover:bg-[#8b7335] focus:outline-none focus:ring-2 focus:ring-[#614e1a]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Connexion..." : "Se connecter"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Pas encore de compte ?{" "}
              <a
                href={supportMailto("Demande d'accès Horus Assurances Manager")}
                className="font-medium text-[#614e1a] underline-offset-4 hover:underline dark:text-[#c2a65b]"
              >
                Demander un accès
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
