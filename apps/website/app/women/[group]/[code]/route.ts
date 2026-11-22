import html from "../../../../public/index.html?raw";
import routeMap from "../../../../data/real-routes.json";
import pin from "../../../../data/women-fabrics.json";
import {
  headForWomen,
  shellResponse,
  type WomenHeadSource,
} from "../../../../lib/route-head";

// Fabric defined women's products at a real URL carrying the fabric
// code (owner decisions, 2026-11-21): women's suits, jackets,
// trousers and shirts built from real library fabrics that are not
// shown for suits open at /women/<group>/<code>, for example
// /women/suits/CN51036, the same URL pattern as the fabric trousers
// (/trousers/<group>/<code>). Validation is against the pinned
// fabric selection the catalog generator builds these products from
// (data/women-fabrics.json), never a hand list:
//
// - A canonical path serves the storefront document with the head
//   rewritten for the fabric it names (lib/route-head.ts
//   headForWomen). The document boots from its pathname
//   (public/real-routes.js maps the path to the #women/ route,
//   which renders that fabric's women's product page).
// - Codes are case sensitive and can contain spaces or slashes, so
//   everything after the group segment is the code, rejoined. A
//   non-canonical spelling (group letter case, a trailing slash,
//   different percent encoding) answers with a permanent redirect
//   to the canonical encoded path.
// - An unknown group, or a code the pin does not hold for that
//   group, is a genuine 404, so bad links fail loudly.
const familyGroups: Record<string, string[]> = routeMap.families.women.groups;
const pinGroups = pin as unknown as Record<
  string,
  { code: string; color: string; pattern: string; mill: string; mat?: string }[]
>;
const byGroupCode = new Map<string, WomenHeadSource>();
for (const [group, list] of Object.entries(pinGroups)) {
  for (const f of list) {
    byGroupCode.set(group + "|" + f.code, {
      code: f.code,
      color: f.color,
      pattern: f.pattern,
      mill: f.mill,
      material: f.mat || "Wool",
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
  if (seg.length >= 3 && seg[0].toLowerCase() === "women") {
    const group = seg[1].toLowerCase();
    const code = seg.slice(2).join("/");
    if ((familyGroups[group] || []).includes(code)) {
      const entry = byGroupCode.get(group + "|" + code);
      if (entry) {
        const canonicalDecoded = "/women/" + group + "/" + code;
        if (raw !== canonicalDecoded) {
          return redirect(
            "/women/" + group + "/" + encodeURIComponent(code),
          );
        }
        return shellResponse(html, headForWomen(group, entry));
      }
    }
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
