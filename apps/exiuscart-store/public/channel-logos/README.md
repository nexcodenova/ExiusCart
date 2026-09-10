# Channel logos

`<ChannelLogo>` (src/components/channel-listings/ChannelLogo.tsx) loads
`/channel-logos/<key>.svg` for a channel when `channelMeta` has a `logo:`
entry for it, and falls back to the brand-coloured lucide icon otherwise.
Adding a real SVG here + the one-line `logo:` in channelMeta.ts is the whole
step to give a channel its real mark everywhere it appears.

## Present (wired)

shopify · woocommerce · bigcommerce · ebay · etsy · amazon · walmart · wix ·
tiktok · noon · whop · gumroad · instagram · trendyol · jumia

## Still needed

| File to add | Channel | Source |
|---|---|---|
| daraz.svg | Daraz | Daraz brand assets / logo pack |
| thedersi.svg | TheDersi | your own TheDersi logo |

Rules: **SVG only**, exact lowercase filename = the channel key, real brand
artwork (not AI-generated). Wide wordmarks get `wide: true` in channelMeta;
square icons don't. `custom` (Custom Website) has no brand — globe icon, no
file.
