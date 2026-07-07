export const SEO_CONFIG = {
  appName: "Horus Assurances Manager",
  brandName: "Horus Assurances",
  locale: "fr-SN",
  language: "fr",
  region: "SN-DK",
  placeName: "Dakar, Senegal",
  geoPosition: "14.7167;-17.4677",
  supportEmail: "contact@horus-assur.digital",
  socialImagePath: "/social-card.svg",
  logoPath: "/horus-manager-logo@2x.png",
  themeColor: "#614e1a",
} as const;

const INDEX_ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow, noarchive";

export interface SeoRouteDefinition {
  path: string;
  canonicalPath: string;
  title: string;
  description: string;
  robots: string;
  keywords: readonly string[];
}

const COMMON_KEYWORDS = [
  "assurance auto",
  "gestion assurance",
  "courtier assurance",
  "police assurance",
  "devis assurance auto",
  "echeances assurance",
  "paiements assurance",
  "Sénégal",
] as const;

const PUBLIC_HOME: SeoRouteDefinition = {
  path: "/",
  canonicalPath: "/",
  title: "Horus Assurances Manager | Gestion assurance auto",
  description:
    "Plateforme web et desktop pour gerer devis, clients, vehicules, polices, paiements et echeances d'assurance auto.",
  robots: INDEX_ROBOTS,
  keywords: COMMON_KEYWORDS,
};

const ROUTE_SEO: Record<string, SeoRouteDefinition> = {
  "/": PUBLIC_HOME,
  "/verification": {
    path: "/verification",
    canonicalPath: "/verification",
    title: "Verification d'assurance | Horus Assurances Manager",
    description: "Controle interne des attestations, polices et dossiers d'assurance auto.",
    robots: NOINDEX_ROBOTS,
    keywords: ["verification assurance", "controle police assurance", ...COMMON_KEYWORDS],
  },
  "/clients": {
    path: "/clients",
    canonicalPath: "/clients",
    title: "Gestion clients | Horus Assurances Manager",
    description: "Espace authentifie de suivi des clients et contacts d'assurance auto.",
    robots: NOINDEX_ROBOTS,
    keywords: ["gestion clients assurance", "crm assurance auto", ...COMMON_KEYWORDS],
  },
  "/vehicules": {
    path: "/vehicules",
    canonicalPath: "/vehicules",
    title: "Gestion vehicules | Horus Assurances Manager",
    description: "Espace authentifie de suivi des vehicules assures et de leurs informations.",
    robots: NOINDEX_ROBOTS,
    keywords: ["vehicules assures", "flotte auto", ...COMMON_KEYWORDS],
  },
  "/polices": {
    path: "/polices",
    canonicalPath: "/polices",
    title: "Gestion polices | Horus Assurances Manager",
    description: "Espace authentifie de suivi des polices, renouvellements et statuts.",
    robots: NOINDEX_ROBOTS,
    keywords: ["polices assurance", "renouvellement assurance", ...COMMON_KEYWORDS],
  },
  "/paiements": {
    path: "/paiements",
    canonicalPath: "/paiements",
    title: "Suivi paiements | Horus Assurances Manager",
    description: "Espace authentifie de suivi des encaissements, restes a payer et impayes.",
    robots: NOINDEX_ROBOTS,
    keywords: ["paiements assurance", "impayes assurance", ...COMMON_KEYWORDS],
  },
  "/echeances": {
    path: "/echeances",
    canonicalPath: "/echeances",
    title: "Echeances assurance | Horus Assurances Manager",
    description: "Espace authentifie de pilotage des echeances et renouvellements a venir.",
    robots: NOINDEX_ROBOTS,
    keywords: ["echeances assurance", "renouvellements assurance auto", ...COMMON_KEYWORDS],
  },
  "/parametres": {
    path: "/parametres",
    canonicalPath: "/parametres",
    title: "Parametres | Horus Assurances Manager",
    description: "Parametres prives de configuration du gestionnaire d'assurance auto.",
    robots: NOINDEX_ROBOTS,
    keywords: ["configuration assurance", ...COMMON_KEYWORDS],
  },
  "/profil": {
    path: "/profil",
    canonicalPath: "/profil",
    title: "Profil utilisateur | Horus Assurances Manager",
    description: "Profil prive de l'utilisateur Horus Assurances Manager.",
    robots: NOINDEX_ROBOTS,
    keywords: ["profil utilisateur assurance", ...COMMON_KEYWORDS],
  },
  "/tarification": {
    path: "/tarification",
    canonicalPath: "/tarification",
    title: "Tarification assurance auto | Horus Assurances Manager",
    description: "Calculateur authentifie pour preparer des tarifs et devis d'assurance auto.",
    robots: NOINDEX_ROBOTS,
    keywords: ["tarification assurance auto", "calcul devis auto", ...COMMON_KEYWORDS],
  },
  "/admin": {
    path: "/admin",
    canonicalPath: "/admin",
    title: "Administration | Horus Assurances Manager",
    description: "Console privee d'administration des comptes Horus Assurances Manager.",
    robots: NOINDEX_ROBOTS,
    keywords: ["administration assurance", ...COMMON_KEYWORDS],
  },
};

