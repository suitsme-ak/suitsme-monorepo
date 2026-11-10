import html from "../../../../public/index.html?raw";
import routeMap from "../../../../data/real-routes.json";
import library from "../../../../data/fabric-library.json";
import {
  headForFabric,
  shellResponse,
  type FabricHeadSource,
} from "../../../../lib/route-head";

// Fabric detail at a real URL carrying the fabric code (owner
// request, 2026-11-10): /fabrics/suit/CB11001 opens that fabric's own
// page, so a fabric can be linked, bookmarked and quoted by its code.
// Validation is against the fabric library data the repo ships
// (data/fabric-library.json, the JPOS import), never a hand list:
//
// - A canonical path for a coded fabric serves the same storefront
//   document as the other routes, its head rewritten for the fabric
//   it names (lib/route-head.ts headForFabric, values from the same
//   library the page renders). The document boots from its pathname
//   (public/real-routes.js maps the path to the #fabric/ route).
// - Codes are case sensitive and can contain spaces or slashes, so
//   everything after the kind segment is the code, rejoined. A
//   non-canonical spelling (kind letter case, a trailing slash,
//   different percent encoding) answers with a permanent redirect to
//   the canonical encoded path.
// - An unknown kind, or a code the library does not hold for that
//   kind, is a genuine 404, so bad links fail loudly. The codeless
//   legacy rows have no code and therefore no page, matching their
//   exclusion from the library listings.
const kinds: string[] = routeMap.families.fabrics.kinds;
const fabricsByKindCode = new Map<string, FabricHeadSource>(
  (
    library as unknown as { fabrics: (FabricHeadSource & { k: string })[] }
  ).fabrics
    .filter((f) => f.c)
    .map((f) => [f.k + "|" + f.c, f]),
);

function redirect(to: string) {
  return new Response(null, { status: 308, headers: { Location: to } });
}

export async function GET(request: Request) {
  let raw = new URL(request.url).pathname;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the raw path; it simply will not match a fabric code.
  }
  const seg = raw.replace(/\/+$/, "").split("/").filter(Boolean);
  if (seg.length >= 3 && seg[0].toLowerCase() === "fabrics") {
    const kind = seg[1].toLowerCase();
    const code = seg.slice(2).join("/");
    if (kinds.includes(kind)) {
      const entry = fabricsByKindCode.get(kind + "|" + code);
      if (entry) {
        const canonicalDecoded = "/fabrics/" + kind + "/" + code;
        if (raw !== canonicalDecoded) {
          return redirect("/fabrics/" + kind + "/" + encodeURIComponent(code));
        }
        return shellResponse(html, headForFabric(entry, kind, code));
      }
    }
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
