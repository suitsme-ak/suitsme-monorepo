# Wave 5 design and sizing: standalone accounts (Option B)

Status: design and sizing only. No feature code is written by this document.
Decision recorded: on 2026-10-28 the owner chose Option B, a standalone account system inside the app (email and password, plus Google sign in), over Option A (building on the hosting gateway identity). The implementation plan (`docs/ux-audit/implementation-plan.md` section 9) sized Option A at 8 to 12 days and deferred Option B sizing to this document. Gaps covered: ACC-01 (no account system exists; profiles and orders are browser local only) and SIZ-04 (measurement profiles do not persist beyond one browser).

Every load bearing claim below was verified against the code on main at `5086f13` on 2026-10-28. Anything not verifiable in the repo is marked **Unverified** with the reason and the package that must verify it.

## 0. Verified current state

### 0.1 Server surface

- Four API routes exist, all thin files delegating to one dispatcher: `app/api/checkout/route.ts`, `app/api/orders/[id]/route.ts`, `app/api/payment/config/route.ts`, `app/api/authorize/webhook/route.ts`. Each exports GET and POST that call `commerce(request, env)` in `lib/commerce.ts`, with `env` imported from `cloudflare:workers`.
- `lib/commerce.ts` is the whole server commerce surface. Identity today is one line: `const owner = request.headers.get('oai-authenticated-user-id')`. Checkout and order reads return 401 `Please sign in to continue.` when the header is absent. Consequence worth stating plainly: **a real (non demo) checkout is impossible today without the platform gateway identity**, because demo mode is the only path that skips the API. Option B therefore changes who can check out for real, not just where profiles live.
- The only origin check on any POST today is inside the checkout branch (`Origin` header must equal the request origin, else 403). The webhook is authenticated by the Authorize.Net HMAC signature instead.
- `app/chatgpt-auth.ts` reads the gateway headers `oai-authenticated-user-id`, `oai-authenticated-user-email` and `oai-authenticated-user-full-name`, and builds sign in and sign out URLs at `/signin-with-chatgpt` and `/signout-with-chatgpt`, with `/callback` as the gateway callback path. These paths are platform owned. The app must never register its own routes there.
- `apps/website/README.md` already anticipates this wave, in its own words: payment ownership uses the trusted gateway header, and a different host "must replace that dependency with verified server-side session authentication and strip any client-supplied identity header". The dev middleware does the stripping locally: `scripts/vite/sites-vite-plugin.ts` deletes every incoming `oai-authenticated-user-*` header before injecting its mock identity, and passes ordinary application cookies through untouched (it removes only its own `__sites_local_auth` cookie from the Cookie header). Production stripping is the gateway's job and is **Unverified** in repo evidence; the design therefore never accepts identity from any client supplied header other than the gateway owned ones the platform controls.
- The worker entry is `worker/index.ts`, which delegates to the vinext fetch handler. There is no middleware layer today. All server logic lives behind the route files above.

### 0.2 Database

- One table exists: `store_orders` (id, owner, idempotency_key, items, shipping, subtotal_cents, shipping_cents, tax_cents, total_cents, status, transaction_id, created_at), with unique indexes on (owner, idempotency_key) and (transaction_id). Items and shipping are JSON text columns. Orders are created with raw SQL through `env.DB.prepare(...)` in `lib/commerce.ts`; order ids are `SM` plus 16 upper case hex characters from `crypto.randomUUID()`.
- `db/schema.ts` holds the drizzle definition of `store_orders` and `db/index.ts` exports a `getDb()` drizzle helper. **Nothing imports `getDb()` anywhere in `app/`, `lib/`, `worker/` or `components/`** (verified by search). The drizzle layer is currently migration scaffolding only; runtime data access is raw D1 SQL. This design follows that reality: new runtime code uses raw SQL in the commerce style, and `db/schema.ts` remains the migration source of truth.
- Migrations live in `drizzle/` (one migration, `0000_furry_hardball.sql`). `pnpm db:generate` (drizzle-kit, in devDependencies) generates new ones from `db/schema.ts`. The sites plugin's `closeBundle` copies `.openai/hosting.json` and the whole `drizzle/` directory into `dist/.openai/` at build time, which is how migrations and the binding name reach the deployment. How and when the hosting control plane applies those migrations to the production D1 database is platform behaviour with no code in this repo: **Unverified**. Package 5.1 includes confirming the new tables exist on the deployed database before the accounts feature is switched on.
- The D1 binding name is `DB`, declared in `.openai/hosting.json` (`{"d1": "DB", "r2": null}`) and typed as optional in `cloudflare-env.d.ts`. There is no KV namespace, no rate limiting binding, and no R2 bucket configured. Any design element that needs a store has exactly one choice: D1.

### 0.3 Dependencies and runtime

- `apps/website/package.json` dependencies include `drizzle-orm` 0.45.2, `zod`, `react-hook-form`, `next` 16.3.4 and `vinext` 1.0.0-beta.5. There is **no auth or password hashing library**: no bcrypt, argon2, scrypt, jose, jsonwebtoken or OAuth client package anywhere in the dependency list. `wrangler` 4.92.0 and `@cloudflare/workers-types` 4.20260515.1 are devDependencies.
- The storefront client is vanilla JavaScript in `public/` (no framework components are rendered for shopper pages). Server code already uses WebCrypto in production paths: `crypto.subtle` HMAC verification and `crypto.randomUUID()` in `lib/commerce.ts`. WebCrypto, including PBKDF2 through `crypto.subtle.deriveBits`, is part of the Workers runtime surface the types package describes.
- `vite.config.ts` sets `compatibility_flags: ["nodejs_compat"]` in the binding config the Cloudflare Vite plugin consumes. Whether the deployed worker runs with that flag, and what iteration ceiling the runtime enforces on PBKDF2 if any, cannot be settled from repo files: **Unverified**, and package 5.0 exists to settle both on the built worker before the auth packages commit to parameters.
- Env configuration reaches server code as properties on the `cloudflare:workers` env object (`ANET_API_LOGIN_ID`, `COMMERCE_APPROVED`, `SHIPPING_CENTS`, `TAX_QUOTE_URL`, `TAX_QUOTE_TOKEN` are the existing examples). Secrets are set through the hosting control plane, never committed; the README states this rule for the Authorize.Net keys and this design follows it for the new keys. The existing `TAX_QUOTE_URL` plus bearer token pattern is the in codebase precedent for calling an external HTTPS service from the worker with `fetch`.

### 0.4 Client storage today

localStorage keys and shapes, from `public/app.js` and `public/complete.js`:

- `suits-profiles`: array of measurement profiles. A profile is the measurement draft object plus identity fields: `{step, method: 'body' | 'ready', unit: 'in' | 'cm', values: {chest, waist, shoulder, sleeve, jacket, seat, trouserWaist, thigh, inseam, outseam}, ready: {jacket, length, trouser}, name, fit, wearer: 'Men' | 'Women' | 'Boys', id: <client uid>, created: <ISO timestamp>}`. The `step` field is transient wizard state and is not part of the persisted meaning.
- `suits-bag`: array of bag items (product, fabric, every customization selection, and an embedded profile snapshot). Unchanged by this wave.
- `suits-orders`: array of orders recorded in this browser. Demo orders look like `{id: 'DEMO-…', created, items, shipping, total: <dollars>, status: 'Demo order recorded', demo: true}`. Paid orders fetched back from `/api/orders/<id>` after the payment return are unshifted into the same array with `demo: false`. The orders page copy today reads "Orders saved on this browser.", which is the ACC-01 gap in one sentence.
- `suits-config`, `suits-draft`, `suits-checkout`, `suits-checkout-attempt`, `suits-pending-order`, `suits-clone-plan`: working state, untouched by this design.
- The client calls `/api/orders/<id>` with a plain `fetch` (see `paymentReturnPage` in `public/complete.js`), which sends same origin cookies by default. A cookie based session therefore reaches the existing API shape without client auth plumbing.
- There is no sign in, register or account string anywhere in the client today. The header (`public/index.html`, `.head-actions`) holds a measurement shortcut link, a profiles button and the bag button; that row is where account entry points land.
- New pages are cheap since Wave 4: a page is one `app/<path>/route.ts` serving the shell, one entry in the `PAGES` table of `scripts/build-real-routes.cjs`, one head entry consumed by `lib/route-head.ts`, and one branch in the client `render()` switch in `public/complete.js`. `tests/real-urls.cjs` guards the set.

