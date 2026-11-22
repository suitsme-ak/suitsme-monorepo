import html from "../../../public/index.html?raw";
import routeMap from "../../../data/real-routes.json";
import pin from "../../../data/shirt-fabrics.json";
import {
  headForShirt,
  shellResponse,
  type ShirtHeadSource,
} from "../../../lib/route-head";

// Fabric defined shirts at a real URL carrying the fabric code
// (owner decisions, 2026-11-21 and 2026-11-22): men's tailored
// cotton and linen shirts built from real library fabrics open
// at /shirts/<code>, for example /shirts/10-1295-05, the same
// URL pattern as the fabric suits (/suits/<code>). Validation
// is against the pinned fabric selection the catalog generator
// builds these products from (data/shirt-fabrics.json), never
// a hand list:
//
// - A canonical path serves the storefront document with the
//   head rewritten for the fabric it names (lib/route-head.ts
//   headForShirt). The document boots from its pathname
//   (public/real-routes.js maps the path to the #shirt/ route,
//   which renders that fabric's shirt product page).
// - Codes are case sensitive and can contain spaces or slashes,
//   so everything after the shirts segment is the code,
//   rejoined. A non-canonical spelling (a trailing slash,
//   different percent encoding) answers with a permanent
//   redirect to the canonical encoded path.
// - A code the pin does not hold is a genuine 404, so bad
//   links fail loudly.
const familyGroups: Record<string, string[]> =
  routeMap.families.shirts.groups;
const pinGroups = pin as unknown as Record<
  string,
  { code: string; color: string; pattern: string; mill: string; mat?: string }[]
>;
const byCode = new Map<string, ShirtHeadSource>();
for (const list of Object.values(pinGroups)) {
  for (const f of list) {
    byCode.set(f.code, {
      code: f.code,
      color: f.color,
      pattern: f.pattern,
      mill: f.mill,
      material: f.mat || "Cotton",
    });
  }
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
  if (seg.length >= 2 && seg[0].toLowerCase() === "shirts") {
    const code = seg.slice(1).join("/");
    const inFamily = Object.values(familyGroups || {}).some((list) =>
      (list || []).includes(code),
    );
    if (inFamily) {
      const entry = byCode.get(code);
      if (entry) {
        const canonicalDecoded = "/shirts/" + code;
        if (raw !== canonicalDecoded) {
          return redirect("/shirts/" + encodeURIComponent(code));
        }
        return shellResponse(html, headForShirt(entry));
      }
    }
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
