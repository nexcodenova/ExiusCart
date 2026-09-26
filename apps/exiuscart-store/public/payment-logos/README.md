# Payment provider logos

`PaymentLogo` (src/components/custom-website/PaymentLogo.tsx) loads
`/payment-logos/<id>-icon.svg` (whop: `whop.svg`) and falls back to a brand-coloured two-letter
badge when the file is missing.

Drop these in (SVG only, real brand artwork — not AI-generated):

| File | Provider | Source |
|---|---|---|
| stripe-icon.svg  | Stripe  | official brand assets |
| paypal-icon.svg  | PayPal  | official brand assets |
| whop.svg    | Whop    | whop.com brand assets (reuse channel-logos/whop.svg) |