## 1. Data model

All new tables are additive. `store_orders` is not altered, so the migration is a set of `CREATE TABLE` statements with no rewrite of existing rows and no risk to the Wave 6 commerce path. Definitions are added to `db/schema.ts` in the existing style and the migration is generated with `pnpm db:generate` (expected output `drizzle/0001_*.sql`), which the build ships automatically (section 0.2).

Owner keying decision, stated once and used everywhere: an app account's orders and data are keyed by the string `app:` followed by the user id (`app:U…`). Gateway identified orders keep the raw gateway user id as `owner`, exactly as today. The two namespaces cannot collide because gateway ids are platform issued and never begin with the literal prefix the app mints for itself, and the app never writes an unprefixed owner.

```ts
// db/schema.ts additions (drizzle, sqlite dialect, existing style)
import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                    // 'U' + 32 hex chars from crypto.randomUUID(), mirroring the SM order id pattern
  email: text('email').notNull(),                 // stored trimmed and lower cased; the only form ever queried
  displayName: text('display_name'),
  emailVerifiedAt: text('email_verified_at'),     // null until the verification link is used
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),                  // soft delete posture, see section 8 question 3
}, table => [uniqueIndex('user_email').on(table.email)]);

export const userCredentials = sqliteTable('user_credentials', {
  userId: text('user_id').primaryKey(),           // one password per user; Google only users have no row
  passwordHash: text('password_hash').notNull(),  // self describing string, section 3.1
  passwordUpdatedAt: text('password_updated_at').notNull(),
});

export const userIdentities = sqliteTable('user_identities', {
  provider: text('provider').notNull(),           // 'google' in v1
  subject: text('subject').notNull(),             // the provider's stable subject id (Google 'sub')
  userId: text('user_id').notNull(),
  email: text('email'),                           // provider email at link time, for display and support only
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.provider, table.subject] }), index('identity_user').on(table.userId)]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),     // SHA-256 hex of the session token; the token itself is never stored
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  expiresAt: text('expires_at').notNull(),        // absolute expiry, 30 days from creation
}, table => [index('session_user').on(table.userId)]);

export const authTokens = sqliteTable('auth_tokens', {
  tokenHash: text('token_hash').primaryKey(),     // SHA-256 hex of the emailed token
  userId: text('user_id').notNull(),
  purpose: text('purpose').notNull(),             // 'verify' or 'reset'
  expiresAt: text('expires_at').notNull(),        // verify: 24 hours; reset: 1 hour
  usedAt: text('used_at'),                        // set on first use; tokens are single use
  createdAt: text('created_at').notNull(),
}, table => [index('auth_token_user').on(table.userId, table.purpose)]);

export const authAttempts = sqliteTable('auth_attempts', {
  key: text('key').primaryKey(),                  // e.g. 'signin:email:<email>' or 'signin:ip:<ip>'
  count: integer('count').notNull(),
  windowStartedAt: text('window_started_at').notNull(),
  lockedUntil: text('locked_until'),
});

export const accountProfiles = sqliteTable('account_profiles', {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),                       // the client uid from suits-profiles, preserved so import is idempotent
  data: text('data').notNull(),                   // the profile object as JSON, minus the transient step field
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] })]);

export const accountOrderSnapshots = sqliteTable('account_order_snapshots', {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),                       // the local order id, e.g. 'DEMO-…'
  data: text('data').notNull(),                   // the local order object as JSON, stored verbatim
  importedAt: text('imported_at').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] })]);
```

Design notes on the model:

- Password hashes live in their own table so the general user row, which other code will read with `SELECT *` in the commerce style, never carries a hash.
- Profiles and imported orders store the client object as JSON text, the same storage pattern `store_orders` already uses for items and shipping. The client shapes are the contract (Wave 1 to 3 suites pin them), so flattening them into columns would buy nothing and risk drift.
- Imported local orders go to `account_order_snapshots`, never into `store_orders`. `store_orders` is the payment record; writing unpaid demo records into it would corrupt Wave 6 reporting, idempotency and webhook matching. Snapshots are view only history (section 5).
- Sessions and one time tokens store only SHA-256 hashes, so a database read never yields a usable credential. SHA-256 is sufficient here (unlike for passwords) because the tokens are 256 bit random values, not human chosen secrets.

### 1.1 Coexistence with the gateway identity

One resolver, used by every authenticated route, in this order:

1. If the request carries a valid app session cookie (section 2), the owner is `app:<user id>` and the user is the app account.
2. Else, if the gateway header `oai-authenticated-user-id` is present, the owner is that value, exactly as `lib/commerce.ts` behaves today.
3. Else the request is a guest: public routes proceed, account routes return 401.

Rules that follow:

- The app session wins when both exist. The shopper explicitly signed in to the shop account; silently keying their order to a platform identity they may not know they have would split their history.
- Gateway identified orders are never re keyed automatically. An app account whose verified email matches the gateway email header is **not** merged in v1: the app has no proof the two identities are operated by the same person beyond an email string, and order rows are payment records. Gateway orders stay readable through gateway authenticated requests, unchanged. Whether to offer an explicit claim step later is an owner question (section 8, question 4).
- `lib/commerce.ts` changes are confined to owner resolution: the single header read is replaced by the resolver, shared with the accounts dispatcher. Every other commerce behaviour (pricing, idempotency, webhook) is untouched, and `tests/commerce.cjs` must pass with its existing header based cases unmodified, plus new cases for the cookie path and the precedence rule.
- No route ever accepts an owner, user id or email from the request body or query string. Identity comes from the session cookie or the gateway header only.

## 2. Authentication flows

Server shape, following the existing pattern exactly: a new dispatcher `accounts(request, env)` in `lib/accounts.ts`, structured like `commerce()`, with thin route files under `app/api/auth/` and `app/api/account/` that import `env` from `cloudflare:workers` and delegate. All responses use the commerce `reply()` conventions: JSON, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

A readiness gate mirrors `settings()` in `lib/commerce.ts`:

- `accountsEnabled(env)` is true only when `env.DB` exists and the email settings of section 4 are present. When false, every `/api/auth/*` and `/api/account/*` route returns 503 `{error: 'Accounts are not enabled yet.'}`, except `GET /api/auth/me`, which returns `{user: null, enabled: false}` so the client can hide entry points the way it already reads `/api/payment/config` for the payment mode.
- `googleEnabled(env)` additionally requires the Google settings of section 2.7. When false, the Google button is not rendered and the Google routes return 503.

### 2.1 Register

- Screen: `/register` page (hash `#register`), linked from `/sign-in` and from the header entry point. Fields: name, email, password. Copy states what happens next in one line: "We will email you a link to confirm your address. Your measurements stay on this device until you sign in."
- `POST /api/auth/register` with `{name, email, password}`. Email is trimmed and lower cased; password is checked against section 3.2.
- Response is **always** `202 {ok: true, message: 'Check your email to finish creating your account.'}`, in three cases that must stay indistinguishable (section 3.5):
  - New email: create `users` row (unverified) and `user_credentials` row, mint a `verify` token (24 hours), send the verification email.
  - Email already registered and verified: create nothing, send a "someone tried to register with your email" notice to that address.
  - Email registered but unverified: replace the password hash with the newly submitted one, mint a fresh `verify` token, resend. Whoever owns the mailbox completes registration and sets the final password in the same act, which closes the squatting hole without a support process.
- No session is created by registration. The first session is created by the verification link (2.2) or by sign in (2.3). This is what makes the uniform 202 honest.

### 2.2 Verify email

- The email links to `/verify-email?token=<token>` (real route plus `#verify-email` hash route, like every Wave 4 page). The page explains itself and, on load, posts the token.
- `POST /api/auth/verify-email` with `{token}`. The server hashes the token, looks it up with purpose `verify`, not used, not expired. Success: set `email_verified_at`, mark the token used, delete any other outstanding verify tokens for the user, create a session (2.3 cookie), respond `200 {user}`. The client lands on `/account` and immediately runs the guest migration prompt (section 5).
- Failure of any kind (unknown, used, expired) returns the identical `400 {error: 'This link is invalid or has expired.'}` and the page offers a resend field.

