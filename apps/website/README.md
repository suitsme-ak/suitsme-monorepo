# Suits.me storefront - source handoff

A responsive custom-tailoring storefront with the Suits.me palette, original generated imagery, StudioSuits reference menu structure, garment detail/customization screens with thumbnail image galleries, enlarged viewing and front/back/detail views, guided measurements, saved profiles, bag, demo checkout, order history, gift configuration, customer care, showroom directory and geometric 3D garment studio.

## What this version contains
- Readable 18px body typography, 17–18px menu/form text and larger labels and controls across the storefront.
- Seven navigation categories with all reference options recorded in `data/reference-navigation.json`.
- 99 unique menu destinations: 92 shopping destinations and seven service/configurator destinations. Repeated navigation links resolve to the same destination.
- 2,245 sample SKUs, including 19 preserved original IDs. Every shopping menu destination contains at least 36 distinct design configurations; lists show 36 per page. Broad collections and Shop All share existing SKUs.
- Six colors and six patterns per collection design family. Model photography is a silhouette reference; swatches/specifications identify each configuration. These are illustrative designs, not verified merchant inventory or branded cloth.
- Guided body measurements driven by one shared measurement schema (`lib/measurement-schema.js`, generated to `public/measurement-schema.js` for the browser): per garment field sets with placement guidance, an explicit wearer on every profile, inch/centimeter entry with inches stored, versioned profiles (version 1 profiles keep loading and are offered completion rather than padded values), and the same validation in the studio, at checkout and in account profiles. Standard US men's sizes, separate profile groups, browser persistence.
- Three.js garment geometry with rotation, zoom, color/pattern/lapel controls and front/back/reset views. Browsers without WebGL use a software-rendered 3D shape; the selected cloth pattern remains visible in a swatch. This is an illustrative geometric model, not a photorealistic garment simulator or production pattern engine.
- Fit support, garment-clone consultation preparation and service-charge guidance. Consultation notes save locally; they do not send requests or book appointments.

## Project map
`public/` contains frontend scripts, CSS, imagery and the generated 3D bundle. `public/index.html` is the single source of the shell document: the route handlers import it directly (the former `web/index.html` mirror was retired in Wave 4 stage 3b). `studio/` contains authored Three.js source. `data/` contains the sample catalog, collections and menu mapping. `scripts/generate-catalog.cjs` regenerates browser data and server prices while keeping the first 19 product IDs stable. `lib/commerce.ts` implements the payment API; `app/api/` exposes its routes. `lib/measurement-schema.js` is the single source of truth for measurement fields, per garment sets, guidance, ranges and validation; the build generates its browser copy and both server validators read it directly. `db/` and `drizzle/` contain the D1 schema and migrations. `tests/` contains catalog and mocked payment contracts.

## Development and deployment
This project uses Node 22.13+ and pnpm 11.25.0. The user does not need to run these commands; they are provided for a future developer.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm dev
pnpm build
```

The build regenerates catalog files and bundles the 3D source, then builds Vinext for Cloudflare Workers using the retained Sites integration. Keep `.openai/hosting.json` for updates to this Site; register a new Site identity for a separate deployment. Sites' build helper produces the supported deployment archive. Publication preserves the current private audience. D1 binding `DB` stores payment orders; migrations are in `drizzle/`.

This application's payment ownership uses the trusted `oai-authenticated-user-id` header supplied by the Sites gateway. A different host must replace that dependency with verified server-side session authentication and strip any client-supplied identity header. Do not expose this API directly without that authentication boundary.

## Authorize.Net
`lib/commerce.ts` implements Accept Hosted token creation, server-authoritative prices, authenticated order ownership, origin checks, idempotent checkout and signed webhook processing followed by transaction-detail, amount and status verification. Card details are entered on the provider's hosted page, never in this frontend.

Set server-side runtime secrets; never put credentials in JavaScript, git or chat:
- `ANET_ENV`: `sandbox` or `production`
- `ANET_API_LOGIN_ID`, `ANET_TRANSACTION_KEY`, `ANET_SIGNATURE_KEY`
- `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`: the transactional email settings for account verification and password reset mail. Standalone accounts (Wave 5) stay disabled until all three are set alongside the D1 binding: the auth endpoints then answer 503 and no sign in entry point is shown.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: the Google sign in settings. The Google button and routes stay disabled until these are set in addition to the email settings. Register the redirect URI `<origin>/api/auth/google/callback` in the Google Cloud console; `/callback` belongs to the Sites gateway auth, not to this app.
- Register `/api/authorize/webhook` for `net.authorize.payment.authcapture.created` at a publicly reachable HTTPS callback approved by the merchant. The current owner-private Site blocks external webhook senders. Public storefront access and callback routing require configuration before real provider testing.

Production readiness additionally requires `COMMERCE_APPROVED=true`, an approved `SHIPPING_CENTS` value and an HTTPS `TAX_QUOTE_URL`. The tax service receives `{shipping,items,subtotalCents,shippingCents}` and returns `{taxCents}`; optional `TAX_QUOTE_TOKEN` authenticates it. In live mode the review step quotes the same server computed shipping, tax and total through `POST /api/checkout/quote` before the redirect to the hosted payment form, so the shopper reviews the full total on suits.me first.

No merchant credentials are configured in this handoff. Checkout therefore stays in demonstration mode: no charge, email, gift credit, inventory reservation or production submission. Real sandbox/production transactions have not been tested. Before live selling, connect and approve actual catalog/pricing, the remaining per garment measurement studio flows and size guide tables, tax, fulfillment, notifications, gift issuance and business policies. Complete merchant sandbox testing, including webhook reachability and duplicate/rejected payment cases. This is an interactive storefront implementation; it is not a launched production commerce operation or a guarantee of zero bugs.

## Verification
See `docs/VALIDATION.md`. Catalog and mocked payment contracts plus the framework build passed. Browser checks covered every menu destination, collection pagination/search, customization, required measurement validation, conversion, saving, demo checkout and software 3D controls. WebGL rendering and physical mobile-device behavior have not been verified in this environment.

## Data and imagery
Profiles, drafts, bag, checkout details, demo orders and consultation plans save in the current browser. Payment orders use D1 and authenticated ownership. Privacy controls clear this preview's browser keys. No merchant keys or customer records are included in the source archive. Original generated assets and prompts are listed in `IMAGE_PROMPTS.md`; the supplied business logo/craftsmanship image remain business assets. Third-party packages retain their respective licenses; the generated Three.js bundle includes its license notice.
