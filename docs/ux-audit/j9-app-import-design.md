# J9 app side import: build design

Approved by Avenash on 2026-11-09 ("Go ahead: build the app side import
package"). Data side is already live: the four JPOS staging tables are
in production D1 (see j9-production-staging-report.md). This package
builds the shopper facing half: a signed in, email verified customer
can pull their shop gauge record into a suits.me measurement profile.

Baseline documents: j0-mapping-design.md section D.3 (provenance and
copy rules) and j9-import-readiness.md section 4 (transform sketch).
Where this design narrows D.3 for a first ship, it says so.

## 1. Endpoint

POST /api/account/jpos-import (new route file mirroring the other
account routes, dispatched in lib/accounts.ts).

- Requires an app session (401 when signed out), the standard POST
  origin check (403 on a foreign origin), and accountsEnabled.
- Verified email gate: the session user's emailVerified must be true.
  An unverified account gets 403 with the existing wording pattern
  ("Please confirm your email first...") and nothing is read from
  staging beyond that check. Google accounts arrive verified, so
  they pass the gate the same way.
- The lookup key is the account's own email (stored trimmed and
  lower cased). The customer never types an email to search by, so
  the endpoint cannot be used to probe anyone else's shop record.

Responses are JSON with a status field:

- imported: a new profile was created.
- unchanged: re-import found the same source values; nothing written.
- refreshed: the source changed and the copy was untouched since
  import, so the copy and its snapshot were updated in place.
- candidate: the source changed but the copy was edited on suits.me;
  the copy is untouched and the new values are recorded on its
  provenance as pendingCandidate for a later side by side offer.
- no-match: no JPOS customer carries this email.
- ambiguous: more than one JPOS customer row carries this email
  (the shared email rule, section 3); nothing is imported.
- no-gauge: the customer matched, but has no gauge profile row, so
  there are no importable values yet (body values from orders are a
  later pass).
- unavailable (503): the staging tables cannot be read.

## 2. Transform (staging rows to one profile v3)

One candidate per matched customer, built from their single
GaugeSuitProfiles row plus the latest measurementProfiles header
(latest by measurementCreationDate, modification date as tiebreak).

Profile shape (an ordinary v3 profile, stored in account_profiles):

- id: "jpos-" plus the JPOS customer id. Deterministic, so a
  re-import finds its own copy and never duplicates.
- version 3, origin "jpos", method "body", garment "suit",
  wearer "Men" (GaugeSuitProfiles is the shop's suit gauge record),
  unit "in".
- wearerName: the customer record's first and last name; falls back
  to the account display name, then the email local part.
- name: "Shop measurements", plus the profile type in brackets when
  a header exists, for example "Shop measurements (Classic)".
- header: profileType from the header's measurementType (stored as
  received), jposLinks {jacket, pants, vest} from the header's order
  ids, each null where empty. With no header row: profileType null
  and jposLinks null (gauge only candidate, as the readiness report
  allows).
- gauge: parsed from the gauge row. Numbers pass through as recorded;
  mixed fraction strings (the HalfWaistJacket form, for example
  "17 1/2") and simple fractions convert to decimal inches; anything
  else is not a number and stays out of the gauge block.
  - chest: Chest. jacketWaist: GaugeSuitJacketWaist. pantsWaist:
    GaugeSuitPantsWaist. chestOverArm: ChestOverArm. seat: Seat.
    halfWaistJacket: HalfWaistJacket (fractions converted).
  - posture: Posture as recorded when it is one of Normal, Erect,
    Stooping; anything else stays snapshot only.
  - height, weight, shoulder: always null. The source holds band or
    label text for these, never a number; the raw text is kept in
    the import snapshot and nothing is invented from it.
- values: an empty object. Per J0 D.3, body values come from the
  measurement sets on the linked orders, which are not staged yet.
  Gauge values are never copied into body value keys: a gauge chest
  and a body chest are different measures. missingForCompletion
  therefore reports the body set as owed, and the completion offer
  is how the customer fills it. The profile is a partial profile by
  design, and checkout keeps refusing incomplete profiles exactly
  as it does today.
