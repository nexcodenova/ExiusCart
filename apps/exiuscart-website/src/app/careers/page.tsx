import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Mail, MapPin, ArrowUpRight, Target, Zap, Lightbulb, Shield, Globe2, Clock, Laptop, Rocket, Heart, Users } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Careers | NexCode Nova — Team Behind ExiusCart',
  description: 'ExiusCart is built and owned by NexCode Nova, a SaaS company under Fairan Pvt Ltd. Small remote team building real software for real businesses.',
  openGraph: {
    title: 'Careers | NexCode Nova',
    description: 'Join the team behind ExiusCart. Small team, real work, remote-first.',
    url: 'https://exiuscart.com/careers',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

const workingHere = [
  { n: '01', title: 'Fully remote, always',       body: 'No office, no plans to get one. Work from wherever you work best. We run async by default.' },
  { n: '02', title: 'Results, not hours',          body: "We don't track when you log in. Flexible hours, no micromanagement — just good work." },
  { n: '03', title: 'Freelance & contract welcome', body: 'Not every role is full-time. Project-based and contract arrangements are completely fine.' },
  { n: '04', title: 'Early stage, real ownership', body: 'Join now and you shape the product — not just execute tasks handed down from above.' },
];

const values = [
  { icon: Target,   label: 'Customer First',       desc: 'Every decision starts with — how does this help our customers?' },
  { icon: Zap,      label: 'Move Fast',             desc: 'We ship, learn from feedback, and iterate. Done beats perfect.' },
  { icon: Lightbulb,label: 'Think Big',             desc: 'We are building something that will change how businesses run in the UAE.' },
  { icon: Shield,   label: 'Trust & Transparency',  desc: 'We share openly, give honest feedback, and trust each other.' },
];

const perks = [
  { icon: Globe2,  label: 'Work From Anywhere',    desc: 'Fully remote. Home, coffee shop, beach — wherever you do your best work.' },
  { icon: Clock,   label: 'Flexible Hours',         desc: 'No 9–5. We care about results, not when you clock in.' },
  { icon: Laptop,  label: 'Modern Tools',           desc: 'We give you what you need — great stack, premium software, good setup.' },
  { icon: Rocket,  label: 'Grow With Us',           desc: 'As we expand into Dubai, early people get the most exciting opportunities.' },
  { icon: Heart,   label: 'Work-Life Balance',      desc: 'Your life matters. No micromanagement, no burnout culture.' },
  { icon: Users,   label: 'A Real Team',            desc: 'Passionate people who care about what they build. We collaborate, not compete.' },
];

const roles = ['Engineering', 'Design', 'Marketing', 'Customer Support'];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <Navbar />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-5xl mx-auto">

          <Link href="/" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-14 transition">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          {/* ── Hero ── */}
          <div className="mb-16">
            <p className="text-[#6B3FD9] text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
              NexCode Nova · Careers
            </p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6">
              Small team.<br />
              <span style={{ color: '#6B3FD9' }}>Real product.</span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed max-w-xl">
              ExiusCart is fully owned and built by{' '}
              <a href="https://nexcodenova.com" target="_blank" rel="noopener noreferrer"
                className="text-gray-900 font-semibold border-b border-gray-400 hover:border-[#6B3FD9] hover:text-[#6B3FD9] transition">
                NexCode Nova
              </a>
              , a SaaS company under <span className="text-gray-900 font-semibold">Fairan Pvt Ltd</span>.
              Sri Lanka-based, expanding into Dubai. All hiring is handled by NexCode Nova.
            </p>
          </div>

          {/* ── NexCode Nova dark card ── */}
          <div className="relative bg-gray-900 rounded-3xl overflow-hidden mb-16">
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative p-8 md:p-10">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div className="flex-1">
                  <span className="inline-block text-[#9B6FF9] text-[10px] font-bold tracking-[0.2em] uppercase bg-[#9B6FF9]/10 px-3 py-1 rounded-full mb-4">
                    About NexCode Nova
                  </span>
                  <p className="text-white font-black text-2xl leading-snug mb-3">
                    The SaaS company<br />behind ExiusCart
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    We build our own products, own them fully, and grow them long-term.
                    No agency work, no client projects. ExiusCart is our flagship — a
                    multi-channel business management platform for sellers in the UAE and Middle East.
                  </p>
                </div>
                <a href="https://nexcodenova.com" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white text-gray-900 hover:bg-[#6B3FD9] hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl transition whitespace-nowrap self-start">
                  nexcodenova.com
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* ── Values ── */}
          <div className="mb-16">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-6">
              What we stand for
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {values.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start">
                  <div className="w-9 h-9 rounded-xl bg-[#6B3FD9]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#6B3FD9]" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-sm mb-0.5">{label}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── What it's like ── */}
          <div className="mb-16">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-6">
              What it&apos;s like to work here
            </p>
            <div className="space-y-px">
              {workingHere.map(({ n, title, body }, i) => (
                <div key={n}
                  className={`flex gap-6 p-6 bg-white border border-gray-200
                    ${i === 0 ? 'rounded-t-2xl' : ''}
                    ${i === workingHere.length - 1 ? 'rounded-b-2xl' : ''}`}>
                  <span className="text-3xl font-black text-gray-100 leading-none w-10 flex-shrink-0 select-none">{n}</span>
                  <div>
                    <p className="text-gray-900 font-bold text-sm mb-1">{title}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Perks ── */}
          <div className="mb-16">
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-6">
              Benefits &amp; perks
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {perks.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <Icon className="w-5 h-5 text-[#6B3FD9] mb-3" />
                  <p className="text-gray-900 font-bold text-sm mb-1">{label}</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Roles + Positions ── */}
          <div className="grid sm:grid-cols-2 gap-4 mb-16">
            <div className="bg-[#6B3FD9] rounded-3xl p-7">
              <p className="text-white/60 text-[10px] font-bold tracking-[0.2em] uppercase mb-5">Areas we hire in</p>
              <div className="space-y-3">
                {roles.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                    <span className="text-white font-semibold text-sm">{r}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/40 text-xs mt-6">Engineering · Design · Growth · Support</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-3xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-gray-400 text-[10px] font-bold tracking-[0.2em] uppercase">Open positions</p>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">0 open</span>
                </div>
                <p className="text-gray-900 font-bold text-lg leading-snug mb-2">Nothing listed<br />right now</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  We don&apos;t always post publicly. Send an email anyway — we read everything.
                </p>
              </div>
              <a href="https://www.nexcodenova.com/careers"
                target="_blank" rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 text-[#6B3FD9] font-bold text-xs hover:gap-2.5 transition-all">
                View & apply on NexCode Nova <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* ── Contact ── */}
          <div className="relative bg-gray-900 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative p-10 md:p-14">
              <p className="text-[#9B6FF9] text-[11px] font-bold tracking-[0.2em] uppercase mb-4">Get in touch</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-4">
                Think you&apos;d be<br />
                <span style={{ color: '#9B6FF9' }}>a good fit?</span>
              </h2>
              <p className="text-gray-400 text-base mb-10 max-w-md leading-relaxed">
                Send your resume, a portfolio link, or just tell us what you work on.
                No cover letter needed — we read everything.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a href="https://www.nexcodenova.com/careers" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-bold px-6 py-3.5 rounded-xl transition text-sm">
                  <ArrowUpRight className="w-4 h-4" />
                  Apply on NexCode Nova
                </a>
                <a href="mailto:careers@nexcodenova.com"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3.5 rounded-xl transition text-sm">
                  <Mail className="w-4 h-4" />
                  careers@nexcodenova.com
                </a>
              </div>

              <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row gap-6">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#9B6FF9] flex-shrink-0" />
                  <div>
                    <p className="text-white font-semibold text-sm">Sri Lanka · Dubai</p>
                    <p className="text-gray-500 text-xs">Fairan Pvt Ltd · NexCode Nova</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#9B6FF9] flex-shrink-0" />
                  <div>
                    <p className="text-white font-semibold text-sm">careers@nexcodenova.com</p>
                    <p className="text-gray-500 text-xs">Handled by NexCode Nova team</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
