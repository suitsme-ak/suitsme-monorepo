# Suits.me original fabrics

Imported on 2026-10-24 from the public catalog used by https://www.suits.me/swatches/suit and https://www.suits.me/swatches/shirt. The dataset contains the public fabric codes, compositions, patterns, collection categories and original swatch image associations: 256 suit fabrics and 200 shirt fabrics. No stock quantity or garment price was supplied by this import.

`data/merchant-fabrics.json` preserves the original metadata and image source URLs. `data/launch-fabrics.json` selects 36 suit and 36 shirt fabrics for the initial generated garment catalog. `data/merchant-models.json` explicitly maps every generated illustration to its reference fabric code. Images are in `public/assets/merchant-fabrics/` and `public/assets/merchant-models/`.

Generated with the built-in image generation tool using each local original swatch as the reference. Prompt set: original photorealistic luxury tailoring ecommerce portrait of a fictional adult male model wearing a two-piece suit or long-sleeve spread-collar shirt made from reference fabric CODE. Match the reference color, pattern, weave and realistic cloth scale. Suits show matching trousers and a white shirt; shirts show charcoal trousers without a jacket or tie. Neutral pale stone studio background, soft neutral daylight, realistic garment construction, no text, logos, watermark, collage or inset swatch. Each prompt supplies the source fabric color, pattern and composition.

Generated photos illustrate cloth appearance and do not guarantee exact physical color, pattern scale, cut or construction. Product galleries show the original swatch alongside the garment illustration. Fabrics beyond the initial 72 have swatch-led product pages and customization, with no substituted model photo. Physical swatches remain the color reference.

The initial launch used 36 generated garments per category. The current Suits department uses ten-item merchant edits described in suit-category-edits.md; Shirts retains its 36-item launch edit. The full fabric library is available through Browse every fabric or More > Fabric Samples. Specialist collections outside the updated Suits department retain their clearly labeled illustrative design studies; they are not verified merchant inventory.

Run the normal project build to regenerate both catalogs. The import script refreshes image downloads from the checked-in metadata; it does not access private data or credentials. The initial 19 product IDs and existing sample design IDs are stable. Merchant fabric products append IDs so existing saved bags continue working. Server checkout derives the fabric code from its catalog, ignoring a client-supplied code.

Prices remain illustrative and live sales are disabled pending approved garment pricing, availability, payment configuration and production operations.