- figure: an empty object (measurementProfiles carries no figure
  columns; that question is closed by the export).
- provenance (J0 D.3): sourceSystem "jpos", sourceTable
  "measurementProfiles" when a header exists, else
  "GaugeSuitProfiles"; jposCustomerId, jposMeasurementId,
  jposGaugeSuitProfileId, jposOrderIds {jacket, pants, vest};
  sourceCreatedAt and sourceModifiedAt from the header dates (gauge
  row dates when there is no header); importedAt; importSnapshot
  holding the gauge, values and figure exactly as imported, plus a
  raw block with the band and label texts that had no numeric
  target (Height, Weight, Shoulder) and any unparsed source texts
  (Thigh, PantsOutSeam, malformed numbers), so nothing the shop
  recorded is silently dropped.

Storage note: the import writes the row directly after checking the
candidate with validateV3Blocks and structural checks of its own.
It does not go through cleanProfile: that validator requires a
complete body profile, and an imported profile is honestly partial.
listProfiles returns it like any other profile, and the studio's
completion flow is what turns it into a complete one.

## 3. Shared email rule

An email that matches more than one distinct JPOS customer id
imports nothing and returns "ambiguous" with wording that asks the
customer to have the shop confirm which record is theirs. Picking
one silently could hand one person's measurements to another
person who shares a family or office email. 1,844 addresses in the
export are shared; none of the six live accounts hits one today.
This is the safe default; Avenash can replace it with a
disambiguation flow later without changing the unambiguous path.

## 4. Re-import rules (J0 D.3 copy rules, as built)

- Same source values as the stored importSnapshot: a no op
  ("unchanged"), whether or not the copy was edited.
- Source changed, copy untouched (its values, gauge and figure
  still equal its importSnapshot): refresh copy and snapshot in
  place, new importedAt ("refreshed").
- Source changed, copy edited: never overwrite. The new values are
  recorded on the provenance as pendingCandidate with its own
  importedAt; the customer facing side by side choice is a follow
  up package, and the API answer ("candidate") already tells the
  customer their edits were kept.
- An existing account profile with the deterministic id but no JPOS
  provenance for this customer is never touched.

## 5. Shopper facing surface

- Account page gains a "Your shop measurements" section: plain
  explanation, one button ("Find my shop measurements"), and a
  status line that reports the outcome in plain words per status.
  On imported or refreshed it pulls the account profiles so the new
  profile is in this browser's list right away.
- Profiles modal (app.js openProfiles): an imported profile is
  labelled as a shop record with its gauge line (for example
  "Shop record · Gauge chest 42 in · Jacket waist 36 in") instead
  of a body measurement count and an undefined fit.
- Profile summary (complete.js, used in bag and checkout review):
  an imported profile summarizes its gauge block under the words
  "Shop gauge record", never as body measurements.

## 6. Tests

New journey suite tests/account-jpos-import.cjs, wired into the
package test chain after account-google.cjs. It drives the real
lib/accounts.ts dispatcher against a fake D1 that also carries the
three staging tables, and covers: guest refused, unverified
refused, origin refused, no match, shared email ambiguous, no gauge
row, a full import (fraction conversion, band labels snapshot only,
posture token, provenance and header links, validateV3Blocks
clean), re-import unchanged, refresh of an untouched copy, an
edited copy kept with a candidate recorded, and a malformed gauge
value staying snapshot only. Full test chain and root build must
pass in the worktree before the PR opens (standing rules).

## 7. Out of scope for this package

- Body values from the orders measurement sets (needs its own
  staging and transform pass).
- SelfMeasurement sourced imports and its photos.
- The side by side re-import candidate choice UI (the candidate is
  recorded; the choice screen is a follow up).
- Any write back to JPOS (standing rule: never).
- Shared email disambiguation beyond refusing safely.
