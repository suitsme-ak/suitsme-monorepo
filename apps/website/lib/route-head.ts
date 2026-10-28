import routeMap from "../data/real-routes.json";

// Wave 4 stage 3b (NAV-01): per route head injection, Mechanic A.
//
// Until this stage every real URL served the shell with the home
// page's head, and only the client corrected the title after boot,
// so crawlers and link unfurlers saw the same title, description and
// canonical (the home page) for a wool suit collection, a product
// and the checkout alike. The route handlers now rewrite the head
// for the route they serve, before the document leaves the server:
//
// - title and meta description specific to the route;
// - a canonical link pointing at the canonical real URL;
// - robots: indexable for collections, products, the fabric and
//   studio listings and the content pages; noindex for the state
//   pages (customize, checkout, orders, order detail, payment
//   return), which are shopper state, not content;
// - the Open Graph and Twitter mirrors of the title, description
//   and URL follow the same values, because unfurlers read those.
//
// All values come from data, never from literals in the handlers:
// the generated route map (data/real-routes.json, built by
// scripts/build-real-routes.cjs) carries the collection, page and
// family heads, and product values are looked up in
// data/catalog.json by the product route. The client side
// document.title behaviour after boot is unchanged; this injection
// is what a crawler or unfurler sees before any script runs.
//
// The root route is deliberately not injected: the shell's own head
// is the home head, which is exactly what "/" should serve.

export const ORIGIN = "https://suits.me";

const INDEX_ROBOTS = "index,follow,max-image-preview:large";
const NOINDEX_ROBOTS = "noindex,nofollow";

export interface RouteHead {
  title: string;
  description: string;
  // Site relative canonical path, always starting with "/".
  canonicalPath: string;
  robots: "index" | "noindex";
}

interface HeadCopy {
  title: string;
  description: string;
}

interface PageHeadCopy extends HeadCopy {
  robots: "index" | "noindex";
}

const heads = routeMap.heads as unknown as {
  collections: Record<string, HeadCopy>;
  pages: Record<string, PageHeadCopy>;
  families: {
    fabrics: Record<string, HeadCopy>;
    studio: Record<string, HeadCopy>;
  };
};

export function headForCollection(path: string): RouteHead | null {
  const copy = heads.collections[path];
  if (!copy) return null;
  return { ...copy, canonicalPath: path, robots: "index" };
}

export function headForPage(path: string): RouteHead | null {
  const copy = heads.pages[path];
  if (!copy) return null;
  return {
    title: copy.title,
    description: copy.description,
    canonicalPath: path,
    robots: copy.robots,
  };
}

export function headForFamily(
  family: "fabrics" | "studio",
  kind: string,
): RouteHead | null {
  const copy = heads.families[family][kind];
  if (!copy) return null;
  return { ...copy, canonicalPath: `/${family}/${kind}`, robots: "index" };
}

const KIND_NOUNS: Record<string, string> = {
  suit: "suit",
  jacket: "jacket",
  waistcoat: "waistcoat",
  pants: "trousers",
  shirt: "shirt",
  accessory: "accessory set",
  swatch: "fabric swatch set",
  gift: "gift card",
};

export interface ProductHeadSource {
  name: string;
  fabric: string;
  category: string;
  kind: string;
}

export function headForProduct(
  entry: ProductHeadSource | undefined,
  id: number,
): RouteHead | null {
  if (!entry) return null;
  const noun = KIND_NOUNS[entry.kind] || "garment";
  return {
    title: `${entry.name} | Suits.me`,
    description: `${entry.name} at Suits.me: a ${entry.fabric} ${noun} from the ${entry.category} collection, custom tailored to your measurements. Choose your details and build your fit profile.`,
    canonicalPath: `/product/${id}`,
    robots: "index",
  };
}

export function headForOrderDetail(path: string): RouteHead {
  // Order detail is shopper state: it always carries noindex, and
  // its canonical is the URL itself, the only canonical form an
  // unenumerable id has.
  return {
    title: "Order details | Suits.me",
    description:
      "The details of your Suits.me order: items, customization, fit profiles, and status.",
    canonicalPath: path,
    robots: "noindex",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Rewrite the shell's head for one route. Each pattern is anchored
// on the attribute the shell actually carries, and the test suite
// asserts every pattern occurs exactly once in the shell, so a shell
// edit that breaks an anchor fails the suite instead of silently
// serving the home head for a route.
export function injectHead(html: string, head: RouteHead): string {
  const title = escapeHtml(head.title);
  const description = escapeHtml(head.description);
  const canonical = escapeHtml(ORIGIN + head.canonicalPath);
  const robots = head.robots === "noindex" ? NOINDEX_ROBOTS : INDEX_ROBOTS;
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${description}">`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*">/,
      `<link rel="canonical" href="${canonical}">`,
    )
    .replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${robots}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${description}">`,
    )
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(
      /<meta name="twitter:description" content="[^"]*">/,
      `<meta name="twitter:description" content="${description}">`,
    );
}

// The one serve path every shell route uses: inject the route's head
// (a null head serves the document as it stands, which is the root
// route's behaviour) and answer with the root route's headers.
export function shellResponse(html: string, head: RouteHead | null): Response {
  return new Response(head ? injectHead(html, head) : html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
