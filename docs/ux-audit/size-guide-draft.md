# SIZ-03 size guide draft: values from in code size data, for owner approval

Status: APPROVED FOR V1, shipped in package 2.4 (gap SIZ-03). The owner confirmed derivation rules D1 and D2 on 2026-10-27 and approved the v1 scope: only the body chest (jackets) and body waist (trousers) columns ship. Every other column in the draft tables below stays blank and is deferred until production supplies real values; nothing was estimated to fill them.

Owner decision recorded 2026-10-27: do not copy the benchmark site's size values (the benchmark publishes different finished measurements per product, so there is no single chart to copy). Draft from suits.me's own size data in the codebase instead. This draft follows that decision. The v1 guide lives in the standard size step of the Measurement Studio, shows the active unit's values (inches or cm, converted at times 2.54 with the storefront's existing rounding), and names the Short, Regular, and Long jacket lengths in guidance text only, with no numbers.

## 1. The rule used for every value

Every number in this draft is one of three kinds, and is labeled as such:

- (a) CODE: taken directly from the codebase, with a file and line citation.
- (b) DERIVED: computed from code values by a stated rule. The rule is written next to the value, and the owner must confirm the rule before it ships.
- (c) NOT DERIVABLE: the codebase contains no data for this cell. The cell is left blank for the owner or production to fill. Nothing in this class was estimated, interpolated, or borrowed.

Benchmark note (layout reference only, no values taken): the benchmark's guide uses a per size table with body and finished garment columns, a length variant split, and an in place unit toggle. Those are layout ideas only.

## 2. Inventory: every size datum in the code

### 2.1 Standard sizes offered (CODE)

Source: `apps/website/public/app.js` line 37, function `measure()` (the standard size step of the Measurement Studio). The repo README describes these as "standard US men's sizes" (`apps/website/README.md` line 11).

- Jacket size (US): 30 to 62 in steps of 2, 17 options. Generated in code as 30 + i times 2 for i in 0 to 16.
- Jacket length: three named options only: Short, Regular, Long. No numeric values exist anywhere in the code.
- Trouser size (US): 28 to 64 in steps of 2, 19 options. Generated in code as 28 + i times 2 for i in 0 to 18.
- Field labels in code: "Jacket size (US)", "Jacket length", "Trouser size (US)" (line 37; also `readyFields`, line 13).
- The standard size method is offered for Men only. For Women and Boys garments the customizer shows "Standard sizes are not offered for this garment. Your fit comes from guided body measurements." (`app.js` lines 27 and 28).

Server enforcement (CODE): `apps/website/lib/commerce.ts` line 8, function `cleanItems()`. A ready profile is rejected unless the jacket is an even integer from 30 to 62, the trouser is an even integer from 28 to 64, the length is one of Short, Regular, Long, and the wearer is not Women or Boys. The offered lists and the server rules agree exactly.

### 2.2 Guided body measurement fields and accepted ranges (CODE)

