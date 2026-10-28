import html from "../../../web/index.html?raw";

// Wave 4 stage 3a (NAV-01), Mechanic A: order detail at a real URL.
//
// Unlike products, order ids cannot be validated on the server: demo
// order ids are minted in the shopper's browser and live in browser
// storage, and server order records are not enumerable by the shell.
// This route therefore serves the storefront document for ANY single
// segment id, and the client keeps doing what the #order/<id> hash
// route does today: it renders the order when the id is one of the
// shopper's own orders and its own not found state (the orders list)
// when it is not. No id is ever confirmed or denied here.
export async function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
