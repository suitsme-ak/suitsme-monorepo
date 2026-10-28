# Wave 4 spike report: one collection at a real URL (NAV-01)

Status: spike complete, local branch only (`spike/wave-4-real-urls`, commit `c85aedb` for the proof code). Nothing pushed, nothing merged. This report is the evidence for the mechanic decision the plan asks for in section 8, stage 1.
Prepared: October 28, 2026.
Companion documents: `docs/ux-audit/implementation-plan.md` section 8, `docs/ux-audit/studiosuits-gap-analysis.md` row NAV-01.

## 1. Recommendation in brief

Adopt **Mechanic A: framework server routes** that serve the existing storefront document, with the client booting from the pathname when no hash is present. The spike proves it end to end for Wool Suits with a six file change, no change to any existing render function, the full test suite green and no material build time change. Mechanic B (build time generation of one HTML entry per collection) was analysed, not built: it needs the exact same client boot and base URL work as A, then adds a generated file fleet that can never cover the product, checkout or order families, so the migration would end up running both mechanics anyway.

## 2. How a request flows today (verified on main `b183546`)

Serving stack, from the outside in:

1. The Cloudflare worker entry is `apps/website/worker/index.ts`. It delegates every request to the vinext fetch handler (with a connector binding wrapper used only by local previews).
2. Static assets come from `dist/client`, the build output of `apps/website/public/`. Exact file paths are served directly: at baseline, `GET /app.js` returned 200 (46,844 bytes), `GET /style.css` returned 200, `GET /assets/model-navy.webp` returned 200.
3. Framework routes are the only dynamic surface. The production build prints this route table, and nothing else exists:

```
Route (app)
┌ λ /
├ λ /api/authorize/webhook
├ λ /api/checkout
├ λ /api/orders/:id
└ λ /api/payment/config
```

4. `GET /` is handled by `apps/website/app/route.ts`, a two line handler that returns `web/index.html` raw with `Content-Type: text/html; charset=utf-8` and `Cache-Control: no-cache`. `web/index.html` is a byte identical mirror of `public/index.html`; `tests/catalog.cjs` asserts the equality, so the pair is one document with a guard, not two documents.
5. The document is a shell: header, an empty `<main id="main">`, footer, then ten classic scripts in a fixed order (`app.js`, `complete.js`, `catalog-data.js`, `expanded.js`, `navigation-data.js`, `navigation.js`, `gallery.js`, `quick-add.js`, `merchant-data.js`, `merchant.js`). All content is rendered client side.
6. Routing is entirely hash driven. `render()` in `complete.js` dispatches on `location.hash` (collection, product, customize, measure, checkout, order, orders, gift-cards, help, locations, shipping, privacy, terms, home), wrapped by `expanded.js` (fit-support, clone, charges, studio) and by `merchant.js` (fabrics listings, and the Suits, Shirts and Fabrics collection overrides). `app.js` registers the `hashchange` listener that re-renders. Before this spike, no storefront script or worker code read `location.pathname` or used the History API (verified by search across `public/`, `app/` and `worker/`).
7. Catalog and navigation data are generated at build time by scripts chained in `apps/website/package.json` (`generate-catalog.cjs`, `build-merchant-catalog.cjs`, `build-suit-edits.cjs`, `build-studio.mjs`) before the framework build runs. They write `data/*.json`, `lib/catalog.json` and the generated `public/*-data.js` files. Nothing in the build generates HTML entries.

What happens on an unknown path today, measured against the locally built production server (`pnpm start`, wrangler dev on the built output, October 28, 2026):

| Request | Result |
| --- | --- |
| `GET /` | 200, the storefront document (4,690 bytes) |
| `GET /index.html` | 307 redirect (framework canonicalises to `/`) |
| `GET /collections/suits/wool-suits` | 404, framework default error page (5,709 bytes) |
| `GET /product/1964` | 404, same error page family |
| `GET /totally-unknown` | 404, same error page family |
| `GET /api/payment/config` | 200 JSON |

There is no SPA fallback: `dist/server/wrangler.json` declares an assets directory but no `not_found_handling`, and no `_redirects` file exists in `public/`. Any real path that is not a file and not a registered route is a hard 404 today. That is the gap NAV-01 has to close, route family by route family.

One more current state fact the spike had to respect: **every asset and content URL in the shell and in the render functions is relative** (`href="style.css"`, `src="app.js"`, `src="assets/..."`, and thousands of generated `assets/...` image paths). Served from `/` they resolve to the site root. Served from a nested path they resolve under that path: at baseline, `GET /collections/suits/assets/model-navy.webp` returned 404. Any mechanic that serves the shell from a nested URL must fix the document base, or the page arrives unstyled with broken images.