### 2.3 Sign in and sign out

- Screen: `/sign-in` (hash `#sign-in`), fields email and password, links to `/register` and `/forgot-password`, plus the Google button when enabled. Accepts a `returnTo` parameter validated with the same relative path rules `app/chatgpt-auth.ts` already uses (must start with `/`, never `//`, never an auth path); invalid values fall back to `/account`.
- `POST /api/auth/sign-in` with `{email, password}`:
  - Look up the user by normalized email. If there is no credential row, run one PBKDF2 verification against a fixed dummy hash so response time does not reveal whether the account exists (section 3.5).
  - Wrong password, unknown email, locked out (section 3.4): identical `401 {error: 'Email or password is not correct.'}`.
  - Correct password on an unverified account: mint a fresh verify token, resend the email, return `403 {error: 'Please confirm your email first. We have sent you a new link.'}`. This response is only reachable with the correct password, so it leaks nothing to anyone else.
  - Correct password on a verified account: create a session, set the cookie, `200 {user: {id, email, name, emailVerified: true}}`.
- The session cookie: name `suitsme-session`; value is 32 random bytes, base64url; attributes `HttpOnly; Secure; SameSite=Lax; Path=/`; `Max-Age` 30 days matching the absolute expiry in `sessions.expires_at`. Only the SHA-256 hash is stored (section 1).
- Session lifetime: absolute expiry 30 days from creation. Idle handling: `last_seen_at` is updated at most once per day per session, and a session idle for more than 14 days is treated as expired on next use and deleted. There is no refresh token and no silent re issue; when the session ends, the shopper signs in again. This is a deliberate simplicity choice for a shopper account, stated so it can be challenged.
- `POST /api/auth/sign-out`: deletes the session row, clears the cookie with `Max-Age=0`, returns `200 {ok: true}`. Origin checked (section 3.6). The client then re renders as a guest; local profiles, bag and local orders are untouched.
- `GET /api/auth/me`: `200 {user: null, enabled}` for guests, `200 {user, enabled: true}` with a valid session. Never an error status for guests; the header renders from this at boot.

### 2.4 Forgot and reset password

- Screen: `/forgot-password` (hash `#forgot-password`), one email field.
- `POST /api/auth/forgot-password` with `{email}`: **always** `202 {ok: true, message: 'If an account matches that email, a reset link is on its way.'}`. If a verified account exists and the send caps of section 3.4 allow, mint a `reset` token (1 hour) and email `/reset-password?token=<token>`. Unverified accounts get no reset email; their recovery path is the register flow of 2.1, which is stated in the help copy, not in the API response (which stays uniform).
- Screen: `/reset-password` (hash `#reset-password`), new password field plus confirmation, posts `{token, password}`.
- `POST /api/auth/reset-password`: validate the token (purpose `reset`, unused, unexpired), set the new hash, mark the token used, **delete every session for the user**, create one fresh session and set its cookie, `200 {user}`. Any token failure returns the same `400` as 2.2.
- `POST /api/auth/change-password` (signed in) with `{currentPassword, newPassword}`: verifies the current password, sets the new hash, deletes the user's other sessions, rotates the current session (new token, new cookie). Wrong current password returns the sign in 401 body.

### 2.5 Account screens and entry points

All in the existing storefront style: server rendered shell pages whose content is vanilla JS template strings in `public/complete.js` and `public/app.js`, modals via the existing `openModal`, forms via the existing labelled field markup.

- Header (`.head-actions` in `public/index.html`): guests see a "Sign in" text link beside "Your measurements" when accounts are enabled; signed in shoppers see an account button with their initial, opening a small menu: My account, My orders, Sign out. Hidden entirely when `enabled` is false, so nothing half launched is visible.
- `/account` (hash `#account`): name, email, verification state, links to orders and profiles, change password form, sign out. No settings exist beyond this in v1.
- Checkout (`checkoutPage` in `public/complete.js`): a slim strip at the top of step 1. Guests: "Have an account? Sign in to use your saved measurements." Signed in: "Signed in as <email>. Your profiles sync to your account." The guest checkout path is byte for byte the current one; the strip is additive.
- Measurement studio (`measure` flow and `openProfiles` in `public/app.js`): the profiles modal gains one line of status. Guests: "Profiles are saved on this browser. Sign in to keep them with your account." Signed in: "Profiles save to your account and this browser." Saving a profile while signed in writes through to the API (section 5.2); the flow itself does not change.
- Auth pages (`/sign-in`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) are state pages: `noindex` heads through `lib/route-head.ts`, exactly like checkout and orders today.

### 2.6 Profiles and orders API (used by sections 5 and 6)

- `GET /api/account/profiles`: `200 {profiles: [<profile objects>]}` for the session user, ordered by creation.
- `POST /api/account/profiles`: body `{profile}` creates or replaces by (user, profile.id), with the same server side validation spirit as `cleanItems` (method must be `body` or `ready`; body values must be finite numbers in the 8 to 100 range the commerce code already enforces, wearer one of Men, Women, Boys; ready selections within the size ranges). Returns the stored profile.
- `DELETE /api/account/profiles/:id`: removes the row; deleting a profile that is not the user's is a 404, indistinguishable from nonexistent.
- `POST /api/account/import`: body `{profiles: [...], orders: [...]}` for the first sign in migration. Idempotent by primary key: rows that already exist are skipped, never overwritten. Response `200 {profilesImported, profilesSkipped, ordersImported, ordersSkipped}`.
- `GET /api/account/orders`: `200 {orders: [...]}` combining the user's `store_orders` rows (same JSON shape as `GET /api/orders/:id` returns, newest first) with their snapshots, each snapshot marked `demo: true` and `imported: true`. The orders page renders both lists in one history, snapshots badged as demo records.

### 2.7 Google sign in

Authorization code flow, implemented with plain `fetch` (no new dependency), mirroring how `lib/commerce.ts` already calls Authorize.Net:

- `GET /api/auth/google/start?returnTo=<path>`: mint a 32 byte `state`, store it in a short lived (10 minutes) `HttpOnly; Secure; SameSite=Lax` cookie `suitsme-oauth-state` together with the validated returnTo, then `302` to `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri` = `<origin>/api/auth/google/callback`, `response_type=code`, `scope=openid email profile`, `state`, `prompt=select_account`.
- The callback is **not** `/callback`: that path belongs to the gateway auth (section 0.1). The Google console registration must use `/api/auth/google/callback` exactly.
- `GET /api/auth/google/callback?code&state`: compare `state` to the cookie (mismatch or missing: clear the cookie, land on `/sign-in?error=google`). Exchange the code at `https://oauth2.googleapis.com/token` with the client secret (server side only). Verify the returned `id_token` before trusting any claim: fetch Google's JWKS from `https://www.googleapis.com/oauth2/v3/certs`, verify the RS256 signature with WebCrypto, and check `iss`, `aud` equals the client id, and `exp`. Read `sub`, `email`, `email_verified`, `name`.
- Resolution, in order:
  1. An identity row `(google, sub)` exists: sign in as that user.
  2. Else, if `email_verified` is true and a user with that normalized email exists: link (insert the identity row), and if that user was unverified, set `email_verified_at`, since Google has proved mailbox ownership. Sign in.
  3. Else, if `email_verified` is true and no user exists: create the user already verified, insert the identity row, no credential row. Sign in, land on `/account` with the migration prompt.
  4. If `email_verified` is not true: refuse with a sign in page error asking the shopper to use email and password. The app never links or creates accounts on an unverified provider email.
- What is stored: the identity row only (provider, subject, user id, provider email at link time). No Google tokens are stored; there is no offline access request, so there is nothing to refresh and nothing extra to leak.
- Password interplay: a Google created user has no password. They can set one later through the forgot password flow (which works for them because their email is verified) or a "set a password" variant of change password that skips the current password check when no credential row exists. Both paths are in package 5.7's scope.

## 3. Security requirements

Each requirement is written to be testable in the harness style of section 6.

### 3.1 Password hashing

