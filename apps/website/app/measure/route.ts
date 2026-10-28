import html from "../../public/index.html?raw";
import { headForPage, shellResponse } from "../../lib/route-head";

// Wave 4 stage 3a (NAV-01), Mechanic A: /measure serves the same
// storefront document as the root route in app/route.ts, with the
// same headers. It renders the measurement studio, the #measure screen:
// public/real-routes.js boots the pathname into its hash route when
// the URL carries no hash, and the generated map in
// data/real-routes.json records the pairing, so this path and its
// screen cannot drift apart without the build noticing.
// Stage 3b: the served head is rewritten for this page by
// lib/route-head.ts, using the values the generated map carries for
// this path (noindex for the state screens, per route copy for the
// content screens).
export async function GET(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return shellResponse(html, headForPage(path));
}
