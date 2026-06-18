import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { notFound } from 'next/navigation';

// ── Add posts here as content is ready ─────────────────────────────────────
const POSTS: Record<string, {
  title: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  date: string;
  readTime: string;
  content: string; // HTML string — paste content here
}> = {
  'uae-vat-invoicing-guide-small-business': {
    title: 'The Complete Guide to UAE VAT Invoicing for Small Business Owners',
    seoTitle: 'UAE VAT Invoicing Guide 2026 — 5% VAT Compliance for Small Businesses | ExiusCart',
    seoDescription: 'Everything small business owners need to know about UAE VAT invoicing, 5% VAT compliance, TRN requirements, and FTA-approved invoice formats.',
    category: 'Finance',
    date: 'Jun 2026',
    readTime: '7 min',
    content: '<p>Content coming soon.</p>',
  },
  'skip-admin-panel-connect-custom-website': {
    title: "Why Your Custom Website Doesn't Need a Separate Admin Panel",
    seoTitle: "Skip the Backend: How ExiusCart Replaces Your Custom Website Admin Panel | ExiusCart",
    seoDescription: "Building a website? ExiusCart acts as your complete admin panel — orders, inventory, invoicing, HR, and reports — no backend to build.",
    category: 'Integrations',
    date: 'Jun 2026',
    readTime: '5 min',
    content: '<p>Content coming soon.</p>',
  },
  'thedersi-sellers-manage-orders-exiuscart': {
    title: 'How TheDersi Sellers Can Manage All Their Orders in One Place',
    seoTitle: 'TheDersi Order Management Made Easy with ExiusCart | ExiusCart Blog',
    seoDescription: 'A step-by-step guide for TheDersi sellers on syncing orders, tracking inventory, and issuing invoices using ExiusCart.',
    category: 'Guides',
    date: 'Jun 2026',
    readTime: '4 min',
    content: '<p>Content coming soon.</p>',
  },
  'pos-vs-cash-register-uae-shops-2026': {
    title: 'POS vs Cash Register: What UAE Shop Owners Need to Know in 2026',
    seoTitle: 'POS System vs Cash Register for UAE Shops — Which Should You Choose in 2026? | ExiusCart',
    seoDescription: 'Comparing modern POS systems against traditional cash registers for UAE shop owners. Features, cost, and what works for your business size.',
    category: 'Technology',
    date: 'Jun 2026',
    readTime: '6 min',
    content: '<p>Content coming soon.</p>',
  },
  'scale-uae-business-multiple-branches': {
    title: 'From One Store to Multiple Branches: How to Scale Your UAE Business',
    seoTitle: 'How to Manage Multiple Retail Branches in UAE — Complete Guide 2026 | ExiusCart',
    seoDescription: 'How successful UAE retailers expand to multiple locations without losing control of inventory, staff, and sales reporting.',
    category: 'Growth',
    date: 'Jun 2026',
    readTime: '5 min',
    content: '<p>Content coming soon.</p>',
  },
  'stop-using-spreadsheets-switch-exiuscart': {
    title: 'Why Growing Shops Stop Using Spreadsheets (And What They Use Instead)',
    seoTitle: 'Stop Using Spreadsheets to Run Your Business — Switch to ExiusCart | ExiusCart Blog',
    seoDescription: 'The real cost of managing a business on Excel spreadsheets, and how switching to ExiusCart saves hours every week.',
    category: 'Productivity',
    date: 'Jun 2026',
    readTime: '4 min',
    content: '<p>Content coming soon.</p>',
  },
  'hr-payroll-small-business-no-hr-team': {
    title: 'How to Handle Employee Payroll Without an HR Department',
    seoTitle: 'Small Business HR & Payroll Management — No HR Team Needed | ExiusCart Blog',
    seoDescription: 'How small business owners can manage employee attendance, leave, and payroll in minutes without hiring an HR team.',
    category: 'HR & Payroll',
    date: 'Jun 2026',
    readTime: '5 min',
    content: '<p>Content coming soon.</p>',
  },
  'shopify-woocommerce-sync-exiuscart': {
    title: 'Syncing Shopify & WooCommerce Orders into One Dashboard',
    seoTitle: 'Manage Shopify, WooCommerce & TheDersi Orders in One Place | ExiusCart Blog',
    seoDescription: 'How to sync Shopify, WooCommerce, TheDersi, and custom website orders into a single ExiusCart dashboard.',
    category: 'Integrations',
    date: 'Jun 2026',
    readTime: '4 min',
    content: '<p>Content coming soon.</p>',
  },
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS[params.slug];
  if (!post) return { title: 'Post Not Found | ExiusCart Blog' };
  return {
    title: post.seoTitle,
    description: post.seoDescription,
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      url: `https://exiuscart.com/blog/${params.slug}`,
    },
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  Finance:        'text-emerald-600',
  Integrations:   'text-blue-600',
  Guides:         'text-[#6B3FD9]',
  Technology:     'text-cyan-600',
  Growth:         'text-orange-600',
  Productivity:   'text-rose-600',
  'HR & Payroll': 'text-pink-600',
};

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero — dark */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className={`text-xs font-bold uppercase tracking-widest ${CATEGORY_COLORS[post.category] ?? 'text-[#6B3FD9]'}`}>
              {post.category}
            </span>
            <span className="text-gray-600">·</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" /> {post.readTime} read
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-xs text-gray-500">{post.date}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.08] tracking-tight">
            {post.title}
          </h1>
        </div>
      </section>

      {/* Content — cream */}
      <section className="bg-[#F5F3EF] px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <div
            className="prose prose-lg prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#F5F3EF] px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#0B1121] rounded-3xl p-10 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-3">Try ExiusCart free</p>
              <h3 className="text-2xl md:text-3xl font-black text-white mb-2">14 days, no credit card.</h3>
              <p className="text-gray-400 text-sm">All features included from day one.</p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-7 py-3.5 rounded-xl transition-all text-sm whitespace-nowrap shrink-0"
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
