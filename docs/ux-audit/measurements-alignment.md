# Measurements alignment study: the self measurement journey (suits.me vs StudioSuits)

Status: plan approved by Avenash on 2026-10-29, with all ten open owner
questions answered the same day (section 8). Building has started with
package M0. This document remains the design record for the wave; code
changes land package by package under the plan in section 7.

Revision (2026-10-29): the first version of this study relied on
StudioSuits' published guide article for their measurement set, because
their real form was unverified. The form has since been inspected directly
behind Avenash's own login (section 4.5), it does not match the guide's
published set, and this revision treats the verified form as the canonical
benchmark for field sets and the measurement experience throughout.

Direction (Avenash, 2026-10-29): suits.me's measurements should be made in
sync with StudioSuits, because currently they are not consistent. Scope
clarification (Avenash, 2026-10-29): the alignment centers on the self
measurement journey. When a shopper selects any garment (a suit, a shirt, a
jacket, trousers, and so on) and chooses to take their own measurements, that
measurement taking part should work the way StudioSuits' does. The size guide
and the standard size tables are supporting context for that flow, because
they feed the standard size alternative offered in the same step. This study
supersedes the 2026-10-27 decision to draft the size guide from suits.me's
existing size ranges only.

Evidence basis:

- suits.me: the storefront and server code at origin/main 470e125, read at
  file level on 2026-10-29. Every claim in sections 2 and 3 carries a file
  reference.
- StudioSuits: public pages fetched or observed on 2026-10-29, the verified
  live journey walk of 2026-10-26 recorded in the audit notes, and the
  verified capture of their real measurement forms on 2026-10-29 (Avenash
  signed in to his own account for a read only inspection, 7:52 to 8:23 AM
  EDT; nothing was saved, no order placed, cart left empty; full record in
  the workspace audit notes,
  studiosuits-measurements-form-capture-2026-10-29.md). Where the public
  material and the verified form disagree, the form governs (section 4.5).
  Factual garment data (field names, chart numbers, ranges) is quoted as
  comparison material; no branding, images, or marketing text is copied.

## 1. The two self measurement journeys at a glance

suits.me today: inside the product customizer, the Measurements step offers a
saved profile picker or a "Take my measurements" button. That opens the
Measurement Studio wizard: step 0 chooses the method ("Measure my body" or
"Use a standard size"), steps 1 and 2 collect ten body fields in two fixed
groups (a jacket group, then a trousers group), and a review step lists every
value before saving a named, reusable profile. The same ten fields, the same
groups, and the same ranges apply to every garment kind the shop sells:
suits, jackets, waistcoats, trousers, shirts, women's garments, and boys'
garments alike. Quick Add cannot measure at all: it requires an existing
saved profile.

