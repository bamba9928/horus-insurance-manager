/**
 * Service des fichiers statiques du frontend web + repli SPA (index.html).
 * Monté en dernier : les routes /api/* sont déjà gérées avant.
 *
 * @module routes/static
 */

import fs from "node:fs";
import path from "node:path";
import type { Context, Hono } from "hono";
import type { AuthEnv } from "../auth/middleware.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

interface StaticOptions {
  publicSiteUrl?: string | undefined;
}

interface SeoRoute {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
  keywords: string[];
}

const SEO_BLOCK_PATTERN = /<!-- horus:seo:start -->[\s\S]*?<!-- horus:seo:end -->/;
const INDEX_ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow, noarchive";
const SOCIAL_IMAGE_PATH = "/social-card.svg";
const LOGO_PATH = "/horus-manager-logo@2x.png";
const APP_NAME = "Horus Assurances Manager";
const BRAND_NAME = "Horus Assurances";
const SUPPORT_EMAIL = "contact@horus-assur.digital";
const DEFAULT_DESCRIPTION =
  "Plateforme web et desktop pour gérer devis, clients, véhicules, polices, paiements et échéances d'assurance auto.";
const COMMON_KEYWORDS = [
  "assurance auto",
  "gestion assurance",
  "courtier assurance",
  "police assurance",
  "devis assurance auto",
  "échéances assurance",
  "paiements assurance",
  "Sénégal",
];
const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/profil",
  "/clients",
  "/vehicules",
  "/polices",
  "/paiements",
  "/echeances",
  "/parametres",
  "/verification",
  "/tarification",
];

const ROUTE_SEO: Record<string, SeoRoute> = {
  "/": {
    title: `${APP_NAME} | Gestion assurance auto`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: "/",
    robots: INDEX_ROBOTS,
    keywords: COMMON_KEYWORDS,
  },
  "/verification": {
    title: `Vérification d'assurance | ${APP_NAME}`,
    description: "Contrôle interne des attestations, polices et dossiers d'assurance auto.",
    canonicalPath: "/verification",
    robots: NOINDEX_ROBOTS,
    keywords: ["vérification assurance", "contrôle police assurance", ...COMMON_KEYWORDS],
  },
  "/clients": {
    title: `Gestion clients | ${APP_NAME}`,
    description: "Espace authentifié de suivi des clients et contacts d'assurance auto.",
    canonicalPath: "/clients",
    robots: NOINDEX_ROBOTS,
    keywords: ["gestion clients assurance", "crm assurance auto", ...COMMON_KEYWORDS],
  },
  "/vehicules": {
    title: `Gestion véhicules | ${APP_NAME}`,
    description: "Espace authentifié de suivi des véhicules assurés et de leurs informations.",
    canonicalPath: "/vehicules",
    robots: NOINDEX_ROBOTS,
    keywords: ["véhicules assurés", "flotte auto", ...COMMON_KEYWORDS],
  },
  "/polices": {
    title: `Gestion polices | ${APP_NAME}`,
    description: "Espace authentifié de suivi des polices, renouvellements et statuts.",
    canonicalPath: "/polices",
    robots: NOINDEX_ROBOTS,
    keywords: ["polices assurance", "renouvellement assurance", ...COMMON_KEYWORDS],
  },
  "/paiements": {
    title: `Suivi paiements | ${APP_NAME}`,
    description: "Espace authentifié de suivi des encaissements, restes à payer et impayés.",
    canonicalPath: "/paiements",
    robots: NOINDEX_ROBOTS,
    keywords: ["paiements assurance", "impayés assurance", ...COMMON_KEYWORDS],
  },
  "/echeances": {
    title: `Échéances assurance | ${APP_NAME}`,
    description: "Espace authentifié de pilotage des échéances et renouvellements à venir.",
    canonicalPath: "/echeances",
    robots: NOINDEX_ROBOTS,
    keywords: ["échéances assurance", "renouvellements assurance auto", ...COMMON_KEYWORDS],
  },
  "/parametres": {
    title: `Paramètres | ${APP_NAME}`,
    description: "Paramètres privés de configuration du gestionnaire d'assurance auto.",
    canonicalPath: "/parametres",
    robots: NOINDEX_ROBOTS,
    keywords: ["configuration assurance", ...COMMON_KEYWORDS],
  },
  "/profil": {
    title: `Profil utilisateur | ${APP_NAME}`,
    description: "Profil privé de l'utilisateur Horus Assurances Manager.",
    canonicalPath: "/profil",
    robots: NOINDEX_ROBOTS,
    keywords: ["profil utilisateur assurance", ...COMMON_KEYWORDS],
  },
  "/tarification": {
    title: `Tarification assurance auto | ${APP_NAME}`,
    description: "Calculateur authentifié pour préparer des tarifs et devis d'assurance auto.",
    canonicalPath: "/tarification",
    robots: NOINDEX_ROBOTS,
    keywords: ["tarification assurance auto", "calcul devis auto", ...COMMON_KEYWORDS],
  },
  "/admin": {
    title: `Administration | ${APP_NAME}`,
    description: "Console privée d'administration des comptes Horus Assurances Manager.",
    canonicalPath: "/admin",
    robots: NOINDEX_ROBOTS,
    keywords: ["administration assurance", ...COMMON_KEYWORDS],
  },
};

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

