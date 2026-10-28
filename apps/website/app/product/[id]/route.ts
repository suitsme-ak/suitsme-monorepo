import html from "../../../web/index.html?raw";
import routeMap from "../../../data/real-routes.json";

// Wave 4 stage 3a (NAV-01), Mechanic A: product detail at a real URL.
// The id is the stable numeric catalog id the hash route #product/<id>
// has always used. The generated map in data/real-routes.json (built
// by scripts/build-real-routes.cjs from data/catalog.json) carries the
// valid id ranges, so validation is against the catalog data the repo
// ships, never against a hand maintained list:
//
// - A canonical path for an existing id (/product/1964) serves the
//   same storefront document as the root route in app/route.ts, with
//   the same headers. The document boots from its pathname when no
//   hash is present (public/real-routes.js).
// - A non-canonical spelling of an existing id (leading zeros, a
//   trailing slash the framework let through) answers with a
//   permanent redirect to the canonical path.
// - A non-numeric id, or a numeric id the catalog does not hold, is a
//   genuine 404. Unknown products are never served the shell, so bad
//   links fail loudly instead of rendering an empty product page.
const ranges: [number, number][] = routeMap.families.product.idRanges as [number, number][];

function redirect(to: string) {
  return new Response(null, { status: 308, headers: { Location: to } });
}

export async function GET(request: Request) {
  let raw = new URL(request.url).pathname;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the raw path; it simply will not match a product id.
  }
  const trimmed = raw.replace(/\/+$/, "");
  const seg = trimmed.split("/").filter(Boolean);
  if (seg.length === 2 && seg[0].toLowerCase() === "product" && /^\d+$/.test(seg[1])) {
    const id = parseInt(seg[1], 10);
    if (ranges.some(([lo, hi]) => id >= lo && id <= hi)) {
      const canonical = "/product/" + id;
      if (raw !== canonical) return redirect(canonical);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