StudioSuits, verified on their public pages and, since 2026-10-29, in
their real forms: the product builder's Size step splits "Made to Measure"
from "Standard Size". Made to Measure collects nothing in the builder; the
shopper adds measurements later from the cart, where each item offers
"Create new measurements" or "Later", with up to three entry modes
(measure your body, measure an existing garment, modify a standard size).
The body form opens from the cart as a single long form per garment, with
a per field instruction pane, an Enter Name and Height preamble, per
garment field sets (a suit set far larger than a shirt's 7 fields or a
waistcoat's 3), fit dropdowns inside the form, and a profile name
prefilled by category and date. Their public guide article teaches a
different 12 measurement set that the real form does not use; the form,
not the article, is the benchmark this study aligns to (section 4.5).

Headline differences, before the detail:

1. suits.me asks every shopper for the same ten fields whatever they are
   buying, including fields for garments they are not buying, and it has no
   neck measurement at all, so a shirt only order collects five trouser and
   jacket fields it does not need and misses the one field a shirt collar is
   cut from. StudioSuits' verified form is garment aware: a large set for
   a suit, 8 fields for trousers, 7 for a shirt (neck first), 3 for a
   waistcoat, each exactly the block that garment needs, and their
   standard size route starts from only a jacket size and a trouser
   waist.
2. suits.me disagrees with itself in at least twelve recorded places
   (section 3): three separate copies of "what is a valid profile" exist,
   the standard size sets and the body field ranges only partly overlap, the
   rules a shopper gets depend on which page they entered the wizard from,
   and women and boys are refused standard sizes while the only size guide
   in the shop covers men's sizes.
3. The guidance models differ in depth. suits.me gives each field one line
   of instruction plus a line drawing highlight on a shared figure.
   StudioSuits' form gives every field an instruction pane whose guidance
   text and instructional image swap in as the field is focused
   (photographs with a red tape for body fields, line diagrams for rises,
   lengths, and hems), their guide names which fields need a second
   person, and their form offers a measure a garment you already own
   entry mode as a first class alternative.

## 2. suits.me today: the self measurement system (code verified)

### 2.1 Flow map

- Customizer Measurements step (`apps/website/public/app.js`, stage 2 of 3):
  two method cards once a profile exists ("Use a saved profile"), a profile
  select whose options are labeled "Standard size" or "Custom measurements"
  with a one line summary, the error "Choose a saved profile, or take your
  measurements first." when neither exists, and a "Take my measurements"
  button that routes to the Studio wizard and returns to the customizer on
  save. The step is identical for every garment kind;
  `apps/website/public/complete.js` overrides only customizer stages 0 and 1.
- Measurement Studio wizard (`app.js`, `measure()` at line 122): step 0 is
  the method choice with the note "Use a soft tape over light clothing and
  ask someone to help with back measurements." Body steps render one field
  group per step with a per field "How to measure" help button, a body
  figure that highlights the focused field, and a unit toggle (inches or
  centimeters). The review step lists all fields with their values.
  `measureNext` (line 126) validates the whole step at once and lists every
  problem together, marking each bad field `aria-invalid`.
- Quick Add (`apps/website/public/quick-add.js`, lines 9 to 12): requires an
  existing saved profile whose wearer matches the product; there is no
  inline measuring path.
- Entry points: the customizer button, the navigation "Measurement Studio"
  button (`apps/website/public/navigation.js` line 25), and the profiles
  modal. Only the customizer path sets the wearer (see INC-05).

### 2.2 The body field set (one set for all garments)

Canonical definition: `apps/website/public/app.js` line 75. All ten fields
are required for every made garment. Stored values are body measurements in
inches.

| # | Key | Label | Group (wizard step) | Adult range (in) | Boys minimum (in) |
| --- | --- | --- | --- | --- | --- |
| 1 | chest | Chest | 1 (jacket step) | 26 to 70 | 18 |
| 2 | waist | Natural waist | 1 | 22 to 70 | 18 |
| 3 | shoulder | Shoulder width | 1 | 12 to 28 | 8 |
| 4 | sleeve | Sleeve length | 1 | 17 to 40 | 10 |
| 5 | jacket | Jacket length | 1 | 22 to 42 | 14 |
| 6 | seat | Seat / hips | 2 (trousers step) | 26 to 78 | 20 |
| 7 | trouserWaist | Trouser waist | 2 | 22 to 70 | 18 |
| 8 | thigh | Thigh | 2 | 15 to 42 | 10 |
| 9 | inseam | Inseam | 2 | 20 to 42 | 10 |
| 10 | outseam | Outseam | 2 | 30 to 55 | 18 |

Each field carries a one line `tip` (how to measure) and an SVG `line` drawn
on one shared body figure (`figure()`, same line). Boys bounds come from
`measureBounds` (line 76): for the Boys wearer only the minimums drop, to
the values in the last column; the maximums stay at the adult values.

There is no neck, bicep, wrist, stomach, or garment length field for shirts
anywhere in the system. The catalog kinds are suit, jacket, waistcoat,
pants, shirt, accessory, swatch, and gift (`complete.js` lines 3 to 17);
women's products are category Women with kinds suit, jacket, and pants, and
they use the same ten fields.

### 2.3 Units and conversion

- Canonical storage is inches. Entering a value in centimeters divides by
  2.54 (`updateValue`, line 114); displaying converts back with
  `(inches x 2.54)` rounded to one decimal (`displayValue`, line 115).
- Input min and max attributes and the ranges quoted in error messages are
  converted with `Math.round(bound x 2.54)` (`fieldHtml` line 119,
  `bodyProblemMessage` line 124), so centimeter bounds are whole numbers and
  are not the exact conversion (26 in shows as 66 cm; exact is 66.04).
- The size guide converts each cell with `Math.round(value x 2.54)`
  (`sizeGuideHtml`, line 118): whole centimeters in the guide, one decimal
  in the wizard, for the same quantity.
- Saved profile summaries (bag, checkout, orders) render values in the unit
  saved on the profile itself, converted from the stored inches and rounded
  to one decimal (`profileSummary`, `apps/website/public/complete.js`
  line 39). The wizard, by contrast, renders in the current draft unit,
  which persists across sessions and may no longer match the unit a saved
  profile was created in.

### 2.4 Validation: three copies of one rule

- Client wizard: per field ranges from the table in 2.2 (Boys minimums when
  the draft wearer is Boys), all problems on a step reported together.
- Server, checkout: `apps/website/lib/commerce.ts`, `cleanItems` (lines 53
  to 77). A body profile must carry exactly the ten keys, each a finite
  number between a flat minimum (10, or 8 for Boys) and 100. There are no
  per field ranges server side. A ready (standard size) profile requires an
  even integer jacket size 30 to 62, an even integer trouser size 28 to 64,
  and a length of Short, Regular, or Long, and is refused for the Women and
  Boys wearers.
- Server, account profiles: `apps/website/lib/accounts.ts`, `cleanProfile`
  (lines 282 to 312) with `PROFILE_VALUE_KEYS` (line 281) mirrors the
  commerce rule exactly: same ten keys, same flat 8 or 10 to 100 bounds,
  same ready size rules.
- The customizer's own step validation (`nextConfig`, line 104) checks only
  that a profile is chosen; field level truth lives in the wizard and the
  two server copies.

### 2.5 The standard size alternative in the same step

- A ready profile is `{jacket size, trouser size, length}` chosen from three
  selects, nothing preselected (Wave 1, SIZ-01). Jacket sizes run 30 to 62
  in steps of 2, trouser sizes 28 to 64 in steps of 2, lengths Short,
  Regular, Long. One ready shape serves suits and jackets and trousers
  alike: a trousers only order still records a jacket size, and a jacket
  only order still records a trouser size.
- For Women and Boys wearers the ready method is hidden and forced to body,
  with the note "Standard sizes are not offered for this garment."
  (`methodChoiceHtml` and `setCustomizerMethod`, lines 109 to 110;
  `complete.js` line 34 strips the ready card for those wearers.)
- The v1 size guide (Wave 2 package 2.4, derivation recorded in
  `docs/ux-audit/size-guide-draft.md`) is generated in `sizeGuideHtml`
  (line 118): a jacket table whose only body column is Chest, with the rule
  jacket size number equals body chest in inches (rows 30 to 62), and a
  trouser table whose only body column is Waist, trouser size number equals
  body waist in inches (rows 28 to 64), each in inches and centimeters.
  Lengths are named in the guidance text with no numbers. Shoulder, sleeve,
  seat, and inseam columns were deliberately omitted because no source for
  them exists in suits.me's data.
- The guide modal is reachable from the customizer size step and lists the
  same two men's tables for every product, including women's and boys'
  products.

### 2.6 Wearer handling

`productWearerOf` (`app.js`): Boys when the product silhouette is "Boys
two-piece", Women when the category is Women, otherwise Men. Entering the
wizard from a product sets `draft.wearer` from that product and forces the
body method for Women and Boys (`complete.js` line 33). The wizard itself
contains no wearer control. The draft persists in local storage
(`suits-draft`), so the wearer, and with it the validation minimums and
whether standard sizes are offered, carries across products and sessions
until another product overwrites it. The customizer filters the profile
picker to profiles whose wearer matches the current product (`complete.js`
line 36).

### 2.7 Persistence

- Local: profiles in local storage `suits-profiles`, the in progress draft
  in `suits-draft`, Quick Add state in `suits-quick-add`. A saved profile is
  a copy of the whole draft: step, method, unit, values, name, fit, ready,
  and wearer when set. The bag line carries its own copy of the profile,
  and the order snapshot carries it again.
- Account sync (Wave 5): signed in saves also POST the profile to
  `/api/account/profiles` and deletes propagate (`complete.js` lines 98 to
  101, called from the wizard save at `app.js` line 128 and from
  `deleteProfile` at line 140). On sign in, account profiles are pulled and
  merged into the local list by id without overwriting local ones
  (`pullAccountProfiles`, `complete.js` line 110), and a one time import
  offers local only profiles to the account (lines 120 to 129). Signed out
  use is local only. The bag is never migrated.
- Note on names: `public/studio.bundle.js` and `studio/index.js` are the 3D
  garment viewer, not a measurement tool. The Measurement Studio is the
  wizard in `app.js`. The shared word "studio" is a naming collision worth
  recording because the two are easy to confuse in discussion.


## 3. suits.me internal inconsistency register

Severity uses the audit scale: P0 broken purchase or incorrect order, P1
blocking or confusing core customization or measurements, P2 discoverability
or consistency, P3 polish. Each entry names the proposed resolution; the
packages in section 7 carry them.

### INC-01: One field set for every garment, including fields for garments not being bought (P1)

A shirt only order requires seat, trouser waist, thigh, inseam, and outseam;
a trousers only order requires chest, shoulder, sleeve, and jacket length;
and no order of any kind can record a neck measurement, because the field
does not exist. The requirement is enforced identically in the client
(`app.js` line 75), at checkout (`lib/commerce.ts` line 53, the body branch
requires all ten keys), and in account profiles (`lib/accounts.ts` lines 281
to 312). Impact: shoppers must invent or pad numbers for fields their
garment does not need, which works directly against the never guess a
measurement rule, and the shirt journey lacks its most garment specific
field. Resolution: per garment field sets (packages M0 to M4).

### INC-02: Three copies of the validity rule, and they do not agree (P1)

The wizard enforces per field ranges (chest 26 to 70, and so on). Both
server copies enforce a flat 8 or 10 to 100 for every field. A chest of 80
is invalid in the wizard and valid to the server; a Boys chest of 12 passes
the server (Boys minimum 8) and fails the client (Boys minimum 18). The two
server copies are themselves duplicates (`lib/commerce.ts` line 53,
`lib/accounts.ts` lines 281 to 312) that can drift independently. Resolution:
one schema as the single source, consumed by the client and mirrored by both
server validators, with parity tests (package M0).

### INC-03: The rules depend on which door the shopper entered by (P1)

The wearer is set only when the wizard is entered from a product
(`complete.js` line 33). Entered from the navigation Measurement Studio
button or the profiles modal, the wizard keeps whatever wearer a previous
product left in the persisted draft, or none, which every consumer treats
as Men. The same child therefore gets Boys minimums and no standard sizes
via one door, and adult minimums with standard sizes via another. There is
no wearer control inside the wizard to correct it. Resolution: the wearer
becomes an explicit first step choice in the wizard, stored on the profile,
never inferred from browsing history (packages M0 and M4).

### INC-04: Women and boys are refused standard sizes, and the only guide in the shop is for men (P1)

Ready profiles are refused for Women and Boys in the client
(`app.js` lines 109 to 110) and again on the server (`lib/commerce.ts`
line 53). At the same time the size guide modal shows only the men's jacket
and trouser tables (`app.js` line 118) on every product, including women's
and boys' products. Two of the three wearer groups the shop sells to,
including a top level menu category, get no standard size path and no size
guidance at all. Resolution: owner decision O6, then package M4 (body flows
first) and M5 (tables if confirmed).

### INC-05: The two waist numbers in the same step mean different things and are never reconciled (P2)

The body flow collects "Natural waist" and, one step later, "Trouser
waist". The trouser waist tip warns that a body waist "is not the size
printed on a trouser label", yet the standard size flow in the same wizard
asks for a trouser size number with no explanation of how it relates to
either measured waist. A shopper who measured a 36 inch trouser waist meets
a size select running 28 to 64 and no statement of which number to pick.
The verified StudioSuits form confirms the concern from the benchmark
side: it asks for one body waist only, and its waist guidance explicitly
warns the shopper not to give the label size and to measure where the
pants will be worn. Resolution: owner decision O4 (one body waist field,
or two fields with the relationship stated), carried by packages M1 and
M5.

### INC-06: Standard size sets and body field ranges only partly overlap, silently (P2)

Ready jacket sizes run 30 to 62 while the body chest field accepts 26 to
70; ready trouser sizes run 28 to 64 while the body trouser waist accepts
22 to 70. A shopper whose chest measures 66 can save a body profile but has
no standard size, and a shopper with a 28 inch chest is offered standard
sizes from 30 up. Neither edge is acknowledged in the UI or the guide.
Resolution: align the sets or document the edges deliberately (owner
decision O3, package M5).

### INC-07: A ready profile records sizes for garments not being bought (P2)

The ready shape always carries jacket size, trouser size, and length
(`lib/commerce.ts` line 53 validates all three for every ready item). A
trousers only order therefore records a jacket size nobody chose for a
garment, and the bag summary prints it (`complete.js` line 39). Resolution:
per garment ready shapes in the shared schema (packages M0 and M2).

### INC-08: "Jacket length" is a garment measurement inside a body measurement flow (P2)

Step 0 of the wizard says "Use your body measurements", and nine of the ten
fields are body measurements. The tenth, jacket length, is measured from
the base of the neck to the hem the finished jacket should reach: a garment
target, not a body dimension. The size guide draft already flagged the same
body versus garment ambiguity for trouser waist. Resolution: label every
field as body or garment in the schema and the UI (package M0), and say so
in the jacket length guidance (package M1).

### INC-09: The same task has three entries with three different rules (P2)

The customizer measures through a profile picker plus wizard, the Studio
wizard splits capture into jacket then trousers groups even for a shirt,
and Quick Add refuses to start without an existing profile
(`quick-add.js` lines 9 to 12). A returning shopper and a new shopper doing
the identical task meet different requirements depending on the entry.
Resolution: one measuring flow behind every entry; Quick Add routes into it
when no profile exists (packages M1 to M3).

### INC-10: Centimeter display is rounded two different ways, and typed values can drift (P2)

Wizard display rounds converted values to one decimal (`app.js` line 115);
the size guide rounds to whole centimeters (line 118); input bounds and
error messages quote whole centimeter conversions of inch bounds (lines 119
and 124), so the range a centimeter shopper is told (66 to 178 cm for
chest) is not the exact conversion of the range enforced (66.04 to 177.8).
A value typed in centimeters is stored divided by 2.54 and redisplayed
rounded, so the number on screen after saving can differ from the number
typed. Resolution: one conversion and rounding rule, stated once, used by
inputs, errors, summaries, and the guide (package M0).

### INC-11: Boys maximums are adult maximums, and the Boys minimums disagree between client and server (P2)

`measureBounds` (line 76) lowers only the minimums for Boys; a child profile
may validly carry a 40 inch sleeve. Server side, the Boys minimum is a flat
8 for all ten fields (`lib/commerce.ts` line 53), while the client's Boys
minimums run 8 to 20 by field. Resolution: per wearer ranges in the shared
schema, child ranges set with owner input (packages M0 and M4).

### INC-12: The documentation describes a different measurement system than the shop runs (P3)

`apps/website/README.md` line 11 describes "Guided adult and child body
measurements, inch/centimeter conversion, standard US men's sizes", and
line 44 lists "garment measurement specifications" among the connections
still to make before live selling. The storefront presents the wizard as
the finished system; the README admits garment specifications are not
connected. Resolution: update the README as part of package M0 so the
documentation, the guide, and the code describe the same system.

## 4. StudioSuits observed

Sources, with the date each was observed. Sections 4.1, 4.2, and 4.4 are
public evidence: the two pages marked "fetched" were read in full on
2026-10-29, and search snapshots were crawled by the search index within
the four days before 2026-10-29, as reported by the index. The 2026-10-26
journey is the audit's own verified live walk. Section 4.5 is the verified
capture of their real measurement forms behind Avenash's own login on
2026-10-29; where it and the public material disagree, section 4.5
governs.

### 4.1 The measurement set and how they teach it

Source: "How to Measure Yourself for a Suit: 12 Measurements + Chart",
https://www.studiosuits.com/blogs/articles/how-to-measure-yourself-to-get-the-ideal-custom-suit
(published 2025-08-24, fetched 2026-10-29).

Their published self measurement set for a custom suit is 12 body
measurements, in this order, each taught with a placement paragraph and the
common error for that field:

1. Neck: base of the neck where a collar sits, one finger of ease.
2. Chest: fullest part, under the armpits, across the shoulder blades,
   relaxed breath.
3. Shoulders: across the back, edge to edge, following the curve; needs a
   second person.
4. Sleeve Length: shoulder point down the outside of the arm to the wrist
   bone, arm naturally bent.
5. Bicep: widest part of the upper arm, relaxed, not flexed.
6. Waist: the natural waist, the narrowest point, not where trousers sit.
7. Hips: broadest part of the hips and seat, feet together, tape level.
8. Inseam: crotch seam to the intended hem, wearing the shoes the suit will
   be worn with.
9. Outseam: natural waist down the outside of the leg to the same hem
   point; always the longer of the two leg numbers.
10. Jacket Length: base of the neck down the back to the intended finish;
    needs a second person.
11. Thigh: thickest part of the upper leg, standing, not seated.
12. Wrist: around the wrist bone where a cuff sits, small gap.

Guidance rules stated in the same article: report true body measurements
and add no allowance of your own, because the allowance is built into their
charts (jackets carry 3 inches at the chest, trousers 2 inches at the
waist); take every measurement twice; three of the twelve need a second
person (shoulders, jacket length, and the back of the chest); measure in
close fitting clothes; write each number down as you take it. For a ready
size order, only two of the twelve are needed to place the order: chest for
the jacket and waist for the trousers; the full set applies to fully custom
orders. The article also documents a second route: measure a jacket and
trousers that already fit (five garment measurements each: shoulder, chest,
stomach, sleeve, length for the jacket; waist, hip, thigh, leg opening,
front rise for the trousers) and compare them against the finished garment
charts. Between sizes guidance: size up, because a jacket can be taken in
at the waist but not let out at the shoulders; order on the chest when
chest and waist point to different jacket sizes.

What this article is, after the 2026-10-29 form capture: their public
teaching material, not a description of their form. The form that
collects the measurements (section 4.5) does not use this set: it has no
wrist field and no inseam or outseam in body mode, and it adds stomach,
seat, front and back rise, knee, leg opening, and height. The article
still evidences how they teach measuring (placement, common errors,
helper fields, measure twice), but per garment field sets come from the
form, not from this article. This also resolves owner input O1: the
verified form is the canonical benchmark for field sets and the
measurement experience (section 8).

### 4.2 Per garment public material

- Suits and jackets: the 12 measurements above are the published custom set
  (article FAQ: "For a full custom suit, all 12"). Their dedicated size
  chart page (section 4.4) is titled for jackets and suits. The verified
  form sets differ from the article: a large suit set and a smaller
  jacket set, recorded in section 6.2.
- Shirts: a Shirt Size Guide appears on product and collection pages with
  letter sizes mapped to US numbers, S (36) to 5XL (50), and finished
  garment columns Shoulder, Front Length, Full Sleeve, Half Sleeve, Chest,
  Stomach. Example row: L (40) has Shoulder 19, Front Length 29, Full
  Sleeve 25, Chest 47, Stomach 46. No public shirt self measurement field
  list was found; the verified shirt form set is 7 fields with Neck
  first (sections 4.5 and 6.2).
- Trousers: a Trouser Size Guide on pants pages (see 4.4) and fit style
  descriptions on a Styles and Fit Info page
  (https://www.studiosuits.com/pages/styles-fit-info, observed via search
  snapshot 2026-10-29). No public trousers self measurement field list was
  found beyond the suit set's leg fields; the verified trousers form set
  is 8 fields, exactly the suit's trouser block (section 6.2).
- Waistcoats: a Waist Coat Size Guide on product pages, US 36 to 62,
  finished Chest (size plus 3.5), finished Stomach, and Length, in Short,
  Regular, and Long variants. The verified waistcoat form set is only 3
  fields: Vest Length, Chest, Stomach (section 6.2).
- Women: a size guide on product pages keyed to bust: "What Size You Need"
  30 (XXS) to 46 (4XL), each matched to a bust band (for example 40 (XL)
  suits a bust of 39 to 40), with finished Jacket Bust (size plus 4),
  Jacket Length, Jacket Shoulder, Jacket Sleeves, Jacket Stomach, and
  Jacket Hem Width columns. No public women's self measurement field list
  was found; the verified women's suit form set is the men's suit set
  with every field required (section 6.2).
- Kids: a Kids Size Guide on product pages by age, 12 months to 10 years,
  with Jacket Length, Jacket Chest, Shoulder, Sleeves, Pants Waist (a body
  range, for example 26 to 28 at age 8), and Pants Length. No public kids
  self measurement field list was found, and no kids form was captured
  either; kids field sets remain unverified (section 9).

### 4.3 The flow, from the verified 2026-10-26 journey

Recorded in the audit notes from a live walk on 2026-10-26, not re-run for
this study: the builder Size step has Made to Measure and Standard Size
tabs. Made to Measure shows no fields in the builder and defers collection
to the cart. The Standard Size tab opens separate jacket and trouser
popups: jacket sizes 36 to 60 with lengths Short, Regular, Long; trouser
sizes 28 to 58 with inseam options including Unhemmed; nothing is
preselected, and applying an incomplete choice answers "Select all options
please!". In the cart, each item shows a Measurement Profile column with
"Add Measurements Now" and "Later"; choosing Later does not block entering
checkout; "Add Measurements Now" redirects to a login page. The guide
article (fetched 2026-10-29) is consistent with this: it ends by telling
the reader to browse the collection and "enter the measurements at
checkout".

The 2026-10-29 capture (section 4.5) verified what sits behind that
login: the form opens inline from the cart item's "Create new
measurements", offers up to three entry modes, and ends in a named
profile saved to the account, which the account's MY MEASUREMENTS page
lists by category. Choosing "Later" leaves the item showing "No profile
added for this product" and does not block the cart.

Two cautions from the same journey, already recorded as benchmark flaws not
to copy: the jacket size guide on their pages runs to size 62 while the
builder dropdown stops at 60, and the same suit appeared at three different
prices across their surfaces.

### 4.4 The standard size charts (supporting context)

Source: "Ordering Custom made Jacket or Suit",
https://www.studiosuits.com/pages/suit-sizing (fetched 2026-10-29). Every
chart on their pages carries an inch and centimeter toggle that converts
the table in place. "Our Default is US Sizing" is stated on the charts, and
an international conversion line gives US and UK jacket sizes identical,
European equal to US plus 10.

Jackets, Ready Size (US) 36 to 62 in steps of 2, finished garment columns
Shoulder, Chest (all round), Stomach (all round), Sleeve Length, Jacket
Length, with separate Short, Regular, and Long tables:

| Size | Shoulder | Chest | Stomach | Sleeve (Regular) | Length (Regular) |
| --- | --- | --- | --- | --- | --- |
| 36 | 17.5 | 39 | 36.5 | 24 | 29 |
| 40 | 18 | 43 | 40.5 | 24.5 | 29.5 |
| 44 | 19 | 47 | 44.5 | 25.25 | 31 |
| 48 | 20 | 51 | 48.5 | 25.5 | 32 |
| 52 | 21 | 55 | 53 | 25.5 | 33 |
| 56 | 22 | 59 | 57 | 26.5 | 33.5 |
| 62 | 23.5 | 65 | 63 | 27 | 34 |

The finished chest is the size number plus 3 in every row. The Short and
Long tables differ from Regular only in the Sleeve Length and Jacket Length
columns, Short shorter and Long longer, by up to two inches depending on
the size and the column, and identical to Regular at a few larger sizes.
The guide header
instructs: measure your chest and choose the size that corresponds; if
between sizes, go up.

Trousers, Ready Size (US) 30 to 60 in steps of 2, finished garment columns
Waist Circumference, Pant Hip, Pant Thighs, Leg Opening, Front Rise:

| Size | Waist | Hip | Thigh | Leg Opening | Front Rise |
| --- | --- | --- | --- | --- | --- |
| 30 | 32 | 37 | 23.5 | 14 | 10.5 |
| 36 | 38 | 44.5 | 26.5 | 15 | 11 |
| 40 | 42 | 48.5 | 28.5 | 16 | 12 |
| 46 | 48 | 55.5 | 31.5 | 18 | 13 |
| 52 | 54.5 | 62 | 36 | 19 | 14 |
| 60 | 62.5 | 70 | 40.5 | 20 | 15.25 |

The finished waist is the size number plus 2 up to size 46, then plus 2.5.
The chart header on pants pages instructs the shopper to choose the waist
size they usually buy, noting the actual pants will measure more than the
selected size: the standard flow is keyed to the label size, while the
chart's own waist column is the true circumference. Both meanings are in
play on their pages at once (see the flag in section 6).

Benchmark inconsistency, recorded because it decides what "in sync" can
mean: the trouser chart on pants product pages (search snapshot,
2026-10-29) does not match this dedicated chart page. At size 38 the thigh
is 27.5 on the chart page and 28 on the pants page; the leg opening at size
30 is 14 on the chart page and 15.5 on the pants page; at size 40 it is 16
versus 17. Even the benchmark disagrees with itself across pages, so
alignment must name one canonical source per garment. This study treats the
dedicated chart page and the guide article as canonical and product page
popups as secondary.

### 4.5 The measurement form, verified behind login (2026-10-29)

Method: Avenash signed in to his own StudioSuits account in the browser
(registered and signed in during the session) for a read only inspection,
7:52 to 8:23 AM EDT. No order was placed, no checkout entered, no
measurements submitted or saved, and no account settings changed. All 11
items added for the inspection were removed afterwards, the cart was
verified empty, and the account's MY MEASUREMENTS section was verified
to still list no saved profiles. Full record: workspace audit notes,
studiosuits-measurements-form-capture-2026-10-29.md.

Flow facts, common to all categories:

- Product pages offer "Made to Measure" alongside "Standard Size", with
  the note "Measurements can be added on the Cart page." Nothing is
  collected in the builder.
- The cart carries a Measurement Profile column per item. Each item shows
  "Create new measurements", "Later" (deferred measurement), and "No
  profile added for this product".
- "Create new measurements" expands inline with up to three entry modes:
  MEASURE YOUR BODY, MEASURE EXISTING GARMENT, and MODIFY A STANDARD
  SIZE. All three were verified for suits, shirts, trousers, jackets,
  waist coats, and leather vests; their availability in some other
  categories is partly unverified (section 9).
- MEASURE YOUR BODY opens a modal on the cart page: a single long form
  in a two column grid, a right hand instruction pane that swaps in the
  focused field's guidance text and instructional image, a PRINT link,
  one SAVE button, and no Next or Back. Body fields mostly use color
  photographs of a model with a red measuring tape at the placement;
  length, rise, and hem fields in several categories use line diagrams
  with dashed start to finish lines. The existing garment mode uses flat
  garment line diagrams throughout.
- Units: the form is inches only. Its unit control opens an inline cm to
  inch converter beside the form; it does not convert the form itself,
  and there is no unit toggle. Converter behavior was not tested.
- Every body form starts with ENTER NAME (required; whose clothes these
  are) and HEIGHT (required; FT dropdown 4 to 7 and IN dropdown 0 to 11,
  plus a box offering a recommendation whose behavior was not observed),
  and ends with MEASUREMENT PROFILE NAME (required), prefilled
  "[Category]_[date]", then SAVE. The saved profile attaches both to the
  cart item and to the account, whose MY MEASUREMENTS page lists the
  same categories with a create new size action.
- Validation, tested once on the suit form: SAVE with everything empty
  saved nothing, the modal stayed open, the page scrolled to the first
  field, and a single red inline error appeared under ENTER NAME. The
  evidence points to first error only reporting, not all errors at once;
  it was not retested on other garments.

The per garment field sets, with required and optional flags and the fit
dropdowns, are recorded in section 6.2, which now states the verified
sets instead of proposals. Two guidance facts from the form are load
bearing for suits.me's design: the waist guidance warns the shopper not
to give the label size and to measure the waist where the pants will be
worn (the form asks for the body waist only, which confirms INC-05), and
guidance text is per garment, not shared blindly (their shirt sleeve
guidance, shoulder tip to the knuckle of the thumb, differs from their
suit sleeve guidance).

The conflict with section 4.1, stated plainly: the published guide's 12
field set does not match the real form. The form has no wrist field, no
inseam and no outseam in body mode, and it adds stomach, seat, front
rise, back rise, knee, leg opening, and height. The real form is the
canonical benchmark for per garment field sets and for the measurement
experience; the guide article remains evidence for how they teach
measuring, and the chart page for size table numbers. Owner input O1 is
resolved accordingly (section 8).

## 5. Field by field comparison

### 5.1 Body measurement fields

StudioSuits column: the verified MEASURE YOUR BODY form for a suit
(capture of 2026-10-29, section 4.5), with garment specific fields noted
from the other verified forms. Their accepted value ranges were not
observed and remain unverified (section 9).

| Field | suits.me today | StudioSuits verified form | Gap |
| --- | --- | --- | --- |
| Neck | Absent entirely | Not asked for a suit; field 1 of 7 in the shirt form | suits.me cannot size a collar; the benchmark asks neck only for the garment cut from it |
| Height | Absent | Required preamble on every form (FT and IN dropdowns, plus a recommendation box) | suits.me profiles carry no height at all |
| Chest | "Chest", all garments, 26 to 70 in | Suit field 1; present in every upper garment form | Same field; guidance depth differs (5.2) |
| Sleeves | "Sleeve length", all garments, 17 to 40 in | Suit field 2 ("Sleeves"); the shirt form's sleeve guidance differs from the suit's | Same field; benchmark guidance is per garment |
| Shoulder | "Shoulder width", all garments, 12 to 28 in | Suit field 3 ("Shoulder") | Same field |
| Jacket length | "Jacket length", all garments, 22 to 42 in; a garment target in a body flow | Suit field 4; shirt and long coat forms use a Front Length variant | Same field; suits.me does not label it as a garment target (INC-08) |
| Bicep | Absent | Suit field 5, optional; also in the jacket and long coat forms, optional | Missing on suits.me |
| Stomach | Absent as a body field | Suit field 6; also in the jacket, shirt, waistcoat, and long coat forms | Missing on suits.me |
| Pants length | Absent; suits.me collects inseam and outseam instead | Suit field 7; the length field of every trouser block in body mode | Missing on suits.me |
| Waist | Two fields: "Natural waist" and "Trouser waist", all garments | One "Waist" (suit field 8), the body waist, its guidance warning against giving the label size | suits.me asks for two waists, the benchmark asks for one (INC-05) |
| Seat | "Seat / hips", all garments, 26 to 78 in | Suit field 9 ("Seat"); also asked in the jacket and shirt forms | Same field; the benchmark asks it for more garments than suits.me's grouping suggests |
| Front rise | Absent | Suit field 10 | Missing on suits.me |
| Back rise | Absent | Suit field 11, optional | Missing on suits.me |
| Thighs | "Thigh", all garments, 15 to 42 in | Suit field 12 ("Thighs") | Same field |
| Knee | Absent | Suit field 13, optional | Missing on suits.me |
| Leg opening | Absent | Suit field 14, optional, last of the enumerated suit fields | Missing on suits.me |
| Inseam | "Inseam", all garments, 20 to 42 in | Not in body mode; appears as a selector in modify a standard size and as a field in the garment mode | suits.me collects a field the benchmark's body form never asks (see 6.2) |
| Outseam | "Outseam", all garments, 30 to 55 in | Not in body mode; appears in the garment mode and as an automatic field in modify a standard size | Same as inseam |
| Wrist | Absent | Only in the published guide's 12; no verified form asks it | No gap against the form; the guide alone suggested one |
| Fit dropdowns | A fit value rides on the profile draft, not presented as part of measuring | Jacket Fit, Trouser Fit, and Shirt Fit dropdowns inside the forms, with stated defaults, stored on the profile (6.2) | Fits are part of the benchmark's measurement profile; on suits.me they are incidental |

Field count by garment, self measurement (body mode; counts are the
enumerated fields of section 6.2):

| Garment | suits.me requires | StudioSuits verified form |
| --- | --- | --- |
| Suit | The same 10 | 14 enumerated fields, plus Jacket Fit and Trouser Fit dropdowns |
| Jacket | The same 10, including 5 trouser fields | 7 enumerated fields, plus Jacket Fit; no trouser fields, but Seat is asked |
| Waistcoat | The same 10 | 3 fields: Vest Length, Chest, Stomach |
| Trousers | The same 10, including 5 jacket fields | 8 fields, exactly the suit's trouser block, plus Trouser Fit |
| Shirt | The same 10, no neck | 7 fields, Neck first, plus Shirt Fit |
| Long coat (no suits.me kind today) | n/a | 7 enumerated fields, Front Length instead of Jacket Length |
| Shorts (no suits.me kind today) | n/a | 7 fields, Shorts Leg Opening required |
| Leather jackets (no suits.me kind today) | n/a | The jacket set, with different Jacket Length guidance and image |
| Leather pants (no suits.me kind today) | n/a | 8 fields, order differs from trousers, Knees required |
| Leather vest | n/a | Maps to the waistcoat form exactly |
| Women, suit | The same 10 men's fields, body only | The suit set with every field required, including the ones optional for men |
| Women, jacket or pants kinds | The same 10 | No separate forms captured; unverified (section 9) |
| Boys | The same 10, lowered minimums by entry path only | No form captured; their public guide keys sizes to age; unverified (section 9) |

### 5.2 The journey around the fields

| Aspect | suits.me today | StudioSuits (verified form and public evidence) |
| --- | --- | --- |
| When measurements are taken | Before the item can be bagged; the customizer cannot proceed without a profile (SIZ-05) | Deferred: nothing in the builder; added from the cart per item, "Later" allowed (2026-10-26 journey, confirmed in the 2026-10-29 capture) |
| Entry shape | Customizer step, Studio wizard, Quick Add (profile required) | Cart Measurement Profile per item; "Create new measurements" opens one of up to three entry modes (verified 2026-10-29) |
| Grouping and order | Two fixed groups: 5 jacket fields, then 5 trouser fields, whatever the garment | One single long form per garment with no group headings; for a suit a jacket block runs into a trouser block; order is the verified order of section 6.2 |
| Per field guidance | One line tip plus a line drawing highlight on a shared figure; a "How to measure" modal per field | An instruction pane beside the form swaps in the focused field's guidance text and image: photographs of a model with a red tape for body fields, line diagrams for rises, lengths, and hems; the guide article adds placement and common error teaching |
| Helper guidance | One line at step 0: ask someone to help with back measurements | Names the exact 3 fields that need a second person |
| Accuracy guidance | Ranges enforced; no technique guidance beyond the tips | Measure twice, write numbers down as you go, close fitting clothes, shoes on for leg fields |
| Body vs garment clarity | Body flow containing one garment field, unlabeled as such (INC-08) | Explicit: the body mode is labeled "all measurements are in Inches" body entry, and the garment measuring mode is a separate, labeled entry mode in the same flow |
| Alternative route | None | Two further entry modes inside the form flow: measure an existing garment (garment fields, all required, flat line diagrams) and modify a standard size (size selects plus garment detail fields); both verified for the suit (section 4.5) |
| Units | Inches canonical; centimeter entry converts and stores inches; toggles in wizard and guide; rounding differs by surface (INC-10) | Charts toggle inches and centimeters in place; the form is inches only, with a cm to inch converter beside it and no unit toggle (verified) |
| Input style | Number inputs with min and max, steppers off, one field per row; stepped wizard | Single long form, two column grid, dropdowns for height and fits, one SAVE button, no steps (verified) |
| Validation | Per field ranges in the wizard, all problems listed per step (Wave 1, SIZ-06); server flat rule differs (INC-02) | First error only on the suit form's empty save test: one inline error, scroll to the first field, nothing saved (verified once, section 4.5) |
| Profiles | Named, reusable across garments, local plus account sync; wearer filtered | Named profile per garment, name prefilled "[Category]_[date]", attached to the cart item and listed in the account by category (verified) |
| Standard size in the same step | Yes: jacket, trouser, and length selects, nothing preselected; refused for Women and Boys | Yes: separate jacket and trouser popups, nothing preselected, incomplete apply refused with a message; jacket 36 to 60, trousers 28 to 58 with inseam options (2026-10-26 journey) |

### 5.3 Standard size sets and tables (supporting context)

| Garment | suits.me | StudioSuits |
| --- | --- | --- |
| Jacket sizes offered | 30 to 62, step 2, one set for all men's garments | Chart 36 to 62 step 2; builder dropdown 36 to 60 (2026-10-26); modify a standard size mode offers 36 to 62 with Regular, Long, Short lengths (verified 2026-10-29) |
| Jacket table content | Size number and body chest (equal by rule), inches and cm | Finished shoulder, chest (size plus 3), stomach, sleeve, length, per length class, inches and cm |
| Trouser sizes offered | 28 to 64, step 2 | Chart 30 to 60 step 2; builder 28 to 58 with inseam choices including Unhemmed (2026-10-26); modify a standard size mode offers waist 30 to 60 and inseam 28 to 40 (verified 2026-10-29) |
| Trouser table content | Size number and body waist (equal by rule) | Finished waist (size plus 2, then plus 2.5), hip, thigh, leg opening, front rise |
| Lengths | Short, Regular, Long as names only | Short, Regular, Long tables with actual sleeve and length values |
| Shirts | No standard set and no table | Letter sizes S (36) to 5XL (50) with finished columns |
| Waistcoats | No table; uses the suit ready shape | US 36 to 62 with finished chest, stomach, length |
| Women | No standard sizes, no table | 30 (XXS) to 46 (4XL) keyed to bust bands, finished columns |
| Boys and kids | No standard sizes, no table | By age 12 months to 10, garment columns plus a body pants waist range |
| International | Not shown | US and UK identical; Europe is US plus 10 |
| Ordering rule | Size number equals the body measurement | Same rule stated for ordering (a 40 inch chest orders a 40), with the finished garment values shown beside it |

The ordering rules already agree. What differs is that StudioSuits shows
the finished garment consequences of each size and covers every garment
and wearer group, while suits.me shows only the one body number each size
is keyed to, for men's jackets and trousers only.

## 6. What "in sync" should mean for suits.me

Three layers, in the order the plan builds them. The headline layer is the
experience; fields come second; values are supporting.

### 6.1 Experience alignment (the headline)

The self measurement journey per garment should work the way StudioSuits'
verified form does:

- A shopper measuring for a specific garment is asked only for that
  garment's measurements, in the benchmark's verified field order, and
  can see the whole set before starting. The verified benchmark form is
  a single long form per garment with a right hand instruction pane;
  the content requirements below apply whether suits.me keeps its
  stepped wizard shape or adopts the single form shape.
- Every field carries placement guidance and the common error for that
  field, in suits.me's own words and its own artwork in the same
  instructional style the benchmark uses (photographs for body fields,
  line diagrams for rises, lengths, and hems), produced as suits.me
  originals generated using the benchmark's images as reference (O9,
  decided 2026-10-29), with the fields that need a second person flagged
  on the field itself. Guidance text is per garment where the
  benchmark's differs per garment (their shirt sleeve guidance differs
  from their suit sleeve guidance).