Source: `apps/website/public/app.js` line 8, the `fields` array. Values are stored canonically in inches; the flow validates each value against these ranges and shows the range in its error messages (package 1.3, PR #13).

| Field | Label shown | Step | Accepted range (in) |
| --- | --- | --- | --- |
| chest | Chest | Jacket | 26 to 70 |
| waist | Natural waist | Jacket | 22 to 70 |
| shoulder | Shoulder width | Jacket | 12 to 28 |
| sleeve | Sleeve length | Jacket | 17 to 40 |
| jacket | Jacket length | Jacket | 22 to 42 |
| seat | Seat / hips | Trousers | 26 to 78 |
| trouserWaist | Trouser waist | Trousers | 22 to 70 |
| thigh | Thigh | Trousers | 15 to 42 |
| inseam | Inseam | Trousers | 20 to 42 |
| outseam | Outseam | Trousers | 30 to 55 |

Notes:

- Each field also carries a measuring tip in the same array. The trouser waist tip reads, in part: "This is a body measurement, not the size printed on a trouser label." That sentence matters for section 4 below.
- Boys profiles lower only the minimums (`app.js` line 9, `measureBounds`): chest 18, waist 18, shoulder 8, sleeve 10, jacket 14, seat 20, trouserWaist 18, thigh 10, inseam 10, outseam 18. Maximums are unchanged. Boys never see standard sizes, so these ranges do not affect this guide.
- Server side body validation is looser than the UI ranges: `lib/commerce.ts` line 8 accepts any finite value above 10 (above 8 for Boys) and up to 100 for every field. The per field ranges above are a front end rule only. Flagged here as a consistency note; it is not size guide data.
- Unit conversion (CODE): stored values are inches; cm display multiplies by 2.54 (for example `apps/website/public/complete.js` line 39). The plan for 2.4 reuses this same conversion for the guide's unit toggle.

### 2.3 What does not exist in the code (CODE finding)

A full text search of the storefront scripts, server code, data files, tests, and docs found:

- No mapping from any standard size number to any body or garment measurement.
- No ease allowance, no finished garment specification, no per size shoulder, sleeve, length, seat, or inseam values.
- No existing size guide, size chart, or size table anywhere in the product. The only mentions are the gap row SIZ-03 itself (`docs/ux-audit/studiosuits-gap-analysis.md` line 71) and the plan line requiring owner approved data (`docs/ux-audit/implementation-plan.md` line 72).

## 3. Jacket size guide draft

One row per jacket size offered (section 2.1). The chest column uses derivation rule D1 below. All other measurement columns are class (c): production data that does not exist in the code yet.

Derivation rule D1 (DERIVED, confirmed by the owner 2026-10-27): in US men's sizing, the jacket size number is the chest circumference in inches. Supporting evidence in code: the sizes are labeled "Jacket size (US)" (line 37), and the offered range 30 to 62 sits inside the guided chest acceptance range of 26 to 70 inches (line 8), which is consistent with the rule. Counter evidence: none in code, but no code text states the rule either. It is an industry convention, not a code fact. If suits.me's standard jacket block is cut for a different chest at any size, this column is wrong at that size.

The cm column is DERIVED from the inch column by the code's own conversion, times 2.54, rounded to the nearest whole cm for display (class b, arithmetic only).

| Jacket size (US) | Body chest (in) | Body chest (cm) | Jacket length: Short (in) | Jacket length: Regular (in) | Jacket length: Long (in) | Shoulder (in) | Sleeve length (in) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | 30 | 76 | ____ | ____ | ____ | ____ | ____ |
| 32 | 32 | 81 | ____ | ____ | ____ | ____ | ____ |
| 34 | 34 | 86 | ____ | ____ | ____ | ____ | ____ |
| 36 | 36 | 91 | ____ | ____ | ____ | ____ | ____ |
| 38 | 38 | 97 | ____ | ____ | ____ | ____ | ____ |
| 40 | 40 | 102 | ____ | ____ | ____ | ____ | ____ |
| 42 | 42 | 107 | ____ | ____ | ____ | ____ | ____ |
| 44 | 44 | 112 | ____ | ____ | ____ | ____ | ____ |
| 46 | 46 | 117 | ____ | ____ | ____ | ____ | ____ |
| 48 | 48 | 122 | ____ | ____ | ____ | ____ | ____ |
| 50 | 50 | 127 | ____ | ____ | ____ | ____ | ____ |
| 52 | 52 | 132 | ____ | ____ | ____ | ____ | ____ |
| 54 | 54 | 137 | ____ | ____ | ____ | ____ | ____ |
| 56 | 56 | 142 | ____ | ____ | ____ | ____ | ____ |
| 58 | 58 | 147 | ____ | ____ | ____ | ____ | ____ |
| 60 | 60 | 152 | ____ | ____ | ____ | ____ | ____ |
| 62 | 62 | 157 | ____ | ____ | ____ | ____ | ____ |

Column sources:

- Jacket size (US): CODE, section 2.1.
- Body chest: DERIVED by rule D1. Owner confirmed 2026-10-27. This column ships in v1.
- Jacket length Short, Regular, Long: NOT DERIVABLE. The code offers the three names only (section 2.1). Production fact needed: the finished jacket length, or the body jacket length range, for each size and length. A single length range per length name (not per size) is an acceptable fill if that is how production works.
- Shoulder, Sleeve length: NOT DERIVABLE. The code has only the overall guided acceptance ranges (shoulder 12 to 28 in, sleeve 17 to 40 in), which are not per size values. Production fact needed: per size body or finished values, and a statement of which of the two they are.

## 4. Trouser size guide draft

One row per trouser size offered (section 2.1). The waist column uses derivation rule D2 below.

Derivation rule D2 (DERIVED, confirmed by the owner 2026-10-27, weaker evidence than D1): in US men's sizing, the trouser size number is the waist circumference in inches. Caution from the code itself: the trouser waist field tip warns shoppers that a body measurement is "not the size printed on a trouser label" (`app.js` line 8). That tip is about other brands' labels, but it means suits.me cannot assume its own label equals the body waist without production confirming the standard trouser block is cut that way. If production cuts the standard trouser waist with any ease or vanity offset, this column is wrong by that offset at every size.

The cm column is DERIVED by the same conversion as section 3.

| Trouser size (US) | Body waist (in) | Body waist (cm) | Seat / hips (in) | Inseam (in) |
| --- | --- | --- | --- | --- |
| 28 | 28 | 71 | ____ | ____ |
| 30 | 30 | 76 | ____ | ____ |
| 32 | 32 | 81 | ____ | ____ |
| 34 | 34 | 86 | ____ | ____ |
| 36 | 36 | 91 | ____ | ____ |
| 38 | 38 | 97 | ____ | ____ |
| 40 | 40 | 102 | ____ | ____ |
| 42 | 42 | 107 | ____ | ____ |
| 44 | 44 | 112 | ____ | ____ |
| 46 | 46 | 117 | ____ | ____ |
| 48 | 48 | 122 | ____ | ____ |
| 50 | 50 | 127 | ____ | ____ |
| 52 | 52 | 132 | ____ | ____ |
| 54 | 54 | 137 | ____ | ____ |
| 56 | 56 | 142 | ____ | ____ |
| 58 | 58 | 147 | ____ | ____ |
| 60 | 60 | 152 | ____ | ____ |
| 62 | 62 | 157 | ____ | ____ |
| 64 | 64 | 163 | ____ | ____ |

Column sources:

- Trouser size (US): CODE, section 2.1.
- Body waist: DERIVED by rule D2. Owner confirmed 2026-10-27, with the caution above on record. This column ships in v1.
- Seat / hips: NOT DERIVABLE. Code has only the overall guided range (26 to 78 in). Production fact needed: per size seat values, or a statement that the guide omits this column.
- Inseam: NOT DERIVABLE, and it may not be a per size value at all. The standard size flow never asks for an inseam; the guided flow accepts 20 to 42 in overall. Production fact needed: are standard size trousers delivered hemmed to a fixed inseam, delivered unfinished, or hemmed from a measurement taken later? If a fixed inseam exists, its single value fills this column for every row.

## 5. What the code supports publishing today, with no new data

These statements are fully code backed and could appear on the size guide surface in the 2.4 build even before production fills the blanks:

- The exact size lists offered: jacket 30 to 62 (even numbers), trouser 28 to 64 (even numbers), lengths Short, Regular, Long (section 2.1, CODE).
- The overall body measurement ranges the guided flow accepts, per field (section 2.2, CODE). Wording must present these as the ranges the guided measurements accept, not as per size recommendations.
- The guidance the standard size step already shows shoppers (CODE, `app.js` line 37): "These are standard size selections, not a custom body measurement profile." and "Between sizes or unsure? Go back and choose guided body measurements, or visit a showroom for a fitting."
- The measuring tips for chest and trouser waist (CODE, `app.js` line 8), so a shopper can measure the body value the derived columns refer to.
- The unit toggle behavior: every inch value converts at times 2.54 (CODE).

## 6. Owner decisions

Decided 2026-10-27:

1. Rule D1: CONFIRMED. suits.me's standard jacket size number equals the body chest in inches it is cut for, at every size from 30 to 62. The v1 guide presents the column as a body measurement to compare against ("Measure your chest and pick the jacket size that matches it."), keeping the hedge from section 7.
2. Rule D2: CONFIRMED. The same holds for trouser size and body waist, with no offset. The v1 guide presents it the same hedged way.
3. Jacket lengths: DEFERRED. No length numbers ship in v1; the guide names Short, Regular, and Long in guidance text only. Production fact still needed to unlock a numbers column: finished jacket length (or accepted body jacket length range) for Short, Regular, and Long, per size or as one range per length name.
4. Shoulder and sleeve per jacket size: DEFERRED. Both columns are omitted in v1. Production fact needed: per size values, stated as body or finished garment measurements.
5. Trouser inseam policy: DEFERRED. No inseam column ships in v1. Production fact needed: fixed inseam (give the value), unfinished, or measured later.
6. Seat / hips per trouser size: DEFERRED. The column is omitted in v1. Production fact needed: per size seat values.
7. Scope: CONFIRMED. The guide covers men's standard sizes only, because the code offers standard sizes for Men only (section 2.1). No women's standard size guide is expected in 2.4.
8. Recommendation (labeled as a recommendation, not data): if decisions 1 and 2 are confirmed, publish the guide as body measurements to compare against, using the chest and waist measuring tips from the code, and keep the existing "between sizes" steering to the guided flow. A second genuine standard the owner may optionally approve later: an EU conversion line (EU jacket size is conventionally US plus 10). No conversion data exists in the code today (CODE finding), so it is excluded from the draft tables.

## 7. Risks and how the copy should hedge

- If rule D1 or D2 is wrong, the error is systematic: every shopper using the guide is steered to a wrong standard size, and unlike the guided flow there is no validation step to catch it. This is the same class of harm the audit's measurement principles guard against (never guess a customer's size mapping silently).
- Hedge until production confirms: label the chest and waist columns as body measurements to compare against, not as garment specifications; do not show finished garment columns at all until production supplies them; keep the "between sizes or unsure" steering to guided body measurements visible next to the table (the copy already exists, section 5).
- If production can only confirm the rules approximately (for example within half an inch), the guide should say "closest size" language and recommend the guided flow for anyone between sizes, rather than presenting the table as exact.
- The blanks in sections 3 and 4 are deliberate. Shipping the guide with only the confirmed columns is safer than shipping a complete looking table with invented columns.

## 8. What shipped in v1 (package 2.4)

- A Size guide disclosure inside the standard size step of the Measurement Studio, toggled by a button with `aria-expanded`, so the shopper never leaves the step.
- Two tables only: Jackets (Jacket size US, Body chest) and Trousers (Trouser size US, Body waist), one row per size the store offers.
- One measurement column per table, in the shopper's selected unit: inches as listed, or cm at times 2.54 with the storefront's existing whole number rounding. A units toggle inside the guide reuses the Studio's own unit switch.
- Guidance text naming Short, Regular, and Long with no numbers, the existing between sizes note left intact, and copy that frames standard sizes as a starting point next to guided body measurements.
- Deferred until production supplies data: jacket length numbers, shoulder, sleeve, seat / hips, and inseam columns (section 6, items 3 to 6).
