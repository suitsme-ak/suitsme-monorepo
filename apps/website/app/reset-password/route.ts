import html from "../../public/index.html?raw";
import { headForPage, shellResponse } from "../../lib/route-head";

// Wave 5 package 5.4 (ACC-01), Mechanic A: /reset-password serves
// the same storefront document as the root route in app/route.ts,
// with the same headers. It renders the reset password screen, the
// #reset-password screen, and carries the emailed token in its
// query string, which the client reads when the screen renders:
// public/real-routes.js boots the pathname into its hash route when
// the URL carries no hash, and the generated map in
// data/real-routes.json records the pairing, so this path and its
// screen cannot drift apart without the build noticing. The served
// head is rewritten for this page by lib/route-head.ts using the
// values the generated map carries (noindex: the auth screens are
// shopper state, not content). The screen itself renders its form
// only while the accounts gate is open; the client reads
// GET /api/auth/me at boot and hides every account entry point while
// accounts are not enabled.
export async function GET(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return shellResponse(html, headForPage(path));
}