- Every field is labeled as a body measurement or a garment target.
- Entry modes and timing are settled scope, decided by Avenash on
  2026-10-29: the benchmark's form opens from the cart per item and
  offers three entry modes (measure your body, measure an existing
  garment, modify a standard size). suits.me adopts all three: the
  deferred measurements timing (O7, package M6) and the other two modes
  (O10, packages M7 and M8) are all in scope for this wave.
- The profile is named for the shopper: the benchmark prefills the
  profile name with the category and the date; suits.me profiles should
  be prefilled the same way and remain editable.
- Units: suits.me keeps its inch and centimeter entry, a deliberate
  divergence from the benchmark's inches only form with a side
  converter, kept because it is better for the shopper, under one
  conversion and rounding rule everywhere (today the rule differs by
  surface, INC-10).
- Validation: suits.me keeps reporting every problem on a step together
  (Wave 1, SIZ-06), a deliberate divergence from the benchmark's first
  error only reporting, kept because it is better, and the client and
  the server enforce the same ranges (today they do not, INC-02). Both
  divergences were confirmed as settled decisions by Avenash on
  2026-10-29 (O11); they are decisions, not gaps.
- The standard size alternative sits in the same step, shows what the
  size means, and is available to every wearer group the shop offers it
  to, or is honestly absent with a reason.

