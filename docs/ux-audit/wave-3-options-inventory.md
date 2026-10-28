# Wave 3 options inventory: customization depth (CUS-01, CUS-02, CUS-06, CUS-07)

Prepared 2026-10-27 from the code at main d2324f5 and the Oct 26, 2026 live audit notes. This document changes no storefront code. Its job is to give the owner one list to decide against: what suits.me offers today, what StudioSuits was observed offering, and an empty decision column for each candidate.

How to use it: in each candidate table, fill the last column with Yes, No, or Later. Wave 3 package 3.1 builds only the Yes rows. Package 3.2 then attaches Included or a price to every row (CUS-02). Nothing in the candidate tables is a promise that suits.me can make the item; that is exactly what the column is for.

Sources: `docs/ux-audit/studiosuits-gap-analysis.md` (CUS-01, CUS-02), `docs/ux-audit/wave-0-verification.md` (CUS-06, CUS-07), `docs/ux-audit/implementation-plan.md` section 7, and the journey notes in the audit working files. Where the StudioSuits choice list inside an option was never opened during the audit walk, the table says so rather than guessing.

## A. What suits.me offers today, per garment

The customizer has three steps: 01 Fabric and fit, 02 Personalize, 03 Measurements. The tables below cover step 02 (Personalize), plus the shared step 01 choices. Code sources: `apps/website/public/app.js` (base customizer, `customize()` and the shared `config` object) and `apps/website/public/complete.js` (per kind overrides in its `customize` wrapper and `beginDesign`).

Shared by every tailored garment, step 01:

| Group | Choices | Default |
| --- | --- | --- |
| Fabric | The product's own fabric and color (catalog products). The base demo flow instead shows a Color story swatch choice: Navy, Charcoal, Blue, Sand | The product's color |
| Fit preference | Slim, Tailored, Relaxed | Tailored |

### Suits, Men (kind: suit)

| Group | Choices | Default |
| --- | --- | --- |
| Lapel | Notch, Peak, Shawl | Notch |
| Jacket closure | Two button, One button, Double breasted | Two button |
| Lining | Tonal, Burgundy, Midnight | Tonal |
| Monogram | Free text, optional, up to 12 characters | Empty |

That is the complete list. No pockets, no vents, no button options beyond closure, no trousers options inside the suit, no vest.

### Suits, Women (kind: suit, category Women)

Identical Personalize groups to Men's suits: Lapel, Jacket closure, Lining, Monogram, with the same choices and defaults. The differences for Women are in measurements only (body measurements, no standard sizes). The trousers inside a women's suit get no trouser options at all: this is gap CUS-06.

### Suits, Boys (kind: suit, silhouette Boys two-piece)

Identical Personalize groups to Men's suits. Differences are in measurements only (body measurements taken by an adult helper, no standard sizes).

### Jackets (kind: jacket)

Identical Personalize groups to suits: Lapel (Notch, Peak, Shawl), Jacket closure (Two button, One button, Double breasted), Lining (Tonal, Burgundy, Midnight), Monogram (free text, up to 12 characters). Jackets are not in the per kind override list in `complete.js`, so they reuse the suit option set as written.

### Waistcoats (kind: waistcoat)

| Group | Choices | Default |
| --- | --- | --- |
| Front style | Five button, Six button | Five button |
| Monogram | Free text, optional, up to 12 characters | Empty |

No Lapel group and no Lining group. The Front style value is stored in the same `closure` field the jackets use.

### Trousers, standalone (kind: pants)

| Group | Choices | Default |
| --- | --- | --- |
| Trouser front | Flat front, Single pleat | Flat front |
| Monogram | Free text, optional, up to 12 characters | Empty |

No Lining group. Note the contrast with suits: a standalone trouser can be personalized (one group), while the trousers inside any suit, Men's, Women's, or Boys, get nothing.

### Shirts (kind: shirt)

| Group | Choices | Default |
| --- | --- | --- |
| Collar | Spread collar, Point collar | Spread collar |
| Monogram | Free text, optional, up to 12 characters | Empty |

No Lining group.

### Not customizable

Accessories, fabric swatches, and gift cards have no customizer. They are added directly from the product page.

### How the per kind sets are implemented (relevant to CUS-06 and CUS-07)

- There is one shared `config` object for every garment (product, fabric, lapel, closure, fit, lining, monogram). `complete.js` replaces the Personalize section for pants, shirt, and waistcoat by cutting the rendered HTML between the Lapel heading and the Monogram field and inserting that kind's single group. Because the cut spans the Lining group too, those three kinds lose Lining as a side effect of the technique, not as a recorded product decision.
- Because the state is one shared object, values carry across products (CUS-07): a monogram typed for one garment is still present when the next garment's customizer opens. `beginDesign` resets lapel and closure for pants, shirt, and waistcoat, but not lining or monogram.

