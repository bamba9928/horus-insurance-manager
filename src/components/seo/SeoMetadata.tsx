import { useEffect } from "react";
import {
  buildAbsoluteUrl,
  buildStructuredData,
  getClientPublicSiteUrl,
  getSeoForPathname,
  SEO_CONFIG,
} from "../../lib/seo";

interface SeoMetadataProps {
  pathname: string;
}

function upsertMeta(attribute: "name" | "property", key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
}

function upsertLink(selector: string, attributes: Record<string, string>): void {
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function upsertJsonLd(id: string, data: unknown): void {
  let element = document.head.querySelector<HTMLScriptElement>(`script#${id}`);

  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}

export function SeoMetadata({ pathname }: SeoMetadataProps) {
  useEffect(() => {
    const route = getSeoForPathname(pathname);
    const publicSiteUrl = getClientPublicSiteUrl();
    const canonicalUrl = buildAbsoluteUrl(route.canonicalPath, publicSiteUrl);
    const socialImageUrl = buildAbsoluteUrl(SEO_CONFIG.socialImagePath, publicSiteUrl);

    document.documentElement.lang = SEO_CONFIG.locale;
    document.title = route.title;

    upsertMeta("name", "description", route.description);
    upsertMeta("name", "keywords", route.keywords.join(", "));
    upsertMeta("name", "robots", route.robots);
    upsertMeta("name", "googlebot", route.robots);
    upsertMeta("name", "bingbot", route.robots);
    upsertMeta("name", "application-name", SEO_CONFIG.appName);
    upsertMeta("name", "apple-mobile-web-app-title", SEO_CONFIG.appName);
    upsertMeta("name", "author", SEO_CONFIG.brandName);
    upsertMeta("name", "publisher", SEO_CONFIG.brandName);
    upsertMeta("name", "theme-color", SEO_CONFIG.themeColor);
    upsertMeta("name", "format-detection", "telephone=no");
    upsertMeta("name", "geo.region", SEO_CONFIG.region);
    upsertMeta("name", "geo.placename", SEO_CONFIG.placeName);
    upsertMeta("name", "geo.position", SEO_CONFIG.geoPosition);
    upsertMeta("name", "ICBM", SEO_CONFIG.geoPosition);
    upsertMeta("name", "DC.title", route.title);
    upsertMeta("name", "DC.description", route.description);

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", "fr_SN");
    upsertMeta("property", "og:site_name", SEO_CONFIG.appName);
    upsertMeta("property", "og:title", route.title);
    upsertMeta("property", "og:description", route.description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", socialImageUrl);
    upsertMeta("property", "og:image:type", "image/svg+xml");
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", "Horus Assurances Manager - gestion assurance auto");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", route.title);
    upsertMeta("name", "twitter:description", route.description);
    upsertMeta("name", "twitter:image", socialImageUrl);
    upsertMeta("name", "twitter:image:alt", "Horus Assurances Manager");

    upsertLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });
    upsertLink('link[rel="alternate"][hreflang="fr-SN"]', {
      rel: "alternate",
      hreflang: "fr-SN",
      href: canonicalUrl,
    });
    upsertLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: "alternate",
      hreflang: "x-default",
      href: canonicalUrl,
    });

    upsertJsonLd("horus-structured-data", buildStructuredData(route, canonicalUrl, publicSiteUrl));
  }, [pathname]);

  return null;
}