### 6.2 Fields alignment

Per garment field sets are no longer proposals. The sets below are the
verified MEASURE YOUR BODY form sets (capture of 2026-10-29, section
4.5), in the form's order, and they are the design targets for packages
M0 to M4. Avenash confirmed on 2026-10-29 (O5) that suits.me collects
exactly the fields the verified forms ask, changing later if required,
so no shop side confirmation gates these sets. Required means the
benchmark's form will not save without it.

Every form also carries a preamble and a closing field that are part of
the measurement profile: ENTER NAME (required; whose clothes these are)
and HEIGHT (required; FT dropdown 4, 5, 6, 7 and IN dropdown 0 to 11,
plus a recommendation box) before the garment fields, and MEASUREMENT
PROFILE NAME (required, prefilled "[Category]_[date]") after them, then
SAVE. The fit dropdowns named below live inside the forms, after the
body fields, and are part of the profile.

Counts are the enumerated body fields. The capture's category headers
count two more fields for the suit and the women's suit, and one more
each for the jacket, long coat, and leather jackets, than their
enumerations name; the enumerations below are treated as the verified
sets, and the difference is carried as unverified in section 9.

- Suit (14 enumerated body fields): Chest, Sleeves, Shoulder, Jacket
  Length, Bicep (optional), Stomach, Pants Length, Waist, Seat, Front
  Rise, Back Rise (optional), Thighs, Knee (optional), Leg Opening
  (optional). Then two fit dropdowns: JACKET FIT (default Regular Fit;
  options Regular Fit, Slim fit) and TROUSER FIT (default Classic
  Comfort Fit; options Classic Comfort Fit, Straight Fit, Slimmer
  Straight, Baggy, Slimmer Tapering). The jacket block (Chest to
  Stomach) runs into the trouser block (Pants Length to Leg Opening)
  with no headings. The two waists question is resolved in the
  benchmark's favor by the form itself: one body waist (see O4).
