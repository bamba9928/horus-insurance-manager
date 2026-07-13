/**
 * Page d'accueil publique : accueil, connexion et auto-inscription (mode web).
 * Seule page visible sans session ; toute autre route est protégée.
 */

import {
  Check,
  ChevronDown,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  SearchCheck,
  Share2,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DevisRapideForm } from "../components/forms/DevisRapideForm";
import { AppFooter } from "../components/layout";
import { SeoMetadata } from "../components/seo/SeoMetadata";
import { useToast } from "../components/ui/Toast";
import { type RegisterInput, useAuth } from "../lib/auth";
import { DEVIS_WHATSAPP_PHONE } from "../lib/devis";
import { buildAbsoluteUrl, getClientPublicSiteUrl, SEO_CONFIG } from "../lib/seo";
import { VerificationPage } from "./verification";

const LOGO_SRC = "/horus-manager-logo.png";
const LOGO_SRC_SET = "/horus-manager-logo.png 1x, /horus-manager-logo@2x.png 2x";
const SUPPORT_EMAIL = "contact@horus-assur.digital";
const PUBLIC_SHARE_TEXT =
  "Devis, clients, véhicules, polices, paiements et échéances d'assurance auto dans un seul outil.";

/** Même numéro que le devis WhatsApp — une seule source de vérité. */
const CONTACT_PHONE_DISPLAY = "+221 77 340 96 58";
const CONTACT_PHONE_TEL = `+${DEVIS_WHATSAPP_PHONE}`;
/* Un `text` dédié : sans lui, WhatsApp rouvre la conversation avec le dernier
   brouillon pré-rempli (ex. un devis validé puis réinitialisé). */
const CONTACT_WHATSAPP_URL = `https://wa.me/${DEVIS_WHATSAPP_PHONE}?text=${encodeURIComponent(
  "Bonjour, je vous contacte depuis le site Horus Assurances Manager.",
)}`;
const CONTACT_LOCATION = "Dakar, Sénégal";

/** Reprend la `featureList` déclarée dans le JSON-LD (cf. lib/seo.ts). */
const FEATURES = [
  "Devis d'assurance auto en quelques clics",
  "Gestion des clients et des véhicules",
  "Suivi des polices et des renouvellements",
  "Paiements, restes à payer et impayés",
  "Alertes sur les échéances à venir",
] as const;

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

type Mode = "home" | "login" | "register" | "verification";

const FOCUSABLE_SELECTOR = "input, select, textarea, button";

/** Ancre publique : https://…/#devis ouvre directement le formulaire de devis. */
const DEVIS_HASH = "#devis";

/** Doit rester aligné sur la classe `duration-300` du panneau de devis. */
const DEVIS_TRANSITION_MS = 300;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isDevisHash(): boolean {
  return typeof window !== "undefined" && window.location.hash === DEVIS_HASH;
}

