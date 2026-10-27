# Wave 0 verification addendum

Companion to docs/ux-audit/studiosuits-gap-analysis.md and docs/ux-audit/implementation-plan.md.
 Completed: October 26, 2026 (live checks in the evening, America/New_York; code checks the same day).
 Purpose: close the questions the gap report left open, before any build work. No site behavior was changed by this addendum.

## 1. Results at a glance

| Check | Question | Result |
| --- | --- | --- |
| 0.1 | Can a garment reach the bag or checkout with no measurements? (SIZ-05) | No. Both the customizer and Quick add block it, and the server also requires a profile. SIZ-05 is closed as verified safe, with one small copy flaw (section 2) |
| 0.2 | Is the lining lost, or only not shown? (CRT-01) | Stored, sent, and saved on the order. Only the bag and checkout summary display drops it. CRT-01 confirmed as a display fix (section 3) |
| 0.3 | What options does each garment really offer? (CUS-01 scoping) | All four remaining garments verified live. Trousers and shirts offer only 2 option groups each; women's suits reuse the men's suit groups and miss a trousers choice their own product includes (section 4) |
| 0.4 | How does suits.me navigation behave on mobile? | Code evidence: no hamburger or drawer exists; the full menu bar wraps or scrolls at small widths. Visual and touch behavior still unverified (section 5) |
| 0.5 | Do the test suites pass on main? | Yes, all three, with dependencies installed. One coverage gap found: no body measurement profile test exists (section 6) |

## 2. SIZ-05: no measurements path (live test, Oct 26, 6:57 to 7:00 PM EDT)

- Customizer path: the saved profile was deliberately deselected in the Measurements step ("Choose a profile"). ADD TO BAG was blocked; the bag did not change; the page showed: "Choose a saved profile, or take your measurements first."
- Quick add path (tested on a different suit to keep results clean): the dialog starts with no profile selected, explains "Use a saved fit profile, or personalize this garment first.", and lists the standard details it would apply (notch lapel, two button, tonal lining, no monogram). ADD TO BAG was blocked by form validation.
- Server path (code): lib/commerce.ts rejects any garment item whose profile method is not body or ready, so a real payment cannot be taken without measurements either.
- Conclusion: the guardrail works at every layer. SIZ-05 changes from an open P1 to **Closed: verified safe**.
- Remaining flaw, P3: the Quick add block surfaces the browser's default validation text, "Please select an item in the list.", which never mentions measurements. Fix: use the customizer's clear wording in Quick add. Added to implementation plan Wave 1 as a micro fix under package 1.2.
- Note: the customizer arrives with the shopper's own saved profile preselected. That is the shopper's own data and is acceptable; it is not the same pattern as SIZ-01's preselected standard sizes.

## 3. CRT-01: lining trace (code)

- The item object stores the lining choice (customizer config, default Tonal, updated on selection).
- The bag line text is built by lineDescription in public/complete.js from fabric, fit, lapel, closure, and monogram only. Lining is omitted there, and the checkout summary reuses that rendering, so the customer cannot see their lining in either place.
- At checkout the front end posts the whole bag, so lining travels in the payload, and cleanItems in lib/commerce.ts validates and persists lining with the other selections (fabric, lapel, closure, fit, monogram, profile) on the order record.
- An older rendering in public/app.js (order and profile views) does show lining, so two parts of the same site disagree.
- A probe run through the repo's own commerce test harness (mocked payment provider and database) confirms the end state: a configured item completes checkout and its saved order contains lining and the full profile.
- Conclusion: CRT-01 stays P1 (customer confirmation), but the fix is display only and sits at the small end of its estimate (implementation plan package 1.4).

## 4. Per garment option inventory (live, Oct 26, 6:57 to 7:01 PM EDT)