- Jacket (7 enumerated body fields): Chest, Sleeves, Shoulder, Jacket
  Length, Bicep (optional), Stomach, Seat. Then JACKET FIT, same options
  and default as the suit. Note the benchmark asks Seat in a jacket only
  form and asks no trouser fields.
- Waistcoat (3 body fields): Vest Length, Chest, Stomach. No fit
  dropdown.
- Trousers (8 body fields): Pants Length, Waist, Seat, Front Rise, Back
  Rise (optional), Thighs, Knee (optional), Leg Opening (optional).
  Then TROUSER FIT, same options and default as the suit. Exactly the
  suit's trouser block.
- Shirt (7 body fields): Neck, Chest, Sleeve, Shoulder, Front Length,
  Stomach, Seat. Then SHIRT FIT (default Relaxed; options Slim Fit,
  Relaxed). No bicep and no trouser fields; Front Length is the shirt
  analogue of Jacket Length.
- Long Coat (7 enumerated body fields; overcoats map to this form):
  Chest, Sleeves, Shoulder, Front Length, Bicep (optional), Stomach,
  Seat. No fit dropdown. suits.me has no long coat kind today; the set
  is recorded so a future kind starts aligned.
- Shorts (7 body fields): Shorts Length, Waist, Seat, Front Rise, Back
  Rise (optional), Thighs, Shorts Leg Opening (required here, unlike
  trousers). No Knee and no fit dropdown. No suits.me kind today;
  recorded for the same reason.