A second fact: two different Wool collections exist in the data. The catalog map (`data/collections.json`, generated) holds 147 keys including legacy aliases, among them `#collection/Suits/Wool%20Suits` with 36 design products (ids 19 to 54) and a lowercase alias `#collection/Suits/Wool%20suits` pointing at the same set. But what a shopper actually sees for the menu destination today is decided by `merchant.js`, which intercepts every Suits collection and renders the merchant fabric edit instead: Wool Suits is the ten looks in `data/suit-collections.json` (ids 1964, 1965, 1966, 1970, 1974, 1986, 1987, 1967, 1968, 1969; first look: Black Solid Suit, fabric EB11127). The spike's parity bar is therefore the rendered menu destination, not the raw catalog map entry.

## 3. The proof (Mechanic A, smallest viable form)

Six files changed, no existing render function touched:

1. **`apps/website/app/collections/suits/wool-suits/route.ts` (new).** A framework route handler for the one real URL, written in exactly the pattern of the existing root handler: it imports `web/index.html` raw and returns it with the same status and headers. The build route table now ends with `└ λ /collections/suits/wool-suits`.
2. **`apps/website/public/real-routes.js` (new).** The boot translation. It runs before every other storefront script and does one thing: when the URL has **no hash**, it looks the pathname up in a small map (`/collections/suits/wool-suits` maps to `#collection/Suits/Wool%20Suits`, the exact hash the menu's `menuLink` already produces) and assigns `location.hash`. Pathnames are normalised (decoded, lowercased, trailing slash stripped). If a hash is already present, or the path is unknown, it does nothing. Existing hash bookmarks and every in-app link therefore behave byte for byte as before, by construction.
3. **`apps/website/public/index.html` and `apps/website/web/index.html` (kept identical).** Two insertions: `<base href="/">` directly after the charset meta, so every relative stylesheet, script and image URL resolves from the site root at any serving depth; and `<script src="real-routes.js"></script>` immediately before `app.js`. The catalog suite's equality guard still passes because both copies received the same edit.
4. **`apps/website/tests/real-urls.cjs` (new) and the `test` chain in `apps/website/package.json`.** The spike suite, described below.

What the shopper gets: `GET /collections/suits/wool-suits` returns the storefront document; the boot script sets the Wool Suits hash before `app.js` executes its first `render()`; the existing dispatch renders the merchant Wool Suits edit, preselected, with its ten products. From there the shopper is in the ordinary app: product links, menus, the measurement studio and checkout all work through the same hash navigation the app has always used, and the bag, profiles and config in localStorage are untouched by the entry path.

### Verification evidence

Commands run in the spike worktree (`npx pnpm@11.25.0 --config.verify-deps-before-run=false`):

| Check | Baseline (main `b183546`) | Spike branch |
| --- | --- | --- |
| `pnpm test` | exit 0, 20 suites | exit 0, 21 suites (the new `tests/real-urls.cjs` included) |
| `pnpm build` (root) | exit 0, wall 21.2s in one run | exit 0, wall 27.8s and 23.0s in two runs; framework sub-build times are the same order as baseline (sum of the five `built in` steps: 8.6s baseline, 9.4s and 11.2s spike). No material change; the delta is one extra route module in the server bundle plus run to run variance on this machine |
| Build route table | 5 routes (root plus 4 API) | 6 routes: adds `λ /collections/suits/wool-suits` |

The new suite (`tests/real-urls.cjs`, same Node vm harness style as the existing suites) asserts:

- Translation: the Wool path maps to `#collection/Suits/Wool%20Suits`; trailing slash and case variants map; `/collections/suits/linen-suits`, `/collections`, `/` and an empty path map to nothing; an existing hash (`#checkout`) is never overridden.
- Handler: the compiled route's `GET()` returns status 200, the root route's headers, and a body byte identical to `web/index.html`; the document contains the base element and loads `real-routes.js` before `app.js`; the two HTML copies remain equal.
- Entry render: a full storefront world (all eleven scripts in document order) booted with `pathname=/collections/suits/wool-suits` and no hash ends with the hash set to the Wool route and `#main` containing `<h1>Wool Suits.</h1>`, the listing count `10 results`, and every one of the ten expected products' image path and fabric code (expectations computed from `data/suit-collections.json` and `data/catalog.json`, not hard coded).
- Navigation from the entry: `chooseProduct(1964)` lands on `#product/1964` and renders that product's page; switching to `#measure` renders the measurement studio; switching back re-renders Wool Suits; the rendered menu still contains the Wool Suits anchor.
- Compatibility: a world booted at `/` with the Wool hash renders the same collection with the hash untouched; a world booted at `/` with no hash renders the home page, not the collection.

Live server evidence, same wrangler method as the baseline probe, after the spike build:

| Request | Result |
| --- | --- |
| `GET /collections/suits/wool-suits` | **200**, `text/html`, 4,743 bytes, byte identical to the document served at `/`, containing `<base href="/">` and the `real-routes.js` script tag |
| `GET /collections/suits/wool-suits/` | 308 redirect to the slash free URL (framework normalisation) |
| `GET /real-routes.js` | 200, served as a static asset |
| `GET /collections/suits/linen-suits` | 404 (not yet migrated; behaviour unchanged) |
| `GET /totally-unknown` | 404 (unchanged) |
| `GET /`, `GET /app.js`, `GET /api/payment/config` | 200 (unchanged) |

Honest limits of this proof: rendering is verified through the repo's vm harness, the same standard every prior wave used, plus HTTP level checks against the real built server. No live browser walk was run (this agent cannot operate the browser), so visual confirmation on desktop and mobile viewports remains a stage 4 task for the rollout, exactly as the plan schedules it. The spike also does not set a per collection page title: the client sets `document.title` from the hash as today (`The Collection - Suits.me`), and the served shell still carries the home page meta. Per route titles and meta belong to the rollout (see risks).


## 4. Mechanic B, analysed honestly (not built)

Mechanic B: a build step generates one static HTML entry per collection from the single source, for example `public/collections/suits/wool-suits/index.html` (following the existing generator pattern of writing into `public/`) or copies injected into `dist/client` after the framework build.

What B would actually require, step by step:

1. **The same client work as A.** A generated copy is still the same JS shell. On arrival at `/collections/suits/wool-suits/` (note the trailing slash form static hosting prefers), nothing renders Wool Suits until something translates the pathname into the hash route, and every relative asset still breaks until the base is fixed. B therefore includes A's boot script and base change in full. The only part of A it avoids is one small route handler file per route family.
2. **A generator plus its guard.** Following repo convention the generator would write into `public/`, producing 147 collection files (one per key in `data/collections.json`, aliases included) of about 4.7KB each, roughly 0.7MB of duplicated shell. They would be regenerated on every build, they would sit in the source tree next to the hand maintained shell, and the existing guard test compares only the two root copies, so B needs a new guard asserting every generated copy matches the shell plus its injection, or the copies silently drift the first time someone edits `index.html` and runs a partial build. Writing into `dist/client` post build instead keeps the source tree clean but puts a Wave 4 step outside the established generator chain, invisible to anyone reading `public/`.
3. **It cannot finish the job.** Collections are the only family B can generate sensibly. Products number 2,245 in `data/catalog.json`: generating an identical shell per product adds about 10MB of pure duplication to buy URLs a route handler serves for free. Customize, checkout, orders, order detail and payment return are application states, not content; static entries for them are meaningless. So even a completed B leaves Mechanic A (or an SPA fallback) to build for the remaining families, and the migration ends up maintaining both.
4. **Hosting behaviour differs in B's favour in exactly one place:** static assets are served before the worker runs, so a generated entry costs no worker invocation and is edge cacheable, while A's handler runs per request (as `/` already does today, with `Cache-Control: no-cache`). On this stack, where every page view already executes the worker for `/` and the APIs, that saving is real but small.
5. **B's one genuine extra:** because each file is distinct, the generator can bake a unique title, description and canonical into each collection entry at build time. A can match this by having the handler rewrite the title and meta block per route before responding (a string substitution on a 4.7KB document), which the rollout plan includes; it does not require distinct files.

## 5. Comparison

| Dimension | Mechanic A: server routes (spike, built) | Mechanic B: build time HTML entries (analysed) |
| --- | --- | --- |
| Spike result | Proven: 200 at the real URL, correct collection rendered, suite and build green | Not built; client prerequisites are identical to A, so its unproven remainder is only the file generation and static serving |
| Effort to first collection | One route file (18 lines), one boot script, two insertions in the shell | One generator plus guard test, plus the same boot script and base change |
| Effort to all collections | One parameterised route family plus a generated route map (stage 2 and 3 work) | Generator emits 147 files; effort similar for collections only |
| Effort to product, checkout, order families | Same pattern: one route per family with an id segment | Not viable for products (2,245 duplicate shells); not meaningful for app state pages; A still required |
| Two HTML copies guard | Unchanged: one document, two mirrored copies, existing test still guards them; a later stage can try retiring the mirror (risk list) | Guard must grow to cover every generated copy, or copies drift from the shell |
| Generated catalog scripts | Unaffected: generators keep writing data files; the route map joins them as one more generated artifact in the rollout | A new HTML generator joins the chain and must run after any shell edit; partial builds can leave stale entries |
| Cloudflare hosting fit | Matches how `/` is already served; route paths are not files, so the worker handles them; trailing slash gets a framework 308 to the canonical form (measured) | Static assets win over the worker for exact paths; directory index and trailing slash behaviour of the assets layer decides the canonical form, and would need its own verification |
| 404 behaviour | Unmigrated and unknown paths keep today's framework 404 (measured for Linen Suits and an unknown path) | Ungenerated paths keep today's 404; risk is a path that exists as a stale file but should have been removed |
| Redirects and compatibility | Hash URLs keep working untouched (boot never overrides a hash); stage 2 adds server redirects from any legacy real path forms if needed | Same hash compatibility; plus file moves or renames need asset level redirects |
| SEO | Real, linkable, canonicalisable URLs; per route title and meta available via handler injection in the rollout; content still renders client side, as today | Real URLs; per route title and meta baked in at build time; content still renders client side, as today |
| Build time | Measured: no material change (section 3) | Generator cost itself is trivial (147 small file writes), but it adds a step that must stay correct forever |
| Rollback | Previous build; route files are additive | Previous build; generated files are additive |
| Ongoing cost | A route map kept in one generated place | A file fleet kept in sync with the shell, plus A for the remaining families |

SEO, stated plainly for both: neither mechanic changes the fundamental fact that product and collection content renders in the browser. Search engines that execute JavaScript will index the same content at better URLs; engines that do not will see the shell and its noscript summary, exactly as today. Real URLs buy linkability, shareability, analytics clarity and a canonical sitemap, and they are the owner approved direction (decision D1). Server side rendering of catalog content is a separate, much larger project and is not smuggled into this wave by either mechanic.

## 6. Proposed real URL scheme (for owner approval)

Rules: lowercase; spaces become hyphens; `&` becomes `and`; parentheses and apostrophes are dropped; one canonical form per destination, with the slug table generated from `data/reference-navigation.json` (the menu source), not from the alias heavy catalog map. Verified for the proposal: slugifying all 101 menu (category, item) pairs this way produces **zero collisions within any category**. Categories keep their current names as the first segment (Trousers stays Trousers, per decision D2). Application state pages (customize, checkout, orders, payment return) should carry `noindex` once per route meta lands in the rollout; collections and products are the indexable families.

| Hash route today | Proposed real URL | Notes |
| --- | --- | --- |
| `#home` | `/` | Unchanged |
| `#story` | `/#craft` | Today it scrolls the home page to the craft section; it becomes a plain fragment on the home URL |
| `#collection` | `/collections/suits` | Today the bare route defaults to Suits; the real URL names it |
| `#collection/<Category>` | `/collections/<category>` | Example: `#collection/Women` to `/collections/women` |
| `#collection/<Category>/<Topic>` | `/collections/<category>/<topic-slug>` | Example: `#collection/Suits/Wool%20Suits` to `/collections/suits/wool-suits` (the spike URL). `#collection/Suits/Cocktail%20&%20Evening%20Suits` to `/collections/suits/cocktail-and-evening-suits`; `#collection/Suits/Look%20Book%20(All)` to `/collections/suits/look-book-all` |
| `#fabrics/<suit or shirt>` | `/fabrics/<suit or shirt>` | The merchant fabric listings: `/fabrics/suit`, `/fabrics/shirt` |
| `#product/<id>` | `/product/<id>` | Keeps the stable numeric id the catalog suite guards. Slug based product URLs (name plus SKU) are a possible later SEO enhancement, deliberately out of the migration: names are display data, ids are the contract |
| `#customize` | `/customize` | State page, noindex |
| `#measure` | `/measure` | The measurement studio |
| `#checkout` | `/checkout` | State page, noindex |
| `#orders` | `/orders` | Signed in order history lands here in Wave 5; noindex |
| `#order/<id>` | `/orders/<id>` | Example: `#order/DEMO-ABC123` to `/orders/DEMO-ABC123`; noindex |
| `#gift-cards` | `/gift-cards` | |
| `#help` | `/help` | |
| `#locations` | `/locations` | |
| `#shipping` | `/shipping` | Delivery and returns policy page |
| `#privacy` | `/privacy` | |
| `#terms` | `/terms` | |
| `#studio/<suit, jacket or pants>` | `/studio/<suit, jacket or pants>` | The 3D configurators: `/studio/suit`, `/studio/jacket`, `/studio/pants` |
| `#fit-support` | `/fit-support` | Fit Guarantee destination |
| `#clone` | `/clone` | Clone Garments destination |
| `#charges` | `/charges` | Other Charges destination |
| `#payment-return` | `/payment-return` | The Authorize.Net return landing; keep this exact path stable because the payment flow already points at the flow, and treat it as noindex |

Legacy alias hash topics (for example `#collection/Suits/Wool%20suits`, lowercase) have no separate real URL: they canonicalise to the menu label's slug. Anyone holding an old hash link still lands correctly, because hash handling at `/` is unchanged.

## 7. Open risks

1. **Base element side effects.** `<base href="/">` also governs fragment only links: on a real URL page, an in-app `#measure` link resolves to `/#measure`, so the browser loads the root document and then renders the destination, instead of a pure hash change. Functionally correct (and the spike suite proves the destinations render), but cross page navigation from a real URL entry costs a reload until stage 3 rewrites internal links to real URLs, after which the base element is only an asset safety net. This is the main behavioural trade of the spike design and the owner should know it exists.
2. **Catch all versus explicit routes.** The spike uses one explicit route file. The rollout needs either a catch all segment (for example `app/collections/[...slug]/route.ts`) or generated explicit routes. Catch all support in this vinext beta, and its precedence against the existing `/api/*` routes and static assets, is unverified; stage 2 must prove it on the built server before rollout relies on it. Explicit generated routes are the fallback and are known to work, at the cost of more files.
3. **Per route title and meta are not yet real.** Every real URL initially serves the home page title and meta, with the client correcting the title from the hash as today. Until stage 3 adds handler side injection (title, description, canonical, noindex for state pages), migrated URLs are linkable but not yet individually described for search or sharing.
4. **The two copies problem survives the spike.** A keeps `web/index.html` mirrored from `public/index.html` under its guard test. Retiring the mirror (having the route import the public copy, or serving the shell from assets) is attractive but unproven against the vinext build; it is a stage 3 investigation, not an assumption.
5. **Payment return and checkout continuity.** `#payment-return` is part of a payment flow that must not break in Wave 6. Its real path is proposed unchanged in form, but the return flow has to be retested end to end in the rollout verification, in demo mode, before any Wave 6 work builds on it.
6. **Trailing slash and case.** The framework 308s a trailing slash to the canonical form (measured). Uppercase variants of real paths are not redirected by the framework (the boot map tolerates case only once the document loads, which a 404 prevents), so canonical links and the sitemap must always emit the lowercase slug form.
7. **Analytics and external references.** Any external system that parses the hash to identify pages (analytics, support links, emails) sees page identity move to the path in stage 3. Out of scope to fix here; listed so it is a decision, not a surprise.

## 8. Staged rollout (stages 2 to 4, for approval after the mechanic decision)

### Stage 2: Compatibility and redirect layer (plan estimate 1 to 2 days)

Work:
- Prove the catch all question on the built server (risk 2): a catch all collection route that serves the shell for any slug pair, checked against `/api/*` precedence, static assets and the 404 for genuinely unknown paths. Fallback: generated explicit routes.
- Generate the route map from source data: one build script, in the existing generator chain, that emits the real path to hash map (and the reverse) from `data/reference-navigation.json` plus `data/collections.json`, consumed by both the server route (for validation: unknown slugs 404) and `real-routes.js` (replacing the hand written spike map). Slug collisions fail the build.
- Server behaviour for legacy forms: a request to a real path with a trailing slash or a known alias slug answers with the framework redirect to the canonical slug; hash URLs are untouched (they are client side and cannot be server redirected; the root document keeps honouring them).

Acceptance criteria:
- Every one of the 147 catalog collection keys resolves through the generated map to exactly the hash route it names today, proven by a suite in the style of `tests/catalog.cjs`.
- Slug uniqueness per category is asserted in the test chain; adding a colliding menu label fails the build.
- On the built server: all seven category roots return 200; an unknown slug under `/collections/` returns 404; `/api/payment/config` still returns 200; `/app.js` and other assets are unaffected.

### Stage 3: Rollout (plan estimate 3 to 5 days)

Work:
- All route families from section 6 get server routes on the stage 2 pattern: collections, fabrics, product, customize, measure, checkout, orders, order detail, gift cards, help, locations, policy pages, studio, fit support, clone, charges, payment return.
- Internal links move to real URLs: `menuLink` in `navigation.js` returns real paths, and the home tiles, footer, breadcrumbs and in-copy links follow; hash navigation remains as the in-app state mechanism only where a screen is genuinely a state (the customizer steps), which is an internal detail, not a URL the shopper sees.
- Handler side per route head injection: title, meta description, canonical and robots (noindex for state pages) per route family, with collection and product values taken from the same catalog data the pages render.
- Sitemap regenerated to list every collection and product real URL (2,245 products) with the canonical slug forms; robots file unchanged except the sitemap reference stays valid.
- The two copies question is investigated and either retired with evidence (suite plus built server proof that the single source serves) or explicitly kept, with the guard test unchanged and the decision recorded in this document's successor note.

Acceptance criteria:
- Menu inventory parity: the rendered menus contain the same 96 anchors and 94 destinations as the pre migration baseline, with every href now a real URL that returns 200 on the built server.
- Every hash route in the section 6 table has a working real equivalent, and every old hash URL still renders its screen when opened at `/`.
- Full test chain and root build pass; new suites cover the generated map, the injection and the sitemap contents.
- Demo checkout completes end to end from a real URL entry (bag, checkout, demo order, order page), including the payment return path in demo mode.

### Stage 4: Verification (plan estimate 1 to 2 days)

Work:
- Spot journeys per category on the built server and, with the owner's browser, on the live deployment: menu to collection to product to customize to measure to bag to checkout (stopping before any real order), once entering from a real URL and once from a hash URL, on desktop and mobile viewports (the mobile check also closes the long open NAV-08 verification item).
- SEO basics page by page for a sample of each family: status, canonical, title, description, robots, sitemap presence, and the base element behaviour on the deepest URL.
- A final parity note appended to the gap analysis: NAV-01 marked implemented with the PR list, or the remaining families listed explicitly if the rollout stops early.

Acceptance criteria:
- No journey step loses customization, measurement or bag state when entered from a real URL (the Wave 1 to 3 suites already prove the state behaviour; this stage proves the entry paths).
- The sample SEO checks pass for every family, and any failure is either fixed in stage or recorded as a named follow up.
- Rollback remains the previous build throughout: no data model changed at any stage, so reverting is a redeploy, not a migration.

## 9. What the spike changed, for the record

Branch `spike/wave-4-real-urls` (local only), two commits: the proof code and this report.

```
apps/website/app/collections/suits/wool-suits/route.ts  (new)
apps/website/public/real-routes.js                      (new)
apps/website/public/index.html                          (base element, boot script tag)
apps/website/web/index.html                             (identical mirror edit)
apps/website/tests/real-urls.cjs                        (new suite)
apps/website/package.json                               (test chain)
docs/ux-audit/wave-4-spike.md                           (this report)
```

Decision requested from the owner: approve Mechanic A and the section 6 URL scheme, or send the spike back with changes. Stages 2 to 4 start only after that approval, per the wave rule.

## 10. Stage 2 addendum: compatibility and redirect layer (October 28, 2026)

Stage 2 is built on local branch `feat/nav-01-stage-2` (from the spike branch; nothing pushed). The owner approved Mechanic A and the section 6 scheme, and stage 2 implements the compatibility layer exactly as section 8 scoped it.

**What was built**

- `scripts/build-real-routes.cjs`, chained into the build immediately after `generate-catalog.cjs`, generates the route map from `data/reference-navigation.json` (canonical destinations and slugs) plus every key in `data/collections.json`. It emits `data/real-routes.json` (consumed by the server route) and `public/real-routes-data.js` (consumed by the boot script). Result on current data: **101 canonical paths, 42 alias paths, all 147 catalog keys covered**. Slug collisions, a canonical destination missing from the catalog data, an entry claimed by two different paths, or any catalog key left unresolved all throw, so the build fails loudly instead of shipping a partial map.
- `app/collections/[...slug]/route.ts`, one catch all route, replaces the spike's explicit Wool Suits route file (removed). It serves the shared storefront document for canonical paths with the root route's exact headers, answers alias paths and non-canonical forms (letter case, trailing slash) with a server side 308 redirect to the canonical path, and returns 404 for anything else under `/collections/`. It reads the path from the request URL rather than from route params, so validation does not depend on catch all param plumbing in the beta framework.
- `public/real-routes.js` keeps the spike contract (translate only when no hash is present, never override a hash) and now reads the generated full map instead of the hand written one entry map. Alias paths resolve through it to the canonical path's hash, so even if a document loads at an alias path, the rendered destination is the canonical one. Both HTML copies gained the `real-routes-data.js` script tag ahead of the boot script and remain byte identical under the existing guard.

**Catch all verdict: it works in this vinext beta, with evidence.** The production build route table lists `λ /collections/:slug+` alongside the previous five routes. Against the built server (wrangler on the build output, October 28, 2026):

| Request | Result |
| --- | --- |
| `GET /collections/suits`, `/jackets`, `/trousers`, `/shirts`, `/weddings`, `/more`, `/women` | 200 (all seven category roots) |
| `GET /collections/suits/wool-suits` and 10 more sampled canonical URLs across every family (Cocktail and Evening, Waistcoats, Gurkha Trousers, Liberty London Shirts, Wool Wedding Suits, Women Leather Trousers, More Fabric Samples, Accessories, Fabrics, Look Book All) | 200, 4,786 bytes, byte identical to the document at `/`, base element and boot data present |
| `GET /collections/pants/wool-pants`, `GET /collections/pants` | 308 to `/collections/trousers/wool-trousers`, `/collections/trousers` (server redirect, the plan's preferred canonical behaviour) |
| `GET /collections/suits/wool-suits/`, `GET /collections/Suits/Wool-Suits` | 308 to the canonical `/collections/suits/wool-suits` |
| `GET /collections/suits/not-a-collection`, `/collections/not-a-category`, `/collections/suits/wool-suits/extra`, `/collections` | 404 |
| `GET /`, `/api/payment/config`, `/app.js`, `/real-routes-data.js`, `/real-routes.js`, `/style.css`, `/assets/model-navy.webp` | 200, unchanged; the catch all shadows neither the API routes nor static assets |
| `GET /totally-unknown` | 404, unchanged |

**Deviations from the stage 2 plan.** None of substance. Two clarifications worth recording. First, the acceptance wording said every catalog key resolves "to exactly the hash route it names today"; for alias keys (lowercase spellings, the Shop all cross links, the Pants mirror) the map resolves to the canonical menu hash for the same catalog entry, which is the canonicalisation the plan itself specifies for aliases. The suite proves this by entry equality: resolving any of the 147 keys through the map lands on a hash whose catalog entry is deep equal to the key's own entry. Second, slug uniqueness is enforced in the generator (build failure) and independently asserted per category in the test suite, rather than only in the test chain.

**Tests.** `tests/real-urls.cjs` was rewritten for the full map: fresh generation equality with the committed artifacts, all 147 keys resolving, per category slug uniqueness, boot translation across every path in the map, handler behaviour (serve, redirect, 404), entry renders computed from the map (one root and one topic per menu category, plus Wool Suits in depth and the Pants alias rendering Wool Trousers), and the unchanged hash and root compatibility checks. New e2e journey J19 enters at the real Wool Suits URL and completes product, customize, measure, bag and checkout. Full chain: all suites pass (21 suites) and the root build exits 0.

**What stage 3 still owns** (unchanged from section 8): the remaining route families (product, fabrics, customize, measure, checkout, orders and the rest), internal links moving to real URLs, per route title and meta injection, the sitemap, and the two copies investigation. Rollback for stage 2 remains the previous build.

## 11. Stage 3a addendum: every route family and internal links (October 28, 2026)

Stage 3 is being delivered in two packages. This first package (local branch `feat/nav-01-stage-3a`, from main `97857cd`; nothing pushed) gives every route family in the section 6 scheme a server route and moves internal links to real URLs. Per route title and meta injection, the sitemap and the two copies investigation remain with the second package, as sequenced by the lead agent.

**Routes added** (all serve the shared storefront document with the root route's headers; the boot script translates each path into its hash route):

- `app/fabrics/[kind]/route.ts`: `/fabrics/suit` and `/fabrics/shirt` serve; the valid kinds come from the generated map and mirror the merchant dispatch; any other kind 404s; case and trailing slash forms of a valid kind 308 to the canonical path.
- `app/studio/[kind]/route.ts`: `/studio/suit`, `/studio/jacket`, `/studio/pants` serve; kinds from the generated map, mirroring the expanded dispatch; unknown kinds 404; non-canonical forms 308.
- `app/product/[id]/route.ts`: the id is validated against the product id ranges the generator computes from `data/catalog.json`. An existing id serves (`/product/0`, `/product/1964`, `/product/2244` verified); a non-numeric id or an id the catalog does not hold (`/product/2245`, `/product/99999`, `/product/abc`) 404s; leading zero and trailing slash spellings of an existing id 308 to the canonical path.
- `app/orders/[id]/route.ts`: serves the shell for any single segment id, with the reason recorded in the file: order ids live in the shopper's browser storage or in server order records the shell cannot enumerate, so the server confirms nothing and the client keeps rendering its own not found state (the orders list) for unknown ids, exactly as the `#order/<id>` hash route does today.
- One route file per single segment page: `/customize`, `/measure`, `/checkout`, `/orders`, `/gift-cards`, `/help`, `/locations`, `/shipping`, `/privacy`, `/terms`, `/fit-support`, `/clone`, `/charges`, `/payment-return`.

**The generated map grew with the families.** `scripts/build-real-routes.cjs` now also emits `pages` (the 14 single segment paths and their hash routes), `families` (fabrics and studio kind lists, the product id ranges compressed from the catalog, and the orders marker) and a full `reverse` map (every hash route that has a real URL, including the pages and `#home` to `/`), into both `data/real-routes.json` and `public/real-routes-data.js`. Collisions between a page path and a collection path, duplicate or invalid catalog ids, and the stage 2 collision rules all still fail the build loudly.

**One chain fix the evidence forced.** The product ranges are only correct if the generator reads the final catalog, but `data/catalog.json` is appended to by three scripts in sequence: `generate-catalog.cjs` writes 1,759 entries, `build-merchant-catalog.cjs` and `build-suit-edits.cjs` grow it to 2,245. With the stage 2 chain position, the generator read the intermediate catalog and the built server 404'd `/product/1964` (measured). The generator now runs after `build-suit-edits.cjs` in the `build` chain, and the route map suite guards the invariant: it regenerates the map from the final catalog and compares it with the committed artifacts, so a reorder that breaks this fails the suite after a build.

**Internal links.** `menuLink` in `navigation.js` computes each destination exactly as before, then translates it through `realUrlForHash` in the boot script, so the menus render real hrefs with identical labels, ordering and destination sets. The rendered templates follow: static links are written as real paths directly (home tiles and sections, the footer in the shell and in `complete.js`, breadcrumbs to home, the policy and help links), product, order and fabrics links use their real path forms (`/product/<id>`, `/orders/<id>`, `/fabrics/<kind>`), and the links computed from a category or topic name (filter chips, the product page breadcrumb, the studio page's collection link, the merchant fabric tiles) translate through `realUrl`, an alias defined in `app.js` that delegates to `realUrlForHash` when the boot data is loaded (it always is in the served document) and keeps the hash form in compositions without it. The story route is carried by the same translation: `realUrlForHash('#story')` returns `/#craft`, the fragment form the scheme specifies. In-app behaviour after entry is unchanged: functions that navigate by setting `location.hash` (chooseProduct, beginDesign, the checkout flow) keep working within the loaded document, and hash URLs opened at `/` render exactly as before, both proven in the suites.

**Deviations and notes.**

1. The build chain reorder described above: the only change to shared build behaviour in this package, and it is required for correct product routes.
2. No rendered `#story` link exists anywhere in the current storefront (the route is supported by the render dispatch but nothing links to it), so there was no story anchor to migrate; the mapping lives in the link translation and is asserted there.
3. The studio entry is covered at the handler, boot and menu levels, not by a vm entry render: `initStudio` dynamically imports the studio bundle, which the vm harness cannot do. A live browser check of the studio and of every family on desktop and mobile viewports remains stage 4 work, as the plan schedules.
4. Uppercase spellings of single segment page paths (for example `/Measure`) 404 at the framework level, because those routes are explicit files rather than a catch all; canonical links and the sitemap always emit the lowercase form, the same position the spike report recorded for collections in risk 6.

**Tests.** `tests/real-urls.cjs` now covers the full map (fresh generation equality including pages, families and reverse; product ranges covering exactly the 2,245 catalog ids), boot translation for every page and representative family paths (unknown kinds and product ids map to nothing; order id case is preserved), every new handler (serve, 308, 404 per family), entry renders for the product, fabrics, order, customize, measure and checkout families, and a menu parity section: 96 rendered anchors with the baseline labels in order and the baseline set of 94 destinations, every href a real path resolving through the map or a family pattern. Existing suites were updated only where the href form intentionally changed: e2e J1 (menu destinations and the 3D entries), J8 and J10 (product card hrefs, menu lookups by real URL), and `tests/listing-labels.cjs` (menu anchors resolved back through the generated map for the listing dispatch; its inventory counts are unchanged). New e2e journey J20 enters at a real product URL and completes customize, measure, bag and checkout; J19 passes unchanged. Full chain: all 21 suites pass and the root build exits 0.

**Built server verification** (wrangler on the build output, October 28, 2026): every family URL returns 200 with the shell (`/collections/suits/wool-suits`, `/fabrics/suit`, `/fabrics/shirt`, `/product/0`, `/product/1964`, all 14 page paths, `/orders/DEMO-ABC123`, `/studio/suit`, `/studio/jacket`, `/studio/pants`), the shell at `/product/1964` is byte identical to the shell at `/`, `/api/payment/config`, `/app.js`, `/real-routes-data.js` and `/assets/model-navy.webp` return 200, `/product/99999`, `/product/2245`, `/product/abc`, `/not-a-page`, `/fabrics/wool`, `/studio/tuxedo` and an unknown collection slug return 404, and `/product/01964`, `/fabrics/Suit`, `/collections/pants` and a trailing slash collection URL answer 308 to their canonical forms. The build route table now lists 24 routes: the previous six plus the 14 pages, `/fabrics/:kind`, `/product/:id`, `/orders/:id` and `/studio/:kind`.
