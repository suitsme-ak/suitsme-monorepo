import html from "../../web/index.html?raw";

// Wave 4 stage 3a (NAV-01), Mechanic A: /orders serves the same
// storefront document as the root route in app/route.ts, with the
// same headers. It renders the orders list, the #orders screen:
// public/real-routes.js boots the pathname into its hash route when
// the URL carries no hash, and the generated map in
// data/real-routes.json records the pairing, so this path and its
// screen cannot drift apart without the build noticing.
export async function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