- Leather Jackets (7 enumerated body fields): the jacket set, but the
  Jacket Length guidance differs (measure straight down from the
  shoulder to the hem) and its image is a line diagram instead of a
  photograph. JACKET FIT present. No suits.me kind today.
- Leather Pants (8 body fields): Pants Length, Waist, Seat, Thighs,
  Front Rise, Knees (required), Back Rise (optional), Leg Opening
  (optional). The order differs from trousers (Thighs before Front
  Rise, Knees after Front Rise). No fit dropdown. No suits.me kind
  today.
- Womens Suit (14 enumerated body fields, ALL required): Chest,
  Sleeves, Shoulder, Jacket Length, Stomach, Bicep, Pants Length,
  Waist, Seat, Front Rise, Back Rise, Thighs, Knee, Leg Opening. The
  same set as the men's suit, but every field is required, including
  Bicep, Back Rise, Knee, and Leg Opening, which are optional for men,
  and Stomach comes before Bicep. Then JACKET FIT and TROUSER FIT, same
  options and defaults as men's.
- Leather Vest: no distinct form; it maps to the Waistcoat form exactly
  (Vest Length, Chest, Stomach), verified.
- Boys: no benchmark form was captured. Until one is, the boys' sets
  follow the men's garment sets with child ranges (packages M0 and M4).

Two consequences of aligning to the verified sets, flagged for the
schema design in M0. First, suits.me's inseam and outseam fields appear
in no verified body form: the benchmark's body mode asks Pants Length
for the leg, and inseam appears only as a selector in their modify a
standard size mode. Under the O5 decision (collect what the verified
forms ask), inseam and outseam leave the body profile: they remain
only where the benchmark uses them, in the ready size flow (O8) and
the modify a standard size mode (package M8), and M0 must not carry
them into any body set. Second, because the fit dropdowns live
inside the benchmark's measurement profile, fits become per garment
profile data in the M0 schema, not a separate customization concern.

### 6.3 Values alignment (supporting)

- Size sets: align to the benchmark's published sets (jackets 36 to 62,
  trousers 30 to 60), replacing suits.me's wider sets (30 to 62, 28 to
  64). Decided by Avenash on 2026-10-29 (O3).
- Tables: rebuild the guide per garment with finished garment columns, in
  inches and centimeters, using the canonical chart page structure. The
  numbers in those columns are the benchmark's published finished
  values, adopted by Avenash on 2026-10-29 as suits.me's working values
  (O2): cutting allowances the same as StudioSuits (chest plus 3, waist
  plus 2) and the published finished garment chart columns become the
  basis for suits.me's finished numbers, which may therefore be
  published on that basis.
- The ordering rule (order the size that matches your body measurement)
  already matches and stays.

### 6.4 Where full alignment would conflict, flagged honestly

1. Finished garment values: adopting their chart numbers wholesale asserts
   suits.me cuts with identical allowances and grading. That is a
   production claim only the shop can make, and the shop made it:
   Avenash adopted the benchmark's allowances and finished values as
   suits.me's working values on 2026-10-29 (O2), so values alignment
   now covers their finished numbers as adopted, alongside size sets,
   structure, and the ordering rule.
2. Profile shape change: adding neck (shirts), bicep, stomach, pants
   length, front and back rise, knee, leg opening, and height, and
   resolving the two waists, changes the stored profile shape enforced
   by the client, the checkout validator, and the account validator. Saved profiles in
   shoppers' browsers and accounts will lack the new fields. The migration
   rule must be: a profile missing a now required field is offered for
   completion, never padded with a default or an inferred value. Anything
   else would guess a measurement.
3. Deferred measurements: their flow lets an order proceed with
   measurements to follow. suits.me's current rule, verified in Wave 0
   (SIZ-05), is that an item cannot be bagged without measurements.
   Reversing that is an operations decision about fulfillment, not a UX
   copy of the benchmark, and Avenash made it on 2026-10-29 (O7):
   deferred measurements are allowed, as the benchmark's cart allows,
   and package M6 is in scope for this wave.
4. The label size trap: their standard trousers flow keys off "the waist
   size you usually buy" while their own chart prints the true
   circumference beside it. Copying both conventions would import the
   ambiguity suits.me already has in INC-05. suits.me should carry one
   meaning per number and label it.
5. The benchmark's own guide does not describe its form: the published
   12 field set omits fields the form requires (stomach, the rises,
   knee, leg opening, height) and includes fields the form never asks in
   body mode (wrist, inseam, outseam). Alignment therefore follows the
   verified form for field sets and experience, and uses the guide and
   chart pages only for teaching content and size table structure. This
   is the resolution of owner input O1.

## 7. Wave plan: Measurements Wave (approved 2026-10-29)

Sequenced garment flow first, per the scope clarification: the shared
schema and guidance model land first because every garment flow depends on
them, then the garment flows in order of shopper volume, then the
supporting tables, then deferred measurements and the two additional
entry modes, all in scope per Avenash's decisions of 2026-10-29. Every
package follows the standing rules: the full existing test suite and the
root build pass in the package's own worktree before its PR opens, new e2e
journeys are wired into `pnpm test`, and no package ships a default,
preselected, or inferred measurement.

### M0: Shared measurement schema and guidance model (2 to 3 days)

One per garment, per wearer field schema as the single source: field keys,
labels, body or garment kind, order, required or optional per garment and
wearer, ranges per wearer, guidance content (placement, common error,
helper flag), the fit dropdowns that live inside the benchmark's forms
(section 6.2) as per garment profile data, the Enter Name and Height
preamble fields, and unit conversion and rounding rules. The wizard, the
customizer, and the guide render from it; both server validators are
regenerated or re-pointed at the same definitions. The profile shape is
versioned, with the completion prompt rule of section 6.4 for profiles
saved under the old shape. The wearer becomes an explicit wizard step.
suits.me's inseam and outseam fields, which appear in no verified body
form, leave the body profile under the O5 decision and are recorded in
the schema only for the ready and modify a standard size flows, never
carried into a body set. The README
inconsistency (INC-12) is closed here. No shopper visible flow change
beyond corrected labels and consistent ranges. Resolves INC-02, INC-08
(labeling), INC-10, INC-12, and the machinery behind INC-03 and INC-11.

Acceptance: the schema reproduces the verified sets of section 6.2 field
for field, including order, optional flags, fit dropdown options and
defaults, and the preamble; client and both server validators accept and
reject identically on boundary cases for every garment and wearer; a
profile saved under the old shape still loads, still orders, and is
offered completion rather than silently changed; the full suite and the
root build pass.

