import html from "../../../web/index.html?raw";
import routeMap from "../../../data/real-routes.json";

// Wave 4 stage 2 (NAV-01), Mechanic A: one catch all route serves
// every real collection URL, replacing the spike's single explicit
// Wool Suits route. The generated map in data/real-routes.json (built
// by scripts/build-real-routes.cjs from the menu source and the
// catalog collection data) decides what exists:
//
// - A canonical path serves the same storefront document as the root
//   route in app/route.ts, with the same headers. The document boots
//   from its pathname when no hash is present (public/real-routes.js),
//   and its <base href="/"> element keeps every relative asset,
//   stylesheet and script URL resolving from the site root.
// - An alias path (legacy spellings, the retired Pants wording)
//   answers with a permanent redirect to the canonical path.
// - A path whose normalised form differs from its canonical form
//   (letter case, a trailing slash the framework let through) also
//   redirects to the canonical form.
// - Anything else under /collections/ is a genuine 404. Unknown slugs
//   are never served the shell, so migrated and unmigrated paths stay
//   distinguishable and bad links fail loudly instead of rendering
//   the wrong collection.
const paths: Record<string, string> = routeMap.paths;
const aliases: Record<string, string> = routeMap.aliases;

function redirect(to: string) {
  return new Response(null, { status: 308, headers: { Location: to } });
}

export async function GET(request: Request) {
  let raw = new URL(request.url).pathname;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the raw path; it simply will not match a known slug.
  }
  const canonical = raw.replace(/\/+$/, "").toLowerCase();
  if (canonical in paths) {
    if (raw !== canonical) return redirect(canonical);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }
  if (canonical in aliases) return redirect(aliases[canonical]);
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