export function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (path.length > 1) return path.replace(/\/+$/, "");
  return "/";
}

export function getSeoForPathname(pathname: string): SeoRouteDefinition {
  const normalized = normalizePathname(pathname);
  return (
    ROUTE_SEO[normalized] ?? {
      path: normalized,
      canonicalPath: normalized,
      title: `Espace prive | ${SEO_CONFIG.appName}`,
      description: "Espace authentifie Horus Assurances Manager.",
      robots: NOINDEX_ROBOTS,
      keywords: COMMON_KEYWORDS,
    }
  );
}

export function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function getClientPublicSiteUrl(): string {
  const envUrl = normalizeBaseUrl(import.meta.env.VITE_PUBLIC_SITE_URL);
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "https://horus-assur.digital";
}

export function buildAbsoluteUrl(path: string, baseUrl = getClientPublicSiteUrl()): string {
  return new URL(path, `${baseUrl}/`).toString();
}

export interface StructuredData {
  "@context": "https://schema.org";
  "@graph": Array<Record<string, unknown>>;
}

export function buildStructuredData(
  route: SeoRouteDefinition,
  canonicalUrl: string,
  baseUrl = getClientPublicSiteUrl(),
): StructuredData {
  const siteUrl = buildAbsoluteUrl("/", baseUrl);
  const logoUrl = buildAbsoluteUrl(SEO_CONFIG.logoPath, baseUrl);
  const imageUrl = buildAbsoluteUrl(SEO_CONFIG.socialImagePath, baseUrl);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: SEO_CONFIG.brandName,
        url: siteUrl,
        logo: logoUrl,
        image: imageUrl,
        email: SEO_CONFIG.supportEmail,
        areaServed: {
          "@type": "Country",
          name: "Senegal",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: SEO_CONFIG.appName,
        url: siteUrl,
        inLanguage: SEO_CONFIG.locale,
        publisher: {
          "@id": `${siteUrl}#organization`,
        },
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${siteUrl}#software`,
        name: SEO_CONFIG.appName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Windows, macOS, Linux",
        inLanguage: SEO_CONFIG.locale,
        url: siteUrl,
        image: imageUrl,
        description: PUBLIC_HOME.description,
        offers: {
          "@type": "Offer",
          category: "Insurance management software",
        },
        featureList: [
          "Devis assurance auto",
          "Gestion clients et vehicules",
          "Suivi des polices",
          "Paiements et impayes",
          "Alertes d'echeances",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}#faq`,
        inLanguage: SEO_CONFIG.locale,
        mainEntity: [
          {
            "@type": "Question",
            name: "A quoi sert Horus Assurances Manager ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Horus Assurances Manager aide les courtiers et equipes d'assurance auto a gerer les devis, clients, vehicules, polices, paiements et echeances.",
            },
          },
          {
            "@type": "Question",
            name: "Les donnees clients sont-elles publiques ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Non. Les espaces clients, vehicules, polices, paiements et administration sont authentifies et declares en noindex pour les moteurs.",
            },
          },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: route.title,
        description: route.description,
        inLanguage: SEO_CONFIG.locale,
        isPartOf: {
          "@id": `${siteUrl}#website`,
        },
      },
    ],
  };
}