All garments use the same generic customizer address (#customize) and the same three steps (Fabric and fit, Personalize, Measurements). No option anywhere shows a price or the word Included.

| Garment | Test product | Price | Personalize groups (complete) |
| --- | --- | --- | --- |
| Suits (from the main journey) | Black Solid Suit, EB11127 | $399 | Lapel (Notch, Peak, Shawl); Jacket closure (Two button, One button, Double breasted); Lining (Tonal, Burgundy, Midnight); Monogram text |
| Jackets | Rivington Navy Solid Wool Jacket | $279 | Identical to suits: Lapel; Jacket closure; Lining; Monogram text |
| Trousers | Rivington Navy Solid Wool Trouser | $159 | Trouser front (Flat front, Single pleat); Monogram text. No cuffs group, no pockets group |
| Shirts | Blue Twill Shirt | $99 (preview price) | Collar (Spread collar, Point collar); Monogram text. No cuffs group, no placket group |
| Women, suits | Rivington Navy Solid Wool Suit | $399 | Identical to men's suits. No Trouser front group, even though the product includes trousers, so a women's suit buyer gets fewer choices for the same trousers than a standalone trousers buyer |

New and adjusted conclusions for the plan:

- CUS-01 is now scoped per garment, not assumed: jackets match suits; **trousers and shirts are thinner than suits**, at 2 groups each. Wave 3 scoping must treat shirts and trousers as their own design work (collars, cuffs, plackets for shirts; fronts, cuffs, pockets, waistband for trousers), subject to what operations can fulfill.
- New gap **CUS-06 (P2): women's suit trousers cannot be personalized.** The same trousers sold standalone offer Trouser front; inside a women's suit they offer nothing. Fix direction: when a suit includes trousers, include the trousers option group for every wearer, which the configuration schema should make routine.
- Collection model evidence for CAT-02 grows: Jackets Shop All is a design library (402 designs) and Trousers Shop All is a design library (360 designs), while Shirts Shop All opens the fabric library (36 fabrics). The split is real and inconsistent across sibling categories.
- New observation **CUS-07 (P2): personalization state carries across products.** On arrival in each garment's customizer, the Monogram field already contained the text "AUDIT", entered earlier for a different product in the same browser. Customization state persists in the browser across products. A monogram is product specific personalization; carrying it silently to the next garment risks an unwanted monogram on an order the shopper did not review for it. Fix direction: scope saved customization state per product, or clearly show and confirm carried over values before adding to the bag. This is the same failure family as SIZ-01 (values chosen by the site, not the shopper, reaching an order), at lower severity because the field is visible on the Personalize step.

## 5. Mobile: code evidence, visual check still open

- A search of all storefront JS and HTML finds no hamburger, menu button, mobile menu, nav toggle, or drawer code. Header controls are only the main navigation, saved profiles, the bag, and the home link.
- Responsive CSS breakpoints sit at 1100, 1000, 900, 750, 720, and 600 px, and the repo's own validation notes describe menu spacing, wrapping, and scrolling adjustments. The pattern on small screens is therefore a wrapping or scrolling full menu bar with click dropdown panels, not the two level drawer StudioSuits uses on mobile.
- Recorded as a candidate gap, **NAV-08 (P2, provisional)**: mobile navigation pattern differs from the benchmark and may be hard to use with 7 categories and 100 links in a scrolling bar. It stays provisional until a true mobile viewport check confirms tap behavior, panel sizing, and readability. The check remains blocked on tooling that can set a mobile viewport; a 5 minute check on a real phone by the owner would also settle it.

## 6. Test baseline and a coverage gap

- Environment: pnpm 11.25.0 via npx, dependencies installed from the frozen lockfile, root test script. All three suites pass on main (56b6f4d): catalog (2,245 SKUs, 92 shopping destinations, 9 service links, prices, assets, stable legacy IDs), suit-edits (18 edits, galleries, routing), and commerce (authentication, origin, server pricing, required profiles, idempotency, owner access, signed webhook, amount matching, paid order replay).
- Coverage gap **TEST-01 (P3)**: tests/commerce.cjs only exercises profile methods none and ready. No test completes a checkout with a body measurement profile, which is the primary way customers are expected to buy. Recommended Wave 1 hardening: add a body profile checkout test, including the unit contract (the front end stores measurements canonically in inches; cm entry is converted on input, verified in app.js updateValue and by the section 3 probe).
- Unit suspicion cleared: an earlier draft of these findings worried that cm profiles might fail the server's value cap of 100. That does not happen through the real front end, because cm values are converted to inches before they are stored or sent. Recorded here so the concern is visibly closed, not silently dropped.

## 7. Changes this addendum makes to the plan

1. SIZ-05: closed. Its Wave 1 effort is removed; only the Quick add message micro fix remains (folded into package 1.2).
2. CRT-01 (package 1.4): confirmed display only; use the small end of the estimate.
3. CUS-01 (Wave 3): scope per garment using section 4; shirts and trousers are separate design work, not a roll out of the suit schema alone.
4. New packages proposed: CUS-06 (women's suit trousers options, can ride with Wave 3 schema work), CUS-07 (per product customization state, small; candidate to move into Wave 1 given its order accuracy family), TEST-01 (body profile commerce test, Wave 1 hardening, half a day).
5. NAV-08: provisional; needs the mobile viewport check before it can be planned responsibly.

Nothing in this addendum authorizes build work. The approval gate in the implementation plan still stands.