- Algorithm: PBKDF2 with HMAC SHA-256 through WebCrypto `crypto.subtle.deriveBits`. It is the only password KDF the runtime provides without a new dependency: the dependency list (section 0.3) has no argon2 or bcrypt package, and adding a WASM KDF is a supply chain and bundle decision this design does not take for v1.
- Parameters: 16 byte random salt per password from `crypto.getRandomValues`; derived key 32 bytes; iteration count is the highest value package 5.0 verifies the built worker accepts and performs acceptably, targeting the OWASP recommendation of 600,000 for PBKDF2 HMAC SHA-256. If the runtime ceiling is below target, the package adopts the highest verified count and records the shortfall in its PR; it does not silently ship a weaker number.
- Storage format is self describing so parameters can rise later: `pbkdf2-sha256:<iterations>:<salt base64url>:<hash base64url>` in `user_credentials.password_hash`. On a successful sign in, if the stored parameters differ from the current ones, the password is rehashed and the row updated.
- Comparison: derive with the stored parameters and compare digests with a constant time equality over the full 32 bytes.
- Named alternative, not adopted without evidence: scrypt through `node:crypto` under the `nodejs_compat` flag, which `vite.config.ts` sets in the plugin binding config. Whether that flag and `crypto.scrypt` are live in the deployed worker is **Unverified**; package 5.0 may spike it, and the self describing format makes a later algorithm swap a data migration of one column, not a redesign.

### 3.2 Password policy

- Minimum 12 characters, maximum 128. No composition rules (no forced symbols or cases), per current NIST guidance.
- The password may not equal the account email or its local part.
- A small built in list of the most common passwords (a few hundred entries, shipped as data in `lib/accounts.ts`) is rejected with "That password is too common. Try a longer phrase."
- Password managers and paste must work: no `onpaste` blocking, correct `autocomplete` attributes (`new-password`, `current-password`) on every field. This is a testable markup assertion in the client suites.

### 3.3 Sessions

- Token: 32 bytes from `crypto.getRandomValues`, base64url encoded (43 characters). Only its SHA-256 hash is stored.
- Cookie: `suitsme-session`, `HttpOnly; Secure; SameSite=Lax; Path=/`, `Max-Age` 30 days. Never readable from JavaScript; the client learns identity only from `GET /api/auth/me`.
- Rotation: a new token is minted on every sign in (any method), on password change, and on password reset; the previous token's row is deleted in the same request. Password reset and change delete all other sessions for the user (3.4 of flows, section 2.4).
- The dev preview passes application cookies through to the worker (section 0.1, verified in the plugin source). Whether the production gateway passes an unknown cookie name through untouched is **Unverified** from repo evidence alone; package 5.0 verifies it against the deployed site by setting and reading back a probe cookie through the new session route in a pre launch check, before any account UI ships.

### 3.4 Rate limiting and lockout

There is no rate limiting binding, KV or dashboard rule in the repo (section 0.2), so v1 rate limiting is D1 backed via `auth_attempts`, keyed by the **submitted identifier**, never by whether an account exists:

- Sign in: key `signin:email:<normalized submitted email>` and key `signin:ip:<ip>`. Five consecutive failures on the email key locks it for 15 minutes; twenty failures on the IP key in 15 minutes locks it for 15 minutes. While locked, sign in attempts return the same 401 body as a wrong password (even with the correct password; the lock is on the identifier, and the response must not reveal which state occurred). A successful sign in clears the email key's counter.
- The IP source is the `cf-connecting-ip` header. Whether this hosting surfaces that header to the worker is **Unverified** (nothing in the repo reads it today); if it is absent, the email dimension still applies and package 5.2 records the gap rather than inventing a header.
- Email sending endpoints (register, resend verification, forgot password): per normalized email, at most 3 sends per hour; per IP, at most 10 sends per hour across all three endpoints (one shared `email-send:` key space). When a cap is hit the endpoint still returns its uniform success response and simply does not send.
- Counters are approximate by design (D1 writes are not transactional counters under concurrency). That is acceptable for a lockout posture; the document does not claim hard guarantees.

### 3.5 No account enumeration

- Sign in failure is one body and one status for unknown email, wrong password and lockout: `401 {error: 'Email or password is not correct.'}`.
- Unknown email sign ins perform one dummy PBKDF2 verification against a fixed published dummy hash with the current parameters, so the response time matches a real wrong password attempt within measurement noise. Package 5.2 includes a timing smoke check in its notes (not a unit assertion, since CI timing is noisy).
- Register, forgot password and resend verification always return their uniform 202 bodies regardless of account existence (sections 2.1 and 2.4).
- Verify and reset token failures share one 400 body. Profile and order reads for another user's id return 404, never 403.
- `GET /api/auth/me` returns `user: null` for guests and for invalid or expired cookies alike.

### 3.6 CSRF posture

The existing APIs were designed around a gateway header, which a cross site page cannot set, so only checkout bothered with an origin check. Cookie authentication changes the threat: the browser attaches the session cookie automatically. The posture is therefore:

- **Every** POST under `/api/auth/*` and `/api/account/*`, including sign in, register and sign out, requires the `Origin` header to equal the request origin, returning 403 otherwise, generalizing the exact check `lib/commerce.ts` already applies to checkout. When `Origin` is absent, `Referer` with a matching origin is accepted as a fallback for older browsers; with neither header present on a POST, the request is rejected.
- `/api/checkout` and `/api/orders/*` keep their existing behaviour and gain nothing new to configure: when the request is authenticated by the app cookie, the checkout origin check already applies; order reads are GETs and change no state.
- `SameSite=Lax` on the session cookie is the second layer: cross site POSTs do not carry the cookie in current browsers, so a forged form post arrives as a guest and fails authentication before any state changes.
- The Google flow uses the `state` cookie comparison (section 2.7) as its CSRF control, since its callback is a cross site GET by design.
- `GET /api/auth/google/start` changes no account state (it only sets the state cookie and redirects), which is why a GET is acceptable there; the state changing moment is the callback, gated by `state`.

### 3.7 Secrets handling

- New server side settings, set through the hosting control plane like the `ANET_*` keys, never in the repo, never in client code, never in chat: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the email settings of section 4 (`EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`). The client id alone is not a secret, but it is kept server side anyway because only server code uses it (the start route builds the Google URL).
- Local development uses the same names through the local env mechanism the `start` script already wires (`scripts/sites-env.mjs`); a local `.dev.vars` style file stays out of git. Package 5.1 adds the names to the README's secrets list alongside the Authorize.Net keys, with no values.
- Nothing in the account system logs passwords, tokens, full email bodies or provider responses. Error responses follow the commerce convention of short shopper safe messages.

## 4. The email dependency

**Survey result: there is no email capability anywhere in the repo or the described deployment.** Verified by search on 2026-10-28: no mailer library in `package.json`, no provider configuration, no send call in `app/`, `lib/`, `worker/`, `public/` or `scripts/` (no Resend, SendGrid, Postmark, MailChannels, SES, SMTP or nodemailer references at all), and no `EMAIL_*` environment name anywhere. The demo order page says the quiet part out loud: "No email sent for demo orders." Verification and password reset, as designed in section 2, cannot send a single message today.

Options, in the order this codebase would naturally adopt them:

1. **A transactional email provider with an HTTPS API** (the Resend, Postmark or SendGrid class of service). The worker sends with `fetch`, authenticated by a bearer API key, configured exactly like the existing tax service: `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`. No SDK, no new dependency, and the commerce test harness pattern (stubbed `fetch`) covers it. This is the recommended option.
2. **Cloudflare's own email sending**, if the hosting plan offers it as a binding. `hosting.json` declares only the D1 binding today and nothing in the repo evidences an email binding: **Unverified** that the platform can provide one. If the owner confirms it exists, it replaces option 1's settings with a binding and package 5.3 adjusts; the flow design does not change.
3. SMTP is not an option: Workers have no general outbound TCP for SMTP submission in this stack, and no dependency provides it.

**Owner inputs required** (blocking package 5.3 and any public switch on, not blocking the other packages): a provider account; an API key delivered as a server secret through the control plane (never through chat or git); a sending identity, meaning a from address on a domain the owner controls, with that domain's SPF and DKIM DNS records published by whoever manages DNS; and the reply posture for the from address (even a monitored no reply mailbox is a decision).

