# Payment provider logos

`PaymentLogo` (src/components/custom-website/PaymentLogo.tsx) loads
`/payment-logos/<id>.svg` and falls back to a brand-coloured two-letter
badge when the file is missing.

Drop these in (SVG only, real brand artwork — not AI-generated):

| File | Provider | Source |
|---|---|---|
| stripe.svg  | Stripe  | simpleicons.org -> "Stripe" |
| paypal.svg  | PayPal  | simpleicons.org -> "PayPal" |
| payhere.svg | PayHere | payhere.lk brand assets |
| whop.svg    | Whop    | whop.com brand assets (reuse channel-logos/whop.svg) |
