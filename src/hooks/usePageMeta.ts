import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  /** Absolute canonical URL (origin + path). */
  canonical?: string;
  noindex?: boolean;
}

const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

/** Sets per-page title, description, canonical, Open Graph and robots tags. */
export function usePageMeta({ title, description, canonical, noindex }: PageMeta) {
  useEffect(() => {
    document.title = title;
    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);

    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
      upsertMeta("name", "twitter:description", description);
    }

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
      upsertMeta("property", "og:url", canonical);
    } else {
      link?.remove();
    }

    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
  }, [title, description, canonical, noindex]);
}