E2E: J-M0 schema parity journey (boundary values per field per garment
through the wizard and both validators), plus the existing suite unchanged
in behavior for legacy profiles.

### M1: Suit and jacket self measurement flow (3 to 4 days)

The wizard becomes garment aware for suits and jackets: the verified sets
of section 6.2, in the form's order (for a suit: chest, sleeves, shoulder,
jacket length, bicep, stomach, then pants length, waist, seat, front rise,
back rise, thighs, knee, leg opening), each field with placement guidance,
the common error, a helper flag where a second person is needed, per
garment guidance text where the benchmark's differs, and the figure
highlight suits.me already draws. The Enter Name and Height preamble and
the prefilled profile name land here for these garments, as do the in
form fit dropdowns (JACKET FIT and TROUSER FIT for a suit, JACKET FIT for
a jacket), stored on the profile. The two waists are resolved per O4. The
review step groups values by garment part. Quick Add routes into the same
flow when no profile exists. Resolves INC-01 (suits, jackets), INC-05,
INC-09 (for these garments).

Acceptance: a suit order can be completed with exactly the verified suit
set of section 6.2 and no field from another garment, with the fit
dropdowns present at their benchmark defaults until the shopper changes
them; a jacket only order asks for the verified jacket set, Seat
included, and no trouser fields; optional fields (bicep on both, and
back rise, knee, and leg opening on the suit) may be left empty without
blocking, and every other field is required; a profile missing a newly
required field cannot be bagged until completed, and is never auto
filled; validation still reports all problems at once (the kept
divergence of section 6.1); guidance, helper flags, and body or garment
labels show on every field; full suite and root build pass.

E2E: J-M1a suit measuring journey end to end (customizer to wizard to bag
to demo checkout with the suit set intact); J-M1b jacket only journey
proving the trousers fields are neither asked nor required; J-M1c legacy
profile completion prompt journey.

### M2: Trousers and waistcoat flow (2 days)

Trousers only orders take the verified 8 field trouser set and nothing
else, with the TROUSER FIT dropdown stored on the profile; waistcoats
take their verified 3 fields (Vest Length, Chest, Stomach) and no fit
dropdown. Ready profiles become per garment, so a trousers only order
records no jacket size. Standard trousers carry an inseam choice in
the ready flow, including Unhemmed, as the benchmark offers (O8,
decided 2026-10-29, change later if required). Resolves INC-01
(trousers, waistcoats) and INC-07.

Acceptance: trousers only and waistcoat journeys complete with exactly
the verified sets of section 6.2 (back rise, knee, and leg opening
optional on trousers; all three waistcoat fields required); a ready
trousers journey offers the inseam choice including Unhemmed and
records the choice on the profile; bag and
order summaries show only the sizes actually chosen; full suite and
root build pass.

E2E: J-M2a trousers only measuring journey; J-M2b waistcoat journey; J-M2c
ready trousers journey showing no jacket size recorded.

### M3: Shirt flow (2 days)

Shirts gain the verified set: neck first, then chest, sleeve, shoulder,
front length, stomach, and seat, with the SHIRT FIT dropdown (default
Relaxed) stored on the profile and the shirt specific sleeve guidance
(shoulder tip to the knuckle of the thumb). The verified set is smaller
than the set this study originally proposed: it has no waist, bicep, or
wrist field, and it adds Front Length and Seat, which the proposal
missed. A shirt only order asks for no leg fields and no jacket length.
Resolves INC-01 (shirts) and the neck gap for the garment that needs it
most.

Acceptance: shirt journey completes with exactly the verified 7 field
set; a shirt profile cannot be saved without a neck value; full suite
and root build pass.

E2E: J-M3 shirt measuring journey end to end, including the neck field's
guidance and validation.

### M4: Women and boys flows (3 days)

The wearer is chosen explicitly in the wizard (machinery from M0) and the
women's and boys' flows get their own sets and ranges. For women, the
verified women's suit set governs: the men's suit fields in the form's
order, with every field required, including bicep, back rise, knee, and
leg opening, which are optional for men, and the same two fit dropdowns.
The benchmark's women's form keeps "Chest" naming (its chest guidance
uses a female model), so no bust renaming is introduced unless the shop
asks for it. Boys have no verified benchmark form (their public guide
keys sizes to age), so boys' ranges are set with owner input and their
field sets follow the men's garment sets until a benchmark exists.
Both groups also get standard size alternatives, like the benchmark:
women by bust band and kids by age, using the benchmark's published
sets as the working source (O6, decided 2026-10-29). Resolves INC-03,
INC-04 (body flow half), INC-11.

Acceptance: entering the wizard from any door produces the same rules
for the same wearer; a women's suit journey completes with the verified
set and refuses to save while any field, including the ones optional
for men, is empty; a boys' journey completes with its own fields and
ranges; standard size journeys for a women's garment (by bust band)
and a boys' garment (by age) complete using the benchmark's published
sets; no men's table or set is presented as applying to them; full
suite and root build pass.

E2E: J-M4a women's measuring journey; J-M4b boys' journey entered from the
navigation Studio (the door that fails today); J-M4c wearer switch journey
proving profiles filter correctly per wearer; J-M4d women's and boys'
standard size journeys.

### M5: Standard size and guide alignment (2 to 3 days, supporting)

