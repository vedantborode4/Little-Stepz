/**
 * Banner `linkUrl` is a free-text field: admins enter either a relative web path
 * (`/products/some-shoe`, the web admin form's placeholder convention) or a full
 * `https://littlestepz.in/...` URL. Neither works on mobile as-is — an absolute URL
 * kicks the user out to the browser, and web's URL shapes don't match the app's
 * routes (`/products/x` vs the app's `/product/x`).
 *
 * This maps any of those onto an in-app route, and only genuinely third-party hosts
 * fall through to the browser.
 */

const INTERNAL_HOSTS = ["littlestepz.in", "www.littlestepz.in"];

const LEGAL_SLUGS = [
  "about",
  "authenticity",
  "cancellation",
  "faq",
  "privacy",
  "returns",
  "shipping",
  "terms",
  "warranty",
];

export type BannerTarget =
  | { kind: "internal"; href: string }
  | { kind: "external"; url: string }
  | null;

/** Strips the origin from an internal absolute URL; returns null if the host is foreign. */
function toInternalPath(url: string): string | null {
  if (url.startsWith("/")) return url;
  if (!/^https?:\/\//i.test(url)) return null;

  // RN's URL is limited, so parse the host manually rather than relying on `new URL`.
  const match = url.match(/^https?:\/\/([^/?#]+)([^?#]*)(.*)$/i);
  if (!match) return null;

  const [, host, path, rest] = match;
  if (!INTERNAL_HOSTS.includes(host.toLowerCase())) return null;
  return (path || "/") + (rest || "");
}

/** Rewrites a web path onto the equivalent expo-router route. */
function mapWebPathToRoute(path: string): string {
  const [rawPath, query = ""] = path.split("?");
  const suffix = query ? `?${query}` : "";
  const segments = rawPath.split("/").filter(Boolean);

  const route = ((): string => {
    if (segments.length === 0) return "/(tabs)/home";

    const [first, second, third] = segments;

    if (first === "products") {
      if (!second) return "/(tabs)/search";
      // Web nests categories under /products/category/<slug>; the app doesn't.
      if (second === "category") return third ? `/category/${third}` : "/(tabs)/search";
      return `/product/${second}`;
    }

    // Already-correct app shapes, plus web's singular/plural variants.
    if (first === "product" && second) return `/product/${second}`;
    if (first === "category" && second) return `/category/${second}`;
    if (first === "pre-order" && second) return `/pre-order/${second}`;
    if (first === "pre-orders" || first === "preorders") return "/(tabs)/preorders";

    if (first === "cart") return "/(tabs)/cart";
    if (first === "wishlist") return "/(tabs)/wishlist";
    if (first === "account" || first === "profile") return "/(tabs)/account";
    if (first === "search") return "/(tabs)/search";
    if (first === "orders") return second ? `/orders/${second}` : "/orders";
    if (first === "support") return "/support";
    if (first === "notifications") return "/notifications";
    if (first === "ref" && second) return `/ref/${second}`;

    if (first === "legal" && second) return `/legal/${second}`;
    if (LEGAL_SLUGS.includes(first)) return `/legal/${first}`;

    // Unrecognised internal path — the home tab is a safer landing than a dead tap.
    return "/(tabs)/home";
  })();

  return route + suffix;
}

/**
 * Resolves a banner's `linkUrl` into something actionable.
 * Returns null when there is no link at all.
 */
export function resolveBannerTarget(linkUrl?: string | null): BannerTarget {
  const url = linkUrl?.trim();
  if (!url) return null;

  const internalPath = toInternalPath(url);
  if (internalPath === null) {
    return /^https?:\/\//i.test(url) ? { kind: "external", url } : null;
  }

  return { kind: "internal", href: mapWebPathToRoute(internalPath) };
}
