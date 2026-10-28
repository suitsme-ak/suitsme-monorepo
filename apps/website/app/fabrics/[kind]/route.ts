import html from "../../../public/index.html?raw";
import routeMap from "../../../data/real-routes.json";
import { headForFamily, shellResponse } from "../../../lib/route-head";

// Wave 4 stage 3a (NAV-01), Mechanic A: the merchant fabric listings
// at real URLs. The generated map in data/real-routes.json (built by
// scripts/build-real-routes.cjs) carries the valid kinds, mirroring
// the client dispatch in merchant.js, which renders the #fabrics/
// screens for suit and shirt only:
//
// - A canonical path (/fabrics/suit, /fabrics/shirt) serves the same
//   storefront document as the root route in app/route.ts, with the
//   same headers, its head rewritten for the listing it names (stage
//   3b: lib/route-head.ts, values from the generated map). Redirects
//   and 404s are never injected. The document boots from its
//   pathname when no hash is present (public/real-routes.js).
// - A non-canonical form of a valid kind (letter case, a trailing
//   slash the framework let through, a leading zero style spelling)
//   answers with a permanent redirect to the canonical path.
// - Any other kind is a genuine 404. Unknown kinds are never served
//   the shell, so bad links fail loudly instead of rendering the
//   wrong listing.
const kinds: string[] = routeMap.families.fabrics.kinds;

function redirect(to: string) {
  return new Response(null, { status: 308, headers: { Location: to } });
}

export async function GET(request: Request) {
  let raw = new URL(request.url).pathname;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the raw path; it simply will not match a known kind.
  }
  const seg = raw.replace(/\/+$/, "").split("/").filter(Boolean);
  const kind = seg.length === 2 && seg[0].toLowerCase() === "fabrics" ? seg[1].toLowerCase() : null;
  if (kind && kinds.includes(kind)) {
    const canonical = "/fabrics/" + kind;
    if (raw !== canonical) return redirect(canonical);
    return shellResponse(html, headForFamily("fabrics", kind));
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