The guide is rebuilt per garment from the schema: men's jacket and trouser
tables with finished garment columns published on the basis Avenash
adopted under O2 (the benchmark's allowances and published finished
values as suits.me's working values), shirt and waistcoat tables,
women's and kids' tables using the benchmark's published sets (O6), the
international conversion line, and one conversion rule
throughout. Ready size sets are aligned to the benchmark's published
sets, jackets 36 to 62 and trousers 30 to 60 (O3).
The guide states, per table, whether its numbers are body or finished
garment values. Resolves INC-04 (table half) and INC-06.

Acceptance: every garment the shop sells has a guide table or an explicit
body only note; finished garment columns match the adopted benchmark
values; the guide and the ready selects offer the same sets, jackets
36 to 62 and trousers 30 to 60; full suite and root build pass.

E2E: J-M5 guide journey (open the guide from each garment's customizer,
switch units, confirm the offered sizes match the ready selects).

### M6: Deferred measurements (2 to 3 days)

In scope for this wave: Avenash decided on 2026-10-29 (O7) that an
order may be placed with measurements to follow, as the benchmark's
cart allows. The bag and checkout accept a "measurements to follow"
state, the order and the account surface it as incomplete, and the shopper
is prompted to complete the profile from the account. Nothing about demo or
live payment behavior changes.

Acceptance: an order placed without measurements is visibly incomplete
everywhere it appears; completing the profile later attaches it to the
order; orders with measurements behave exactly as today; full suite and
root build pass.

E2E: J-M6 deferred journey (bag without measurements, demo order,
completion from the account, order shows complete).

### M7: Measure existing garment entry mode (estimated 3 to 4 days)

In scope for this wave per O10 (decided 2026-10-29). The second entry
mode from the benchmark's form: the shopper measures a garment they
already own instead of their body. This is a second, garment
measurement schema per category (all fields required, flat garment
line diagram guidance of the kind section 4.5 records), reusing the
M0 schema and guidance machinery, plus a body versus garment profile
type in storage so the two profile kinds are never confused downstream.
For the suit, the verified garment set is the one captured in section
4.5 (jacket chest, shoulder width, jacket midsection, jacket length,
sleeve length, bicep width, waist circumference, sleeve opening, hip
width, thigh width, knee width, leg opening, outseam, front rise, back
rise, after the name and height preamble). The day size is an
estimate, not a measured package size.

Acceptance: a suit order can be completed through the garment mode
with exactly the verified garment set and no body field asked; garment
profiles are stored and labeled as garment profiles, and are never
validated against body ranges; the other categories follow the same
schema pattern; full suite and root build pass.

E2E: J-M7 garment mode journey (suit measured from an existing jacket
and trousers, through to the bag with the garment profile intact).

### M8: Modify a standard size entry mode (estimated 3 to 5 days)

In scope for this wave per O10 (decided 2026-10-29). The third entry
mode from the benchmark's form: the shopper picks a standard size
(jacket size, jacket length, trouser waist, inseam) and adjusts
prefilled garment detail fields to the exact dimensions they want.
The prefilled values come from the finished garment values adopted
under O2, so a shopper starts from a real size's dimensions, not
zeros, and edits from there. The day size is an estimate, not a
measured package size; it is larger than M7's because the size driven
prefill depends on the finished value tables landing in M5 first.

Acceptance: selecting a standard size prefills the garment detail
fields with that size's adopted finished values; edited values are
what reach the bag and the order; an unedited prefill is never
submitted silently as if it were a shopper's own measurement without
the mode's explicit save action; full suite and root build pass.

E2E: J-M8 modify mode journey (select a suit size, adjust two detail
fields, save, and confirm the adjusted values on the bag line).

### Totals

The full wave, M0 to M8, is roughly 22 to 29 engineer days: the core
M0 to M5 at 14 to 17 days, M6 at 2 to 3 days, M7 at an estimated 3 to
4 days, and M8 at an estimated 3 to 5 days. The M7 and M8 sizes are
estimates, marked as such in their package sections; the rest follow
the sizing basis below.

Package day sizes for M0 to M5 are unchanged by the verified form
capture. The verified sets differ from the sets this study first
proposed (the suit set is larger than the guide based proposal, the
shirt set smaller, the waistcoat set exact), but every set is data in
the M0 schema rather than new code per garment, so the differences do
not move the estimates.

Sequencing: M0 first; M1 next; M2 and M3 in either order after M1's
patterns settle; M4 after M1; M5 last among the core, because the
tables depend on the adopted values and sets of O2, O3, and O6; M6
after the core flows it defers; M7 after M0, whose machinery it
reuses; M8 after M5, whose finished value tables drive its prefill.

## 8. Owner inputs and decisions needed

Each is stated so it can be settled in one answer. All ten open
questions were answered by Avenash on 2026-10-29 and are marked
RESOLVED below with his answers; O1 was resolved earlier the same day.

- O1: RESOLVED on 2026-10-29, in favor of the form. The canonical
  benchmark for per garment field sets and the measurement experience is
  StudioSuits' real measurement form, verified behind Avenash's own
  login that day (section 4.5), not their published guide article, whose
  12 field set the form does not use. For size table numbers in the
  values layer, the dedicated chart page (fetched 2026-10-29) remains
  the canonical public source, because their product page charts
  disagree with it in places (section 4.4). No owner answer is needed.
- O2: RESOLVED on 2026-10-29. Avenash: suits.me's cutting allowances are
  the same as StudioSuits'. Their plus 3 chest, plus 2 waist, and the
  published finished garment chart columns (source: the StudioSuits
  chart page) become suits.me's working values, adopted by the owner,
  so finished garment numbers may be published on that basis.
- O3: RESOLVED on 2026-10-29. Ready size sets align to StudioSuits'
  published sets (jackets 36 to 62, trousers 30 to 60), replacing
  suits.me's wider sets (30 to 62, 28 to 64). Package M5's acceptance
  is updated accordingly.
- O4: RESOLVED on 2026-10-29. One body waist field, per Boone's
  recommendation, accepted by Avenash. "Trouser waist" merges into the
  single body waist field, with the profile migration of section 6.4.
- O5: RESOLVED on 2026-10-29. suits.me collects the fields StudioSuits'
  verified forms ask, per garment, changing later if required.
  Consequence, stated plainly: inseam and outseam leave the body
  profile, because no verified body form asks them; they remain only
  where the benchmark uses them, in the ready size flow (O8) and the
  modify a standard size mode (package M8).
- O6: RESOLVED on 2026-10-29. Women and boys get standard sizes like
  the benchmark: women by bust band, kids by age, using the
  benchmark's published sets as the working source. Packages M4 and
  M5 are updated accordingly.
- O7: RESOLVED on 2026-10-29. Deferred measurements are allowed, as
  the benchmark's cart allows. Package M6 is in scope for this wave,
  no longer optional or separately gated.
- O8: RESOLVED on 2026-10-29. Ready trousers carry an inseam choice
  like the benchmark, including Unhemmed, changing later if required.
  Package M2's acceptance is updated accordingly.
- O9: RESOLVED on 2026-10-29. Guidance media will be generated as
  suits.me originals using the benchmark's images as reference:
  photographs for body fields, line diagrams for rises, lengths, and
  hems.
- O10: RESOLVED on 2026-10-29. Both extra entry modes are in scope for
  this wave: measure existing garment as package M7 (estimated 3 to 4
  days) and modify a standard size as package M8 (estimated 3 to 5
  days), after M6. The wave total is updated in section 7 (Totals).
- O11: RESOLVED on 2026-10-29. Confirmed: suits.me keeps its own
  approach. Validation reports all problems at once (Wave 1, SIZ-06)
  rather than the benchmark's first error only, and shoppers enter
  values in true inches or centimeters rather than the benchmark's
  inches only form with a side converter. Both divergences are settled
  decisions.

## 9. Unverified register

- U1: VERIFIED on 2026-10-29 (this was the study's largest unknown).
  StudioSuits' measurement form itself: fields per garment, order,
  grouping, input style, entry modes, profile handling, and validation
  behavior on an empty save. Verified by direct inspection behind
  Avenash's own login, 7:52 to 8:23 AM EDT, read only: no measurements
  saved, no order placed, cart left empty, and the account verified to
  hold no saved profiles afterwards. Recorded in section 4.5, with the
  full capture in the workspace audit notes
  (studiosuits-measurements-form-capture-2026-10-29.md). What remains
  unverified about the form is carried in U8.
- U2: LARGELY RESOLVED on 2026-10-29. Whether StudioSuits uses different
  field sets per garment than the published suit set of 12: yes, and
  the verified sets are recorded in section 6.2 for suits, jackets,
  waistcoats, trousers, shirts, long coats, shorts, leather jackets,
  leather pants, and women's suits. Still unverified: a kids or boys
  form (none was captured) and separate women's jacket and women's
  pants forms.
- U3: Whether a StudioSuits order can complete payment with measurements
  still deferred, and how completion is followed up. The 2026-10-26 journey
  verified only that Later does not block entering checkout.
- U4: StudioSuits' centimeter chart values cell by cell. The inch and
  centimeter toggle mechanism was observed in the 2026-10-26 journey and
  the toggles appear on every chart fetched for this study, but the
  converted cells were not recorded.
- U5: StudioSuits' validation ranges for body measurement fields. Not
  published anywhere found.
- U6: suits.me's own production facts behind O2, O5, and O6: cutting
  allowances, which fields the tailors use, and whether women's and boys'
  standard size sets exist in the shop. None of this is in the codebase;
  it is owner input by design. RESOLVED by owner adoption on 2026-10-29:
  Avenash settled all three by adopting the benchmark's values, field
  sets, and published size sets as suits.me's working basis (section 8),
  so no separate shop side production fact remains outstanding.
- U7: How many saved shopper profiles exist in the wild under the current
  shape, and their wearer mix. No telemetry exists; the M0 migration is
  designed defensively (completion offered, nothing rewritten silently)
  because of this.
- U8: Residual unverified items from the 2026-10-29 form capture, taken
  from its own Not verified record: the alternate entry modes for
  categories other than the suit, and whether the modes not seen in
  some category expansions (long coat, shorts, leather pants, womens
  suit, leather jackets) exist there or the view was truncated; the
  height recommendation box's behavior (no height was entered); the cm
  to inch converter's behavior (no value was entered); how modify a
  standard size populates its detail fields when a size is selected;
  the category mapping for leather suit, leather blazer, custom jeans,
  cargo pants, and women's leather pants (presumed, not verified); the
  full text of several guidance strings, which the capture summarizes
  rather than quotes in full; whether first error only validation holds
  on forms other than the suit's (only the suit form's empty save was
  tested); and a field count reconciliation: the capture's category
  headers count 16 suit and womens suit fields and 8 jacket, long coat,
  and leather jacket fields, while its enumerations name 14, 14, 7, 7,
  and 7 respectively. The enumerations are treated as the verified sets
  in section 6.2 until a recheck settles the counts.

## Appendix A: suits.me evidence index

- Field set, ranges, tips, figure: `apps/website/public/app.js` line 75;
  Boys bounds line 76; unit conversion lines 114, 115, 119, 124; wizard
  lines 122, 126, 128; size guide line 118; method choice lines 109, 110;
  customizer step line 103 and validation line 104; account sync calls
  lines 128, 140.
- Overrides and summaries: `apps/website/public/complete.js` lines 3 to 17
  (kinds), 33, 34, 36 (wearer and filtering), 39 (profile summary), 98 to
  110 (account profile sync and pull), 120 to 129 (import offer).
- Quick Add profile requirement: `apps/website/public/quick-add.js` lines
  9 to 12.
- Navigation entry: `apps/website/public/navigation.js` line 25.
- Server validation: `apps/website/lib/commerce.ts` line 53 (cleanItems);
  `apps/website/lib/accounts.ts` lines 281 to 312 (cleanProfile).
- Size guide derivation: `docs/ux-audit/size-guide-draft.md`.
- Documentation drift: `apps/website/README.md` lines 11 and 44.

## Appendix B: StudioSuits sources

- Guide article, fetched 2026-10-29:
  https://www.studiosuits.com/blogs/articles/how-to-measure-yourself-to-get-the-ideal-custom-suit
- Size chart page, fetched 2026-10-29:
  https://www.studiosuits.com/pages/suit-sizing
- Styles and fit page, search snapshot 2026-10-29:
  https://www.studiosuits.com/pages/styles-fit-info
- Product and collection page size guides (jacket, trousers, shirt,
  waistcoat, women, kids), search snapshots crawled within the four days
  before 2026-10-29, including
  https://www.studiosuits.com/products/tailored-pants and
  https://www.studiosuits.com/products/opal-axis-shirt
- Builder, cart, and login gate behavior: the audit's verified live journey
  of 2026-10-26, recorded in the workspace audit notes
  (studiosuits-journey-live.md).
- Measurement forms behind login, verified capture 2026-10-29, 7:52 to
  8:23 AM EDT (Avenash's own account, read only, nothing saved, cart left
  empty): workspace audit notes,
  studiosuits-measurements-form-capture-2026-10-29.md.
