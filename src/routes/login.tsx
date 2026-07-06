/**
 * Page d'accueil publique : accueil, connexion et auto-inscription (mode web).
 * Seule page visible sans session ; toute autre route est protégée.
 */

import { type FormEvent, useEffect, useRef, useState } from "react";
import { type RegisterInput, useAuth } from "../lib/auth";

const LOGO_SRC = "/horus-manager-logo.png";
const LOGO_SRC_SET = "/horus-manager-logo.png 1x, /horus-manager-logo@2x.png 2x";
const SUPPORT_EMAIL = "contact@horus-assur.digital";

function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("network") || message.includes("fetch")) {
      return "Erreur réseau. Vérifiez votre connexion internet.";
    }
    if (message.includes("timeout")) {
      return "Le serveur ne répond pas. Réessayez dans quelques instants.";
    }
    return err.message || "Une erreur est survenue.";
  }
  return "Une erreur inattendue s'est produite. Réessayez.";
}

type Mode = "home" | "login" | "register";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-slate-300";
const loginLabelClass = "block text-sm font-medium text-green-700 dark:text-green-400";

export function LoginPage() {
  const { config } = useAuth();
  const [mode, setMode] = useState<Mode>("home");

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

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-700 dark:bg-slate-800">
          {mode === "home" ? (
            <HomePanel
              registrationEnabled={config.registrationEnabled}
              onGoToLogin={() => setMode("login")}
              onGoToRegister={() => setMode("register")}
            />
          ) : mode === "login" ? (
            <LoginForm
              onBack={() => setMode("home")}
              onSwitchToRegister={() => setMode("register")}
            />
          ) : (
            <RegisterForm onBack={() => setMode("home")} onSwitchToLogin={() => setMode("login")} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-slate-500">
          Accès réservé. Contact :{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-green-700 underline-offset-4 hover:underline dark:text-green-400"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}

function HomePanel({
  registrationEnabled,
  onGoToLogin,
  onGoToRegister,
}: {
  registrationEnabled: boolean;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-lg font-semibold text-[#614e1a] dark:text-[#c2a65b]">Bienvenue</h2>
      <p className="text-sm text-gray-600 dark:text-slate-400">
        Accédez à votre espace Horus Assurances Manager.
      </p>
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={onGoToRegister}
          disabled={!registrationEnabled}
          className="flex w-full items-center justify-center rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500"
        >
          Créer un compte
        </button>
        <button
          type="button"
          onClick={onGoToLogin}
          className="flex w-full items-center justify-center rounded-lg bg-[#614e1a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335]"
        >
          Connectez-vous
        </button>
      </div>
      {!registrationEnabled && (
        <p className="text-xs text-gray-500 dark:text-slate-500">
          La création de compte est actuellement désactivée.
        </p>
      )}
    </div>
  );
}

function LoginForm({
  onBack,
  onSwitchToRegister,
}: {
  onBack: () => void;
  onSwitchToRegister: () => void;
}) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const loginInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loginInputRef.current?.focus();
  }, []);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="mb-4 text-center text-lg font-semibold text-[#614e1a] dark:text-[#c2a65b]">
        Connectez-vous
      </h2>

      <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
        <div>
          <label htmlFor="login-email" className={loginLabelClass}>
            Email
          </label>
          <input
            ref={loginInputRef}
            id="login-email"
            name="email"
            type="email"
            data-no-upper
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            placeholder="votre@email.com"
            disabled={submitting}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className={loginLabelClass}>
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
              name="current-password"
              type={showPassword ? "text" : "password"}
              data-no-upper
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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="flex flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Retour
          </button>
          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#614e1a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </div>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600 dark:text-slate-400">
        Pas encore de compte ?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-green-700 underline-offset-4 hover:underline dark:text-green-400"
        >
          Créer un compte
        </button>
      </p>
    </>
  );
}

type RegisterFormState = RegisterInput;

const emptyRegister: RegisterFormState = {
  nom: "",
  prenom: "",
  email: "",
  telephone1: "",
  password: "",
  passwordConfirm: "",
  website: "",
};

function RegisterForm({
  onBack,
  onSwitchToLogin,
}: {
  onBack: () => void;
  onSwitchToLogin: () => void;
}) {
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterFormState>(emptyRegister);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof RegisterFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const isValid =
    form.nom.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    form.password === form.passwordConfirm;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.passwordConfirm) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        nom: form.nom.trim(),
        prenom: form.prenom?.trim() || undefined,
        email: form.email.trim(),
        telephone1: form.telephone1?.trim() || undefined,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        website: form.website?.trim() || undefined,
      });
      // Succès → l'AuthProvider a défini l'utilisateur, l'app se charge.
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="text-center text-lg font-semibold text-[#614e1a] dark:text-[#c2a65b]">
        Créer un compte
      </h2>

      <form onSubmit={onSubmit} className="space-y-3" autoComplete="on">
        <div
          className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
          aria-hidden="true"
        >
          <label htmlFor="reg-website">Site web</label>
          <input
            id="reg-website"
            name="website"
            type="text"
            value={form.website ?? ""}
            onChange={update("website")}
            tabIndex={-1}
            autoComplete="off"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-nom" className={labelClass}>
              Nom complet
            </label>
            <input
              id="reg-nom"
              name="name"
              type="text"
              autoComplete="name"
              value={form.nom}
              onChange={update("nom")}
              required
              minLength={2}
              maxLength={200}
              className={inputClass}
              placeholder="Aminata Diop"
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="reg-tel" className={labelClass}>
              Téléphone
            </label>
            <input
              id="reg-tel"
              name="tel"
              type="tel"
              autoComplete="tel"
              value={form.telephone1}
              onChange={update("telephone1")}
              maxLength={50}
              className={inputClass}
              placeholder="optionnel"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className={labelClass}>
            Email
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            data-no-upper
            autoComplete="username"
            value={form.email}
            onChange={update("email")}
            required
            maxLength={200}
            className={inputClass}
            placeholder="aminata.diop@example.com"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-password" className={labelClass}>
              Mot de passe
            </label>
            <input
              id="reg-password"
              name="new-password"
              type="password"
              data-no-upper
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              required
              minLength={8}
              maxLength={200}
              className={inputClass}
              placeholder="8 caractères min."
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="reg-password-confirm" className={labelClass}>
              Confirmation
            </label>
            <input
              id="reg-password-confirm"
              name="new-password-confirm"
              type="password"
              data-no-upper
              autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={update("passwordConfirm")}
              required
              minLength={8}
              maxLength={200}
              className={inputClass}
              placeholder="Confirmer"
              disabled={submitting}
            />
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
          disabled={submitting || !isValid}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#614e1a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600 dark:text-slate-400">
        Déjà un compte ?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-[#614e1a] underline-offset-4 hover:underline dark:text-[#c2a65b]"
        >
          Se connecter
        </button>
      </p>
      <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
        <button
          type="button"
          onClick={onBack}
          className="font-semibold text-gray-600 underline-offset-4 hover:underline dark:text-slate-300"
        >
          Retour à l'accueil
        </button>
      </p>
    </>
  );
}