**Verdict: working email is a hard prerequisite for enabling accounts, and the honest interim posture is a gate, not a degraded launch.** Reasons, stated plainly:

- Without outbound email there is no password recovery at all. The first shopper who forgets a password loses the account and every synced profile with it, permanently. "Register now, add email later" manufactures exactly the support problem accounts exist to prevent.
- Without verification, mailbox ownership is unproven, which breaks the Google linking rule (2.7), the squatting remedy (2.1) and any future claim on gateway orders (1.1). The design's anti enumeration and anti squatting properties are built on the verification link; removing it removes them.
- The codebase already has the honest pattern for exactly this situation: commerce runs in a labelled demo mode until its secrets exist, gated by `settings()` in `lib/commerce.ts` and surfaced through `/api/payment/config`. Accounts copy it: until the email settings exist, `accountsEnabled(env)` is false, the endpoints return 503, the header shows no sign in link, and nothing about the guest experience changes. The system can be fully built and tested against a stubbed provider (the harness already stubs `fetch` for Authorize.Net the same way) while remaining invisible to shoppers.
- One launch sequencing consequence: the verification requirement means the first public version should ship with verification as designed, not as a fast follow. Deferring verification "temporarily" after launch would strand the accounts created in the gap in precisely the unrecoverable state above.

## 5. Guest migration

Trigger: the first successful sign in or verification on a browser that holds local data, and only then. Signing in never forces migration; it offers it, once, in these words and with these mechanics.

### 5.1 What the customer is told

Immediately after the first sign in (or the verification landing), a modal in the existing style:

> **Your measurements, saved to your account.**
> This browser has <N> measurement profiles saved. Add them to your account so they are there on any device? Your orders recorded on this browser (<M>) come along as view only history, marked as demo records. Nothing is removed from this browser.

Buttons: "Add to my account" and "Not now". "Not now" is remembered per account on this browser (a local flag `suits-import-dismissed:<user id>`), so the shopper is asked once, not every sign in. If they later change their mind, `/account` carries an "Import from this browser" button that runs the same call.

### 5.2 Mechanics

- The client posts the full local arrays to `POST /api/account/import` (2.6). Profiles are stored with their existing client ids, so a repeat import, from the same or another browser with the same local data, imports zero duplicates (the response reports imported versus skipped counts, and the modal confirms "Added <N> profiles; <M> were already in your account.").
- Local orders post as snapshots (section 1). They are labelled demo in the account history forever, because that is what they are; the import does not upgrade them into payment records.
- **Nothing is deleted locally.** Local profiles remain the guest fallback and the offline copy; after import, the signed in client treats the server list as the account's copy and keeps the local array mirrored on each successful write through (create, edit, delete while signed in go to the API first, then update local storage on success). If the API write fails, the local change is kept and the profiles modal shows "Not saved to your account yet" until a later successful sync; the design does not silently drop a measurement, per the program wide rule.
- The bag is never migrated. It is a working cart, not account data; it simply continues across sign in on the same browser, which is also what the parity gate checks.
- `suits-draft` (an in progress measurement) is not migrated either; it belongs to the wizard session on that device. A signed in shopper finishing the wizard saves the resulting profile through the normal write through path.
- Duplicate handling across devices: profiles are identified by their client id. The same profile imported from two browsers is one row. Two genuinely different profiles that happen to share a name are both kept; names are display text, not identity.
- The guest path stays fully functional forever: every local feature works signed out, demo checkout stays local, and no screen requires an account. This is the plan's step 1 ("guest path unchanged") made testable in section 6.

## 6. Parity gate

