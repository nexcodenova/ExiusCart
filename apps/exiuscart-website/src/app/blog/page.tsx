import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Blog | ExiusCart — Business Tips, Guides & Retail Insights',
  description: 'Guides, tips and insights to help you run and grow your business with ExiusCart. POS, invoicing, inventory, HR and more.',
  openGraph: {
    title: 'Blog | ExiusCart',
    description: 'Guides, tips and insights to help you run and grow your business.',
    url: 'https://exiuscart.com/blog',
  },
};

const POSTS = [
  {
    slug: 'uae-vat-invoicing-guide-small-business',
    category: 'Finance',
    date: 'Jun 2026',
    readTime: '7 min',
    title: 'The Complete Guide to UAE VAT Invoicing for Small Business Owners',
    excerpt: 'Everything you need to know about 5% VAT compliance, TRN numbers, and issuing FTA-compliant invoices — without an accountant.',
    featured: true,
  },
  {
    slug: 'skip-admin-panel-connect-custom-website',
    category: 'Integrations',
    date: 'Jun 2026',
    readTime: '5 min',
    title: 'Why Your Custom Website Doesn\'t Need a Separate Admin Panel',
    excerpt: 'Building a website? ExiusCart replaces the backend you\'d normally have to build — orders, inventory, staff, invoicing, all ready from day one.',
  },
  {
    slug: 'thedersi-sellers-manage-orders-exiuscart',
    category: 'Guides',
    date: 'Jun 2026',
    readTime: '4 min',
    title: 'How TheDersi Sellers Can Manage All Their Orders in One Place',
    excerpt: 'A step-by-step guide for TheDersi sellers on syncing orders, tracking inventory, and issuing invoices using ExiusCart.',
  },
  {
    slug: 'pos-vs-cash-register-uae-shops-2026',
    category: 'Technology',
    date: 'Jun 2026',
    readTime: '6 min',
    title: 'POS vs Cash Register: What UAE Shop Owners Need to Know in 2026',
    excerpt: 'Is a modern POS system worth switching to? We break down the real difference — cost, features, and what makes sense for your shop size.',
  },
  {
    slug: 'scale-uae-business-multiple-branches',
    category: 'Growth',
    date: 'Jun 2026',
    readTime: '5 min',
    title: 'From One Store to Multiple Branches: How to Scale Your UAE Business',
    excerpt: 'Managing more than one location doesn\'t have to mean more chaos. Here\'s how successful UAE retailers expand without losing control.',
  },
  {
    slug: 'stop-using-spreadsheets-switch-exiuscart',
    category: 'Productivity',
    date: 'Jun 2026',
    readTime: '4 min',
    title: 'Why Growing Shops Stop Using Spreadsheets (And What They Use Instead)',
    excerpt: 'Spreadsheets feel free — until they cost you hours every week. Here\'s the real cost of running a business on Excel, and how to fix it.',
  },
  {
    slug: 'hr-payroll-small-business-no-hr-team',
    category: 'HR & Payroll',
    date: 'Jun 2026',
    readTime: '5 min',
    title: 'How to Handle Employee Payroll Without an HR Department',
    excerpt: 'Small business owners are doing HR themselves. Here\'s how to manage attendance, leave, and payroll in minutes — not hours.',
  },
  {
    slug: 'shopify-woocommerce-sync-exiuscart',
    category: 'Integrations',
    date: 'Jun 2026',
    readTime: '4 min',
    title: 'Syncing Shopify & WooCommerce Orders into One Dashboard',
    excerpt: 'Selling on multiple platforms? ExiusCart pulls all your orders — Shopify, WooCommerce, TheDersi, and your own site — into one place.',
  },
  {
    slug: 'best-pos-system-small-business-uae-2025',
    category: 'Technology',
    date: 'Jun 2026',
    readTime: '7 min',
    title: 'Best POS System for Small Businesses in UAE 2025',
    excerpt: "Most POS roundups recommend US products that don't handle UAE VAT. Here is an honest guide comparing what actually works for UAE shop owners.",
  },
  {
    slug: 'inventory-management-software-sri-lanka-retailers',
    category: 'Guides',
    date: 'Jun 2026',
    readTime: '6 min',
    title: 'Inventory Management Software for Sri Lanka Retailers',
    excerpt: 'Sri Lanka retailers selling on TheDersi, in-store, and online need one system to manage it all. Here is what to look for and what works.',
  },
  {
    slug: 'exiuscart-vs-zoho-inventory-comparison',
    category: 'Technology',
    date: 'Jun 2026',
    readTime: '8 min',
    title: 'ExiusCart vs Zoho Inventory — Honest Comparison 2025',
    excerpt: 'A clear comparison of ExiusCart and Zoho Inventory for UAE retailers — pricing, UAE VAT, TheDersi integration, and which is right for your business.',
  },
  {
    slug: 'all-in-one-business-software-uae-under-aed-100',
    category: 'Growth',
    date: 'Jun 2026',
    readTime: '6 min',
    title: 'All-in-One Business Software UAE: POS, Inventory, Invoicing Under AED 100',
    excerpt: 'Most UAE businesses pay AED 300–500/month for separate tools. ExiusCart replaces all of them — POS, inventory, VAT invoicing, HR — for AED 45–99/month.',
  },
];