/** Détecte un nom de fichier versionné (hash Vite) → cache long immuable. */
function isHashed(fileName: string): boolean {
  return /\.[0-9a-zA-Z_-]{8,}\.(js|css|woff2?|ttf|png|jpe?g|svg|webp)$/.test(fileName);
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.split(/[?#]/)[0] || "/";
  if (normalized.length > 1) return normalized.replace(/\/+$/, "");
  return "/";
}

function getRouteSeo(pathname: string): SeoRoute {
  const normalized = normalizePathname(pathname);
  return (
    ROUTE_SEO[normalized] ?? {
      title: `Espace privé | ${APP_NAME}`,
      description: "Espace authentifié Horus Assurances Manager.",
      canonicalPath: normalized,
      robots: NOINDEX_ROBOTS,
      keywords: COMMON_KEYWORDS,
    }
  );
}

function normalizePublicSiteUrl(value: string | undefined): string | undefined {
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

function firstForwardedValue(value: string | undefined): string | undefined {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .find(Boolean);
}

function resolvePublicSiteUrl(c: Context<AuthEnv>, configuredUrl: string | undefined): string {
  const configured = normalizePublicSiteUrl(configuredUrl);
  if (configured) return configured;

  const requestUrl = new URL(c.req.url);
  const forwardedHost = firstForwardedValue(c.req.header("x-forwarded-host"));
  const host = forwardedHost ?? c.req.header("host") ?? requestUrl.host;
  const forwardedProto = firstForwardedValue(c.req.header("x-forwarded-proto"));
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : requestUrl.protocol.replace(":", "");

  return normalizePublicSiteUrl(`${proto}://${host}`) ?? requestUrl.origin;
}

function absoluteUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, `${baseUrl}/`).toString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsonForHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function buildStructuredData(route: SeoRoute, canonicalUrl: string, baseUrl: string) {
  const siteUrl = absoluteUrl(baseUrl, "/");
  const imageUrl = absoluteUrl(baseUrl, SOCIAL_IMAGE_PATH);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: BRAND_NAME,
        url: siteUrl,
        logo: absoluteUrl(baseUrl, LOGO_PATH),
        image: imageUrl,
        email: SUPPORT_EMAIL,
        areaServed: { "@type": "Country", name: "Sénégal" },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: APP_NAME,
        url: siteUrl,
        inLanguage: "fr-SN",
        publisher: { "@id": `${siteUrl}#organization` },
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${siteUrl}#software`,
        name: APP_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Windows, macOS, Linux",
        inLanguage: "fr-SN",
        url: siteUrl,
        image: imageUrl,
        description: DEFAULT_DESCRIPTION,
        offers: { "@type": "Offer", category: "Insurance management software" },
        featureList: [
          "Devis assurance auto",
          "Gestion clients et véhicules",
          "Suivi des polices",
          "Paiements et impayés",
          "Alertes d'échéances",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}#faq`,
        inLanguage: "fr-SN",
        mainEntity: [
          {
            "@type": "Question",
            name: "À quoi sert Horus Assurances Manager ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Horus Assurances Manager aide les courtiers et équipes d'assurance auto à gérer les devis, clients, véhicules, polices, paiements et échéances.",
            },
          },
          {
            "@type": "Question",
            name: "Les données clients sont-elles publiques ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Non. Les espaces clients, véhicules, polices, paiements et administration sont authentifiés et déclarés en noindex pour les moteurs.",
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
        inLanguage: "fr-SN",
        isPartOf: { "@id": `${siteUrl}#website` },
      },
    ],
  };
}

