// "How to connect" guide for each dropshipping supplier, shown at
// /dashboard/dropshipping/guide/<supplier>. Steps describe what the seller does
// on the supplier's own site, then what to paste or click in ExiusCart.
// `works` lists what ExiusCart really does once connected, never more.

export interface SupplierGuide {
  name: string;
  intro: string;
  needs: string[];                // what to have ready before starting
  steps: { title: string; body: string }[];
  works: string[];                // what works after connecting
  limits?: string[];              // honest caveats
  signupUrl: string;
  keyUrl?: string;                // where the key / token is created on the supplier's site
}

export const SUPPLIER_GUIDES: Record<string, SupplierGuide> = {
  cj: {
    name: 'CJ Dropshipping',
    intro: 'Free to use, you only pay per order. Connect with your CJ API key, then import products and send orders to CJ in one click.',
    needs: ['A free CJ Dropshipping account', 'Money in your CJ wallet (CJ charges each order from it)'],
    steps: [
      { title: 'Create or sign in to your CJ account', body: 'Go to cjdropshipping.com and sign up or log in.' },
      { title: 'Open the API page', body: 'In CJ, click your profile at the top right, then Authorization, then API.' },
      { title: 'Generate your API key', body: 'Click Generate. CJ shows a key that starts with your user number, like CJ1234567@api@… Copy all of it.' },
      { title: 'Paste it in ExiusCart', body: 'Back here, click Connect CJ Dropshipping, paste the key and click Connect.' },
      { title: 'Top up your CJ wallet', body: 'CJ only ships an order once it is paid, so keep some balance in your CJ wallet.' },
    ],
    works: ['Import products from CJ', 'Send orders to CJ (Fulfill button or auto-fulfil)', 'Live shipping prices', 'Tracking numbers back on the order'],
    signupUrl: 'https://cjdropshipping.com/',
  },
  aliexpress: {
    name: 'AliExpress',
    intro: 'The biggest catalogue of all. Connect by signing in to AliExpress, no key to copy. Then paste any AliExpress product link to import it.',
    needs: ['An AliExpress buyer account', 'A payment method saved in AliExpress'],
    steps: [
      { title: 'Click Connect AliExpress', body: 'You are taken to AliExpress to sign in.' },
      { title: 'Allow ExiusCart', body: 'Sign in with the AliExpress account you will order with, and approve the access request. You come straight back here.' },
      { title: 'Import a product', body: 'Go to Product Sourcing, Import Products, and paste an AliExpress product link. Photos, variants and price come in, and so do its real AliExpress reviews (as Pending).' },
      { title: 'Send orders', body: 'On an order with an AliExpress product, click Fulfill. If AliExpress asks for payment, pay it in your AliExpress account.' },
    ],
    works: ['Import by product link, with variants and reviews', 'Send orders to AliExpress', 'Tracking numbers back on the order'],
    limits: ['The sign-in expires from time to time; if orders start failing with a sign-in error, click Connect again.'],
    signupUrl: 'https://login.aliexpress.com/',
  },
  hypersku: {
    name: 'HyperSKU',
    intro: 'Free to use, pay per order. Strong in Asia-Pacific and the UAE. Connect with the email and password of your HyperSKU account.',
    needs: ['A HyperSKU account', 'Balance or a card in HyperSKU to pay orders'],
    steps: [
      { title: 'Create your HyperSKU account', body: 'Sign up at hypersku.com if you do not have one.' },
      { title: 'Click Connect HyperSKU', body: 'Enter the same email and password you use to log in to HyperSKU, and click Connect.' },
      { title: 'Import and sell', body: 'Import HyperSKU products, then send orders with Fulfill or auto-fulfil.' },
    ],
    works: ['Import products', 'Send orders with the shipping option HyperSKU offers', 'Tracking numbers back on the order'],
    signupUrl: 'https://www.hypersku.com/',
  },
  printful: {
    name: 'Printful',
    intro: 'Premium print on demand with warehouses in the US and EU. Connect with a Printful private token.',
    needs: ['A Printful account', 'A billing method set up in Printful (orders fail without it)'],
    steps: [
      { title: 'Open the Printful developer page', body: 'Sign in to Printful and go to developers.printful.com, then Your tokens.' },
      { title: 'Create a private token', body: 'Click Create token, give it a name like "ExiusCart", allow all scopes, and create it. Copy the token straight away: Printful shows it only once.' },
      { title: 'Paste it in ExiusCart', body: 'Click Connect Printful, paste the token and click Connect.' },
      { title: 'Set up billing in Printful', body: 'In Printful, Billing, add a card. Printful charges it for each order it prints.' },
    ],
    works: ['Send your designs from Design Studio to Printful', 'Send orders to Printful', 'Tracking numbers back on the order'],
    signupUrl: 'https://www.printful.com/auth/register',
    keyUrl: 'https://developers.printful.com/tokens',
  },
  printify: {
    name: 'Printify',
    intro: 'Print on demand with 90+ print providers worldwide. Connect with a Printify personal access token.',
    needs: ['A Printify account with a shop', 'A payment method in Printify'],
    steps: [
      { title: 'Open Connections in Printify', body: 'Sign in to Printify, click your profile, then Connections.' },
      { title: 'Generate a token', body: 'Under Personal access tokens, click Generate, name it "ExiusCart", and copy it. Printify shows it only once.' },
      { title: 'Paste it in ExiusCart', body: 'Click Connect Printify, paste the token and click Connect. ExiusCart checks it with Printify right away.' },
    ],
    works: ['Send designs from Design Studio to Printify', 'Send orders to Printify', 'Tracking numbers back on the order'],
    signupUrl: 'https://printify.com/app/register',
  },
  gelato: {
    name: 'Gelato',
    intro: 'Local printing in 30+ countries, so orders arrive faster. Connect with a Gelato API key.',
    needs: ['A Gelato account', 'A payment method in Gelato'],
    steps: [
      { title: 'Open API keys in Gelato', body: 'Sign in to your Gelato dashboard, go to Developer, then API Keys.' },
      { title: 'Create a key', body: 'Click Create API key and copy it.' },
      { title: 'Paste it in ExiusCart', body: 'Click Connect Gelato, paste the key and click Connect. ExiusCart checks it with Gelato right away.' },
    ],
    works: ['Send designs from Design Studio to Gelato', 'Send orders to Gelato', 'Tracking numbers back on the order'],
    signupUrl: 'https://www.gelato.com/sign-up',
  },
  eprolo: {
    name: 'EPROLO',
    intro: 'Free to use, pay per order only. EPROLO gives its API only on request, so connecting has one extra step.',
    needs: ['A free EPROLO account'],
    steps: [
      { title: 'Create your EPROLO account', body: 'Sign up at eprolo.com and open your dashboard.' },
      { title: 'Ask EPROLO for API access', body: 'On your EPROLO dashboard, use the message box of your account support rep and ask for API access. They reply within about 24 hours with your API key and document.' },
      { title: 'Paste the key in ExiusCart', body: 'Click Connect EPROLO, paste the key and click Connect.' },
    ],
    works: ['Your connection is saved and ready'],
    limits: ['Product import and order sending for EPROLO switch on once ExiusCart has EPROLO’s API document. Until then, place EPROLO orders in your EPROLO dashboard.'],
    signupUrl: 'https://eprolo.com/',
  },
  '1688': {
    name: '1688',
    intro: 'China’s wholesale market, for buying stock in bulk at factory prices. It is not a dropshipper: you buy in bulk and ship from your own stock.',
    needs: ['A 1688 account (or a sourcing agent who buys for you)'],
    steps: [
      { title: 'Get access to 1688', body: '1688 is in Chinese and needs a Chinese-verified account, so most sellers use a sourcing agent.' },
      { title: 'Click Connect 1688', body: 'Add the connection in ExiusCart so you can import 1688 products by link.' },
      { title: 'Import and buy in bulk', body: 'Paste a 1688 product link to import it, then buy your stock on 1688 and sell it from your own inventory.' },
    ],
    works: ['Import products by link'],
    limits: ['1688 does not take single customer orders, so there is no Fulfill button for it.'],
    signupUrl: 'https://www.1688.com/',
  },
};