## B. Candidate deeper options observed on StudioSuits

Observed on one product, the Rust Herringbone Tweed Suit, in the Customize modal and the Custom Suit builder, Oct 26, 2026. Sections there are: Jackets, Add a Vest, Trousers, Add-Ons, Tailor Changes, Comments. Collapsed rows always show the current selection, and selections can be reopened and changed in place.

Choice lists marked "not captured" were never opened during the audit walk. They are unverified, and the counts or names must be confirmed by a fresh walk before build scoping.

### Suits: jacket section candidates

| Option | Choices (as observed) | StudioSuits price | Gap | suits.me can fulfill? (Avenash) |
| --- | --- | --- | --- | --- |
| Jacket Style | One Button, Two Button, Three Button, Four Button, Double Breasted | Included (a style change did not change the price) | CUS-01 (extends today's Jacket closure, which lacks Three Button and Four Button) | |
| Lapels | 8 variants with widths; variant names not captured | Three premium variants at plus $10 | CUS-01, CUS-02 | |
| Buttons | Choice list not captured | Not recorded | CUS-01 | |
| Vents | Choice list not captured | Not recorded | CUS-01 | |
| Jacket Cuff Buttons | Choice list not captured | Not recorded | CUS-01 | |
| Pocket Accent | Choice list not captured | Not recorded | CUS-01 | |
| Jacket Lining | Choice list not captured | Not recorded | CUS-01 (extends today's Lining) | |
| Jacket Lining Type | Choice list not captured | Not recorded | CUS-01 | |
| Elbow Patches | Choice list not captured | Not recorded | CUS-01 | |
| Collar Monogram | Second monogram field, separate from the main Monogram; details not captured | Not recorded | CUS-01 | |
| Monogram | Details not captured (suits.me already offers one monogram field) | Not recorded | CUS-01 | |
| Tier | Listed as the first jacket row and first in the cart details; what the tiers are was not captured | Not recorded | CUS-01 | |
| More customizations | Catch all row; contents not captured | Not recorded | CUS-01 | |

### Suits: trousers section candidates (trousers inside a suit)

| Option | Choices (as observed) | StudioSuits price | Gap | suits.me can fulfill? (Avenash) |
| --- | --- | --- | --- | --- |
| Pants Lining | Front Lining observed; full choice list not captured | Plus $5 | CUS-01, CUS-02, CUS-06 | |
| Pocket Style | Choice list not captured | Not recorded | CUS-01, CUS-06 | |
| Pleats | Choice list not captured (suits.me standalone trousers offer Flat front and Single pleat as Trouser front) | Not recorded | CUS-01, CUS-06 | |
| Back Pockets | Choice list not captured | Not recorded | CUS-01, CUS-06 | |
| Belt Loops | Choice list not captured | Not recorded | CUS-01, CUS-06 | |

CUS-06 note: for Women's suits this whole section is the fix. The same section also gives Men's and Boys suit trousers their first options.

### Suits: builder sections with no option list

| Section | What was observed | Gap | suits.me can fulfill? (Avenash) |
| --- | --- | --- | --- |
| Tailor Changes | A named section in the builder and the last value in the cart details; contents not captured | CUS-01 | |
| Comments | A named section in the builder; contents not captured, likely free text | CUS-01 | |

### Jackets, standalone

StudioSuits standalone jacket customization was not walked. The working candidate set is the jacket section of the suit builder above (Jacket Style through More customizations). Each row needs the same fulfill decision; the suit table is the record, so no second table is duplicated here. Status: candidate list inferred from the suit walk, not independently verified.

### Trousers, standalone

StudioSuits standalone trousers customization was not walked. The working candidate set is the trousers section above (Pants Lining, Pocket Style, Pleats, Back Pockets, Belt Loops), again inferred from the suit walk rather than independently verified. Today's suits.me standalone trousers offer only Trouser front and Monogram.

### Waistcoats

No standalone StudioSuits waistcoat builder was walked. The observed waistcoat related item is the priced Add a Vest extra on a suit (see section C). suits.me already sells waistcoats standalone with Front style and Monogram only. Whether StudioSuits offers more for a standalone vest is unverified.

### Shirts

No StudioSuits shirt customization was observed in the audit at all. There is no candidate list for shirts yet. A shirt walk is needed before any shirt options are scoped for Wave 3.

### Women and Boys

StudioSuits women's and boys customization were not walked. The suit candidate tables above are the working assumption for Women's suits, with the CUS-06 trousers section as the confirmed gap. Boys has no observed benchmark data.

## C. Extras pricing observed on StudioSuits (CUS-02)

| Extra | What it is | StudioSuits price |
| --- | --- | --- |
| Add a Vest | Adds a waistcoat (vest) to the suit order | Plus $90 |
| Additional Pants | A second pair of trousers with the suit | Plus $100 |
| Square and Tie | Pocket square and tie add-on (Add-Ons section) | Plus $39 |
| Pants Lining | Front Lining for the trousers | Plus $5 |
| Premium lapel variants | Three of the eight lapel variants | Plus $10 each |

On suits.me today, no option anywhere carries a price and no extras are offered; changing lapel and lining left the test suit at $399 with nothing on screen saying the choices are included. CUS-02 requires every option to show its state explicitly, Included or plus an amount, whether or not these exact extras are adopted. The prices above are StudioSuits prices, recorded as evidence only. suits.me prices are an owner decision per extra.

## D. Gap mapping and notes

- CUS-01 (P1, customization depth): sections B, all tables. Package 3.1 extends the configuration driven schema, suits first, then rolls the schema to the other garments. Only rows marked Yes get built.
- CUS-02 (P1, no priced options, no price state): section C, plus the price column in every section B table. Package 3.2 runs after 3.1 so prices attach to a stable option model. Server price checks already exist in the commerce code and must agree with whatever prices are set.
- CUS-06 (P2, women's suit trousers cannot be personalized): the trousers section of section B. The schema fix should include the trousers group whenever a suit includes trousers, for every wearer.
- CUS-07 (P2, customization and monogram state leaks across products): not an option row; it is the shared `config` object described in section A. Fix direction from Wave 0: scope saved customization state per product, or clearly show and confirm carried over values. It belongs with the 3.1 schema work because the schema change touches the same state.
- CUS-05 (P3, 3D studio entry): out of Wave 3 scope by owner decision D4. For the record, the separate 3D studio surface in `expanded.js` offers its own small control set (garment, color, pattern, and a lapel select with Notch, Peak, Shawl for non trouser garments). It is not the step customizer inventoried above.
- Benchmark flaws not to copy: StudioSuits cart details omit two of its own selections (Pocket Accent and Monogram). Whatever suits.me adds must be stored on the item and shown in the bag and checkout, per the CRT-01 standard already shipped in Wave 1.
- Sequencing: option by option fulfill decisions first (this document), then 3.1 schema, then 3.2 pricing display. Unverified choice lists (Lapels names and widths, Buttons, Vents, and the rest marked not captured) need one fresh StudioSuits walk before their rows can be built, even if the fulfill answer is Yes.


## Captured choice lists (fresh StudioSuits walk, 2026-10-27)

Captured live on 2026-10-27 from the Napolean Muted Beige Wool Suit builder ($395) on studiosuits.com, no login, no order, cart verified empty at the end. "Included" means no price was shown for that choice. This section supersedes the "not captured" notes in the tables above. Note two price changes since the original audit walk: Add a Vest is now $99 (was $90) and Additional Pants is now $140 (was $100).

### Jacket section (suits and standalone jackets, verified identical by spot check)

- Tier: Regular (Included, default); Make It a Tuxedo (+$50).
- Jacket Style: One Button, Two Button (default), Three Button, Four Button, Double Breasted (Peak Lapel); all Included. This maps to the existing suits.me Jacket closure group, extended.
- Lapels: Notch Lapel 3 to 3.2 inch (Included, default); Slim Notch Lapel 2.5 inch (Included); Wide Notch Lapel 3.75 inch (Included); Peak Lapel 3 to 3.2 inch (+$10); Wide Peak Lapel 3.75 inch (+$10); Classic Wider Notch 4.75 inch (Included); Classic Wider Peak 4.75 inch (+$10); Shawl Lapel (Included).
- Buttons: included choices are Default Fibre, Faux Horn Beige, Faux Horn Brown, Faux Horn Dark Tan, Horn Brown (default). Priced tiers: real horn at +$7 (Horn Solid Black, Horn Royal Black, Italian Horn Black, Horn Mont Black, Italian Horn Dark Brown); corozo at +$4, or +$5 for Corozo Ivory (Beige, Black, Tan, Russet, Irish, Scot Brown); Vintage Brown Leather +$9; Matt Gold Metal +$9; statement brass at +$75 (Victorian Lion, Venetian Mask, Imperial Lion, Stallion Heritage, Black Tiger).
- Vents: Single Vent (default), Double Vent, No Vents; all Included.
- Jacket Cuff Buttons: One, Two, Three (default), Four; all Included.
- Pocket Accent: None (Included); Ticket Pocket (+$5); Slant Pocket (+$5); Patch Pocket (+$15).
- Jacket Lining: Default (Included, "our standard nearest matching color lining"). Priced tiers: plain colors +$15 (Red, Steel Gray, Golden Beige, Purple, Wine, Turkish Blue, Electric Blue, Green, Jade Green); Paisley +$20 (27 colorways, including Black, White, Copper, Red, Silver, Royal Cyan, Seaweed Green, Lux Gold, Ink Blue, Lilac); Bemberg and Black Stretch +$30 (20 colorways, including Black, Purple, Green, Red, Rust, Burgandy as spelled on the site, Hot Pink, Teal Blue, Ivory); Italian designer linings +$109 (Golden Maduro, Retro Romance, Nocturne Skull, Fortune Flag, Iconic Gent, V8 Vintage, Elephant Valor, Jazz Royale).
- Jacket Lining Type: Full Lining (Included, default); Half Lining (+$20); No Lining, Unstructured (+$40).
- Elbow Patches: None (Included, default); 20 leather and suede choices at +$15 each (Black Leather, Brown Leather, Tan Brown Leather, Spanish Brown Leather, Terrain Brown Leather, Scottish Brown Leather, Hunter Tan Leather, Red Leather, White Leather, Off White Leather, Brazil Green Leather, Deep Blue Leather, Prussian Blue Leather, Light Beige Leather, Gray Leather, Sherpa Gray Leather, Yellow Leather, Dark Blue Suede, Light Brown Suede, Caramel Brown Suede).
- Collar Monogram: one text field, max 11 characters, +$10. Separate from the inside monogram.
- Monogram: two lines inside the jacket, max 20 characters each, +$10 for the feature (second line shown disabled until the first is filled, not fully verified).
- More customizations (jacket details, all optional add ons): Working Cuff Buttons (+$5); Pick Stitch (+$10); Gauntlet Cuff (+$15); Natural Shoulders (+$20); Italian Boat Pocket (+$25); Handmade Milanese Lapel Buttonhole (+$75); Buttonholes Color swatches (names not shown in text, unverified).

### Vest (suits only)

- Add a Vest block at +$99: Classic Vest, Classic Lapel Vest, Double Breasted Vest, Double Breasted Lapel Vest, Shawl Lapel Vest, Shawl Lapel Double Breasted Vest, all +$99. Vest lining matches the jacket lining. Optional Fabric Back for the waistcoat: +$20.

### Trousers section (suits and standalone trousers, verified identical by spot check)

- Pants Lining: No Lining (Included, default); Front Lining (+$5); Front and Back Lining (+$10).
- Pocket Style: Cross (default), Seam; both Included.
- Pleats: Flat Front (default), Single Pleat, 2 Pleats (all Included); Forward Single Pleat (+$5); Forward 2 Pleats (+$5). The existing suits.me Trouser front group is a subset of this group.
- Back Pockets: 2 Welted Pockets (default), 1 Welted Pocket On Right, 2 Flap Pockets, 1 Flap Pocket On Right, No Back Pockets; all Included.
- Belt Loops: Yes (default), No; both Included.
- More customizations: Pants Cuff (+$5); Suspender Buttons (+$2); Flap coin pocket (+$5); 2 inch waistband (no price shown). Side tab choices: No Side Tabs (no price shown); Classic Side Tabs (+$12); Back Elastic (+$12); Side Adjusters (+$12); Side Elasticated Tabs (+$17); Milan Side Tabs (+$20); Venice Side Tabs (+$20).

### Add ons, tailor changes, comments (suits)

- Square and Tie (+$39), matches the lining. Additional Pants (+$140, suits only; the standalone jacket builder offers only Square and Tie, and the standalone trousers builder has no Add Ons section).
- Tailor Changes: Yes, Change if required (default); No, Contact me. No price.
- Comments: one free text field, max 200 characters. No price.

### Standalone builders compared

- Standalone jacket builder: same jacket section groups, choices and defaults as the suit builder (Lapels fully re-verified). No trousers section, no vest block, no Tailor Changes row.
- Standalone trousers builder: same trousers section groups, choices and defaults (More customizations fully re-verified). No Add Ons section, no Tailor Changes row.
- Remaining individual choices inside the standalone builders were not re-expanded one by one; equality beyond the spot checks is inferred from the identical group structure and is marked as such.