/** Reflète l'état du panneau dans l'URL sans empiler d'entrée d'historique. */
function syncDevisHash(open: boolean): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}${open ? DEVIS_HASH : ""}`);
}

/** CTA principal de l'accueil : plein, aux couleurs de la marque. */
const primaryButtonClass =
  "flex w-full items-center justify-center rounded-lg bg-[#614e1a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8b7335]";
/** CTA secondaire : même poids typographique, contour seulement. */
const secondaryButtonClass =
  "flex w-full items-center justify-center rounded-lg border border-[#614e1a]/40 px-4 py-2.5 text-sm font-semibold text-[#614e1a] transition-colors hover:bg-[#614e1a]/5 dark:border-amber-300/40 dark:text-amber-200 dark:hover:bg-amber-300/10";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-slate-300";
const loginLabelClass = "block text-sm font-medium text-green-700 dark:text-green-400";

export function LoginPage() {
  const { config } = useAuth();
  const [mode, setMode] = useState<Mode>("home");
  const [devisOpen, setDevisOpen] = useState(isDevisHash);
  // Remonte DevisRapideForm après le repli : la saisie repart de zéro à la réouverture.
  const [devisFormKey, setDevisFormKey] = useState(0);
  // Dépliage terminé : on peut relâcher l'overflow qui rognait les menus déroulants.
  const [devisExpanded, setDevisExpanded] = useState(false);
  const devisPanelRef = useRef<HTMLDivElement>(null);
  const devisTouched = useRef(false);
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;

  const toggleDevis = useCallback(() => {
    const next = !devisOpen;
    setDevisOpen(next);
    syncDevisHash(next);
  }, [devisOpen]);

  // Navigation vers /#devis (lien partagé, bouton retour) → ouvre le panneau.
  useEffect(() => {
    const onHashChange = () => setDevisOpen(isDevisHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Le focus est immédiat, le reste attend la fin de l'animation :
  //  - ouverture : scroll une fois le panneau déplié (avant, il est à hauteur 0,
  //    la page n'a donc rien à faire défiler) et libération de l'overflow ;
  //  - fermeture : remise à zéro du formulaire une fois replié, pour ne pas voir
  //    les champs se vider pendant l'animation.
  // (transitionend sur grid-template-rows n'est pas émis de façon fiable.)
  useEffect(() => {
    const panel = devisPanelRef.current;
    // Rien à faire au montage tant que l'utilisateur n'a pas ouvert le panneau.
    if (!panel || (!devisOpen && !devisTouched.current)) return;
    devisTouched.current = true;

    if (devisOpen) {
      panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus({ preventScroll: true });
    } else {
      // Le repli doit à nouveau rogner le contenu, dès la première frame.
      setDevisExpanded(false);
    }

    const reduced = prefersReducedMotion();
    const settle = () => {
      if (devisOpen) {
        setDevisExpanded(true);
        panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      } else {
        setDevisFormKey((key) => key + 1);
      }
    };

    if (reduced) {
      settle();
      return;
    }
    const timer = window.setTimeout(settle, DEVIS_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [devisOpen]);

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-[#f6f2e8] to-[#ece3cd] dark:from-slate-900 dark:to-slate-800">
      <SeoMetadata pathname={pathname} />
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:py-8">
        <div
          className={`w-full ${mode === "home" || mode === "verification" ? "max-w-4xl" : "max-w-sm"}`}
        >
          {/* Logo / Titre */}
          <div className="mb-5 text-center sm:mb-6">
            <img
              src={LOGO_SRC}
              srcSet={LOGO_SRC_SET}
              alt="Horus Assurances"
              className="mx-auto h-auto w-44 max-w-full object-contain drop-shadow-lg sm:w-56"
            />
            {/* Le h1 de l'accueil est la promesse (cf. HomePanel) ; ici on ne titre
                que les vues de connexion / inscription. */}
            {mode !== "home" && <h1 className="sr-only">Horus Assurances</h1>}
          </div>

          {mode === "home" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
                <HeroPanel />
                <div className="mx-auto w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl shadow-black/5 sm:p-6 dark:border-slate-700 dark:bg-slate-800">
                  <HomePanel
                    registrationEnabled={config.registrationEnabled}
                    onGoToLogin={() => setMode("login")}
                    onGoToRegister={() => setMode("register")}
                    onGoToVerification={() => setMode("verification")}
                    devisOpen={devisOpen}
                    onToggleDevis={toggleDevis}
                  />
                </div>
              </div>
              <div
                id="devis-rapide-panel"
                ref={devisPanelRef}
                className={`grid scroll-mt-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
                  devisOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
                aria-hidden={!devisOpen}
                inert={!devisOpen}
              >
                <div
                  className={`min-h-0 ${devisExpanded ? "overflow-visible" : "overflow-hidden"}`}
                >
                  <DevisRapideForm key={devisFormKey} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xl sm:p-6 dark:border-slate-700 dark:bg-slate-800">
              {mode === "verification" ? (
                <VerificationPage onBack={() => setMode("home")} />
              ) : mode === "login" ? (
                <LoginForm
                  onBack={() => setMode("home")}
                  onSwitchToRegister={() => setMode("register")}
                />
              ) : (
                <RegisterForm
                  onBack={() => setMode("home")}
                  onSwitchToLogin={() => setMode("login")}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <AppFooter variant="public" />
    </div>
  );
}

/**
 * Colonne éditoriale : promesse, ce que fait l'outil, et à qui l'on parle.
 * Sur desktop elle occupe l'espace laissé vide par la carte d'actions.
 */
