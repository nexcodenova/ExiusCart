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
        <StatBox stat="AED 45" label="ExiusCart Starter" sub="$12 USD · per month" />
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

function TheDersiPost() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        Monday morning, 23 new orders on TheDersi. You open a spreadsheet, start copying them across one by one — customer name, product, quantity, address. By the time you're done, it's been 40 minutes and you still haven't checked if anything is actually in stock.
      </p>

      <P>If that sounds familiar, you're not alone. Most TheDersi sellers manage orders manually for longer than they should — because no one tells them there's a better way until they're completely overwhelmed.</P>
      <P>ExiusCart is the official order management platform for TheDersi. Orders sync automatically. Inventory updates in real time. Invoices generate themselves. Here's how to use it properly.</P>

      <H2 id="manual-problem">Why Manual Order Management Breaks Down</H2>
      <P>Copying orders into a spreadsheet works when you have 5 a day. At 30, you're spending two hours on data entry alone. At 100, it's a full-time job — and mistakes start happening.</P>
      <P>Wrong quantities get shipped. Stock runs out because the spreadsheet wasn't updated. A customer asks for an invoice and you spend 20 minutes in Word creating one. A return arrives and you have no record of the original order.</P>
      <P>These aren't big-business problems. They happen to any seller who grows faster than their systems.</P>

      <Callout type="info">
        TheDersi's seller portal shows you orders — but it's not built for managing a business. It doesn't track stock, generate invoices, manage staff, or give you a sales report. That's what ExiusCart is for.
      </Callout>

      <H2 id="how-it-connects">How ExiusCart Connects to TheDersi</H2>
      <P>The connection is built in — not a third-party workaround. ExiusCart and TheDersi are integrated at the platform level, which means setup takes minutes, not days.</P>

      <NumberedList items={[
        { title: 'Create your ExiusCart account', desc: 'Start a free trial — no credit card needed. All features are unlocked during your 14-day trial.' },
        { title: 'Connect TheDersi in your settings', desc: 'Go to Integrations in your ExiusCart dashboard and link your TheDersi seller account. Takes about 2 minutes.' },
        { title: 'Orders start syncing immediately', desc: 'All new TheDersi orders appear in your ExiusCart dashboard automatically. No exports, no manual imports.' },
        { title: 'Set up your product catalog', desc: 'Map your TheDersi listings to ExiusCart products so inventory updates correctly with every order.' },
      ]} />

      <P>Historical orders don't sync back — only new orders from the point of connection. So it makes sense to connect early, before your order volume makes manual management painful.</P>

      <H2 id="what-syncs">What Syncs Automatically</H2>
      <P>When a customer places an order on TheDersi, ExiusCart receives it within seconds. Here's exactly what comes across:</P>

      <UL items={[
        'Order ID and TheDersi reference number',
        'Customer name, address, and contact details',
        'Product name, SKU, quantity, and variant (size, colour, etc.)',
        'Order value and any discounts applied',
        'Payment status (paid, pending, COD)',
        'Delivery method and address',
        'Order status updates — when TheDersi marks it shipped, ExiusCart updates too',
      ]} />

      <Callout type="tip">
        You can also update the order status from ExiusCart and it reflects back in TheDersi. So your fulfilment team can work entirely in ExiusCart without touching the TheDersi seller portal at all.
      </Callout>

      <H2 id="inventory-sync">Keep Your Inventory Accurate</H2>
      <P>This is the part that saves the most headaches. Every time an order syncs from TheDersi, ExiusCart decrements the stock count for that product automatically. No manual updating. No "checking the sheet."</P>
      <P>If you sell the same products on TheDersi and on your own website (or in a physical store), ExiusCart manages stock across all of them from one place. Sell something in-store via POS and the TheDersi listing reflects the updated stock.</P>

      <Callout type="warning">
        Selling on multiple channels without centralised inventory is the fastest route to overselling — taking an order you can't fulfil. ExiusCart prevents this by keeping one stock count, not separate counts per channel.
      </Callout>

      <P>Low-stock alerts are built in. Set a threshold per product and ExiusCart notifies you when you're running low — before you run out completely and miss orders.</P>

      <H2 id="invoicing">Invoices That Generate Themselves</H2>
      <P>Every TheDersi order that syncs into ExiusCart can generate a VAT-compliant invoice automatically. Your logo, your TRN, the correct 5% VAT calculation, sequential numbering — all of it, without you touching anything.</P>
      <P>Customers who request a VAT invoice for their records (B2B buyers especially) get a professional PDF that meets FTA requirements. That's something TheDersi's built-in receipt doesn't provide.</P>

      <div className="grid grid-cols-2 gap-4 my-8">
        <StatBox stat="500" label="Invoices per month" sub="Starter plan" />
        <StatBox stat="∞" label="Invoices per month" sub="Premium plan" />
      </div>

      <H2 id="reports">Know Your TheDersi Numbers</H2>
      <P>The TheDersi seller portal shows you orders and basic revenue. ExiusCart goes much deeper.</P>

      <UL items={[
        'Revenue by day, week, and month — with trend lines so you can spot slow periods early',
        'Best-selling products — ranked by revenue and units sold',
        'Average order value — and how it changes over time',
        'Fulfilment times — how long from order to dispatch',
        'Return rate per product — so you know which listings need attention',
        'Customer lifetime value — repeat buyers vs one-time customers',
      ]} />

      <P>All of this is in your ExiusCart dashboard — no exporting data, no building your own charts in Excel.</P>

      <PullQuote>"You can't grow what you can't measure. The sellers who scale on TheDersi are the ones who know their numbers."</PullQuote>

      <H2 id="plans">Free vs Paid: Which Plan Do You Need?</H2>
      <P>ExiusCart has a free tier specifically for TheDersi sellers who are just getting started. Here's how the plans compare:</P>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Feature</th>
              <th className="text-left px-4 py-3 font-semibold">Free Trial</th>
              <th className="text-left px-4 py-3 font-semibold">Starter · AED 45/$12</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Premium · AED 99/$29</th>
            </tr>
          </thead>
          <tbody>
            {[
              { f: 'TheDersi order sync',   free: '50/month',     starter: '1,000/month',  premium: 'Unlimited' },
              { f: 'Products',              free: '50',           starter: '1,000',         premium: 'Unlimited' },
              { f: 'Staff accounts',        free: '1',            starter: '3',             premium: 'Unlimited' },
              { f: 'Invoices',              free: '—',            starter: '500/month',     premium: 'Unlimited' },
              { f: 'Inventory tracking',    free: 'Basic',        starter: 'Full',          premium: 'Full + multi-branch' },
              { f: 'Analytics',             free: 'Basic',        starter: 'Advanced',      premium: 'Advanced' },
              { f: 'Support',               free: 'Email',        starter: 'Priority email', premium: '24/7 + account manager' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.f}</td>
                <td className="px-4 py-3 text-gray-400 border-b border-gray-100">{row.free}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.starter}</td>
                <td className="px-4 py-3 text-[#6B3FD9] font-semibold border-b border-gray-100">{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="example">
        <strong>When to upgrade:</strong> If your TheDersi store does more than 50 orders a month — even occasionally — the Starter plan at AED 45/month is worth it. At 100 orders a month, you're spending more time on manual management than the subscription costs. At 500+, Premium pays for itself in staff time alone.
      </Callout>

      <H2 id="get-started">Get Connected in 10 Minutes</H2>
      <P>You don't need to migrate anything or change how your TheDersi store works. ExiusCart runs alongside it — your listings stay on TheDersi, your customers check out on TheDersi, and ExiusCart handles everything on the management side.</P>

      <UL items={[
        'Create your ExiusCart account (free, no card needed)',
        'Connect your TheDersi account in the Integrations settings',
        'Set up your product catalog so inventory tracks correctly',
        'Place a test order on TheDersi and watch it appear in your dashboard',
        'Turn on low-stock alerts and invoice auto-generation',
      ]} />

      <P>Most sellers are fully set up within the same day. The 14-day free trial gives you time to test everything properly before choosing a plan.</P>

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Start managing TheDersi orders properly</p>
        <p className="text-gray-400 text-sm mb-6">Connect your TheDersi store to ExiusCart — free for 14 days, all features included.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function POSvsCashRegister() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        A customer pays by card. Your cash register beeps. You hand over a handwritten receipt. Later, an auditor asks for your sales records — and you have a drawer full of paper rolls and nothing else. That worked in 2010. In 2026, it creates real problems.
      </p>

      <P>Most UAE shop owners know a POS system is probably the right move. What stops them is the same question: is it actually worth it for the size of my shop? Or am I paying for features I'll never use?</P>
      <P>This guide gives you a clear comparison — what each option does, what it costs, and when the switch from cash register to POS genuinely makes sense.</P>

      <H2 id="what-a-cash-register-does">What a Cash Register Actually Does</H2>
      <P>A cash register does one thing: it calculates the total and opens the drawer. That's it. The more advanced models add a receipt printer and basic category totals at the end of the day. But there's no software, no database, no reporting, and no integration with anything else.</P>
      <P>You know what sold today by counting the cash in the drawer. You know what's in stock by walking to the shelf. You know your busiest hour by memory. When the FTA asks for your sales records, you hand them a shoebox of receipts.</P>

      <Callout type="warning">
        If your business is VAT-registered, a standard cash register receipt is not a valid tax document. FTA-compliant tax invoices require your TRN, a sequential invoice number, itemised VAT amounts, and your registered business name. A cash register print-out doesn't have any of this.
      </Callout>

      <P>Cash registers cost AED 200–800 to buy, have no monthly fees, and require no setup. For a very small operation — a single fruit stall, a neighbourhood shop doing under AED 100,000 a year — they work. Below the VAT registration threshold and not growing, a cash register is fine.</P>

      <H2 id="what-a-pos-does">What a POS System Does</H2>
      <P>A POS system is software. It runs on a tablet, a desktop, or a dedicated terminal. Instead of just opening a drawer, it records every transaction in a database — what was sold, when, at what price, by which staff member, to which customer.</P>
      <P>That data is what makes the difference. At the end of the day you don't count a drawer — you read a report. At the end of the month you know exactly which products made you money and which sat on the shelf.</P>

      <UL items={[
        'Every sale recorded with product name, quantity, price, and time',
        'Inventory updates automatically — no manual stock counts after every sale',
        'Staff log in separately — you see who sold what and when',
        'FTA-compliant VAT invoices generated on every transaction',
        'Customer database — who bought what, how often, how much they spend',
        'End-of-day reports, weekly trends, monthly revenue — all automatic',
        'Multiple payment methods — cash, card, Apple Pay, split payments',
        'Discount and coupon management per product or category',
        'Low-stock alerts so you reorder before you run out',
      ]} />

      <H2 id="real-cost-comparison">The Real Cost of Each</H2>
      <P>The upfront cost of a cash register is lower. The long-term cost is often much higher — in time spent doing things manually, mistakes that go unnoticed, and information you simply never have.</P>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Cost factor</th>
              <th className="text-left px-4 py-3 font-semibold">Cash register</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">POS system</th>
            </tr>
          </thead>
          <tbody>
            {[
              { f: 'Hardware',           cr: 'AED 200–800 (buy once)',     pos: 'Tablet you may already own' },
              { f: 'Software',           cr: 'None',                        pos: 'AED 45–99/month (ExiusCart)' },
              { f: 'Daily stock count',  cr: 'Manual — 30–60 min/day',     pos: 'Automatic — 0 min' },
              { f: 'End-of-day reports', cr: 'Manual calculation',          pos: 'Instant, automatic' },
              { f: 'VAT invoicing',      cr: 'Not compliant',               pos: 'FTA-compliant, automatic' },
              { f: 'Theft detection',    cr: 'None',                        pos: 'Per-staff transaction log' },
              { f: 'Inventory alerts',   cr: 'None — you find out when empty', pos: 'Alert before you run out' },
              { f: 'Sales history',      cr: 'Paper receipts in a drawer',  pos: 'Searchable, exportable, forever' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.f}</td>
                <td className="px-4 py-3 text-gray-500 border-b border-gray-100">{row.cr}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.pos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PullQuote>"A cash register tells you the total. A POS tells you the story."</PullQuote>

      <H2 id="uae-vat-compliance">VAT Compliance — This Is Where It Gets Serious</H2>
      <P>Since January 2018, VAT-registered businesses in the UAE must issue FTA-compliant tax invoices. Not just any receipt — a tax invoice with specific required fields. A standard cash register receipt doesn't meet these requirements.</P>

      <div className="grid grid-cols-2 gap-4 my-8">
        <StatBox stat="AED 2,500" label="Penalty per non-compliant invoice" sub="FTA enforcement" />
        <StatBox stat="5 years" label="Records must be kept" sub="FTA can audit any period" />
      </div>

      <P>If your annual turnover exceeds AED 375,000, you're required to be VAT-registered. At that point, issuing receipts from a cash register is not just inconvenient — it's a compliance risk.</P>

      <Callout type="info">
        A cloud POS like ExiusCart generates FTA-compliant tax invoices automatically on every transaction. Your TRN, sequential invoice number, itemised VAT, and business details are all included without you doing anything.
      </Callout>

      <H2 id="when-register-is-enough">When a Cash Register Is Still Fine</H2>
      <P>Not every business needs a POS. A cash register is genuinely sufficient if:</P>

      <UL items={[
        'Your annual turnover is below AED 375,000 and you have no plans to grow past it',
        'You sell a very small number of products (under 10) with stable pricing',
        'You have one member of staff — yourself — and no theft risk',
        'You have no need for customer records or marketing',
        'You do zero online selling and never plan to',
      ]} />

      <P>If all five of those are true, a cash register will serve you fine. But if even one of them isn't — particularly the VAT threshold — it's worth making the switch now rather than when you're already overwhelmed.</P>

      <H2 id="when-you-need-pos">When You Genuinely Need a POS</H2>
      <P>There are specific moments when a cash register stops being adequate. Most shop owners can pinpoint exactly when it happened:</P>

      <H3>You hired your first staff member</H3>
      <P>The moment someone else is handling cash, you need transaction-level accountability. A POS logs every sale to a staff account. A cash register doesn't know who rang it up.</P>

      <H3>You crossed AED 375,000 in annual revenue</H3>
      <P>Now you're VAT-registered. Now every receipt needs to be a proper tax invoice. A cash register physically cannot produce one.</P>

      <H3>You opened an online store alongside the physical one</H3>
      <P>Selling in-store and online with separate inventory systems is a stock management nightmare. A POS that connects to your online channel keeps inventory in sync automatically.</P>

      <H3>You stopped knowing what was actually selling</H3>
      <P>If your product decisions are based on gut feeling because you have no data, a POS pays for itself on the first buying decision it informs.</P>

      <H2 id="what-to-look-for">What to Look for in a UAE POS System</H2>
      <P>Not all POS systems are built for UAE businesses. Before choosing one, check these specifically:</P>

      <UL items={[
        'UAE VAT support — FTA-compliant invoices with TRN, 5% VAT calculation, sequential numbering',
        'Arabic receipt option — required for some B2B customers and government entities',
        'AED as primary currency — obvious, but some international POS systems default to USD',
        'Cloud-based — so your data is accessible from anywhere and backed up automatically',
        'Works on tablet or existing hardware — no expensive proprietary terminal required',
        'Inventory management built in — not a separate add-on with extra fees',
        'Staff accounts with role-based access — manager, cashier, warehouse',
        'Offline mode — UAE internet is reliable but a POS that stops working in an outage is a problem',
      ]} />

      <H2 id="exiuscart-pos">ExiusCart POS — Built for UAE Shops</H2>
      <P>ExiusCart includes a full POS as part of every plan — not a separate product, not an add-on. It runs in any browser on any device. Tablet, laptop, or desktop.</P>
      <P>Every sale generates an FTA-compliant VAT invoice automatically. Inventory updates in real time. Staff log in to their own accounts. End-of-day reports are instant. And because it's the same platform handling your online orders, TheDersi sync, invoicing, HR, and reports — everything is connected in one place.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="AED 45" label="Starter plan" sub="$12 USD · per month" />
        <StatBox stat="14 days" label="Free trial" sub="All features unlocked" />
        <StatBox stat="0" label="Hardware cost" sub="Works on any device" />
      </div>

      <Callout type="tip">
        Start the free trial and run your POS on a tablet for 14 days. Compare what you know about your business at the end of that trial versus what you knew when you were using a cash register. The difference is usually the end of the conversation.
      </Callout>

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Try the ExiusCart POS free for 14 days</p>
        <p className="text-gray-400 text-sm mb-6">Works on any tablet or laptop. VAT invoicing, inventory, staff accounts — all included.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function ScaleMultipleBranches() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        The first branch was chaos at first — then it worked. Revenue is solid. Customers are loyal. Someone suggests a second location and the idea sounds straightforward. It isn't. Every problem you had at branch one comes back, doubled, and you're trying to manage it from somewhere else.
      </p>

      <P>Expanding to multiple locations is one of the most exciting things a UAE business can do. It's also where a lot of businesses quietly start to unravel — not because of the location itself, but because the systems that worked for one shop simply don't scale to two.</P>
      <P>This guide covers what actually changes when you open a second branch, the specific operational problems to plan for, and how to set up your management systems before things get messy.</P>

      <H2 id="what-actually-changes">What Actually Changes at Branch Two</H2>
      <P>One branch is personal. You're there. You see what's selling, you know the staff, you notice when something goes wrong. Everything that needs managing is in front of you.</P>
      <P>Two branches means you're splitting your time. You're not there for half the day at each location — you're somewhere else entirely while the other branch runs without you. That changes everything about how you need to manage the business.</P>

      <UL items={[
        'You can no longer see stock levels — you have to be told, or pull a report',
        'Staff performance is invisible unless you have transaction-level data',
        'Revenue from two locations gets confused unless it is tracked separately',
        'Customers who visit both branches expect a consistent experience',
        'Supplier orders get complicated when two locations have different stock needs',
        'End-of-day reconciliation takes twice as long if done manually',
      ]} />

      <Callout type="info">
        The businesses that scale successfully to three, four, five branches didn't get better at managing complexity — they got systems that removed it. The ones that struggled tried to manage two branches the same way they managed one.
      </Callout>

      <H2 id="inventory-challenge">The Inventory Challenge Across Locations</H2>
      <P>Inventory is the first thing that breaks when you expand. At one branch, you eyeball the shelf. At two branches, one of them is always running low on something you don't know about until a customer can't find it.</P>
      <P>The typical workaround — a shared spreadsheet that both managers update — lasts about two weeks before someone forgets to update it after a busy Saturday.</P>
      <P>What you actually need is a system where every sale at every branch decrements the stock count for that location automatically. When branch two sells the last unit of a product, you find out immediately — not when a customer asks for it and the shelf is empty.</P>

      <H3>Transfers between branches</H3>
      <P>One branch runs out of a product that the other has in excess. In a well-run multi-branch business, stock transfers happen regularly. You need to record these properly — otherwise your inventory counts drift and you lose visibility into what you actually have across the business.</P>

      <Callout type="example">
        <strong>A real scenario:</strong> Your Dubai branch has 40 units of a product. Your Abu Dhabi branch has 2. Instead of placing a new supplier order, you transfer 15 units from Dubai. Without a system tracking this, Dubai thinks it has 40, Abu Dhabi thinks it has 2, and neither number is accurate.
      </Callout>

      <H2 id="staff-across-locations">Managing Staff Across Locations</H2>
      <P>At one branch, you know your team. You see who's working hard and who's spending too much time on their phone. At two branches, you're relying entirely on reports and your branch managers.</P>
      <P>This is where staff account management matters. Each employee should log in to your POS system with their own credentials. Every transaction is recorded against their account. End of day, you can see exactly what each staff member sold, how many transactions they processed, and whether the cash drawer matches.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="Branch" label="Level reporting" sub="See each location separately" />
        <StatBox stat="Staff" label="Level tracking" sub="Per-employee transaction logs" />
        <StatBox stat="One" label="Dashboard" sub="All branches in one view" />
      </div>

      <H3>Role-based access</H3>
      <P>Not everyone needs to see everything. A cashier at branch two doesn't need to see the payroll or the performance of branch one. A branch manager needs their location's reports but not the ability to change product prices. A proper multi-branch system lets you set exactly what each role can see and do.</P>

      <H2 id="reporting-across-branches">Seeing the Full Financial Picture</H2>
      <P>At one branch, revenue is a single number. At two branches, you need three numbers: branch one revenue, branch two revenue, and total business revenue. Plus the same breakdown for every metric that matters — costs, profit margins, best-selling products, slow movers.</P>
      <P>Without the right system, you end up with two sets of spreadsheets that you try to combine at the end of the month. It takes hours and the numbers are never quite right because someone updated their spreadsheet on Monday and it was already stale by Wednesday.</P>

      <UL items={[
        'Total revenue across all branches — consolidated automatically',
        'Per-branch revenue breakdown — so you know which location is performing',
        'Best-selling products per branch — different areas often have different customer preferences',
        'Staff performance per branch — who is your top seller at each location',
        'Inventory value per branch — how much stock you are holding and where',
        'Comparative reporting — how is branch two trending versus branch one at the same stage',
      ]} />

      <PullQuote>"You cannot manage what you cannot see. Multi-branch management is fundamentally a visibility problem."</PullQuote>

      <H2 id="common-mistakes">Common Mistakes UAE Businesses Make When Expanding</H2>
      <P>The same mistakes appear in almost every multi-branch expansion. Knowing them in advance is the only way to avoid them.</P>

      <NumberedList items={[
        {
          title: 'Opening branch two before branch one systems are solid',
          desc: 'If you are still managing branch one with spreadsheets and WhatsApp, adding a second location will multiply the chaos. Get your systems right before you expand, not after.',
        },
        {
          title: 'Using different POS or inventory software at each branch',
          desc: 'One branch on Excel, one on a separate POS app, reconciled manually at month end. This is the fastest route to losing track of your business completely.',
        },
        {
          title: 'Giving branch managers too much financial access',
          desc: 'Branch managers should see their branch performance. They should not have access to the full payroll, supplier pricing, or profit margins of the whole business unless you deliberately choose to share it.',
        },
        {
          title: 'Not planning for stock transfers before they happen',
          desc: 'The first time you need to move stock between branches, you need a process already in place. Improvising it under pressure leads to inventory errors that compound over months.',
        },
        {
          title: 'Assuming what worked at branch one will work at branch two',
          desc: 'A product that sells well in one location often performs differently in another area. Your best sellers, peak hours, and customer demographics may be completely different across branches.',
        },
      ]} />

      <H2 id="setting-up-exiuscart">How ExiusCart Handles Multiple Branches</H2>
      <P>ExiusCart Premium includes multi-branch management built in — not as an add-on, not an enterprise upsell. Every branch gets its own inventory, staff accounts, and POS. You see each branch separately and the whole business consolidated, from one dashboard.</P>

      <UL items={[
        'Add each branch as a separate location in your ExiusCart account',
        'Staff are assigned to specific branches — they can only see and access their location',
        'Inventory is tracked per branch — stock levels, low-stock alerts, and restock all per location',
        'Sales reports show per-branch and consolidated views — switch between them instantly',
        'Stock transfers between branches are recorded and both inventory counts update',
        'Branch managers get their own login with access scoped to their location only',
        'One subscription covers all branches — not a per-branch fee',
      ]} />

      <Callout type="tip">
        Start with ExiusCart on your first branch before you open the second. By the time branch two is ready, you will already know the system, your staff will be trained, and adding a new location takes minutes rather than weeks of setup.
      </Callout>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Feature</th>
              <th className="text-left px-4 py-3 font-semibold">Starter · AED 45/$12</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Premium · AED 99/$29</th>
            </tr>
          </thead>
          <tbody>
            {[
              { f: 'Branches / locations', s: '1',           p: 'Unlimited' },
              { f: 'Staff accounts',       s: 'Up to 3',     p: 'Unlimited' },
              { f: 'Inventory per branch', s: 'Single store', p: 'Per-branch + transfers' },
              { f: 'Reporting',            s: 'Store-level',  p: 'Per-branch + consolidated' },
              { f: 'Branch manager roles', s: '—',           p: 'Included' },
              { f: 'Support',              s: 'Priority email', p: '24/7 + account manager' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.f}</td>
                <td className="px-4 py-3 text-gray-600 border-b border-gray-100">{row.s}</td>
                <td className="px-4 py-3 text-[#6B3FD9] font-semibold border-b border-gray-100">{row.p}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="when-youre-ready">Signs You Are Ready for Branch Two</H2>
      <P>Expanding too early is as dangerous as waiting too long. Before signing a second lease, check these honestly:</P>

      <UL items={[
        'Branch one runs profitably without you being there every day',
        'You have a branch manager you trust to make operational decisions',
        'Your inventory and reporting systems are already digital and accurate',
        'You have cash reserves to cover the build-out and 3 months of operating costs at the new location',
        'Demand is genuinely there — customers from another area are already asking or travelling to your existing branch',
        'Your supplier relationships can handle increased volume across two locations',
      ]} />

      <P>If most of these are true, the second location is a growth move. If several are not, the priority is getting branch one to that level first — then expanding from a position of strength.</P>

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Ready to manage multiple branches?</p>
        <p className="text-gray-400 text-sm mb-6">ExiusCart Premium includes unlimited branches, staff, and consolidated reporting from one dashboard.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function StopSpreadsheets() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        Somewhere on your laptop there is a spreadsheet with 12 tabs. One for orders. One for inventory. One for staff hours. A separate one for invoices that someone started and never finished. You open it every morning and spend 45 minutes updating numbers that were already out of date by the time you typed them.
      </p>

      <P>Spreadsheets are not the problem. They are genuinely useful tools — for analysis, for planning, for one-off calculations. The problem is using them to run a live business. The moment your business has more than a few moving parts, a spreadsheet stops being a tool and becomes a second job.</P>
      <P>This is the point where growing shops make the switch. Not because spreadsheets stopped working overnight, but because the cost of maintaining them finally outweighed the cost of replacing them.</P>

      <H2 id="why-spreadsheets-feel-safe">Why Spreadsheets Feel Safe</H2>
      <P>Every business owner who runs on spreadsheets knows exactly why. They are free. They are flexible. You built them yourself so you understand every column. No one can change them without your permission. And there is no monthly fee, no contract, no salesperson calling you.</P>
      <P>These are real advantages — and they explain why spreadsheets survive long after they should have been replaced. The pain of switching feels bigger than the pain of continuing. Until it suddenly doesn't.</P>

      <Callout type="info">
        The businesses that switch earliest are usually the ones that got a scare — a stock error that led to an oversell, a payroll mistake, a customer complaint about a wrong invoice. The switch happens before the disaster, or just after it.
      </Callout>

      <H2 id="what-they-cost-you">What Spreadsheets Actually Cost You</H2>
      <P>The monthly fee for a spreadsheet is zero. The weekly cost in hours is not.</P>
      <P>Think through a typical week. Updating stock counts after sales — 20 minutes daily. Reconciling the order list against what was dispatched — 30 minutes. Chasing staff for their hours to calculate payroll — 45 minutes. Creating invoices manually — 10 minutes per invoice, multiplied by however many you send. Pulling together a revenue summary at the end of the month — 2 hours if everything lines up, longer if it doesn't.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="8–12hrs" label="Lost per week" sub="Typical spreadsheet overhead" />
        <StatBox stat="AED 45" label="ExiusCart Starter" sub="$12 USD · per month" />
        <StatBox stat="0 hrs" label="Manual data entry" sub="Everything updates automatically" />
      </div>

      <P>At eight hours a week, that is over 400 hours a year. If your time is worth AED 50 an hour — a conservative estimate for a business owner — that is AED 20,000 a year in time spent maintaining a system that could be replaced for AED 45 a month.</P>
      <P>And that calculation does not include the cost of mistakes.</P>

      <H2 id="what-breaks-first">What Breaks First</H2>
      <P>Spreadsheets do not fail all at once. They fail one column at a time, usually in the order things get busiest.</P>

      <H3>Inventory</H3>
      <P>The stock spreadsheet is the first to go wrong. Someone makes a sale and forgets to update it. A return comes in and no one adds the units back. You order more of something because the sheet says you are low, but the actual shelf has plenty — because the last three returns were never entered. You discover this when the supplier delivers and you have nowhere to put it.</P>

      <H3>Orders</H3>
      <P>Two people update the order list at the same time and one overwrites the other. An order gets marked dispatched in the spreadsheet but the physical product is still sitting in the stockroom. A customer calls to chase their order and you spend 10 minutes cross-referencing three tabs to work out what happened.</P>

      <H3>Invoicing</H3>
      <P>The invoice spreadsheet has sequential numbering — until someone duplicates a row and breaks the sequence. You send the wrong total to a client because the formula referenced an old version of the price. The FTA asks for your invoice records and you realise half of them were never saved properly.</P>

      <H3>Payroll</H3>
      <P>Staff hours are submitted on WhatsApp or paper. Someone types them into the spreadsheet wrong. You pay the wrong amount and spend two weeks sorting it out. One staff member disputes their hours and you have no log to reference.</P>

      <PullQuote>"Spreadsheets show you what the business looked like when you last updated them. A proper system shows you what it looks like right now."</PullQuote>

      <H2 id="five-signs">5 Signs You Have Outgrown Your Spreadsheets</H2>
      <P>The moment is different for every business. But the signals are almost always the same:</P>

      <NumberedList items={[
        {
          title: 'You have more than one person updating the same file',
          desc: 'The moment a spreadsheet becomes collaborative, version conflicts become inevitable. Who saved last? Whose numbers are current? This question gets asked multiple times a week.',
        },
        {
          title: 'You have made a stock error that cost you a sale',
          desc: 'You sold something that wasn\'t actually in stock because the spreadsheet said it was. Or you ran out of something popular because the reorder trigger was never set. Either way, a customer was disappointed.',
        },
        {
          title: 'End-of-month reporting takes more than 2 hours',
          desc: 'If pulling together your monthly numbers requires consolidating multiple files, fixing formula errors, and manually checking totals — that process should be automatic, not a project.',
        },
        {
          title: 'You cannot answer basic questions about your business on the spot',
          desc: '"What is our best-selling product this month?" should take five seconds to answer. If it requires opening a spreadsheet, filtering columns, and calculating a sum, that is too slow for a growing business.',
        },
        {
          title: 'You are afraid to take a day off',
          desc: 'If the spreadsheets fall behind every time you are not there to maintain them, the business does not actually run without you. That is not a sustainable position.',
        },
      ]} />

      <H2 id="what-the-switch-looks-like">What Switching Actually Looks Like</H2>
      <P>The fear of switching is usually bigger than the switch itself. Most business owners imagine a painful migration, weeks of retraining staff, and a period where nothing works properly. In practice, it is much simpler than that.</P>
      <P>With ExiusCart, you import your product list from a CSV file — the same format your spreadsheet exports. That takes about 10 minutes for most catalogs. You add your staff as users, set their roles, and they can start using the POS the same day. The learning curve is shorter than you expect because the system is designed for people who are not particularly technical.</P>

      <UL items={[
        'Import products via CSV — your existing spreadsheet exports directly',
        'Staff accounts set up in minutes — role and branch access configured per person',
        'VAT invoicing starts working immediately — no template to build',
        'Inventory starts tracking from the first sale — no manual count entry required',
        'Reports appear automatically — no formulas to build or maintain',
      ]} />

      <Callout type="tip">
        Start the 14-day trial while your spreadsheets are still running. Enter your data into ExiusCart in parallel for the first week. By day seven, you will know whether you want to make the switch permanent — and your team will already know how to use it.
      </Callout>

      <H2 id="after-the-switch">What Changes in the First Month</H2>
      <P>The first change most business owners notice is time. The hour and a half they used to spend on morning admin is gone. Stock levels are current without anyone updating them. The end-of-week summary takes 30 seconds to pull up, not 90 minutes to calculate.</P>
      <P>The second change is confidence. Questions about the business get real answers instead of best guesses based on data that was last updated on Tuesday. You can tell a supplier exactly how much of a product you moved last month. You can spot a slow-selling product before you reorder it.</P>
      <P>The spreadsheets do not disappear entirely — most business owners keep one for planning and forecasting, which is exactly what spreadsheets are good at. But the live operational data moves into a system that actually keeps up with the business.</P>

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Replace your spreadsheets in one afternoon</p>
        <p className="text-gray-400 text-sm mb-6">Import your products, add your staff, and start your free 14-day trial — no credit card needed.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function HRPayrollPost() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        End of the month. You message your four staff on WhatsApp asking for their hours. Two reply immediately, one sends a voice note, one goes quiet until Thursday. You add it all up on your phone calculator, cross-reference against your mental memory of who was off sick, and transfer the salaries. Two days later someone says the amount was wrong.
      </p>

      <P>This is how most small businesses handle payroll. Not because the owner is disorganised — but because no one told them there was a better way that didn't require hiring an HR manager.</P>
      <P>HR for a small business is not complicated. Attendance, leave, payroll, records. Four things. This guide covers each one, including the UAE-specific rules that catch small business owners off guard, and how to handle all of it in about 15 minutes a month.</P>

      <H2 id="what-hr-means-for-small-business">What HR Actually Means for a Small Business</H2>
      <P>When people hear "HR," they picture a department with a dedicated manager, policies binders, and a complex HR information system. That is enterprise HR. For a business with 2 to 20 employees, HR is much simpler — but it still needs to be done properly.</P>
      <P>The core of small business HR is four things:</P>

      <UL items={[
        'Knowing when each employee worked — accurate attendance records',
        'Managing time off — annual leave, sick leave, public holidays',
        'Calculating pay correctly — base salary, overtime, deductions, allowances',
        'Keeping records — employment contracts, payslips, leave history',
      ]} />

      <P>None of these require a dedicated HR person. They do require a system — even a simple one — so that the information is accurate and you are not relying on memory and WhatsApp messages.</P>

      <H2 id="attendance-tracking">Tracking Attendance Without the Drama</H2>
      <P>The attendance problem has two parts: recording when staff arrive and leave, and knowing what to do with that information at the end of the month.</P>
      <P>For very small teams, a simple clock-in system is enough. Staff log in when they start and log out when they finish. The system records the timestamps. At the end of the month, you have exact hours — no chasing, no estimating, no disputes.</P>

      <Callout type="info">
        Manual time sheets — paper or WhatsApp — create two problems. First, they are easy to falsify or simply misremember. Second, they require someone to manually total and verify the hours, which takes time you do not have at month end.
      </Callout>

      <P>ExiusCart lets staff clock in from their staff account. Every login is timestamped. You see a complete attendance log per employee without asking anyone for anything.</P>

      <H2 id="leave-management">Managing Leave Requests Properly</H2>
      <P>Leave management sounds formal but it comes down to two things: knowing who is off and when, and making sure people take what they are legally entitled to.</P>
      <P>The second part matters more than most small business owners realise. Under UAE labour law, annual leave is not optional — it is a legal entitlement. If an employee leaves without having taken their leave, you owe them a payment for the unused days. If you have no records, you cannot dispute their claim about how many days they took.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="30 days" label="Annual leave entitlement" sub="After 1 year of service (UAE)" />
        <StatBox stat="90 days" label="Sick leave per year" sub="Paid/unpaid under UAE law" />
        <StatBox stat="6 months" label="Max probation period" sub="UAE Labour Law" />
      </div>

      <H3>Annual leave under UAE Labour Law</H3>
      <P>Employees who have worked for less than one year are entitled to 2 days of leave per month. After one year, entitlement rises to 30 days per year. Public holidays are in addition to annual leave — not counted against it.</P>
      <P>If you approve leave verbally and keep no records, you have no way to track what has been taken. An employee who claims they have 15 days of untaken leave when you believe it is 5 is a dispute you cannot resolve without records.</P>

      <Callout type="warning">
        End of service gratuity is calculated on the employee's last basic salary multiplied by years of service. The calculation is set by UAE Labour Law — it is not optional and not negotiable. Getting this wrong when an employee leaves creates a legal liability.
      </Callout>

      <H2 id="payroll-calculation">Calculating Payroll Correctly</H2>
      <P>The basic payroll calculation is simple: base salary plus allowances, minus any agreed deductions. But there are variables that trip up most small business owners.</P>

      <H3>Overtime</H3>
      <P>UAE Labour Law requires overtime to be paid at 125% of the normal hourly rate for regular overtime, and 150% for overtime on rest days or public holidays. If you have hourly or part-time staff, this matters. If you have salaried staff who sometimes work extra hours, you need a clear policy on how this is handled — and records to support it.</P>

      <H3>Deductions</H3>
      <P>Legal deductions include absent days and agreed salary advances. Deducting for breakages, customer complaints, or other penalties requires the employee's written consent and is subject to limits under UAE law. Illegal deductions — even small ones — can become claims at the Ministry of Human Resources.</P>

      <H3>WPS — Wage Protection System</H3>
      <P>Most UAE employers are required to pay salaries through the WPS — a government system that records every salary payment made. Failure to pay on time through WPS triggers fines starting at AED 1,000 per employee per month and can result in your company being blocked from renewing trade licences.</P>

      <Callout type="example">
        <strong>WPS timeline:</strong> Salaries must be paid within 10 days of the agreed payment date. If you pay on the 1st of each month, the WPS record must show payment by the 11th at the latest. Most businesses set a standing transfer to ensure this never slips.
      </Callout>

      <H2 id="common-mistakes">Common Payroll Mistakes Small Businesses Make</H2>

      <NumberedList items={[
        {
          title: 'Paying informally with no payslips',
          desc: 'Every employee is entitled to a payslip showing their gross pay, deductions, and net pay. No payslip means no paper trail — and no defence if an employee claims they were underpaid.',
        },
        {
          title: 'Missing the WPS deadline',
          desc: 'A single late WPS payment triggers a fine. Multiple late payments can result in your company being flagged, which affects trade licence renewals and visa processing.',
        },
        {
          title: 'Not tracking leave taken',
          desc: 'Without records, you cannot calculate unused leave on exit. That leaves you exposed to claims from departing employees for leave they may or may not have taken.',
        },
        {
          title: 'Calculating gratuity incorrectly',
          desc: 'End of service gratuity is based on the last basic salary — not total package including allowances. Using the wrong base figure means you either overpay or face a claim for underpayment.',
        },
        {
          title: 'No employment contracts',
          desc: 'Verbal employment agreements are unenforceable. Every employee needs a signed contract specifying salary, role, start date, probation period, and leave entitlement. Without one, any dispute defaults to UAE Labour Law minimums — which may not match what you agreed.',
        },
      ]} />

      <PullQuote>"HR problems do not announce themselves early. They arrive at resignation, and they come with paperwork."</PullQuote>

      <H2 id="exiuscart-hr">How ExiusCart Handles HR for Small Teams</H2>
      <P>ExiusCart includes HR and payroll tools built into every plan — attendance tracking, leave management, payroll calculation, and payslip generation. No separate HR software, no extra subscription, no consultant needed.</P>

      <UL items={[
        'Staff clock in and out via their ExiusCart account — attendance logged automatically',
        'Leave requests submitted and approved through the system — running balance tracked per employee',
        'Payroll calculated at month end based on attendance records — deductions and allowances configured once',
        'Payslips generated automatically — downloadable PDF for each employee',
        'Employee records stored securely — contracts, leave history, salary history in one place',
        'Gratuity calculator built in — computes correct end of service amount when an employee leaves',
      ]} />

      <Callout type="tip">
        Set up employee profiles before the month starts — salary, allowances, leave entitlement. Once configured, month-end payroll takes about 10 minutes: review the attendance log, approve or adjust anything unusual, generate payslips. That is it.
      </Callout>

      <H2 id="getting-started">Getting Your HR in Order This Week</H2>
      <P>If your current system is WhatsApp messages and a mental tally, this week is a good time to change that — before someone leaves and asks questions you cannot answer with records.</P>

      <NumberedList items={[
        {
          title: 'Add each employee to ExiusCart with their salary and start date',
          desc: 'This creates their record and starts tracking leave entitlement from their start date.',
        },
        {
          title: 'Configure leave entitlements per employee',
          desc: 'Annual leave days, sick leave, any additional entitlements you have agreed.',
        },
        {
          title: 'Set up clock-in for staff accounts',
          desc: 'Staff log in at the start of their shift. Attendance records from this point forward are automatic.',
        },
        {
          title: 'Run your first payroll at month end',
          desc: 'Review the attendance log, approve payroll, download payslips. The system calculates everything — you just verify and approve.',
        },
      ]} />

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Sort your HR in one afternoon</p>
        <p className="text-gray-400 text-sm mb-6">Attendance, leave, payroll, and payslips — all included in ExiusCart. Free for 14 days.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function ShopifySyncPost() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        Monday morning. Shopify tab — 8 new orders. WooCommerce tab — 4 more. TheDersi tab — 11. Your own website — 3. That is 26 orders across four places, each with their own interface, their own fulfilment status, their own inventory. You have not even had coffee yet.
      </p>

      <P>Multi-channel selling is one of the best things you can do for revenue. Every additional platform you sell on is another audience you would not otherwise reach. The problem is the operations side — managing four separate dashboards, reconciling four inventory counts, and trying to build a complete picture of your business from four sets of data.</P>
      <P>ExiusCart pulls all of it into one place. This guide covers how each integration works, what happens to inventory across channels, and how to get everything connected.</P>

      <H2 id="the-multi-platform-problem">The Multi-Platform Problem</H2>
      <P>Selling on multiple platforms creates a specific type of operational chaos that gets worse as volume grows. It is not that any single platform is hard to manage — it is the combination.</P>

      <UL items={[
        'Orders arrive across different systems at different times — you have to check all of them to know what needs to go out today',
        'Inventory lives in separate places — overselling on one platform because another channel already sold the last unit',
        'Revenue figures are split across platforms — you need to add them up manually to know your actual numbers',
        'Customer records are fragmented — a buyer who shops on your website and on TheDersi appears as two separate people',
        'Fulfilment gets complicated — is this order from Shopify or WooCommerce? Did I already mark it as dispatched?',
        'Reporting is impossible — you cannot see your best-selling products across all channels without a spreadsheet',
      ]} />

      <Callout type="info">
        The inventory problem is the most dangerous. If you sell 10 units of something across four channels and each channel thinks you have 10 in stock, you can technically oversell 30 units you do not have. Every oversell is a cancellation, a refund, and a disappointed customer.
      </Callout>

      <H2 id="how-shopify-sync-works">How Shopify Sync Works</H2>
      <P>Connecting your Shopify store to ExiusCart takes a few minutes. You install the ExiusCart app from the Shopify app store, authorise the connection, and map your Shopify products to your ExiusCart catalog.</P>
      <P>From that point, every Shopify order appears in your ExiusCart dashboard automatically — alongside orders from every other channel. You see the source clearly (tagged as Shopify), the customer details, the products ordered, and the payment status.</P>

      <H3>What syncs from Shopify</H3>
      <UL items={[
        'All new orders — appearing in ExiusCart within seconds of placement',
        'Customer name, email, phone, and shipping address',
        'Product name, SKU, quantity, variant (size, colour, etc.)',
        'Order value, discounts applied, and payment status',
        'Fulfilment status — mark an order fulfilled in ExiusCart and it updates in Shopify',
        'Inventory — every Shopify sale decrements your ExiusCart stock count',
      ]} />

      <Callout type="tip">
        If you already have products in Shopify, you do not need to re-enter them in ExiusCart. The product mapping process pulls your Shopify catalog and lets you link each item to its ExiusCart equivalent, or import them directly if you are starting fresh.
      </Callout>

      <H2 id="how-woocommerce-sync-works">How WooCommerce Sync Works</H2>
      <P>WooCommerce integration works the same way as Shopify — you install the ExiusCart plugin from the WordPress plugin directory, connect your store, and orders start flowing in automatically.</P>
      <P>Because WooCommerce is self-hosted, the connection is slightly different under the hood — ExiusCart uses your WooCommerce REST API credentials rather than an app store authorisation. Your developer can set this up in about 10 minutes if you are not comfortable with API keys.</P>

      <H3>What syncs from WooCommerce</H3>
      <UL items={[
        'All new orders from your WooCommerce store in real time',
        'Full customer and shipping details per order',
        'Product, SKU, quantity, and variant information',
        'Order status updates bidirectionally — ExiusCart and WooCommerce stay in sync',
        'Inventory counts update in ExiusCart with every WooCommerce sale',
      ]} />

      <Callout type="example">
        <strong>A common setup:</strong> A UAE retailer runs a WooCommerce store for their main website, has a Shopify store for international customers, lists products on TheDersi for the UAE marketplace, and sells in-store via the ExiusCart POS. All four channels feed into one ExiusCart dashboard. One inventory count. One place to fulfil orders. One set of reports.
      </Callout>

      <H2 id="thedersi-and-custom-sites">TheDersi and Custom Websites</H2>
      <P>TheDersi is natively integrated with ExiusCart — no plugin installation needed. Connect your TheDersi seller account in the ExiusCart integrations settings and orders start syncing immediately.</P>
      <P>For custom-built websites — whether coded from scratch, built on Laravel, Next.js, or any other framework — ExiusCart provides a REST API. Your developer sends order data to ExiusCart when a purchase is made on your site. The setup is a few hours of development work, not a project.</P>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Platform</th>
              <th className="text-left px-4 py-3 font-semibold">How to connect</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Setup time</th>
            </tr>
          </thead>
          <tbody>
            {[
              { p: 'Shopify',          h: 'Install ExiusCart app from Shopify App Store',           t: '5 minutes' },
              { p: 'WooCommerce',      h: 'Install WordPress plugin + add API credentials',         t: '10–15 minutes' },
              { p: 'TheDersi',         h: 'Connect seller account in ExiusCart Integrations',        t: '2 minutes' },
              { p: 'Custom website',   h: 'Developer integrates via ExiusCart REST API',            t: 'Half a day (developer)' },
              { p: 'Physical store',   h: 'Use ExiusCart POS — already built in',                   t: 'Immediate' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.p}</td>
                <td className="px-4 py-3 text-gray-600 border-b border-gray-100">{row.h}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="unified-inventory">One Inventory Count for All Channels</H2>
      <P>This is the feature that changes everything for multi-channel sellers. Instead of separate stock counts on Shopify, WooCommerce, and TheDersi — all drifting apart as sales happen — ExiusCart maintains one master inventory count. Every sale on any channel decrements the same number.</P>
      <P>Sell a product on Shopify: ExiusCart updates. Sell the same product via the POS in your physical store: ExiusCart updates. Sell the last unit on TheDersi: ExiusCart updates all connected channels to show zero stock, preventing anyone from ordering something you cannot fulfil.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="1" label="Inventory count" sub="Shared across all channels" />
        <StatBox stat="Real-time" label="Stock updates" sub="Every sale, every channel" />
        <StatBox stat="0" label="Oversells" sub="When channels share one count" />
      </div>

      <PullQuote>"Every channel you add without centralising inventory is another way to accidentally sell something you do not have."</PullQuote>

      <H2 id="single-reporting">One Set of Numbers for Your Whole Business</H2>
      <P>When orders come from four platforms, the question "how did we do this month?" requires opening four dashboards, pulling four sets of numbers, and adding them up. ExiusCart answers it in one click.</P>
      <P>Your ExiusCart reports show total revenue across all channels — with the ability to filter by source so you can see which platform is performing. You see your best-selling products ranked across every channel combined, not per-platform. You see which customers are buying repeatedly, regardless of which platform they use each time.</P>

      <UL items={[
        'Total orders today, this week, this month — across every connected channel',
        'Revenue by channel — compare Shopify vs WooCommerce vs TheDersi vs in-store',
        'Best-selling products ranked across all channels combined',
        'Customer purchase history regardless of which platform they ordered from',
        'Inventory value report — what you are holding and what it is worth',
        'Fulfilment time report — from order placed to order dispatched',
      ]} />

      <H2 id="getting-connected">Getting Everything Connected</H2>
      <P>The most common question is: where do I start? The answer is always the highest-volume channel first. Connect the platform that sends you the most orders, verify that everything is syncing correctly, then add the next channel.</P>
      <P>Do not try to connect everything on day one. Add channels one at a time over the first week, testing each connection with a few orders before moving on. By the end of the week you will have full visibility across your entire business — and the Monday morning tab-switching will be a thing of the past.</P>

      <NumberedList items={[
        {
          title: 'Start your ExiusCart free trial',
          desc: 'All integrations are available during the 14-day trial — no credit card needed.',
        },
        {
          title: 'Set up your product catalog',
          desc: 'Import products from your primary channel or add them manually. This is the master catalog all channels map to.',
        },
        {
          title: 'Connect your highest-volume channel first',
          desc: 'Shopify, WooCommerce, or TheDersi — whichever sends you the most orders. Verify the sync with a few test orders.',
        },
        {
          title: 'Add remaining channels one at a time',
          desc: 'Each integration takes minutes. Test after each one before adding the next.',
        },
        {
          title: 'Set low-stock thresholds',
          desc: 'Configure alerts per product so ExiusCart notifies you before any channel runs out — before an oversell happens, not after.',
        },
      ]} />

      <Callout type="tip">
        On your first full week with all channels connected, check the inventory report at the end of each day. After 5 days you will have a clear picture of how stock moves across your channels — which platforms sell fastest, what your reorder rhythm should be, and where your bestsellers actually live.
      </Callout>

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Connect all your channels in one afternoon</p>
        <p className="text-gray-400 text-sm mb-6">Shopify, WooCommerce, TheDersi, custom website, and in-store — one dashboard, one inventory, one set of reports.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function BestPOSUAE() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        You search &quot;best POS UAE&quot; and find articles recommending Square, Lightspeed, or Clover — platforms built for the US and UK market, priced in dollars, with no UAE VAT support and no Arabic receipt option. There is a better list to follow.
      </p>

      <P>The UAE business environment has specific requirements that most international POS platforms do not handle: 5% VAT invoicing with FTA compliance, AED as the primary currency, and pricing that makes sense for small businesses. This guide covers what to look for and which systems actually work in a UAE context.</P>

      <H2 id="what-uae-pos-needs">What a UAE POS System Must Have</H2>
      <P>Before looking at specific products, here are the non-negotiable requirements for any POS operating in the UAE:</P>

      <UL items={[
        'UAE VAT (5%) — FTA-compliant tax invoices with your TRN, automatic VAT calculation, sequential invoice numbers',
        'AED as default currency — not a conversion, not an add-on, AED as the primary currency throughout',
        'Cloud backup — cloud sync means you never lose data if a tablet breaks',
        'Works on tablet or laptop — avoid proprietary hardware that locks you in to one vendor',
        'Offline mode — continue selling during internet outages without losing the sale',
        'Inventory built in — not a separate subscription, stock management included',
        'Staff accounts — separate logins per team member with role-based access',
        'Multi-branch support — essential if you ever plan to open a second location',
      ]} />

      <Callout type="warning">
        Any POS that does not produce FTA-compliant tax invoices is a compliance risk if your annual turnover exceeds AED 375,000. The penalty for a non-compliant invoice is AED 2,500 per document. This rules out most cash register apps and several international POS platforms that have not built UAE-specific invoicing.
      </Callout>

      <H2 id="the-options">POS Options for UAE Small Businesses</H2>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">System</th>
              <th className="text-left px-4 py-3 font-semibold">Starting price</th>
              <th className="text-left px-4 py-3 font-semibold">UAE VAT</th>
              <th className="text-left px-4 py-3 font-semibold">Built for UAE</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Best for</th>
            </tr>
          </thead>
          <tbody>
            {[
              { s: 'ExiusCart',  p: 'AED 45/month',      vat: 'Yes — built in',    uae: 'Yes',         b: 'SMBs wanting all-in-one at low cost' },
              { s: 'Zoho Books', p: 'AED 50+/month',     vat: 'Yes',                uae: 'Partly',      b: 'Accounting-focused businesses' },
              { s: 'Square',     p: 'Free + % per sale', vat: 'Basic',              uae: 'No',          b: 'Freelancers and pop-ups' },
              { s: 'Lightspeed', p: '$89 USD/month',     vat: 'Yes (addon)',         uae: 'Partly',      b: 'Larger retail chains' },
              { s: 'Odoo',       p: 'From $7.25/user',   vat: 'Yes (configured)',   uae: 'With setup',  b: 'Businesses with in-house IT' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className={`px-4 py-3 font-medium border-b border-gray-100 ${row.s === 'ExiusCart' ? 'text-[#6B3FD9]' : 'text-gray-900'}`}>{row.s}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.p}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.vat}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.uae}</td>
                <td className="px-4 py-3 text-gray-500 border-b border-gray-100">{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="exiuscart-recommendation">Why ExiusCart Is the Best Starting Point for UAE SMBs</H2>
      <P>For a small business in the UAE that needs POS + inventory + invoicing + staff management in one affordable platform, ExiusCart is the closest thing to a purpose-built solution. It was built specifically for UAE and Middle East retail — not adapted from a US product.</P>

      <UL items={[
        'FTA-compliant VAT invoices built into every sale — no add-ons needed',
        'AED as the primary currency — automatic AED/USD handling based on customer location',
        'Runs on any tablet or laptop — no proprietary hardware to buy',
        'Inventory, staff accounts, HR, payroll, and reports all included',
        'TheDersi marketplace integration — direct connection to the UAE/Sri Lanka seller platform',
        'Starter plan at AED 45/month — less than Zoho, Lightspeed, or Cin7',
        '14-day free trial with all features unlocked — no credit card required',
      ]} />

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="AED 45" label="Starter plan" sub="$12 USD · per month" />
        <StatBox stat="AED 99" label="Premium plan" sub="$29 USD · per month" />
        <StatBox stat="14 days" label="Free trial" sub="All features included" />
      </div>

      <H2 id="zoho-comparison">ExiusCart vs Zoho — For UAE Small Businesses</H2>
      <P>Zoho is a legitimate product with strong accounting features. The trade-offs for a small UAE retailer:</P>

      <UL items={[
        'Zoho Inventory and Zoho Books are separate products — you pay for both',
        'POS requires Zoho Point of Sale on top — adding more subscriptions',
        'Setup complexity is higher — Zoho is built for flexibility, not out-of-the-box simplicity',
        'No TheDersi integration',
        'ExiusCart combines POS + inventory + invoicing + HR into one subscription at a lower price point',
      ]} />

      <Callout type="info">
        Zoho is the right choice if you need deep accounting features — multi-currency books, complex tax setups, or integration with a CA firm. For a retailer who primarily needs to sell, track stock, and issue VAT invoices, ExiusCart covers more ground for less money.
      </Callout>

      <H2 id="what-to-try-first">What to Try First</H2>
      <P>The fastest way to know if a POS is right for your business is to use it on your actual operations for a week. Start with ExiusCart — it has everything you need from day one, without configuration complexity, and the Starter plan at AED 45/month is the lowest-risk entry point in this category.</P>

      <NumberedList items={[
        { title: 'Start the ExiusCart free trial', desc: '14 days, all features, no card. Set it up the same day you read this.' },
        { title: 'Import your product catalog', desc: 'Upload a CSV of your products or add them manually. Most catalogs take under an hour.' },
        { title: 'Add staff accounts', desc: 'One account per team member. Set roles so cashiers can sell, managers can see reports.' },
        { title: 'Run your first sale through the POS', desc: 'The interface is tablet-friendly. An FTA-compliant receipt generates automatically.' },
        { title: 'Check the end-of-day report', desc: 'Revenue, units sold, best-sellers — all automatic. No spreadsheet needed.' },
      ]} />

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Try the best UAE POS free for 14 days</p>
        <p className="text-gray-400 text-sm mb-6">Built for UAE businesses. VAT-compliant invoices, AED pricing, inventory included. No credit card required.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function InventorySriLanka() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        A boutique in Colombo. A grocery in Kandy. An electronics seller on TheDersi. A clothing store shipping across Sri Lanka. Every one of them is tracking stock in a notebook or a spreadsheet — and every one of them loses sales to stock mistakes they did not see coming.
      </p>

      <P>Inventory management software for Sri Lanka retailers has a specific set of requirements: affordable pricing in USD, online marketplace integration (especially TheDersi), multi-channel support for stores that sell both physically and online, and simple enough to run without an IT team.</P>

      <H2 id="why-sri-lanka-retailers-need-software">Why Sri Lanka Retailers Need Inventory Software Now</H2>
      <P>The retail landscape in Sri Lanka is changing fast. Online sales through platforms like TheDersi have grown significantly — many shop owners now sell in-store, on WhatsApp, and through an online marketplace simultaneously. Managing stock across three channels manually is not sustainable beyond a certain volume.</P>

      <UL items={[
        'Selling the same product in-store and online without shared inventory leads to overselling — taking an order you cannot fulfil',
        'Manual stock counts take hours that could go into the business itself',
        'WhatsApp order management does not scale past about 20 orders a day',
        'Without sales data, buying decisions are based on gut feeling rather than what actually moves',
        'Marketplace platforms like TheDersi require accurate stock availability — out-of-stock listings hurt your seller rating',
      ]} />

      <Callout type="info">
        The shift from one-channel to multi-channel retail is where most Sri Lanka sellers start feeling the pain. A system that handles inventory across TheDersi, in-store, and a direct website from one place eliminates the biggest source of errors.
      </Callout>

      <H2 id="what-to-look-for">What to Look for</H2>
      <UL items={[
        'USD pricing — most international SaaS tools price in USD, which is manageable for Sri Lanka businesses',
        'TheDersi integration — direct native sync with TheDersi, not a manual export/import workaround',
        'Works on a smartphone or basic laptop — not all businesses have dedicated hardware',
        'Simple enough to learn without training — the system needs to be usable within a day',
        'Cloud-based — local server solutions are a maintenance burden for small businesses',
        'Order management included — inventory alone is not enough if you are processing online orders',
      ]} />

      <H2 id="thedersi-sellers">For TheDersi Sellers</H2>
      <P>TheDersi is the largest online marketplace in Sri Lanka for fashion, accessories, and lifestyle products. If you sell on TheDersi, your inventory management system needs to speak directly to it — not require you to manually update stock after every order.</P>
      <P>ExiusCart is the inventory management platform with native TheDersi integration. Orders placed on TheDersi sync into ExiusCart automatically — your stock count decrements, the order appears in your dashboard, and you can track fulfilment without touching the TheDersi seller portal.</P>

      <Callout type="example">
        <strong>How it works:</strong> A customer buys your dress on TheDersi. Within seconds, the order appears in ExiusCart. Stock count updates automatically. If that was the last unit, the TheDersi listing shows out of stock — no oversell. You mark the order fulfilled in ExiusCart and the status updates on TheDersi too.
      </Callout>

      <H2 id="pricing-for-sri-lanka">Pricing That Makes Sense</H2>
      <P>The international benchmark for inventory management is $12–30 USD per month for a basic plan. For a business turning over meaningful volume per month, that pays for itself quickly in time saved and errors avoided.</P>

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="Free" label="14-day trial" sub="All features included" />
        <StatBox stat="$12" label="Starter plan" sub="Per month · USD" />
        <StatBox stat="$29" label="Premium plan" sub="Per month · unlimited" />
      </div>

      <H2 id="features-for-retailers">Key Features for Sri Lanka Retailers</H2>
      <UL items={[
        'TheDersi native integration — orders sync automatically, stock updates in real time',
        'Multi-channel inventory — one stock count shared across in-store, online, and marketplace',
        'Barcode scanning — for businesses with large catalogs, barcode-based stock management speeds everything up',
        'Order management — receive, process, and fulfil orders from all channels in one dashboard',
        'Sales reports — which products move fastest, revenue by day and month',
        'Low stock alerts — get notified before you run out, not after you oversell',
        'Staff accounts — multiple logins with role-based access',
        'Customer records — purchase history, repeat buyers, contact details',
      ]} />

      <PullQuote>&quot;For a Sri Lanka retailer on TheDersi, the right inventory system connects your in-store and online operations so they work as one.&quot;</PullQuote>

      <H2 id="migrating-from-spreadsheets">Moving from Spreadsheets</H2>
      <P>Most Sri Lanka retailers start on spreadsheets and move to software when orders outpace manual management, they hire more than two staff, or they have their first significant oversell. The migration is simpler than it sounds — ExiusCart accepts a CSV import of your product catalog and most catalogs are imported in under an hour.</P>

      <NumberedList items={[
        { title: 'Export your product list as CSV', desc: 'Include name, SKU, price, and current stock quantity. That is all you need to start.' },
        { title: 'Import to ExiusCart', desc: 'Upload the CSV and map your columns. Products are imported in minutes.' },
        { title: 'Connect TheDersi', desc: 'Link your TheDersi seller account in ExiusCart Integrations. Orders start syncing immediately.' },
        { title: 'Set low-stock alerts per product', desc: 'Choose a threshold. ExiusCart notifies you when stock drops below it so you can reorder before running out.' },
        { title: 'Process your first TheDersi order in ExiusCart', desc: 'Watch the stock count drop automatically. No manual update needed.' },
      ]} />

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Try ExiusCart free — built for TheDersi sellers</p>
        <p className="text-gray-400 text-sm mb-6">Native TheDersi integration, multi-channel inventory, order management. 14-day free trial, no credit card.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function ExiusCartVsZohoPost() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        You found ExiusCart and you found Zoho. Both say they handle inventory. Both have pricing pages. Both claim to be the best option for your business. Here is an honest comparison — written by ExiusCart, so read with that context in mind, but written to actually help you decide correctly.
      </p>

      <P>If the right answer for your business is Zoho, this article will tell you that. The goal is a clear comparison across the dimensions that matter for UAE and Middle East retailers — pricing, UAE-specific features, ease of use, and what you actually get for the money.</P>

      <H2 id="quick-summary">Quick Summary</H2>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Feature</th>
              <th className="text-left px-4 py-3 font-semibold">ExiusCart</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Zoho Inventory + Books</th>
            </tr>
          </thead>
          <tbody>
            {[
              { f: 'Starting price',        e: 'AED 45/mo ($12 USD)',       z: '~AED 50+/mo per app' },
              { f: 'POS included',          e: 'Yes — built in',             z: 'Separate app (Zoho POS)' },
              { f: 'HR & Payroll',          e: 'Premium plan',               z: 'Zoho People (separate)' },
              { f: 'UAE VAT invoicing',     e: 'Built in, FTA-compliant',    z: 'Yes, with setup' },
              { f: 'TheDersi integration',  e: 'Native, built in',           z: 'Not available' },
              { f: 'Shopify sync',          e: 'Yes',                        z: 'Yes' },
              { f: 'WooCommerce sync',      e: 'Yes',                        z: 'Yes' },
              { f: 'Multi-branch',          e: 'Premium plan',               z: 'Higher plans' },
              { f: 'Free trial',            e: '14 days, all features',      z: '14 days' },
              { f: 'Setup complexity',      e: 'Low — ready out of the box', z: 'Medium-High' },
              { f: 'Best for',             e: 'UAE/Sri Lanka SMBs, retail',  z: 'Businesses needing deep accounting' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.f}</td>
                <td className="px-4 py-3 text-[#6B3FD9] font-medium border-b border-gray-100">{row.e}</td>
                <td className="px-4 py-3 text-gray-600 border-b border-gray-100">{row.z}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="pricing-comparison">Pricing — The Real Number</H2>
      <P>The price you see on Zoho&apos;s website is per app. To match what ExiusCart provides in one subscription, most small businesses need:</P>
      <UL items={[
        'Zoho Inventory — starts around $29/month for 1,500 orders',
        'Zoho Books — starts around $15/month for accounts and VAT invoicing',
        'Zoho POS — additional subscription for in-store point of sale',
        'Total: $44–80+/month depending on order volume and features needed',
      ]} />
      <P>ExiusCart covers POS + inventory + invoicing + HR + payroll in one subscription: AED 45/month (Starter) or AED 99/month (Premium).</P>

      <Callout type="info">
        This does not mean Zoho is overpriced. The reason Zoho costs more is that each app is more fully featured. If you need deep double-entry accounting or complex multi-currency books, Zoho Books is the right tool. If you primarily need to sell, track stock, and issue UAE VAT invoices, ExiusCart covers it at lower cost.
      </Callout>

      <H2 id="uae-vat-features">UAE VAT Compliance</H2>
      <P>Both ExiusCart and Zoho Books produce FTA-compliant VAT invoices. The difference is configuration effort.</P>
      <P>In ExiusCart, UAE VAT is a setting you turn on. You enter your TRN, set your VAT rate (5%), and every invoice from that point includes your TRN, 5% VAT calculated per line item, and a sequential invoice number — automatically. No template to build.</P>
      <P>In Zoho Books, UAE VAT compliance requires configuring tax codes, VAT accounts, and invoice templates. It works correctly once set up, but the initial setup takes longer and is more likely to require a tutorial or professional help.</P>

      <H2 id="thedersi-marketplace">TheDersi Marketplace — ExiusCart Only</H2>
      <P>If you sell on TheDersi — the UAE and Sri Lanka marketplace — this is a clear differentiator. ExiusCart has native TheDersi integration. Zoho does not.</P>
      <P>With ExiusCart, TheDersi orders sync automatically, inventory updates in real time, and you can manage fulfilment from your ExiusCart dashboard without touching the TheDersi seller portal. With Zoho, TheDersi orders would need to be manually entered or handled through a third-party tool.</P>

      <H2 id="ease-of-use">Ease of Use</H2>
      <P>Zoho is a powerful platform — and with power comes complexity. The interface has a lot of options, menus, and settings. For a business owner who wants to set something up quickly and not think about it again, the learning curve can be significant.</P>
      <P>ExiusCart is built for small business owners who want to sell, not configure software. The POS interface is designed for a tablet — you can hand it to a cashier and they can use it without training.</P>

      <PullQuote>&quot;Zoho is what you want when you need control over everything. ExiusCart is what you want when you want everything to just work.&quot;</PullQuote>

      <H2 id="when-to-choose-zoho">When You Should Choose Zoho</H2>
      <UL items={[
        'You need double-entry accounting for a CA or auditor review',
        'You operate in multiple currencies and need proper FX accounting',
        'You are in manufacturing, distribution, or B2B wholesale (not retail)',
        'You already use other Zoho tools (CRM, Desk, People) and want them connected',
        'You have an IT team or technical staff who can handle setup and maintenance',
      ]} />

      <H2 id="when-to-choose-exiuscart">When You Should Choose ExiusCart</H2>
      <UL items={[
        'You are a UAE or Sri Lanka retailer who primarily needs POS + inventory + VAT invoicing',
        'You sell on TheDersi and need native marketplace integration',
        'You want one subscription that covers POS, inventory, HR, and payroll without additional apps',
        'You want to set it up yourself in an afternoon, not configure it over several weeks',
        'Budget matters — AED 45/month vs AED 100–200+/month for a full Zoho stack',
        'You are starting a new business and want everything working from day one',
      ]} />

      <H2 id="trial-both">Try Both Free</H2>
      <P>Both ExiusCart and Zoho offer free trials. There is no better way to know which fits your business than to use both with your actual products and operations for a few days. Start with ExiusCart — the trial takes minutes to set up and you will know within an hour whether the interface matches how your business operates.</P>

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">Try ExiusCart free for 14 days</p>
        <p className="text-gray-400 text-sm mb-6">POS, inventory, VAT invoicing, TheDersi integration — all features included. No credit card required.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function AllInOneUnder100() {
  return (
    <article>
      <p className="text-lg text-gray-700 leading-relaxed mb-8 font-medium border-b border-gray-100 pb-8">
        A POS system. Inventory management. VAT-compliant invoicing. Order management. Staff accounts. HR and payroll. Customer records. Sales reports. Most businesses in the UAE pay for these as separate subscriptions — and end up spending AED 300–500 a month without realising it.
      </p>

      <P>ExiusCart Premium puts all of that in one platform at AED 99 per month. The Starter plan gives you POS, inventory, invoicing, and order management for AED 45 per month. This article covers exactly what you get and what it replaces.</P>

      <H2 id="the-subscription-sprawl-problem">The Subscription Sprawl Problem</H2>
      <P>Most small businesses end up with too many subscriptions. It happens gradually: you add a POS, then you need inventory software, then invoicing, then HR. Each one feels like a good decision at the time. A year later you have five separate tools, five separate logins, five separate sets of data that do not talk to each other — and a combined bill that dwarfs what a single integrated platform would cost.</P>

      <div className="overflow-x-auto my-7">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-4 py-3 rounded-tl-xl font-semibold">Separate subscription</th>
              <th className="text-left px-4 py-3 font-semibold">Typical cost (AED/mo)</th>
              <th className="text-left px-4 py-3 rounded-tr-xl font-semibold">Covered by ExiusCart</th>
            </tr>
          </thead>
          <tbody>
            {[
              { s: 'POS software',             c: '80–200',    e: 'Yes' },
              { s: 'Inventory management',      c: '60–150',    e: 'Yes' },
              { s: 'VAT invoicing software',    c: '50–100',    e: 'Yes' },
              { s: 'Order management system',   c: '80–200',    e: 'Yes' },
              { s: 'HR & payroll software',     c: '80–200',    e: 'Yes (Premium)' },
              { s: 'CRM / customer management', c: '60–150',    e: 'Yes' },
              { s: 'Sales analytics',           c: '50–100',    e: 'Yes' },
              { s: 'Total',                     c: '460–1,100', e: 'AED 45–99/month' },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className={`px-4 py-3 font-medium border-b border-gray-100 ${row.s === 'Total' ? 'font-bold text-gray-900' : 'text-gray-900'}`}>{row.s}</td>
                <td className={`px-4 py-3 border-b border-gray-100 ${row.s === 'Total' ? 'text-red-600 font-bold' : 'text-gray-600'}`}>{row.c}</td>
                <td className={`px-4 py-3 border-b border-gray-100 ${row.s === 'Total' ? 'text-[#6B3FD9] font-bold' : 'text-[#6B3FD9]'}`}>{row.e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PullQuote>&quot;The cost of separate tools is not just the subscriptions — it is the time spent switching between them and the data that never quite lines up.&quot;</PullQuote>

      <H2 id="what-you-get-starter">Starter Plan — AED 45/Month</H2>
      <P>The ExiusCart Starter plan is designed for businesses with one location and a small team:</P>

      <UL items={[
        'POS — full point-of-sale system, runs on any tablet or laptop, works offline',
        'Inventory management — up to 1,000 products, barcode scanning, low-stock alerts',
        'VAT invoicing — FTA-compliant tax invoices on every sale, with your TRN, 500 invoices per month',
        'Order management — receive and process orders from in-store, TheDersi, and your website',
        'Staff accounts — up to 3 staff with role-based access',
        'Customer records — purchase history, contact details, repeat buyer tracking',
        'Sales reports — daily, weekly, monthly revenue, best-selling products',
        'TheDersi integration — automatic order sync with the TheDersi marketplace',
        'Shopify and WooCommerce sync',
      ]} />

      <H2 id="what-you-get-premium">Premium Plan — AED 99/Month</H2>
      <P>The Premium plan removes all limits and adds HR, payroll, and multi-branch management:</P>

      <UL items={[
        'Everything in Starter — unlimited',
        'Unlimited products, staff, and invoices',
        'Multi-branch support — manage multiple locations from one dashboard',
        'HR and payroll — attendance tracking, leave management, payslip generation',
        'Quotation and purchase order management',
        'Advanced analytics and custom reports',
        'Priority support + account manager',
      ]} />

      <div className="grid grid-cols-3 gap-4 my-8">
        <StatBox stat="AED 45" label="Starter" sub="$12 USD · per month" />
        <StatBox stat="AED 99" label="Premium" sub="$29 USD · per month" />
        <StatBox stat="0" label="Setup fee" sub="No hidden costs" />
      </div>

      <Callout type="tip">
        The Starter plan handles most small retail businesses comfortably — one location, up to 3 staff, up to 1,000 products. Only upgrade to Premium when you open a second branch, need payroll processing, or run a larger team.
      </Callout>

      <H2 id="uae-specific-features">UAE-Specific Features Included</H2>
      <UL items={[
        'FTA-compliant VAT invoicing — 5% VAT, TRN field, sequential numbering, PDF generation',
        'AED as primary currency — no conversion required, invoices in AED for UAE transactions',
        'USD pricing for international customers — auto-detected by customer location',
        'TheDersi marketplace integration — native, not a third-party workaround',
        'WPS-ready payroll — salary records for UAE Wage Protection System compliance (Premium)',
      ]} />

      <H2 id="who-its-for">Who This Is For</H2>
      <UL items={[
        'Physical retail shops — clothing, electronics, grocery, boutique, salon, pharmacy',
        'Online sellers on TheDersi looking for inventory and order management',
        'Businesses selling both in-store and online — one platform for all channels',
        'Business owners who want to eliminate spreadsheets and multiple subscriptions',
        'Growing businesses adding staff, locations, or channels',
      ]} />

      <H2 id="free-trial">14 Days Free — All Features</H2>
      <P>The full platform is available during the 14-day free trial. No credit card required. You can set up your product catalog, run sales through the POS, connect TheDersi, and see exactly what you get before committing to any plan. Most businesses know within the first week whether it works for them.</P>

      <NumberedList items={[
        { title: 'Start the free trial', desc: 'Account created instantly. All features unlocked. No credit card.' },
        { title: 'Set up your products', desc: 'Import via CSV or add manually. Most catalogs take under an hour.' },
        { title: 'Configure UAE VAT', desc: 'Enter your TRN once. Every invoice is correct from that point.' },
        { title: 'Connect your channels', desc: 'TheDersi, Shopify, WooCommerce — connect whichever you use.' },
        { title: 'Add your staff', desc: 'Create accounts for your team. Set their roles. Done.' },
      ]} />

      <div className="mt-10 bg-gray-900 rounded-2xl p-8 text-center">
        <p className="text-white font-black text-xl mb-2">All-in-one for AED 45/month. Try free for 14 days.</p>
        <p className="text-gray-400 text-sm mb-6">POS, inventory, VAT invoicing, HR, multi-channel orders. Built for UAE businesses. No credit card required.</p>
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
    seoDescription: 'How TheDersi sellers can sync orders automatically, track inventory in real time, and generate VAT invoices — all from ExiusCart.',
    category: 'Guides',
    categoryColor: 'text-[#6B3FD9] bg-purple-50 border-purple-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: "Copying TheDersi orders into a spreadsheet works — until it doesn't. Here's how to manage everything automatically without changing how your store works.",
    toc: [
      { id: 'manual-problem',   label: 'Why manual management breaks' },
      { id: 'how-it-connects',  label: 'How the connection works' },
      { id: 'what-syncs',       label: 'What syncs automatically' },
      { id: 'inventory-sync',   label: 'Keeping inventory accurate' },
      { id: 'invoicing',        label: 'Auto-generated invoices' },
      { id: 'reports',          label: 'Sales reports & analytics' },
      { id: 'plans',            label: 'Free vs paid plans' },
      { id: 'get-started',      label: 'Get connected' },
    ],
    Content: TheDersiPost,
  },
  'pos-vs-cash-register-uae-shops-2026': {
    title: 'POS vs Cash Register: What UAE Shop Owners Need to Know in 2026',
    seoTitle: 'POS System vs Cash Register for UAE Shops — Which Should You Choose in 2026? | ExiusCart',
    seoDescription: 'Cash register or POS? A clear comparison for UAE shop owners — features, cost, VAT compliance, and exactly when the switch is worth making.',
    category: 'Technology',
    categoryColor: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    date: 'June 2026',
    readTime: '7 min',
    lead: "A cash register costs AED 300 and does one thing. A POS costs AED 45/month and runs your entire business. Here is exactly when each makes sense.",
    toc: [
      { id: 'what-a-cash-register-does', label: 'What a cash register does' },
      { id: 'what-a-pos-does',           label: 'What a POS does' },
      { id: 'real-cost-comparison',      label: 'Real cost comparison' },
      { id: 'uae-vat-compliance',        label: 'UAE VAT compliance' },
      { id: 'when-register-is-enough',   label: 'When a register is enough' },
      { id: 'when-you-need-pos',         label: 'When you need a POS' },
      { id: 'what-to-look-for',          label: 'What to look for' },
      { id: 'exiuscart-pos',             label: 'ExiusCart POS' },
    ],
    Content: POSvsCashRegister,
  },
  'scale-uae-business-multiple-branches': {
    title: 'From One Store to Multiple Branches: How to Scale Your UAE Business',
    seoTitle: 'How to Manage Multiple Retail Branches in UAE — Complete Guide 2026 | ExiusCart',
    seoDescription: 'How UAE retailers expand to multiple locations without losing control — inventory across branches, staff management, consolidated reporting, and common mistakes to avoid.',
    category: 'Growth',
    categoryColor: 'text-orange-600 bg-orange-50 border-orange-100',
    date: 'June 2026',
    readTime: '7 min',
    lead: "Every problem you had at branch one comes back doubled at branch two — unless you set up the right systems first. Here is exactly how to do it.",
    toc: [
      { id: 'what-actually-changes',      label: 'What changes at branch two' },
      { id: 'inventory-challenge',         label: 'The inventory challenge' },
      { id: 'staff-across-locations',      label: 'Staff across locations' },
      { id: 'reporting-across-branches',   label: 'Consolidated reporting' },
      { id: 'common-mistakes',             label: 'Common mistakes' },
      { id: 'setting-up-exiuscart',        label: 'Multi-branch in ExiusCart' },
      { id: 'when-youre-ready',            label: 'Signs you are ready' },
    ],
    Content: ScaleMultipleBranches,
  },
  'stop-using-spreadsheets-switch-exiuscart': {
    title: 'Why Growing Shops Stop Using Spreadsheets (And What They Use Instead)',
    seoTitle: 'Stop Using Spreadsheets to Run Your Business — Switch to ExiusCart | ExiusCart Blog',
    seoDescription: 'The hidden cost of running a business on Excel — lost hours, stock errors, invoice mistakes — and how switching to ExiusCart fixes all of it.',
    category: 'Productivity',
    categoryColor: 'text-rose-600 bg-rose-50 border-rose-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: "Eight hours a week on spreadsheet admin. That is AED 20,000 a year in your time — for a system you could replace for AED 45 a month.",
    toc: [
      { id: 'why-spreadsheets-feel-safe', label: 'Why spreadsheets feel safe' },
      { id: 'what-they-cost-you',         label: 'What they actually cost' },
      { id: 'what-breaks-first',          label: 'What breaks first' },
      { id: 'five-signs',                 label: '5 signs you have outgrown them' },
      { id: 'what-the-switch-looks-like', label: 'What switching looks like' },
      { id: 'after-the-switch',           label: 'What changes after' },
    ],
    Content: StopSpreadsheets,
  },
  'hr-payroll-small-business-no-hr-team': {
    title: 'How to Handle Employee Payroll Without an HR Department',
    seoTitle: 'Small Business HR & Payroll Management — No HR Team Needed | ExiusCart Blog',
    seoDescription: 'UAE small business payroll guide — attendance tracking, leave management, WPS compliance, gratuity calculation, and how to do it all without an HR team.',
    category: 'HR & Payroll',
    categoryColor: 'text-pink-600 bg-pink-50 border-pink-100',
    date: 'June 2026',
    readTime: '7 min',
    lead: "Four staff, end of month, two reply on WhatsApp, one sends a voice note, one goes quiet. There is a better way — and it takes 15 minutes, not a whole afternoon.",
    toc: [
      { id: 'what-hr-means-for-small-business', label: 'What HR means for small teams' },
      { id: 'attendance-tracking',               label: 'Tracking attendance' },
      { id: 'leave-management',                  label: 'Managing leave properly' },
      { id: 'payroll-calculation',               label: 'Calculating payroll correctly' },
      { id: 'common-mistakes',                   label: 'Common payroll mistakes' },
      { id: 'exiuscart-hr',                      label: 'HR in ExiusCart' },
      { id: 'getting-started',                   label: 'Getting started this week' },
    ],
    Content: HRPayrollPost,
  },
  'shopify-woocommerce-sync-exiuscart': {
    title: 'Syncing Shopify & WooCommerce Orders into One Dashboard',
    seoTitle: 'Manage Shopify, WooCommerce & TheDersi Orders in One Place | ExiusCart Blog',
    seoDescription: 'How to sync Shopify, WooCommerce, TheDersi, and custom website orders into one ExiusCart dashboard — one inventory, one set of reports, zero oversells.',
    category: 'Integrations',
    categoryColor: 'text-blue-600 bg-blue-50 border-blue-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: "26 orders across four platforms before your first coffee. There is a better way to start the day.",
    toc: [
      { id: 'the-multi-platform-problem',  label: 'The multi-platform problem' },
      { id: 'how-shopify-sync-works',      label: 'How Shopify sync works' },
      { id: 'how-woocommerce-sync-works',  label: 'How WooCommerce sync works' },
      { id: 'thedersi-and-custom-sites',   label: 'TheDersi & custom websites' },
      { id: 'unified-inventory',           label: 'One inventory for all channels' },
      { id: 'single-reporting',            label: 'Unified reporting' },
      { id: 'getting-connected',           label: 'Getting connected' },
    ],
    Content: ShopifySyncPost,
  },
  'best-pos-system-small-business-uae-2025': {
    title: 'Best POS System for Small Businesses in UAE 2025',
    seoTitle: 'Best POS System for UAE Small Businesses 2025 — Honest Comparison | ExiusCart',
    seoDescription: 'Comparing the best POS systems for UAE small businesses — ExiusCart, Zoho, Square, Lightspeed. UAE VAT support, AED pricing, and which actually fits a small shop.',
    category: 'Technology',
    categoryColor: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    date: 'June 2026',
    readTime: '7 min',
    lead: "Most POS roundups recommend US products that don't handle UAE VAT. Here is an honest guide written for UAE shop owners.",
    toc: [
      { id: 'what-uae-pos-needs',       label: 'What a UAE POS must have' },
      { id: 'the-options',               label: 'POS options compared' },
      { id: 'exiuscart-recommendation',  label: 'Why ExiusCart fits UAE SMBs' },
      { id: 'zoho-comparison',           label: 'ExiusCart vs Zoho' },
      { id: 'what-to-try-first',         label: 'What to try first' },
    ],
    Content: BestPOSUAE,
  },
  'inventory-management-software-sri-lanka-retailers': {
    title: 'Inventory Management Software for Sri Lanka Retailers',
    seoTitle: 'Best Inventory Management Software for Sri Lanka Retailers 2025 | ExiusCart',
    seoDescription: 'Inventory management software built for Sri Lanka retailers — TheDersi integration, multi-channel stock management, affordable USD pricing. Free trial available.',
    category: 'Guides',
    categoryColor: 'text-[#6B3FD9] bg-purple-50 border-purple-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: "Sri Lanka retailers selling on TheDersi, in-store, and online are managing stock across three places manually. Here is a better way.",
    toc: [
      { id: 'why-sri-lanka-retailers-need-software', label: 'Why software is needed now' },
      { id: 'what-to-look-for',                      label: 'What to look for' },
      { id: 'thedersi-sellers',                       label: 'For TheDersi sellers' },
      { id: 'pricing-for-sri-lanka',                  label: 'Pricing that makes sense' },
      { id: 'features-for-retailers',                 label: 'Key features' },
      { id: 'migrating-from-spreadsheets',            label: 'Moving from spreadsheets' },
    ],
    Content: InventorySriLanka,
  },
  'exiuscart-vs-zoho-inventory-comparison': {
    title: 'ExiusCart vs Zoho Inventory — Honest Comparison 2025',
    seoTitle: 'ExiusCart vs Zoho Inventory — Honest Comparison for UAE Businesses | ExiusCart Blog',
    seoDescription: 'ExiusCart vs Zoho Inventory for UAE and Middle East retailers — pricing, UAE VAT support, TheDersi integration, ease of use, and which is right for your business.',
    category: 'Technology',
    categoryColor: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    date: 'June 2026',
    readTime: '8 min',
    lead: "A fair comparison between ExiusCart and Zoho Inventory — written by ExiusCart, so read with that context, but written to actually help you decide correctly.",
    toc: [
      { id: 'quick-summary',            label: 'Quick summary' },
      { id: 'pricing-comparison',       label: 'Pricing comparison' },
      { id: 'uae-vat-features',         label: 'UAE VAT compliance' },
      { id: 'thedersi-marketplace',     label: 'TheDersi integration' },
      { id: 'ease-of-use',              label: 'Ease of use' },
      { id: 'when-to-choose-zoho',      label: 'When to choose Zoho' },
      { id: 'when-to-choose-exiuscart', label: 'When to choose ExiusCart' },
      { id: 'trial-both',               label: 'Try both free' },
    ],
    Content: ExiusCartVsZohoPost,
  },
  'all-in-one-business-software-uae-under-aed-100': {
    title: 'All-in-One Business Software UAE: POS, Inventory, Invoicing Under AED 100',
    seoTitle: 'All-in-One Business Software UAE — POS, Inventory, VAT Invoicing Under AED 100/Month | ExiusCart',
    seoDescription: 'Replace 5 separate subscriptions with one platform. ExiusCart gives UAE businesses POS, inventory, VAT invoicing, HR, and order management from AED 45/month.',
    category: 'Growth',
    categoryColor: 'text-orange-600 bg-orange-50 border-orange-100',
    date: 'June 2026',
    readTime: '6 min',
    lead: "Most UAE businesses pay AED 300–500 a month for separate subscriptions that don't talk to each other. Here is what one platform at AED 45–99/month covers instead.",
    toc: [
      { id: 'the-subscription-sprawl-problem', label: 'The subscription sprawl problem' },
      { id: 'what-you-get-starter',            label: 'Starter plan — AED 45/month' },
      { id: 'what-you-get-premium',            label: 'Premium plan — AED 99/month' },
      { id: 'uae-specific-features',           label: 'UAE-specific features' },
      { id: 'who-its-for',                     label: 'Who it is for' },
      { id: 'free-trial',                      label: '14-day free trial' },
    ],
    Content: AllInOneUnder100,
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
