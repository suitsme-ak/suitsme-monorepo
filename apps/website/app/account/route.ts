import html from "../../public/index.html?raw";
import { headForPage, shellResponse } from "../../lib/route-head";

// Wave 5 package 5.4 (ACC-01), Mechanic A: /account serves the same
// storefront document as the root route in app/route.ts, with the
// same headers. It renders the account screen, the #account screen:
// public/real-routes.js boots the pathname into its hash route when
// the URL carries no hash, and the generated map in
// data/real-routes.json records the pairing, so this path and its
// screen cannot drift apart without the build noticing. The served
// head is rewritten for this page by lib/route-head.ts using the
// values the generated map carries (noindex: the account screen is
// shopper state, not content). The screen reads the signed in user
// from the boot time GET /api/auth/me state and renders its guest
// and not enabled states honestly when there is no session.
export async function GET(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return shellResponse(html, headForPage(path));
}
