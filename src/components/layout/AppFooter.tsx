import { ExternalLink, Mail, ShieldCheck } from "lucide-react";

const SUPPORT_EMAIL = "contact@horus-assur.digital";
const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61592098011927";
const HORUS_SERVICES_URL = "https://horuservices.cloud/";

interface AppFooterProps {
  variant?: "app" | "public";
}

const linkClass =
  "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:w-auto";

export function AppFooter({ variant = "app" }: AppFooterProps) {
  const year = new Date().getFullYear();
  const isPublic = variant === "public";

  if (!isPublic) {
    return (
      <footer className="shrink-0 border-t border-gray-200 bg-white px-3 py-3 sm:px-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-gray-500 sm:flex-row sm:gap-2 dark:text-slate-400">
          <div className="flex items-center justify-center gap-2 text-center sm:justify-start sm:text-left">
            <ShieldCheck
              className="h-4 w-4 text-[#614e1a] dark:text-amber-300"
              aria-hidden="true"
            />
            <span>© {year} Horus Assurances Manager</span>
          </div>

          <div className="grid w-full grid-cols-2 items-center gap-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
            <FooterIconLink
              href={`mailto:${SUPPORT_EMAIL}`}
              label="Contacter Horus Assurances"
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
            />
            <FooterIconLink
              href={FACEBOOK_URL}
              label="Facebook"
              icon={<FacebookIcon className="h-4 w-4" />}
              external
            />
            <a
              href={HORUS_SERVICES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 inline-flex min-h-9 items-center justify-center gap-1 rounded-md px-2 py-1 text-center font-medium text-[#614e1a] transition-colors hover:bg-amber-50 hover:text-[#8b7335] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#614e1a] sm:min-h-8 dark:text-amber-300 dark:hover:bg-amber-300/10"
            >
              Propulsé par Horus Services
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full shrink-0 px-3 pb-3 pt-10 sm:px-6 sm:pb-6 sm:pt-16">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-slate-300 shadow-xl shadow-slate-950/10 sm:rounded-2xl">
        <div className="grid gap-6 px-4 py-6 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300 ring-1 ring-amber-300/20">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold tracking-wide text-white">Horus Assurances Manager</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                La gestion de votre activité d'assurance automobile, simple et sécurisée.
              </p>
            </div>
          </div>

          <nav
            aria-label="Liens du pied de page"
            className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center md:justify-end"
          >
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className={`${linkClass} bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white`}
            >
              <Mail className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Nous contacter
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200`}
            >
              <FacebookIcon className="h-4 w-4" />
              Facebook
              <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </a>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-white/10 bg-slate-950/40 px-4 py-4 text-center text-xs leading-5 text-slate-500 sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <span>© {year} Horus Assurances Manager. Tous droits réservés.</span>
          <a
            href={HORUS_SERVICES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded text-slate-400 transition-colors hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:justify-end"
          >
            Propulsé par <strong className="font-semibold">Horus Services</strong>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterIconLink({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md px-2 text-center font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#614e1a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#614e1a] sm:min-h-8 sm:w-auto dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-amber-300"
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
      {external && <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />}
    </a>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-8h2.75l.41-3H13.5V8.08c0-.87.24-1.46 1.58-1.46h1.69V3.94a22.7 22.7 0 0 0-2.46-.13c-2.43 0-4.1 1.48-4.1 4.21V10H7.46v3h2.75v8h3.29Z" />
    </svg>
  );
}