The plan's acceptance checklist, expressed as journeys in the repo's two existing harness styles. API journeys extend the `tests/commerce.cjs` pattern (transpile the lib with the repo's TypeScript, drive it with `Request` objects against a fake D1) in a new `tests/accounts.cjs`. Storefront journeys extend `tests/e2e-journeys.cjs` (vm worlds booting the real public scripts, fetch stubbed) as J24 to J26. All journeys must pass before Wave 5 is called done.

API journeys (tests/accounts.cjs):

- **A1, lifecycle:** register returns the uniform 202; verify with the emailed token creates a session cookie; `GET /api/auth/me` returns the user; sign out kills the session (subsequent `me` returns null); sign in with the same credentials returns a fresh, different session token.
- **A2, enumeration:** sign in with an unknown email, a wrong password, and a locked identifier return byte identical status and body; register and forgot password return identical 202 bodies for existing and non existing emails; a bad verify token and a bad reset token return the shared 400 body.
- **A3, lockout:** five failed sign ins lock the submitted email for 15 minutes, the correct password during lockout still returns the uniform 401, and a different email from the same browser is unaffected until the IP threshold is reached.
- **A4, reset:** forgot password issues a token; reset with it changes the password, revokes all prior sessions (old cookie returns null from `me`), and the token cannot be used twice.
- **A5, owner resolution:** with an app session cookie, `POST /api/checkout` writes the order with owner `app:<user id>`; with only the gateway header, owner is the header value (the existing commerce cases); with both, the app owner wins; with neither, 401 as today.
- **A6, profiles and import:** import of three profiles and two demo orders returns counts 3 and 2; a repeat import returns 0 imported and all skipped; another user's profile id reads as 404; profile validation rejects a body profile with an out of range value, mirroring the commerce range checks.
- **A7, CSRF:** every POST under `/api/auth/*` and `/api/account/*` with a foreign or missing origin returns 403 and changes no state (no user created, no session created, no token consumed).
- **A8, gating:** with email settings absent, `accountsEnabled` is false, register returns 503, and `me` returns `{user: null, enabled: false}`.

Storefront journeys (tests/e2e-journeys.cjs):

- **J24, signed in parity:** in a world whose stubbed `/api/auth/me` returns a user, the rendered menus and collection listings are identical to the guest world (same assertions the listing suites make), a suit is customized with priced options at the same totals the Wave 3 suites assert, the bag persists across a re render, and demo checkout completes to the order page. Byte level menu parity is the gate, not a sample.
- **J25, migration:** seed a world with two local profiles and one demo order; sign in through the stubbed endpoints, accept the import modal, and assert: the import call carried exactly the local arrays; the profiles modal now lists the profiles as account saved; the orders page shows the snapshot badged as a demo record; local storage still holds the originals.
- **J26, sign out restores the guest:** after sign out, the header shows Sign in again, local profiles remain usable in the customizer, and a full guest purchase journey (the J1 path) still completes.

Existing suites that must keep passing, unmodified except where a suite's own subject changed: all 21 suites in the `apps/website/package.json` test chain. Named explicitly because they are the ones this wave touches: `tests/commerce.cjs` (owner resolution), `tests/real-urls.cjs` (new auth pages join the page set), `tests/e2e-journeys.cjs` (J1 to J23 untouched, J24 to J26 added), `tests/listing-labels.cjs` and `tests/catalog.cjs` (header and menu parity).

## 7. Package breakdown and sizing

Estimates are engineer days for one engineer, including that package's tests, in the small PR style of Waves 1 to 4 (each package verified by the full suite and a root build before its PR opens). Sizes assume the design in this document is followed rather than re debated per package.

| Package | Scope | Main files | Blocked on owner input | Estimate |
| --- | --- | --- | --- | --- |
| 5.0 Verification spike | PBKDF2 iteration ceiling and timing on the built worker; session cookie round trip through the deployment path; whether `cf-connecting-ip` reaches the worker; how D1 migrations apply at deploy (with 5.1) | none (throwaway probes plus a findings note appended to this document) | No | 1 to 2 days |
| 5.1 Data model and gating | Schema additions, generated migration, `accountsEnabled` and `googleEnabled` gates, `lib/accounts.ts` dispatcher skeleton with the `me` endpoint, README secrets list updated | `db/schema.ts`, `drizzle/0001_*.sql`, `lib/accounts.ts`, `app/api/auth/me/route.ts`, `apps/website/README.md` | No | 2 days |
| 5.2 Email and password core | Register, verify, sign in, sign out, forgot, reset, change password; hashing, sessions, rate limiting, enumeration and CSRF controls of section 3; `tests/accounts.cjs` journeys A1 to A5, A7, A8 | `lib/accounts.ts`, `app/api/auth/*/route.ts`, `tests/accounts.cjs`, `apps/website/package.json` (test chain) | No (tested against a stubbed mailer) | 3 to 4 days |
| 5.3 Email sending | Provider integration behind `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM`; verify, reset and registration notice templates in suits.me's voice; send caps wired to `auth_attempts` | `lib/accounts.ts` (mailer section), env documentation in `apps/website/README.md` | **Yes: provider account, API key as a server secret, sender domain with SPF and DKIM** | 1 to 2 days |
| 5.4 Client screens and entry points | `/sign-in`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account` pages (route files, generator `PAGES` entries, heads); header sign in and account menu; boot time `me` fetch; checkout account strip; studio sync line | `public/index.html`, `public/app.js`, `public/complete.js`, `app/sign-in/route.ts` and siblings, `scripts/build-real-routes.cjs`, `lib/route-head.ts` data | No (entry points stay hidden until the gate opens) | 3 days |
| 5.5 Profiles sync and migration | Profiles API (list, upsert, delete), import endpoint, write through saving while signed in, migration modal and `/account` import button, failure surfacing copy | `lib/accounts.ts`, `app/api/account/profiles/route.ts`, `app/api/account/import/route.ts`, `public/app.js`, journey A6 and J25 | No | 3 days |
| 5.6 Orders and checkout integration | Shared owner resolver in commerce; account orders endpoint and merged orders page; snapshots badged as demo; payment return read back under cookie auth | `lib/commerce.ts`, `lib/accounts.ts`, `app/api/account/orders/route.ts`, `public/complete.js`, journey A5 additions, J24 checkout assertions | No | 2 days |
| 5.7 Google sign in | Start and callback routes, JWKS verification, identity resolution and linking, set a password path for Google created users, Google button on sign in and register | `lib/accounts.ts`, `app/api/auth/google/start/route.ts`, `app/api/auth/google/callback/route.ts`, `public/complete.js` | **Yes: Google Cloud project, OAuth client id and secret as server settings, redirect URI registered for `/api/auth/google/callback`** | 2 to 3 days |
| 5.8 Parity gate and closeout | Journeys J24 to J26 at full strength, the section 6 checklist run end to end, gap document updates for ACC-01 and SIZ-04, wave closeout verification on main | `tests/e2e-journeys.cjs`, `docs/ux-audit/studiosuits-gap-analysis.md` | No | 2 days |

**Total: 19 to 24 engineer days** (roughly four to five working weeks for one engineer), against 8 to 12 days estimated for Option A. The difference is the honest price of Option B: an email and password system with verification, recovery, lockout and OAuth is a security product, not a header read. Two packages (5.3 and 5.7) wait on owner inputs, but neither blocks the others: the critical path 5.0 to 5.2, 5.4 to 5.6 and 5.8 (15 to 19 days) can be built and fully tested with the mailer stubbed. What cannot happen before 5.3 lands is switching accounts on for shoppers (section 4 verdict), and what cannot happen before the owner's Google setup is the Google button (the gate hides it independently).

## 8. Open questions for the owner

Only decisions the design cannot make for itself:

1. **Email provider.** Which transactional provider, and who creates the account, delivers the API key as a server secret, and publishes the sender domain's SPF and DKIM records? (Boone can implement against any HTTPS API provider in the Resend, Postmark or SendGrid class; the account and DNS steps are owner side.)
2. **Google in v1 or fast follow.** Package 5.7 is independently gated. Shipping email and password first and adding Google once the owner has created the Google Cloud OAuth client is fully supported by the design; shipping both together delays launch by the Google setup, not by engineering.
3. **Account deletion and data export posture for launch.** The schema carries a soft delete column (`users.deleted_at`) either way. The decision is the shopper facing one: self serve deletion and data export inside `/account` in v1, or by support request at launch with self serve as a fast follow? The design recommends support request at launch only if fulfillment and order retention rules are unsettled; if they are settled, self serve is about one extra day inside package 5.4 and 5.5 scope and should just ship.
4. **Gateway order claims.** Should an app account with a verified email that matches a gateway identity's email ever be offered an explicit "claim my earlier orders" step that re keys those `store_orders` rows? V1 does not do it (section 1.1). It is a product decision about the platform relationship, not an engineering gap.

## Appendix: unverified register

- PBKDF2 iteration ceiling and per derivation cost on the deployed worker runtime. Not in repo evidence. Package 5.0.
- Whether the production gateway strips client supplied `oai-authenticated-user-*` headers and passes unknown cookies (`suitsme-session`) through untouched. The dev plugin does both (verified in source); production behaviour is platform side. Package 5.0.
- How and when the hosting control plane applies `drizzle/` migrations to the production D1 database. The build ships them in `dist/.openai/` (verified); application is platform behaviour. Packages 5.0 and 5.1.
- Whether `cf-connecting-ip` is visible to the worker on this hosting. Nothing in the repo reads it. Package 5.2 designs for its absence.
- Whether the hosting plan offers a native email sending binding (option 2 in section 4). Nothing in the repo evidences one. Owner confirmation would change package 5.3's settings, not its flows.
- `node:crypto` scrypt availability under `nodejs_compat` in the deployed worker. The flag appears in `vite.config.ts`'s plugin binding config; runtime support is not provable from repo files. Package 5.0, only if the PBKDF2 result motivates it.

## Addendum: package 5.0 verification spike (2026-10-28)

Status: complete. This addendum settles the two runtime questions section 3.1 and the appendix register left open: the PBKDF2 iteration ceiling on the built worker, and scrypt availability under `nodejs_compat`. It closes both register entries. The committed parameters at the end of this addendum are the exact constants package 5.2 implements; section 3.1's "highest verified count" language is now resolved to a number.

### Method

- A throwaway route, `app/api/probe-hash/route.ts`, was added to a spike worktree based on main `ee67f33`. It never touched product code paths: one GET handler that runs the derivations and returns JSON. The full probe source is preserved at the end of this addendum so the experiment can be rebuilt exactly.
- The site was built with the normal root build (`pnpm build`, exit 0; the probe route appears in the build's route table), then served with the repo's own `pnpm start`: wrangler dev against the built output (`dist/server/wrangler.json`), which is real workerd, the same runtime family as the deployment. Node's WebCrypto was never used for these numbers.
- The built worker's config, read from `dist/server/wrangler.json` after the build: `compatibility_date` `2026-05-15`, `compatibility_flags` `["nodejs_compat"]`. So the flag section 0.3 saw in `vite.config.ts` does reach the built worker that was probed.
- The probe derived PBKDF2 HMAC SHA-256 keys (16 byte random salt, 256 bit output, a fixed probe password) at escalating iteration counts, timing each derivation with `performance.now()` inside the worker. Iteration counts and scrypt N values were query overridable, so the high end was probed without rebuilds.
- After the measurements were captured, the probe route was deleted. The committed spike branch contains only this addendum; the probe source below is the evidence trail.

### PBKDF2 results (workerd, built worker)

| Iterations | Result | Wall time |
| --- | --- | --- |
| 100,000 | ok, 32 bytes derived | 33 ms |
| 200,000 | ok | 48 ms |
| 310,000 | ok | 73 ms |
| 400,000 | ok | 92 ms |
| 500,000 | ok | 115 ms |
| 600,000 | ok | 144 ms (repeats: 143 ms, 140 ms, 146 ms) |
| 800,000 | ok | 192 ms |
| 1,000,000 | ok | 232 ms |
| 2,000,000 | ok | 508 ms |
| 5,000,000 | ok | 1,333 ms |
| 10,000,000 | ok | 2,349 ms |

No iteration ceiling was encountered. Every count from 100,000 to 10,000,000 derived successfully, and cost is linear at roughly 0.24 ms per 1,000 iterations. The OWASP target of 600,000 iterations for PBKDF2 HMAC SHA-256 is reachable with more than an order of magnitude of headroom, so the design commits to the full target, not a reduced runtime compromise. There is no shortfall to record against section 3.1.

### scrypt fallback results (node:crypto under nodejs_compat)

`node:crypto` imports inside the worker and both `scrypt` and `scryptSync` are functions. The fallback is real, with one operational catch: the default `maxmem` rejects any parameter set whose memory need (about 128 x N x r bytes) crosses the 32 MiB default, and the failure is a generic `Error: Scrypt failed` with no code. With `maxmem` raised explicitly, every tested parameter set works:

| N (r=8, p=1, keylen 32) | Default maxmem | maxmem 256 MiB |
| --- | --- | --- |
| 16,384 | ok, 51 ms | ok, 43 ms |
| 32,768 | fails (Scrypt failed) | ok, 107 ms |
| 65,536 | fails (Scrypt failed) | ok, 219 ms |
| 131,072 | fails (Scrypt failed) | ok, 449 ms |

Verdict: scrypt is a viable fallback in this runtime, but it is not needed, because PBKDF2 meets the OWASP target directly. If a future algorithm swap ever uses it, the working parameter set measured here is N=65,536, r=8, p=1, keylen 32, `maxmem` 268,435,456 (219 ms), and the `maxmem` option must always be passed explicitly.

### Session token primitives

Confirmed in the same probe run: `crypto.getRandomValues` returns 32 bytes (two consecutive draws distinct), `crypto.subtle.digest('SHA-256', token)` returns a 64 character hex digest, and the base64url encoding of 32 bytes is 43 characters, exactly as section 3.3 specifies. Total time for the whole primitive check was about 1 ms, so token minting and hashing are free next to one password derivation.

### Latency budget for the auth endpoints

One PBKDF2 derivation at the committed parameters costs about 145 ms of worker time. Per endpoint, from the flows in section 2:

- Register: 1 derivation (hash the new password), about 145 ms.
- Sign in: 1 derivation to verify, about 145 ms. The dummy verification for an unknown email (section 3.5) is the same single derivation at the same parameters, so the timing equalisation the design promises holds by construction. A sign in that triggers a parameter upgrade rehash costs 2 derivations, about 290 ms, once per account per parameter change.
- Verify email: no derivation (token hash lookup only).
- Reset password: 1 derivation (hash the new password), about 145 ms.
- Change password: 2 derivations (verify current, hash new), about 290 ms.

These are interactive latencies a shopper will not notice inside a sign in round trip, and they are the deliberate cost of the KDF: an attacker guessing passwords pays the same 145 ms per attempt before the section 3.4 lockout even engages.

One honest limit on this evidence: local wrangler does not enforce whatever CPU budget the deployed hosting plan sets, so the probe settles the API ceiling and the per derivation cost, not the plan limit. The number a plan budget would have to accommodate is about 145 ms of native crypto work per derivation. Package 5.2's first deployment check should confirm a live sign in round trip on the deployed worker before the gate opens; if a plan level CPU cap ever made 600,000 iterations impossible in production, the self describing hash format (section 3.1) and the rehash on sign in rule absorb a parameter change without a redesign, and the scrypt parameters above are the measured alternative.

### Committed parameters (package 5.2 implements exactly these)

```
Password hashing (WebCrypto, crypto.subtle)
  algorithm        PBKDF2, hash SHA-256 (deriveBits)
  iterations       600000
  salt             16 bytes from crypto.getRandomValues, per password
  derived key      32 bytes (deriveBits length 256)
  stored format    pbkdf2-sha256:<iterations>:<salt base64url>:<hash base64url>
  comparison       constant time equality over the full 32 bytes
  measured cost    about 145 ms per derivation on the built worker

Session and one time tokens
  token            32 bytes from crypto.getRandomValues, base64url (43 chars)
  stored           SHA-256 hex of the token only, never the token

Named fallback (not adopted; measured and available)
  scrypt via node:crypto, N=65536, r=8, p=1, keylen 32,
  maxmem 268435456 passed explicitly, about 219 ms per derivation
```

### Probe source (as run; deleted from the branch after measurement)

```ts
// THROWAWAY Wave 5 package 5.0 probe. Not part of the product.
// Runs inside the built worker under wrangler (real workerd runtime) and
// reports: PBKDF2 HMAC SHA-256 deriveBits at escalating iteration counts,
// node:crypto scrypt availability and limits under nodejs_compat, and the
// session token primitives (32 random bytes, SHA-256). Deleted before the
// spike branch is committed; the addendum in docs/ux-audit/wave-5-design.md
// records the method and carries this source so it can be rebuilt exactly.

const enc = new TextEncoder();

function errInfo(e: unknown) {
  const anyE = e as { name?: string; message?: string; code?: string };
  return {
    name: anyE?.name ?? typeof e,
    code: anyE?.code ?? null,
    message: anyE?.message ?? String(e),
  };
}

async function pbkdf2Once(iterations: number, salt: Uint8Array) {
  const t0 = performance.now();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode("probe-password-0123456789"),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const ms = performance.now() - t0;
  return { bytes: new Uint8Array(bits).length, ms: Math.round(ms * 10) / 10 };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const out: Record<string, unknown> = {};

  // --- PBKDF2 ladder -------------------------------------------------------
  const counts = (url.searchParams.get("pbkdf2") ?? "100000,200000,310000,400000,500000,600000,800000,1000000")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pbkdf2: Record<string, unknown>[] = [];
  for (const iterations of counts) {
    try {
      const r = await pbkdf2Once(iterations, salt);
      pbkdf2.push({ iterations, ok: true, derivedBytes: r.bytes, ms: r.ms });
    } catch (e) {
      pbkdf2.push({ iterations, ok: false, error: errInfo(e) });
    }
  }
  out.pbkdf2 = pbkdf2;

  // --- Session token primitives -------------------------------------------
  try {
    const t0 = performance.now();
    const a = crypto.getRandomValues(new Uint8Array(32));
    const b = crypto.getRandomValues(new Uint8Array(32));
    const digest = await crypto.subtle.digest("SHA-256", a);
    const hex = [...new Uint8Array(digest)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const b64url = Buffer.from(a).toString("base64url");
    out.tokenPrimitives = {
      ok: true,
      randomBytes: a.length,
      twoDrawsDistinct: Buffer.from(a).toString("hex") !== Buffer.from(b).toString("hex"),
      sha256HexLength: hex.length,
      base64urlLength: b64url.length,
      ms: Math.round((performance.now() - t0) * 100) / 100,
    };
  } catch (e) {
    out.tokenPrimitives = { ok: false, error: errInfo(e) };
  }

  // --- scrypt via node:crypto (nodejs_compat) ------------------------------
  try {
    const mod = (await import("node:crypto")) as Record<string, unknown>;
    out.scryptModule = {
      scryptType: typeof mod.scrypt,
      scryptSyncType: typeof mod.scryptSync,
    };
    const scryptFn = mod.scrypt as (
      password: string,
      salt: Uint8Array,
      keylen: number,
      options: Record<string, number>,
      cb: (err: Error | null, key: Uint8Array) => void,
    ) => void;
    if (typeof scryptFn === "function") {
      const run = (
        N: number,
        options: Record<string, number>,
      ): Promise<Record<string, unknown>> =>
        new Promise((resolve) => {
          const t0 = performance.now();
          try {
            scryptFn(
              "probe-password-0123456789",
              salt,
              32,
              options,
              (err, key) => {
                if (err) resolve({ ok: false, error: errInfo(err) });
                else
                  resolve({
                    ok: true,
                    derivedBytes: key.length,
                    ms: Math.round((performance.now() - t0) * 10) / 10,
                  });
              },
            );
          } catch (e) {
            resolve({ ok: false, error: errInfo(e) });
          }
        });
      const Ns = (url.searchParams.get("scrypt") ?? "16384,32768,65536,131072")
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const rows: Record<string, unknown>[] = [];
      for (const N of Ns) {
        const base = { N, r: 8, p: 1 };
        const withDefaultMem = await run(N, base);
        const withRaisedMem = await run(N, { ...base, maxmem: 256 * 1024 * 1024 });
        rows.push({ N, r: 8, p: 1, defaultMaxmem: withDefaultMem, maxmem256MiB: withRaisedMem });
      }
      out.scrypt = rows;
    }
  } catch (e) {
    out.scryptModule = { importError: errInfo(e) };
  }

  return Response.json(out);
}
```

## Verification summary: package 5.8 parity gate (2026-10-28)

Status: the gate passes. It ran on the stacked local Wave 5 branches (packages 5.1, 5.2, 5.4, 5.5 and 5.6, with this package on top), as local commits only: nothing in this wave has been pushed or opened as a PR yet, and accounts remain gated off for shoppers until the email settings of section 4 exist. The gap analysis status updates for ACC-01 and SIZ-04 belong to the wave closeout when these packages ship to main; this summary records the test evidence the closeout will cite.

### API journeys (tests/accounts.cjs, with A5 cases also in tests/commerce.cjs)

The section 6 checklist was audited journey by journey against the assertions actually in the suites, not against the suites' own summaries:

- **A1, lifecycle:** covered (package 5.2). Register returns the uniform 202 and creates no session, the emailed token verifies and mints the first session, `me` returns the user, sign out deletes the session and the old cookie reads as a guest, and sign in returns a fresh, different token.
- **A2, enumeration:** covered (package 5.2). Unknown email and wrong password sign ins are byte identical; the locked identifier case returns the same body, asserted in the A3 block against the same literal; register and forgot password return identical 202 bodies for existing and non existing emails; bad verify and bad reset tokens share one 400 body.
- **A3, lockout:** covered (package 5.2). Five failures lock the submitted email for 15 minutes (duration asserted), the correct password during lockout returns the uniform 401, a different email is unaffected until 20 failures lock the IP key, and the same account still signs in from another IP.
- **A4, reset:** covered (package 5.2). Reset changes the password, revokes all prior sessions (old cookies return null from `me`), mints one fresh session, and the token cannot be used twice. Change password follows the same discipline.
- **A5, owner resolution:** covered (package 5.6). Driven through the real commerce dispatcher sharing one fake D1 with the accounts lib: a cookie only checkout writes owner `app:<user id>`, the gateway header alone keys the order exactly as before, both together resolve to the app owner, and neither is the 401 of today. Read backs refuse each identity the other's orders, and the merged account orders endpoint serves the app keyed rows with the imported snapshots marked demo and imported, never a gateway row.
- **A6, profiles and import:** covered (package 5.5). Upsert creates and replaces by client id with the transient step field dropped, validation mirrors the commerce profile checks, another user's profile id deletes as the same 404 as a missing one, an import of three profiles and two demo orders returns counts 3 and 2, a repeat returns 0 imported and all skipped without overwriting, and the snapshots store the local orders verbatim with their demo marking.
- **A7, CSRF:** covered, and completed by this package. Packages 5.2 and 5.5 proved the foreign origin status for every auth route and for both account POSTs, with state assertions on the routes they drive individually, and the missing origin status for register. The audit found the remaining combinations unproven end to end: missing origin on the other routes, and a whole surface state assertion. This package adds exactly that: every POST under `/api/auth/*` and `/api/account/*` is driven with a missing origin and with a foreign origin against a live session, all returning 403, with the database tables and the mail outbox snapshotted before and after and asserted unchanged, the session still live, and the password still working afterwards. No gap remains in A7 as designed.
- **A8, gating:** covered (package 5.1). With email settings absent, `accountsEnabled` is false in every partial configuration, register returns 503 with the design body, and `me` returns `{user: null, enabled: false}`.

### Storefront journeys (tests/account-screens.cjs)

One placement note, recorded honestly: section 6 names `tests/e2e-journeys.cjs` as the home of J24 to J26, but packages 5.4 to 5.6 built the Wave 5 storefront harness in `tests/account-screens.cjs` around the fake accounts API, and J25 landed there in package 5.5. J24 and J26 sit beside J25 in that suite, where the signed in worlds they need already exist. `tests/e2e-journeys.cjs` itself is unmodified by this wave, so J1 to J23 stand untouched exactly as section 6 requires; the listing and menu parity J24 needs is asserted directly, byte for byte, rather than by re running the listing suites.

- **J24, signed in parity:** passes (this package). Against an enabled guest world on the same seed: the rendered menus are byte identical (byte level, as the design demands), and so are the home screen, the Wool Suits, Trousers and Women collection listings, a product page, and the customizer at the fabric, personalize and measurements stages. The priced customization J17 drives (tuxedo tier, vest with fabric back, additional pants, square and tie, all three monogram fields) is then driven in both worlds: the bagged items are identical apart from their random line ids, both subtotals are the Wave 3 total of base + 368, and the bag lines are byte identical. Checkout is byte identical once the account strip line is set aside, and each world's strip is the copy its state requires (the guest prompt with a checkout returnTo, the signed in line naming the account). The bag then persists byte for byte across re renders while signed in, and the demo checkout completes to the order page with the order total at base + 368.
- **J25, migration:** passes (package 5.5, re run green at this gate). The offer is made once in the design's words, the import carries exactly the local arrays, the counts are confirmed, local profiles, orders and the bag are untouched, and the dismiss path is remembered under the design's flag with the account page button as the way back in.
- **J26, sign out restores the guest:** passes (this package). After sign out the header shows Sign in again and the account menu is gone, and the restored guest is byte identical to a fresh guest world holding the same browser data across the header slot, the menus, home, a listing, checkout with its guest strip, the orders page and the profiles modal. The journey then continues as that guest down the J1 path: the menu's Wool Suits destination, its first product, the customizer with the seeded local profile driving the measurements and a priced lining chosen, added to the bag that was already on the browser, and a demo checkout that completes on the order page with the local profile untouched by the whole sign in, sign out and purchase cycle.

Supporting screen journeys S1 to S9 (packages 5.4 to 5.6) also pass at this gate, including S1's byte identity between the disabled site and a world whose fetch never answers, which is the guest path unchanged proof for the gate closed state.

### Parity outcome

The gate found no parity defect in the package 5.4 to 5.6 client code and none in the package 5.1 to 5.2 server code. Every designed difference between the signed in and guest experiences is one the design itself names: the header account slot (a Sign in link for guests, the account menu when signed in), the checkout account strip line, the profiles modal status line, and the signed in orders page with its merged history. Everything else the shopper sees is byte identical, before sign in, while signed in, and after sign out. No production code changed in this package; the only code changes are the A7 completion block in `tests/accounts.cjs`, journeys J24 and J26 in `tests/account-screens.cjs`, and this summary.

### Suite and build results

- Full test chain (`pnpm test`): exit 0, all 23 suites pass, the 21 pre existing suites from before this wave plus `tests/accounts.cjs` and `tests/account-screens.cjs`.
- Root build (`pnpm build`): exit 0.

### What remains open in Wave 5, and why

- **Package 5.3, email sending:** owner blocked. It needs the owner's email provider choice, the provider account and API key as server secrets, and the sender domain's SPF and DKIM records (open question 1 in section 8). Until it lands, the `accountsEnabled` gate stays closed and nothing in this wave is shopper visible; the flows above were all proven against the stubbed mailer, exactly as the design's critical path allows.
- **Package 5.7, Google sign in:** owner blocked. It needs the owner's Google Cloud OAuth client and the redirect URI registered for `/api/auth/google/callback` (open question 2 in section 8), and the separate decision of whether Google ships in v1 or as a fast follow. The Google gate stays independently closed; the routes return 503 without the Google settings.
- **Deployed worker live sign in check:** unverified, pending a deployment. The package 5.0 addendum assigns it to the first deployment: a live sign in round trip on the deployed worker, confirming the hosting plan's CPU budget accommodates the roughly 145 ms of native crypto work per derivation, before the accounts gate opens.
- **D1 migration application:** unverified, platform behaviour. The build ships the migration in `dist/.openai/drizzle/` (verified in package 5.1), but how and when the hosting control plane applies it to the production database cannot be confirmed from this repo; confirming the eight tables exist on the deployed database is a pre-launch check, and it only matters once the owner provides the email settings for package 5.3.
- **cf-connecting-ip visibility:** unverified on this hosting (appendix register). Package 5.2's IP lockout is built on the header when it is present and degrades to a shared bucket when it is absent, with the email key carrying the posture either way, so nothing in the shipped design waits on this answer.
- **Production gateway behaviour:** unverified (appendix register). Whether the production gateway strips client supplied `oai-authenticated-user-*` headers and passes the `suitsme-session` cookie through untouched is platform side; the dev plugin does both. The owner resolver's precedence (app session first) means an app account's own requests resolve correctly either way; the check belongs with the first deployment checks above.
- **Owner decisions still open from section 8:** account deletion and data export posture at launch (question 3), and whether gateway orders should ever be claimable by a matching app account (question 4; v1 does not do it).

