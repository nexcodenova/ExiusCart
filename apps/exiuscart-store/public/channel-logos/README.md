# Channel logos

`<ChannelLogo>` (src/components/channel-listings/ChannelLogo.tsx) loads
`/channel-logos/<key>.svg` for a channel when `channelMeta` has a `logo:`
entry for it, and falls back to the brand-coloured lucide icon otherwise.
Adding a real SVG here + the one-line `logo:` in channelMeta.ts is the whole
step to give a channel its real mark everywhere it appears.

## Present (wired) — every channel

shopify · woocommerce · bigcommerce · wix · ebay · etsy · amazon · walmart ·
tiktok · instagram · noon · daraz · trendyol · jumia · whop · gumroad · thedersi

(`thedersi.jpg` and `daraz.svg` — non-svg is fine, `<img>` takes any format.)

Rules: **SVG only**, exact lowercase filename = the channel key, real brand
artwork (not AI-generated). Wide wordmarks get `wide: true` in channelMeta;
square icons don't. `custom` (Custom Website) has no brand — globe icon, no
file.
