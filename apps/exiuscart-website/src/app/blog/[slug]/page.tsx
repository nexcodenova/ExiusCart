import type { FC, ReactNode } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { notFound } from 'next/navigation';

// ── Reusable content components ───────────────────────────────────────────────

function Callout({ type, children }: { type: 'tip' | 'warning' | 'info' | 'example'; children: ReactNode }) {
  const styles = {
    tip:     { bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,  label: 'Tip',     labelColor: 'text-emerald-700' },
    warning: { bg: 'bg-amber-50',    border: 'border-amber-200',   icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />, label: 'Watch out', labelColor: 'text-amber-700' },
    info:    { bg: 'bg-blue-50',     border: 'border-blue-200',    icon: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,           label: 'Note',    labelColor: 'text-blue-700' },
    example: { bg: 'bg-purple-50',   border: 'border-purple-200',  icon: <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />, label: 'Example', labelColor: 'text-purple-700' },
  }[type];
  return (
    <div className={`${styles.bg} border ${styles.border} rounded-2xl p-5 my-7 flex gap-3`}>
      {styles.icon}
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${styles.labelColor}`}>{styles.label}</p>
        <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function PullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-10 border-l-4 border-[#6B3FD9] pl-6 py-1">
      <p className="text-2xl font-black text-gray-900 leading-tight italic">{children}</p>
    </blockquote>
  );
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-2xl md:text-3xl font-black text-gray-900 mt-14 mb-5 leading-tight scroll-mt-24">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-gray-600 leading-[1.8] mb-5 text-[15px]">{children}</p>;
}

function UL({ items }: { items: string[] }) {
  return (
    <ul className="my-5 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] text-gray-600 leading-relaxed">
          <span className="w-5 h-5 rounded-full bg-[#6B3FD9]/10 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-[#6B3FD9]" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <ol className="my-6 space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span className="w-7 h-7 rounded-full bg-[#6B3FD9] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <div>
            <p className="font-bold text-gray-900 text-[15px]">{item.title}</p>
            <p className="text-gray-500 text-sm leading-relaxed mt-0.5">{item.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatBox({ stat, label, sub }: { stat: string; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
      <p className="text-4xl font-black text-[#6B3FD9] mb-1">{stat}</p>
      <p className="font-semibold text-gray-900 text-sm">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Divider() {
  return <div className="my-10 border-t border-gray-100" />;
}

// ── Post content components ───────────────────────────────────────────────────

function UAEVATGuide() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        You've just made a sale. Your customer asks for a VAT invoice. You open Excel, type something up, and hit send. Three weeks later, an FTA audit letter arrives. The invoice is missing your TRN. The penalty? AED 2,500 — for that one invoice. Multiply that across a busy month and it gets painful fast.
      </p>

      <P>This guide covers everything a UAE business owner needs to know about VAT invoicing — what must be on every invoice, the most common mistakes auditors look for, and how to get it right without spending hours on paperwork.</P>

      <H2 id="what-is-uae-vat">What is UAE VAT?</H2>
      <P>The UAE introduced Value Added Tax (VAT) on 1 January 2018 at a flat rate of 5%. It applies to most goods and services sold within the country and is collected by businesses on behalf of the Federal Tax Authority (FTA).</P>
      <P>The rate itself is straightforward. The invoicing rules are where most businesses run into trouble.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="5%" label="UAE VAT rate" sub="Fixed since Jan 2018" />
        <StatBox stat="AED 375K" label="Mandatory registration threshold" sub="Annual taxable turnover" />
        <StatBox stat="14 days" label="Invoice deadline" sub="After supply date" />
      </div>

      <H2 id="who-needs-to-register">Who Needs to Register for VAT?</H2>
      <P>You must register for VAT if your taxable turnover in the past 12 months exceeded AED 375,000 — or if you reasonably expect it to cross that threshold in the next 30 days.</P>
      <P>Voluntary registration is available from AED 187,500. Many businesses register voluntarily so they can reclaim the VAT they pay on business expenses (called input tax).</P>

      <Callout type="warning">
        Charging VAT on your invoices without being registered is a violation. The FTA penalty for this is AED 5,000. If you're below the threshold and not yet registered — don't include VAT on your invoices.
      </Callout>

      <P>Once registered, the FTA issues you a <strong>Tax Registration Number (TRN)</strong> — a unique 15-digit number. This must appear on every VAT invoice you issue. Without it, the invoice is not legally valid as a tax document.</P>

      <H2 id="two-types-of-invoices">Two Types of UAE VAT Invoices</H2>
      <P>The FTA recognises two types of VAT invoices. Using the wrong one isn't illegal, but issuing a simplified invoice when a full tax invoice is required means your customer can't use it to reclaim VAT — which can cost you the relationship.</P>

      <H3>Full Tax Invoice</H3>
      <P>Required for B2B transactions — when you're selling to another VAT-registered business. The buyer needs this to claim back the input VAT they paid. It must include all required fields (covered below).</P>

      <H3>Simplified Tax Invoice</H3>
      <P>Used for retail sales to consumers (B2C) where the total is under AED 10,000. You don't need the customer's details, which makes high-volume transactions much faster.</P>

      <Callout type="tip">
        When in doubt, issue a full tax invoice. It covers both scenarios, your customer can use it for VAT recovery, and you won't get a callback asking for a replacement.
      </Callout>

      <H2 id="what-must-be-on-invoice">What Must Appear on a UAE VAT Invoice?</H2>
      <P>The FTA specifies exactly what a valid full tax invoice must contain. Miss any of these and the invoice fails compliance.</P>

      <NumberedList items={[
        { title: '"Tax Invoice" — clearly visible', desc: 'These exact words must appear on the document. Not "Invoice" or "Receipt" — it must say Tax Invoice.' },
        { title: 'Your business name and address', desc: 'As registered with the FTA. If you trade under a different name, both names should appear.' },
        { title: 'Your TRN (Tax Registration Number)', desc: 'Your 15-digit FTA-issued number. This is non-negotiable — no TRN means invalid invoice.' },
        { title: 'Invoice date and unique invoice number', desc: 'The number must be sequential. Auditors look for gaps in the numbering sequence, which flag potential underreporting.' },
        { title: "Customer's name, address, and TRN", desc: 'Required for B2B invoices. If the customer is VAT-registered, include their TRN so they can claim input tax.' },
        { title: 'Description of goods or services', desc: 'Specific enough to identify what was supplied. "Consulting" alone is not sufficient — include the scope.' },
        { title: 'Quantity and unit price for each item', desc: 'Per line. Lump sums without itemisation are not acceptable for audits.' },
        { title: 'Any discounts applied', desc: 'Show the discount before calculating VAT. VAT should be calculated on the discounted amount, not the original price.' },
        { title: 'Subtotal before VAT', desc: 'The total of all line items before tax is applied.' },
        { title: 'VAT amount per line item', desc: 'Each line should show its 5% VAT amount separately.' },
        { title: 'Total VAT amount', desc: 'Sum of all line item VAT amounts.' },
        { title: 'Total amount including VAT', desc: 'Final amount the customer pays. Must be in AED.' },
        { title: 'Currency conversion rate (if applicable)', desc: 'If the invoice is in USD, GBP or any other currency, you must show the AED equivalent and the exchange rate used.' },
      ]} />

      <PullQuote>"Missing your TRN from one invoice is AED 2,500. A busy month with 50 invoices missing TRNs? That's AED 125,000."</PullQuote>

      <H2 id="vat-rates">VAT Rates — What's Taxable, Zero-Rated, and Exempt</H2>
      <P>Not everything is taxed at 5%. Knowing the difference between zero-rated and exempt matters — especially if you're in retail, healthcare, property, or logistics.</P>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Category</th>
              <th className="text-left px-4 py-3 font-semibold">VAT Rate</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Examples</th>
            </tr>
          </thead>
          <tbody>
            {[
              { cat: 'Standard rated', rate: '5%', ex: 'Retail goods, restaurant meals, electronics, most services' },
              { cat: 'Zero-rated', rate: '0%', ex: 'Exports outside GCC, international transport, certain healthcare & education' },
              { cat: 'Exempt', rate: 'No VAT', ex: 'Residential property rental, bare land, local passenger transport' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.cat}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.rate}</td>
                <td className="px-4 py-3 text-gray-500 border-b border-gray-100">{row.ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="info">
        Zero-rated and exempt sound similar but work differently. Zero-rated businesses can still reclaim the VAT they pay on their own purchases (input tax). Exempt businesses cannot. If your income is mainly from exempt supplies, most of your input VAT is unrecoverable.
      </Callout>

      <H2 id="common-mistakes">Common Mistakes UAE Businesses Make</H2>
      <P>The FTA has issued thousands of fines since 2018. The violations repeat themselves year after year — and almost all are preventable.</P>

      <UL items={[
        'Missing TRN — Penalty: AED 2,500 per incorrect invoice',
        'Non-sequential invoice numbering — Flags underreporting in audits',
        'Calculating VAT on pre-discount amount instead of post-discount',
        'Issuing invoices more than 14 days after the supply date',
        'Not issuing an invoice at all for taxable supplies',
        'Keeping records for less than 5 years — FTA audits go back 5 years',
        'Charging VAT on exempt supplies',
        'Registering late after crossing the AED 375K threshold',
      ]} />

      <Callout type="example">
        <strong>The 14-day rule in practice:</strong> You complete a fit-out job on 3 June. Your tax invoice must be issued by 17 June at the latest. If you issue it on 25 June because "the client asked us to hold it", you're already in violation — even if the client requested the delay.
      </Callout>

      <H2 id="filing-vat-returns">Filing Your UAE VAT Return</H2>
      <P>VAT-registered businesses file returns quarterly (some monthly, based on FTA assignment). The deadline is 28 days after the end of each tax period.</P>
      <P>The return is filed through the <strong>EmaraTax portal</strong> (the FTA's online platform). You declare:</P>
      <UL items={[
        'Output tax — VAT you charged customers',
        'Input tax — VAT you paid on business purchases',
        'Net VAT payable (output minus input)',
      ]} />
      <P>If your input tax exceeds your output tax, you can claim a refund from the FTA — though the refund process takes time and documentation.</P>

      <Callout type="tip">
        Keep digital records of every invoice issued and received — not just for the return, but because the FTA can request them during a random audit at any point within the 5-year window. A folder of PDFs on your desktop is not good enough. You need a system that can pull up any invoice instantly.
      </Callout>

      <Divider />

      <H2 id="automate-vat-invoicing">How to Stop Doing This Manually</H2>
      <P>Generating VAT invoices in Word or Excel works — right up until it doesn't. TRNs get left off when you're busy. Invoice numbers get duplicated. VAT gets rounded incorrectly. And when the FTA asks for records from 3 years ago, you're hunting through email inboxes and old hard drives.</P>
      <P>ExiusCart generates FTA-compliant VAT invoices automatically on every sale. Every invoice includes your TRN, 5% VAT calculated correctly, sequential numbering, your logo, and a professional PDF — without you touching any of it. The invoices are stored and searchable forever.</P>
      <P>Starter plan includes 500 invoices per month. Premium is unlimited. Both generate the same FTA-compliant format.</P>

      <Divider />

      <H2 id="summary">Key Takeaways</H2>
      <UL items={[
        'Register for VAT when turnover hits AED 375,000 — or consider voluntary registration from AED 187,500',
        'Your TRN must appear on every single invoice — missing it is AED 2,500 per invoice',
        'Issue invoices within 14 days of the supply date — not when it\'s convenient',
        'Use sequential invoice numbering with no gaps',
        'Keep all records for at least 5 years',
        'File your VAT return within 28 days of each tax period end via EmaraTax',
        'Know the difference between zero-rated and exempt — they affect input tax recovery',
      ]} />

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Generate VAT-compliant invoices automatically</p>
        <p className="text-gray-400 text-sm mb-6">ExiusCart handles the invoice format, TRN, VAT calculation, and PDF — on every sale, automatically.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Try free for 14 days <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function SkipAdminPanel() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        Your website is live. It looks great. The first order arrives — and you realize there's no way to manage it. No order list. No inventory tracking. No invoice. You message the developer. They quote AED 25,000 and three months to build an admin panel. What if you didn't need one?
      </p>

      <P>This is a problem almost every business owner with a custom website runs into. The site was built by a designer or a dev agency. It looks polished. But behind the scenes, there's nothing — no backend to process orders, no system to track stock, no way to issue a VAT invoice.</P>
      <P>The usual solution is to build it. And that decision turns a AED 15,000 website project into a AED 50,000 software project that still isn't finished eight months later.</P>
      <P>There's a different approach. And it's much simpler.</P>

      <H2 id="the-hidden-problem">The Hidden Problem With Custom Websites</H2>
      <P>When a business commissions a custom website — whether it's built on Next.js, Laravel, WordPress, or any other framework — the frontend is usually the focus. How it looks. How fast it loads. How easy it is to navigate.</P>
      <P>What gets left out of those initial conversations is the backend. The bit that runs the business. Order management, inventory control, staff accounts, invoicing, reports, customer records — none of that ships with a custom website by default.</P>
      <P>So when orders start coming in, the business is left making do with spreadsheets and WhatsApp messages, or spending more money building a proper system from scratch.</P>

      <Callout type="info">
        This isn't a developer problem or a planning failure — it's just how websites work. A website is a frontend. Running a business needs a backend. Those are two separate things, and most website projects only budget for one of them.
      </Callout>

      <H2 id="what-building-costs">What Building a Backend Actually Costs</H2>
      <P>If you've ever been quoted for a custom admin panel, you know it's not cheap. Here's a rough picture of what's typically needed:</P>

      <NumberedList items={[
        { title: 'Order management system', desc: 'Receive orders, mark them fulfilled, handle returns, notify customers. 3–6 weeks of development.' },
        { title: 'Inventory tracking', desc: 'Track stock levels per product and variant, low-stock alerts, restock management. Another 3–5 weeks.' },
        { title: 'Invoicing', desc: 'Generate branded PDF invoices, apply VAT, maintain sequential invoice numbers. 2–3 weeks.' },
        { title: 'Staff and roles', desc: 'Multiple user accounts with different access levels — manager, cashier, warehouse. 2–4 weeks.' },
        { title: 'Reporting dashboard', desc: 'Revenue by day, product performance, customer retention, sales trends. 3–5 weeks.' },
        { title: 'Customer management', desc: 'View purchase history, manage loyalty, send targeted messages. 2–4 weeks.' },
      ]} />

      <P>Add it up and you're looking at 4–6 months of development time and significant ongoing maintenance. And that's before any of the features break or need updates as the business grows.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="4–6mo" label="Typical build time" sub="For a full admin panel" />
        <StatBox stat="AED 45" label="ExiusCart Starter" sub="Per month — everything included" />
        <StatBox stat="1 day" label="To connect your site" sub="API setup, not a project" />
      </div>

      <PullQuote>"Building an admin panel is like building a car when you just need to get to work."</PullQuote>

      <H2 id="exiuscart-as-admin">ExiusCart as Your Admin Panel</H2>
      <P>ExiusCart is a business management platform — built for exactly this. Orders, inventory, invoicing, HR, payroll, customer management, marketing, and reports. All in one place, already built, already working.</P>
      <P>When you connect your custom website to ExiusCart, every order placed on your site flows directly into the ExiusCart dashboard. From there, you manage everything — without your developer needing to build any of it.</P>
      <P>Your website stays exactly as it is. It just gets a fully functioning backend overnight.</P>

      <Callout type="tip">
        ExiusCart works alongside any website. It doesn't matter what your site is built on — Next.js, Webflow, a custom PHP site, or something proprietary. As long as it can send an HTTP request, the integration works.
      </Callout>

      <H2 id="how-connection-works">How the Connection Works</H2>
      <P>The technical side is simpler than it sounds. Your website sends order data to ExiusCart when a purchase is made — that's it. ExiusCart receives the order, adds it to the dashboard, and updates your inventory automatically.</P>
      <P>From the customer's side, nothing changes. They check out on your website as normal. Behind the scenes, ExiusCart receives the order details and you see it in your dashboard within seconds.</P>

      <H3>For non-technical owners</H3>
      <P>Share the ExiusCart API documentation with whoever built your website. Setup takes a few hours on their end, not months. It's a standard integration — your developer will have done something like it before.</P>

      <H3>For developers reading this</H3>
      <P>ExiusCart exposes a REST API. Your site POSTs order data to the endpoint with your API key. Product IDs map to ExiusCart's catalog, inventory decrements automatically on each order, and fulfilment status syncs back. The integration guide is in the ExiusCart developer docs.</P>

      <Callout type="example">
        <strong>A typical flow:</strong> Customer places an order on your Next.js site → your server sends a POST request to ExiusCart with the order details → ExiusCart creates the order, decrements stock, and queues the VAT invoice → you see the order in your dashboard and mark it fulfilled → the customer gets their receipt.
      </Callout>

      <H2 id="features-day-one">Everything You Get on Day One</H2>
      <P>Once your site is connected, here's what you get without writing a single line of business logic:</P>

      <UL items={[
        'Order management — view, process, and fulfil every order in a clean dashboard',
        'Live inventory — stock levels update automatically with every sale',
        'VAT invoicing — FTA-compliant PDF invoices generated on every order (UAE businesses)',
        'Customer records — purchase history, contact details, order value per customer',
        'Staff accounts — give different access levels to different team members',
        'Sales reports — revenue by day, week, month, product, and category',
        'Low-stock alerts — get notified before you run out',
        'Email & SMS campaigns — market to your existing customer list directly from ExiusCart',
        'Returns and refunds — track and process returns without spreadsheets',
        'Multi-branch support — manage more than one location from the same dashboard (Premium plan)',
      ]} />

      <Divider />

      <H2 id="is-it-right-for-you">Who Should Use This Approach</H2>
      <P>This works well for any business with a custom or non-standard website that sells products or services online. Some specific cases:</P>

      <H3>You built on a custom framework</H3>
      <P>If your site runs on custom code — a Laravel backend, a Django app, or a Node.js API — you don't have a ready-made plugin for order management. ExiusCart's API fills that gap without a rebuild.</P>

      <H3>You're a developer building for a client</H3>
      <P>Instead of building an admin panel from scratch, connect their site to ExiusCart. You deliver faster, the client gets a better product, and you're not maintaining a custom-built backend for the next three years.</P>

      <H3>You outgrew Shopify or WooCommerce</H3>
      <P>Some businesses need more than what a standard platform gives — custom checkout flows, industry-specific features, or tighter control over the customer experience. They move to a custom site and lose the admin tools in the process. ExiusCart gives them back.</P>

      <Callout type="info">
        ExiusCart also connects directly to Shopify and WooCommerce if that's your platform. The custom website integration is specifically for sites that aren't on a standard ecommerce platform.
      </Callout>

      <H2 id="get-started">Connect Your Site in Minutes</H2>
      <P>Start with a free ExiusCart trial. Set up your product catalog. Then share the API documentation with your developer — or follow the integration guide yourself if you're technical. Most sites are connected within a day.</P>
      <P>You won't need to rebuild your website. You won't need a four-month backend project. Your site stays as it is, and ExiusCart handles everything behind it.</P>

      <UL items={[
        'No platform migration required — your site stays exactly as it is',
        'Works with any website that can make HTTP requests',
        'Setup typically takes 1–2 days for a developer',
        'All paid plans include the custom website integration',
        '14-day free trial to test the full connection before committing',
      ]} />

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Connect your custom website today</p>
        <p className="text-gray-400 text-sm mb-6">Start your free trial and give your developer the API docs. Most sites are live within a day.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

// ── Post registry ─────────────────────────────────────────────────────────────

const POSTS: Record<string, {
  title: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  categoryColor: string;
  date: string;
  readTime: string;
  lead: string;
  toc: { id: string; label: string }[];
  Content: FC;
}> = {
  'uae-vat-invoicing-guide-small-business': {
    title: 'The Complete Guide to UAE VAT Invoicing for Small Business Owners',
    seoTitle: 'UAE VAT Invoicing Guide 2026 — 5% VAT Compliance for Small Businesses | ExiusCart',
    seoDescription: 'Everything UAE small business owners need to know about VAT invoicing — TRN requirements, invoice formats, common FTA penalties, and how to automate it all.',
    category: 'Finance',
    categoryColor: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    date: 'June 2026',
    readTime: '8 min',
    lead: 'The FTA penalises AED 2,500 per incorrect invoice. Most mistakes are avoidable. Here\'s everything you need to know about VAT-compliant invoicing in the UAE.',
    toc: [
      { id: 'what-is-uae-vat',        label: 'What is UAE VAT?' },
      { id: 'who-needs-to-register',  label: 'Who needs to register?' },
      { id: 'two-types-of-invoices',  label: 'Two types of invoices' },
      { id: 'what-must-be-on-invoice', label: 'What must be on an invoice' },
      { id: 'vat-rates',              label: 'VAT rates explained' },
      { id: 'common-mistakes',        label: 'Common mistakes & fines' },
      { id: 'filing-vat-returns',     label: 'Filing VAT returns' },
      { id: 'automate-vat-invoicing', label: 'Automating VAT invoices' },
      { id: 'summary',                label: 'Key takeaways' },
    ],
    Content: UAEVATGuide,
  },
  // ── Add more posts here as content is ready ──
  'skip-admin-panel-connect-custom-website': {
    title: "Why Your Custom Website Doesn't Need a Separate Admin Panel",
    seoTitle: "Skip the Backend: How ExiusCart Replaces Your Custom Website Admin Panel | ExiusCart",
    seoDescription: "Building a website? ExiusCart acts as your complete admin panel — orders, inventory, invoicing, HR, and reports — no backend to build.",
    category: 'Integrations',
    categoryColor: 'text-blue-600 bg-blue-50 border-blue-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: 'Most businesses with custom websites hit the same wall: the site looks great but there\'s no backend to run the business. Here\'s how to fix it without a four-month dev project.',
    toc: [
      { id: 'the-hidden-problem',    label: 'The hidden problem' },
      { id: 'what-building-costs',   label: 'What building one costs' },
      { id: 'exiuscart-as-admin',    label: 'ExiusCart as your admin' },
      { id: 'how-connection-works',  label: 'How the connection works' },
      { id: 'features-day-one',      label: 'Features on day one' },
      { id: 'is-it-right-for-you',   label: 'Who this is for' },
      { id: 'get-started',           label: 'Get connected' },
    ],
    Content: SkipAdminPanel,
  },
  'thedersi-sellers-manage-orders-exiuscart': {
    title: 'How TheDersi Sellers Can Manage All Their Orders in One Place',
    seoTitle: 'TheDersi Order Management Made Easy with ExiusCart | ExiusCart Blog',
    seoDescription: 'A step-by-step guide for TheDersi sellers on syncing orders, tracking inventory, and issuing invoices using ExiusCart.',
    category: 'Guides',
    categoryColor: 'text-[#6B3FD9] bg-purple-50 border-purple-100',
    date: 'June 2026',
    readTime: '4 min',
    lead: "If you're selling on TheDersi, your orders are already syncing to ExiusCart. Here's how to make the most of it.",
    toc: [],
    Content: () => <p className="text-gray-500 italic">Full article coming soon.</p>,
  },
  'pos-vs-cash-register-uae-shops-2026': {
    title: 'POS vs Cash Register: What UAE Shop Owners Need to Know in 2026',
    seoTitle: 'POS System vs Cash Register for UAE Shops — Which Should You Choose in 2026? | ExiusCart',
    seoDescription: 'Comparing modern POS systems against traditional cash registers for UAE shop owners. Features, cost, and what works for your business size.',
    category: 'Technology',
    categoryColor: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: "A cash register does one thing. A POS does twenty. But is the upgrade actually worth it for a small shop?",
    toc: [],
    Content: () => <p className="text-gray-500 italic">Full article coming soon.</p>,
  },
  'scale-uae-business-multiple-branches': {
    title: 'From One Store to Multiple Branches: How to Scale Your UAE Business',
    seoTitle: 'How to Manage Multiple Retail Branches in UAE — Complete Guide 2026 | ExiusCart',
    seoDescription: 'How successful UAE retailers expand to multiple locations without losing control of inventory, staff, and sales reporting.',
    category: 'Growth',
    categoryColor: 'text-orange-600 bg-orange-50 border-orange-100',
    date: 'June 2026',
    readTime: '5 min',
    lead: "Opening a second branch is exciting. Managing it without the right tools is chaos. Here's how to do it properly.",
    toc: [],
    Content: () => <p className="text-gray-500 italic">Full article coming soon.</p>,
  },
  'stop-using-spreadsheets-switch-exiuscart': {
    title: 'Why Growing Shops Stop Using Spreadsheets (And What They Use Instead)',
    seoTitle: 'Stop Using Spreadsheets to Run Your Business — Switch to ExiusCart | ExiusCart Blog',
    seoDescription: 'The real cost of managing a business on Excel spreadsheets, and how switching to ExiusCart saves hours every week.',
    category: 'Productivity',
    categoryColor: 'text-rose-600 bg-rose-50 border-rose-100',
    date: 'June 2026',
    readTime: '4 min',
    lead: "Spreadsheets are free. Until you count the hours you spend on them every week.",
    toc: [],
    Content: () => <p className="text-gray-500 italic">Full article coming soon.</p>,
  },
  'hr-payroll-small-business-no-hr-team': {
    title: 'How to Handle Employee Payroll Without an HR Department',
    seoTitle: 'Small Business HR & Payroll Management — No HR Team Needed | ExiusCart Blog',
    seoDescription: 'How small business owners can manage employee attendance, leave, and payroll in minutes without hiring an HR team.',
    category: 'HR & Payroll',
    categoryColor: 'text-pink-600 bg-pink-50 border-pink-100',
    date: 'June 2026',
    readTime: '5 min',
    lead: "You started a business, not an HR department. Here's how to handle payroll in minutes — not hours.",
    toc: [],
    Content: () => <p className="text-gray-500 italic">Full article coming soon.</p>,
  },
  'shopify-woocommerce-sync-exiuscart': {
    title: 'Syncing Shopify & WooCommerce Orders into One Dashboard',
    seoTitle: 'Manage Shopify, WooCommerce & TheDersi Orders in One Place | ExiusCart Blog',
    seoDescription: 'How to sync Shopify, WooCommerce, TheDersi, and custom website orders into a single ExiusCart dashboard.',
    category: 'Integrations',
    categoryColor: 'text-blue-600 bg-blue-50 border-blue-100',
    date: 'June 2026',
    readTime: '4 min',
    lead: "Selling on three platforms means three dashboards to check — unless you centralise everything in ExiusCart.",
    toc: [],
    Content: () => <p className="text-gray-500 italic">Full article coming soon.</p>,
  },
};

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS[params.slug];
  if (!post) return { title: 'Not Found | ExiusCart Blog' };
  return {
    title: post.seoTitle,
    description: post.seoDescription,
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      url: `https://exiuscart.com/blog/${params.slug}`,
      siteName: 'ExiusCart',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle,
      description: post.seoDescription,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];
  if (!post) notFound();
  const { Content } = post;

  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.seoDescription,
          datePublished: '2026-06-01',
          publisher: {
            '@type': 'Organization',
            name: 'ExiusCart',
            url: 'https://exiuscart.com',
          },
        }) }}
      />

      {/* Hero — dark */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-10 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to blog
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${post.categoryColor}`}>
              {post.category}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" /> {post.readTime} read
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{post.date}</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-black text-white leading-[1.06] tracking-tight mb-6">
            {post.title}
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">{post.lead}</p>
        </div>
      </section>

      {/* Content — cream */}
      <section className="bg-[#F5F3EF] px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-16 items-start">

            {/* TOC sidebar — sticky on desktop */}
            {post.toc.length > 0 && (
              <aside className="hidden lg:block sticky top-24 self-start">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">
                  On this page
                </p>
                <nav className="space-y-1">
                  {post.toc.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block text-sm text-gray-500 hover:text-gray-900 py-1.5 border-l-2 border-gray-200 hover:border-[#6B3FD9] pl-4 transition-all leading-tight"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                <div className="mt-10 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-bold text-gray-900 mb-2">Try ExiusCart free</p>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">14 days, all features, no credit card.</p>
                  <Link
                    href="/register"
                    className="flex items-center justify-between gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-xs"
                  >
                    Get started <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </aside>
            )}

            {/* Main content */}
            <div className="max-w-2xl">
              <Content />
            </div>

          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#F5F3EF] px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0B1121] rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-4">Start today</p>
              <h3 className="text-3xl font-black text-white mb-2 leading-tight">
                Run your business<br />the smart way.
              </h3>
              <p className="text-gray-400 text-sm">14-day free trial. No credit card required.</p>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm whitespace-nowrap"
              >
                Start free trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white font-semibold px-7 py-3.5 rounded-xl border border-white/10 hover:border-white/20 transition-all text-sm whitespace-nowrap"
              >
                View pricing <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
