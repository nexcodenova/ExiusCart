# Channel logos

Drop the real brand SVG for each sales channel here, named by its internal
key. `<ChannelLogo>` (src/components/channel-listings/ChannelLogo.tsx) loads
`/channel-logos/<key>.svg` automatically and falls back to a brand-coloured
lucide icon when the file is missing — so adding a file is the whole step.

Required filenames:

| Key            | Channel        |
|----------------|----------------|
| shopify.svg    | Shopify        |
| woocommerce.svg| WooCommerce    |
| bigcommerce.svg| BigCommerce    |
| ebay.svg       | eBay           |
| etsy.svg       | Etsy           |
| amazon.svg     | Amazon         |
| tiktok.svg     | TikTok Shop    |
| noon.svg       | Noon           |
| daraz.svg      | Daraz          |
| whop.svg       | Whop           |
| gumroad.svg    | Gumroad        |
| thedersi.svg   | TheDersi       |

Notes:
- **SVG only**, real brand assets (official brand/press kits, or an accurate
  set like Simple Icons). Not AI-generated — those come out distorted.
- Keep them square-ish; they render at 14–20px.
- `custom` (Custom Website) has no brand and intentionally has no file — it
  always shows the globe icon.