function buildSeoHead(pathname: string, baseUrl: string): string {
  const route = getRouteSeo(pathname);
  const canonicalUrl = absoluteUrl(baseUrl, route.canonicalPath);
  const imageUrl = absoluteUrl(baseUrl, SOCIAL_IMAGE_PATH);
  const escapedTitle = escapeHtml(route.title);
  const escapedDescription = escapeHtml(route.description);
  const escapedKeywords = escapeHtml(route.keywords.join(", "));

  return `<!-- horus:seo:start -->
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <meta name="keywords" content="${escapedKeywords}" />
    <meta name="robots" content="${escapeHtml(route.robots)}" />
    <meta name="googlebot" content="${escapeHtml(route.robots)}" />
    <meta name="bingbot" content="${escapeHtml(route.robots)}" />
    <meta name="application-name" content="${APP_NAME}" />
    <meta name="apple-mobile-web-app-title" content="${APP_NAME}" />
    <meta name="author" content="${BRAND_NAME}" />
    <meta name="publisher" content="${BRAND_NAME}" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="geo.region" content="SN-DK" />
    <meta name="geo.placename" content="Dakar, Senegal" />
    <meta name="geo.position" content="14.7167;-17.4677" />
    <meta name="ICBM" content="14.7167;-17.4677" />
    <meta name="DC.title" content="${escapedTitle}" />
    <meta name="DC.description" content="${escapedDescription}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="alternate" hreflang="fr-SN" href="${escapeHtml(canonicalUrl)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="fr_SN" />
    <meta property="og:site_name" content="${APP_NAME}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Horus Assurances Manager - gestion assurance auto" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:image:alt" content="Horus Assurances Manager" />
    <script id="horus-structured-data" type="application/ld+json">${escapeJsonForHtml(
      buildStructuredData(route, canonicalUrl, baseUrl),
    )}</script>
    <!-- horus:seo:end -->`;
}

function injectSeoHead(html: string, pathname: string, baseUrl: string): string {
  const seoHead = buildSeoHead(pathname, baseUrl);
  if (SEO_BLOCK_PATTERN.test(html)) return html.replace(SEO_BLOCK_PATTERN, seoHead);
  return html.replace("</head>", `${seoHead}\n  </head>`);
}

function buildRobotsTxt(baseUrl: string): string {
  return [
    "# Horus Assurances Manager",
    "User-agent: *",
    "Allow: /",
    ...PRIVATE_PATHS.map((item) => `Disallow: ${item}`),
    `Sitemap: ${absoluteUrl(baseUrl, "/sitemap.xml")}`,
    "",
  ].join("\n");
}

function buildSitemapXml(baseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeHtml(absoluteUrl(baseUrl, "/"))}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function buildLlmsTxt(baseUrl: string): string {
  return [
    "# Horus Assurances Manager",
    "",
    `Canonical URL: ${absoluteUrl(baseUrl, "/")}`,
    `Contact: ${SUPPORT_EMAIL}`,
    "",
    "## Summary",
    "Horus Assurances Manager is a French-language web and desktop application for auto insurance operations: quick quotes, clients, vehicles, policies, payments, unpaid balances and renewal deadlines.",
    "",
    "## Direct answers",
    "- Audience: insurance brokers, agencies and operational teams managing auto insurance portfolios.",
    "- Public page: quick auto insurance quote request and account access.",
    "- Private data: clients, vehicles, policies, payments, profile and administration require authentication and should not be indexed.",
    "- Region context: Dakar, Senegal; FCFA-oriented insurance workflows.",
    "",
    "## Crawl boundaries",
    ...PRIVATE_PATHS.map((item) => `- Do not index ${item}`),
    "",
  ].join("\n");
}

export function mountStatic(app: Hono<AuthEnv>, dir: string, options: StaticOptions = {}): void {
  const root = path.resolve(dir);
  const indexHtml = path.join(root, "index.html");

  app.get("/*", (c) => {
    if (c.req.path.startsWith("/api/")) return c.notFound();

    const publicSiteUrl = resolvePublicSiteUrl(c, options.publicSiteUrl);
    if (c.req.path === "/robots.txt") {
      return c.text(buildRobotsTxt(publicSiteUrl), 200, {
        ...SECURITY_HEADERS,
        "cache-control": "public, max-age=3600",
      });
    }
    if (c.req.path === "/sitemap.xml") {
      return new Response(buildSitemapXml(publicSiteUrl), {
        headers: {
          ...SECURITY_HEADERS,
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }
    if (c.req.path === "/llms.txt" || c.req.path === "/.well-known/llms.txt") {
      return c.text(buildLlmsTxt(publicSiteUrl), 200, {
        ...SECURITY_HEADERS,
        "cache-control": "public, max-age=3600",
      });
    }

    const rel = decodeURIComponent(c.req.path.replace(/^\/+/, ""));
    const candidate = path.resolve(root, rel);

    // Anti-traversée : le chemin résolu doit rester sous la racine.
    const withinRoot = candidate === root || candidate.startsWith(root + path.sep);

    let filePath = candidate;
    if (!withinRoot || rel === "" || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = indexHtml; // repli SPA
    }
    if (!fs.existsSync(filePath)) return c.notFound();

    const ext = path.extname(filePath).toLowerCase();
    const body = fs.readFileSync(filePath);
    const responseBody =
      ext === ".html"
        ? injectSeoHead(body.toString("utf8"), c.req.path, publicSiteUrl)
        : new Uint8Array(body);
    const cacheControl =
      ext === ".html"
        ? "no-cache"
        : isHashed(path.basename(filePath))
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600";

    return new Response(responseBody, {
      headers: {
        ...SECURITY_HEADERS,
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": cacheControl,
      },
    });
  });
}
