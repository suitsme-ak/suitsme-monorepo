import html from "../../../public/index.html?raw";
import routeMap from "../../../data/real-routes.json";
import pin from "../../../data/jacket-fabrics.json";
import {
  headForJacket,
  shellResponse,
  type JacketHeadSource,
} from "../../../lib/route-head";

// Fabric defined jackets at a real URL carrying the fabric code
// (owner decisions, 2026-11-21): jackets built from real library
// fabrics that are not shown for suits open at /jackets/<code>, for
// example /jackets/CN51009, the same URL pattern as the fabric
// trousers (/trousers/<group>/<code>). Validation is against the
// pinned fabric selection the catalog generator builds these
// products from (data/jacket-fabrics.json), never a hand list:
//
// - A canonical path serves the storefront document with the head
//   rewritten for the fabric it names (lib/route-head.ts
//   headForJacket). The document boots from its pathname
//   (public/real-routes.js maps the path to the #jacket/ route,
//   which renders that fabric's jacket product page).
// - Codes are case sensitive and can contain spaces or slashes, so
//   everything after the jackets segment is the code, rejoined. A
//   non-canonical spelling (a trailing slash, different percent
//   encoding) answers with a permanent redirect to the canonical
//   encoded path.
// - A code the pin does not hold is a genuine 404, so bad links
//   fail loudly.
const family: string[] = routeMap.families.jackets.fabrics;
const pinDef = pin as unknown as {
  material: string;
  fabrics: { code: string; color: string; pattern: string; mill: string }[];
};
const byCode = new Map<string, JacketHeadSource>();
for (const f of pinDef.fabrics) {
  byCode.set(f.code, {
    code: f.code,
    color: f.color,
    pattern: f.pattern,
    mill: f.mill,
    material: pinDef.material,
  });
}

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
  if (seg.length >= 2 && seg[0].toLowerCase() === "jackets") {
    const code = seg.slice(1).join("/");
    if (family.includes(code)) {
      const entry = byCode.get(code);
      if (entry) {
        const canonicalDecoded = "/jackets/" + code;
        if (raw !== canonicalDecoded) {
          return redirect("/jackets/" + encodeURIComponent(code));
        }
        return shellResponse(html, headForJacket(entry));
      }
    }
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