const CATEGORIES = ['All', 'Finance', 'Integrations', 'Guides', 'Technology', 'Growth', 'Productivity', 'HR & Payroll'];

const featured = POSTS.find(p => p.featured)!;
const rest = POSTS.filter(p => !p.featured);

const CATEGORY_COLORS: Record<string, string> = {
  Finance:      'text-emerald-600',
  Integrations: 'text-blue-600',
  Guides:       'text-[#6B3FD9]',
  Technology:   'text-cyan-600',
  Growth:       'text-orange-600',
  Productivity: 'text-rose-600',
  'HR & Payroll': 'text-pink-600',
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero — dark */}
      <section className="pt-32 pb-20 px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-5">
          Blog
        </p>
        <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-white leading-[1.03] tracking-tight mb-6">
          Insights to grow<br />your business.
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Practical guides, tips, and ideas for shop owners, sellers, and growing businesses worldwide.
        </p>
      </section>

      {/* Posts — cream */}
      <section className="bg-[#F5F3EF] px-6 py-20">
        <div className="max-w-7xl mx-auto">

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-14">
            {CATEGORIES.map((c, i) => (
              <span
                key={c}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all cursor-default ${
                  i === 0
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {c}
              </span>
            ))}
          </div>

          {/* Featured post */}
          <Link href={`/blog/${featured.slug}`} className="group block mb-8">
            <article className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center">
              {/* Left */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className={`text-xs font-bold uppercase tracking-widest ${CATEGORY_COLORS[featured.category] ?? 'text-[#6B3FD9]'}`}>
                    {featured.category}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{featured.readTime} read</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{featured.date}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-[1.08] tracking-tight mb-5 group-hover:text-[#6B3FD9] transition-colors">
                  {featured.title}
                </h2>
                <p className="text-gray-500 leading-relaxed mb-8">{featured.excerpt}</p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-[#6B3FD9] transition-colors">
                  Read article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              {/* Right — decorative */}
              <div className="hidden md:flex items-center justify-center">
                <div className="w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#6B3FD9]/10 via-[#F5F3EF] to-emerald-50 border border-gray-100 flex items-center justify-center">
                  <div className="text-center px-8">
                    <p className="text-[3rem] font-black text-gray-900 leading-none mb-2">5%</p>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">UAE VAT Guide</p>
                  </div>
                </div>
              </div>
            </article>
          </Link>

          {/* Post grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-7 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-[11px] font-bold uppercase tracking-widest ${CATEGORY_COLORS[post.category] ?? 'text-[#6B3FD9]'}`}>
                        {post.category}
                      </span>
                      <span className="text-gray-200">·</span>
                      <span className="text-[11px] text-gray-400">{post.readTime} read</span>
                    </div>
                    <h3 className="text-lg font-black text-gray-900 leading-snug mb-3 group-hover:text-[#6B3FD9] transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{post.date}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-900 group-hover:text-[#6B3FD9] group-hover:gap-2 transition-all">
                      Read <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Paddle card */}
      <section className="bg-[#F5F3EF] px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#0B1121] rounded-3xl px-10 py-14 md:px-16 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-4">Start today</p>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
                Ready to run your business<br className="hidden md:block" /> the smart way?
              </h2>
              <p className="text-gray-400 text-sm max-w-md">
                14-day free trial. All features included. No credit card required.
              </p>
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
