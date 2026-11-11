import html from "../../../../public/index.html?raw";
import routeMap from "../../../../data/real-routes.json";
import pin from "../../../../data/trouser-fabrics.json";
import {
  headForTrouser,
  shellResponse,
  type TrouserHeadSource,
} from "../../../../lib/route-head";

// Fabric defined trousers at a real URL carrying the fabric code
// (owner decision, 2026-11-11): trousers built from a real library
// fabric open at /trousers/<group>/<code>, for example
// /trousers/wool/CN51001, the same URL pattern as the fabric detail
// pages (/fabrics/suit/<code>). Validation is against the pinned
// fabric selection the catalog generator builds these products from
// (data/trouser-fabrics.json), never a hand list:
//
// - A canonical path serves the storefront document with the head
//   rewritten for the fabric it names (lib/route-head.ts
//   headForTrouser). The document boots from its pathname
//   (public/real-routes.js maps the path to the #trouser/ route,
//   which renders that fabric's trousers product page).
// - Codes are case sensitive and can contain spaces or slashes, so
//   everything after the group segment is the code, rejoined. A
//   non-canonical spelling (group letter case, a trailing slash,
//   different percent encoding) answers with a permanent redirect
//   to the canonical encoded path.
// - An unknown group, or a code the pin does not hold for that
//   group, is a genuine 404, so bad links fail loudly.
const groups: string[] = routeMap.families.trousers.groups;
const pinGroups = (
  pin as unknown as {
    groups: Record<
      string,
      {
        material: string;
        fabrics: {
          code: string;
          color: string;
          pattern: string;
          mill: string;
        }[];
      }
    >;
  }
).groups;
const byGroupCode = new Map<string, TrouserHeadSource>();
for (const [group, def] of Object.entries(pinGroups)) {
  for (const f of def.fabrics) {
    byGroupCode.set(group + "|" + f.code, {
      code: f.code,
      color: f.color,
      pattern: f.pattern,
      mill: f.mill,
      material: def.material,
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
  if (seg.length >= 3 && seg[0].toLowerCase() === "trousers") {
    const group = seg[1].toLowerCase();
    const code = seg.slice(2).join("/");
    if (groups.includes(group)) {
      const entry = byGroupCode.get(group + "|" + code);
      if (entry) {
        const canonicalDecoded = "/trousers/" + group + "/" + code;
        if (raw !== canonicalDecoded) {
          return redirect(
            "/trousers/" + group + "/" + encodeURIComponent(code),
          );
        }
        return shellResponse(html, headForTrouser(entry, group));
      }
    }
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
