# Channel logos

`<ChannelLogo>` (src/components/channel-listings/ChannelLogo.tsx) loads
`/channel-logos/<key>.svg` for a channel when `channelMeta` has a `logo:`
entry for it, and falls back to the brand-coloured lucide icon otherwise.
Adding a real SVG here + the one-line `logo:` in channelMeta.ts is the whole
step to give a channel its real mark everywhere it appears (cards, sync
center, flow diagram, connect modal, listings table/drawer/filter,
integration pages).

## Present

| File | Channel |
|---|---|
| shopify.svg | Shopify |
| woocommerce.svg | WooCommerce |
| bigcommerce.svg | BigCommerce |
| ebay.svg | eBay |
| etsy.svg | Etsy |
| amazon.svg | Amazon |
| walmart.svg | Walmart |
| wix.svg | Wix |

## Still needed (currently showing the fallback icon)

| File to add | Channel | Real source |
|---|---|---|
| tiktok.svg | TikTok Shop | simpleicons.org → "TikTok" |
| gumroad.svg | Gumroad | simpleicons.org → "Gumroad" |
| instagram.svg | Instagram Shopping | simpleicons.org → "Instagram" |
| trendyol.svg | Trendyol | simpleicons.org → "Trendyol" |
| whop.svg | Whop | whop.com brand assets |
| noon.svg | Noon | noon.com brand assets |
| daraz.svg | Daraz | Daraz brand assets / logo pack |
| jumia.svg | Jumia | Jumia brand assets |
| thedersi.svg | TheDersi | your own TheDersi logo |

Rules: **SVG only**, exact lowercase filename above, real brand artwork —
not AI-generated (those come out distorted). Square icon or wide wordmark
both fine; set `wide: true` in channelMeta for wordmarks.

`custom` (Custom Website) has no brand — it stays the globe icon, no file.