function HeroPanel() {
  return (
    <div className="space-y-5 text-center lg:pt-2 lg:text-left">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:font-semibold dark:text-slate-100">
          Gestion assurance auto
        </h1>
        {/* Sur mobile ce bloc est le seul contenu au-dessus des CTA : centré et
            appuyé. Sur desktop il redevient une colonne éditoriale alignée à gauche. */}
        <p className="text-sm leading-6 font-semibold text-gray-700 sm:text-base lg:font-normal lg:text-gray-600 dark:text-slate-300">
          {PUBLIC_SHARE_TEXT}
        </p>
      </div>

      {/* w-fit + mx-auto : le bloc est centré, mais les puces restent alignées
          entre elles (les centrer ligne par ligne produit un escalier). */}
      <ul className="mx-auto w-fit max-w-sm space-y-2 text-left lg:mx-0 lg:max-w-none">
        {FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-sm font-semibold text-gray-700 lg:font-normal dark:text-slate-300"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-[#614e1a] dark:text-amber-300"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-3 border-t border-black/5 pt-4 text-sm sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start dark:border-white/10">
        <a
          href={`tel:${CONTACT_PHONE_TEL}`}
          className="inline-flex items-center gap-2 font-medium text-[#614e1a] underline-offset-4 hover:underline dark:text-amber-200"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {CONTACT_PHONE_DISPLAY}
        </a>
        <a
          href={CONTACT_WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-medium text-green-700 underline-offset-4 hover:underline dark:text-green-400"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
        </a>
        <span className="inline-flex items-center gap-2 text-gray-500 dark:text-slate-400">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {CONTACT_LOCATION}
        </span>
      </div>
    </div>
  );
}

function HomePanel({
  registrationEnabled,
  onGoToLogin,
  onGoToRegister,
  onGoToVerification,
  devisOpen,
  onToggleDevis,
}: {
  registrationEnabled: boolean;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onGoToVerification: () => void;
  devisOpen: boolean;
  onToggleDevis: () => void;
}) {
  const { showToast } = useToast();

  const handleShare = useCallback(async () => {
    const url = buildAbsoluteUrl("/", getClientPublicSiteUrl());
    const shareData = {
      title: SEO_CONFIG.appName,
      text: PUBLIC_SHARE_TEXT,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      showToast({
        title: "Lien copié",
        message: "Le lien public Horus Assurances Manager est dans le presse-papiers.",
        variant: "success",
      });
    } catch {
      showToast({
        title: "Lien public",
        message: url,
        variant: "info",
        durationMs: 7000,
      });
    }
  }, [showToast]);

  return (
    <div className="flex h-full flex-col justify-center space-y-4 text-center">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
        Accès à votre espace
      </h2>
      {/* Un seul CTA primaire : l'inscription courtier. Quand elle est fermée,
          la connexion prend sa place plutôt que d'exposer un bouton désactivé. */}
      <div className="space-y-3">
        {registrationEnabled ? (
          <>
            <button type="button" onClick={onGoToRegister} className={primaryButtonClass}>
              Créer un compte
            </button>
            <button type="button" onClick={onGoToLogin} className={secondaryButtonClass}>
              Connectez-vous
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onGoToLogin} className={primaryButtonClass}>
              Connectez-vous
            </button>
            <p className="text-xs text-gray-500 dark:text-slate-500">
              La création de compte est actuellement désactivée.
            </p>
          </>
        )}
      </div>

      {/* Actions publiques : vérification, demande de devis et partage. */}
      <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-slate-700">
        <button
          type="button"
          onClick={onGoToVerification}
          className="mx-auto flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-[#614e1a]/5 hover:text-[#614e1a] dark:text-slate-400 dark:hover:bg-amber-300/10 dark:hover:text-amber-200"
        >
          <SearchCheck className="h-4 w-4" aria-hidden="true" />
          Vérifier la validité de votre contrat
        </button>
        <button
          type="button"
          onClick={onToggleDevis}
          aria-expanded={devisOpen}
          aria-controls="devis-rapide-panel"
          className="mx-auto flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-[#614e1a]/5 hover:text-[#614e1a] dark:text-slate-400 dark:hover:bg-amber-300/10 dark:hover:text-amber-200"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Demander un devis
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 motion-reduce:transition-none ${devisOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Partager le lien du site"
          title="Partager le lien du site"
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
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
    form.telephone1.trim().length > 0 &&
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
        telephone1: form.telephone1.trim(),
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
              required
              maxLength={50}
              className={inputClass}
              placeholder="771234567"
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
