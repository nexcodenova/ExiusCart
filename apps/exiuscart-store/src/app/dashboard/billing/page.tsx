'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard, Check, Crown, Zap, Users, BarChart3,
  MessageCircle, Shield, AlertTriangle, Download,
  Receipt, Plus, Star, Loader2, Globe,
  Coins, Lock, ShoppingBag, ExternalLink, Package,
  GitBranch, Percent, Tag, Clock, HardDrive, Sparkles,
  TrendingUp, BadgeCheck, ArrowRight, Infinity,
  ChevronRight, Calendar, DollarSign, Rocket, LifeBuoy,
} from 'lucide-react';
import Link from 'next/link';
import { symFor, type Currency } from '@/components/providers/currency-provider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Pricing config ─────────────────────────────────────────────────────────────
// ExiusCart's own Launch/Growth/Scale subscription is billed by Lemon
// Squeezy in USD ONLY, worldwide — one real price, no region-detected
// conversion — same reason apps/exiuscart-website/src/config/pricing.ts is
// USD-only. This used to vary by the shop's own operational currency (the
// currency they invoice THEIR customers in, from useCurrency()), which was
// a real bug: a UAE shop billed in AED would see a converted "AED 92/month"
// price here that had nothing to do with what Lemon Squeezy actually
// charges their card. Mirrors pricing.ts exactly.
const PAYMENT_NOTE = 'Visa / Mastercard accepted worldwide';

// ExiusCart's own plans are "launch"/"growth"/"scale" everywhere — in code,
// in the database, and here — never "starter"/"premium" (retired names).
const PLAN_RANK: Record<string, number> = { free_trial: 0, launch: 1, growth: 2, scale: 3 };
const TD_RANK:   Record<string, number> = { free: 0, growth: 1, pro: 2 };

// Advertised product ceiling per plan — real marketing copy already used in
// each plan's feature list below (e.g. "Up to 1,000 products"), not a
// server-enforced cap (PLAN_CATALOGUE tracks staff limits but not products).
// Paired with the real product count from /subscription/usage so the
// sidebar's usage bar shows a genuine count against a genuine plan promise.
const PRODUCT_CAP: Record<string, number | null> = { free_trial: 25, launch: 1000, growth: 10000, scale: null };

// Mirrors apps/exiuscart-website/src/config/pricing.ts exactly — the one
// real price Lemon Squeezy actually charges.
const PLAN_PRICING = { launch: 14.99, growth: 24.99, scale: 39.99, extraStaff: 5 };

// Yearly price: 3 months free (pay for 9), matching exiuscart.com/pricing's
// real "save 25% billing yearly" — 1 - 9/12 = exactly 25%.
function yearlyPrice(monthly: number): number {
  return monthly * 9;
}

function fmtPlanPrice(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// For displaying a REAL historical charge exactly as it was recorded
// (currentPlan.currency / billingHistory item.currency) — some existing
// subscriptions predate the USD-only pivot and were genuinely charged in
// another currency. Never converted, just formatted with the right symbol.
function fmtRecordedAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = symFor((currency as Currency) || 'USD');
  return sym.length <= 1 ? `${sym}${formatted}` : `${sym} ${formatted}`;
}

type BillingPeriod = 'monthly' | 'yearly';

// Feature lists mirror what the backend actually enforces (products.py
// PLAN_PRODUCT_LIMITS, customers.py CUSTOMER_LIMITS, thedersi.py
// MONTHLY_ORDER_LIMITS, usage.py EMAIL_LIMITS, sms_marketing.py SMS_LIMITS,
// channel_limits.py, dropshipping.py SUPPLIER_LIMIT_BY_PLAN, and the plan
// catalogue's staff counts) — update both together. Storage is deliberately
// not listed: there is no storage quota in the app, so any GB figure was an
// unenforced promise.
//
// Trial model: there is no separate "Free Trial" plan. Every account starts
// on a real plan with everything that plan includes, no restrictions:
//   Launch          - 7 days free, no card, then the monthly fee
//   Growth / Scale  - $1 for the first 7 days, then the monthly fee
const makePlans = (period: BillingPeriod) => {
  const p = PLAN_PRICING;
  const useYearly = period === 'yearly';
  const launchPrice = useYearly ? yearlyPrice(p.launch) : p.launch;
  const growthPrice = useYearly ? yearlyPrice(p.growth) : p.growth;
  const scalePrice = useYearly ? yearlyPrice(p.scale) : p.scale;
  const periodLabel = useYearly ? 'year' : 'month';
  return [
    {
      id: 'launch',
      name: 'Launch',
      price: launchPrice,
      priceLabel: fmtPlanPrice(launchPrice),
      period: periodLabel,
      trialNote: '7 days free, no card needed',
      description: 'For growing stores ready to scale',
      badge: null,
      features: [
        { text: '3 staff accounts',                            included: true  },
        { text: 'Up to 1,000 products',                        included: true  },
        { text: 'Up to 5,000 customers',                       included: true  },
        { text: '1,000 channel orders / month',                included: true  },
        { text: '3 sales channels (1 store, 1 marketplace, 1 digital)', included: true },
        { text: '1 dropship supplier (CJ, AliExpress or Printful)',     included: true },
        { text: 'Full POS, inventory & invoicing',             included: true  },
        { text: '1,000 invoice emails / month',                included: true  },
        { text: '250 marketing emails + 250 SMS / month',      included: true  },
        { text: 'Advanced analytics dashboards',               included: false },
        { text: 'HR, Projects, Helpdesk & AI tools',           included: false },
      ],
      popular: false,
    },
    {
      id: 'growth',
      name: 'Growth',
      price: growthPrice,
      priceLabel: fmtPlanPrice(growthPrice),
      period: periodLabel,
      trialNote: '$1 for your first 7 days',
      description: 'More channels, more suppliers, more room to grow',
      badge: 'Most Popular',
      features: [
        { text: '6 staff accounts',                            included: true  },
        { text: 'Up to 10,000 products',                       included: true  },
        { text: 'Up to 25,000 customers',                      included: true  },
        { text: '5,000 channel orders / month',                included: true  },
        { text: '5 sales channels, any mix',                   included: true  },
        { text: '3 dropship suppliers at once',                included: true  },
        { text: 'Full POS, inventory & invoicing',             included: true  },
        { text: '5,000 invoice emails / month',                included: true  },
        { text: '1,000 marketing emails + 1,000 SMS / month',  included: true  },
        { text: 'Advanced analytics dashboards',               included: true  },
        { text: 'HR, Projects, Helpdesk & AI tools',           included: true  },
      ],
      popular: true,
    },
    {
      id: 'scale',
      name: 'Scale',
      price: scalePrice,
      priceLabel: fmtPlanPrice(scalePrice),
      period: periodLabel,
      trialNote: '$1 for your first 7 days',
      description: 'Full power for serious operations',
      badge: null,
      features: [
        { text: 'Unlimited staff accounts',                    included: true  },
        { text: 'Unlimited products & customers',              included: true  },
        { text: 'Unlimited channel orders',                    included: true  },
        { text: 'Unlimited sales channels',                    included: true  },
        { text: 'All dropship suppliers',                      included: true  },
        { text: 'Full POS, inventory & invoicing',             included: true  },
        { text: 'Unlimited invoice emails, marketing emails & SMS', included: true },
        { text: 'Advanced analytics dashboards',               included: true  },
        { text: 'HR, Projects, Helpdesk & AI tools',           included: true  },
        { text: 'Wholesale B2B portal',                        included: true  },
        { text: 'Priority support',                            included: true  },
      ],
      popular: false,
    },
  ];
};

// ── TheDersi plans ─────────────────────────────────────────────────────────────
// Listings/orders/marketing-email numbers mirror the backend's enforced limits
// (products.py PLAN_PRODUCT_LIMITS, thedersi.py MONTHLY_ORDER_LIMITS,
// usage.py EMAIL_LIMITS + the Pro overrides) — update both together.
// Commission, approval and payout terms are TheDersi's own, not enforced here.
const THEDERSI_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'LKR 0',
    priceSub: '10% commission per sale',
    badge: null,
    color: 'border-border',
    btnColor: 'border border-border text-foreground hover:bg-muted',
    upgradeSlug: null,
    features: [
      { text: 'Up to 25 product listings',        ok: true  },
      { text: '25 orders / month',                ok: true  },
      { text: '10 marketing emails / month',      ok: true  },
      { text: 'Your own storefront page',         ok: true  },
      { text: 'Sales dashboard',                  ok: true  },
      { text: '24hr approval',                    ok: true  },
      { text: 'Bi-weekly payout',                 ok: true  },
      { text: 'Priority approval',                ok: false },
      { text: 'Verified seller badge',            ok: false },
    ],
  },
  {
    id: 'growth', // internal id unchanged — TheDersi renamed the tier's display name from "Growth" to "Lite", not its identity
    name: 'Lite',
    price: 'LKR 799',
    priceSub: '8% commission + LKR 799/mo',
    badge: 'Popular',
    color: 'border-indigo-500',
    btnColor: 'bg-indigo-600 text-white hover:bg-indigo-700',
    upgradeSlug: 'growth',
    features: [
      { text: 'Up to 500 product listings',     ok: true  },
      { text: '500 orders / month',             ok: true  },
      { text: '100 marketing emails / month',     ok: true  },
      { text: 'Your own storefront page',         ok: true  },
      { text: 'Sales dashboard',                  ok: true  },
      { text: 'Priority approval',                ok: true  },
      { text: 'Verified seller badge',            ok: true  },
      { text: 'Bi-weekly payout',                 ok: true  },
      { text: 'Priority placement in search',     ok: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'LKR 1,699',
    priceSub: '5% commission + LKR 1,699/mo',
    badge: 'Best Value',
    color: 'border-yellow-500',
    btnColor: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90',
    upgradeSlug: 'pro',
    features: [
      { text: 'Unlimited product listings',     ok: true  },
      { text: 'Unlimited orders / month',         ok: true  },
      { text: '300 marketing emails / month',     ok: true  },
      { text: 'Your own storefront page',         ok: true  },
      { text: 'Sales dashboard',                  ok: true  },
      { text: 'Priority approval',                ok: true  },
      { text: 'Verified seller badge',            ok: true  },
      { text: 'Payout every Monday',              ok: true  },
      { text: 'Priority placement in search',     ok: true  },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'dkc'>('card');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [extraStaffCount, setExtraStaffCount] = useState(1);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState('');
  const [upgradeError, setUpgradeError] = useState('');
  const [isTheDersiShop, setIsTheDersiShop] = useState(false);
  const [isDowngradeFlow, setIsDowngradeFlow] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [productsUsed, setProductsUsed] = useState<number | null>(null);

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    import('@/lib/api').then(({ subscriptionApi, channelsApi }) => {
      subscriptionApi.getCurrent(shopId)
        .then((res) => {
          setCurrentPlan(res.data?.plan ?? null);
          setBillingHistory(res.data?.history ?? []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      channelsApi.getConnections(shopId)
        .then((res) => {
          setIsTheDersiShop(res.data?.some((c: any) => c.channel_type === 'thedersi') ?? false);
        })
        .catch(() => {});

      subscriptionApi.getUsage(shopId)
        .then((res) => setProductsUsed(res.data?.products_used ?? null))
        .catch(() => {});
    });
  }, [shopId]);

  const plans = makePlans(billingPeriod);

  // TheDersi Pro shares plan_type="launch" (and their internal "Official"
  // tier shares "scale") with real direct ExiusCart customers — safe here
  // since this whole block only ever runs for a confirmed TheDersi shop
  // (isTheDersiShop, set from real channel connections above).
  const theDersiPlanType = currentPlan?.plan_type ?? 'thedersi_free_forever';
  const theDersiCurrentId =
    theDersiPlanType === 'launch' || theDersiPlanType === 'scale' ? 'pro' :
    theDersiPlanType === 'thedersi_lite' ? 'growth' :
    'free';


  const handleUpgrade = (planId: string, downgrade = false) => {
    setSelectedPlan(planId);
    setIsDowngradeFlow(downgrade);
    setUpgradeSuccess('');
    setUpgradeError('');
    setSelectedPayment('card');
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan || !shopId) return;
    if (selectedPayment === 'dkc') return;
    setUpgradeLoading(true);
    setUpgradeError('');
    try {
      const { subscriptionApi } = await import('@/lib/api');

      // Real paid upgrades (not downgrades, not free trial) go through Lemon
      // Squeezy checkout — the plan only activates once payment is confirmed.
      if (!isDowngradeFlow && (selectedPlan === 'launch' || selectedPlan === 'growth' || selectedPlan === 'scale')) {
        // Growth/Scale always start with a $1, 7-day stage (no free week,
        // whether this is a fresh checkout or an existing Launch trial
        // shop switching up) — only Launch is ever a full-price checkout.
        const trialDollar = selectedPlan === 'growth' || selectedPlan === 'scale';
        const res = await subscriptionApi.createCheckout(shopId, selectedPlan, billingPeriod, trialDollar);
        if (res.data?.checkout_url) {
          window.location.href = res.data.checkout_url;
          return;
        }
        // Already had a live Lemon Squeezy subscription — the backend
        // switched it in place instead of opening a new checkout (opening
        // one anyway would have started a second, separately-billed
        // subscription). Reload to pick up the new plan everywhere.
        window.location.reload();
        return;
      }

      // Downgrades (and any other plan changes) stay as an offline request —
      // no payment is needed to move to a lower/free plan.
      await subscriptionApi.requestUpgrade(shopId, selectedPlan, billingPeriod);
      const plan = plans.find(p => p.id === selectedPlan);
      setUpgradeSuccess(
        isDowngradeFlow
          ? `Downgrade to ${plan?.name} requested. Our team will process it within 24 hours.`
          : `${plan?.name} requested! Our team will activate it within 24 hours.`
      );
    } catch (err: any) {
      setUpgradeError(err.response?.data?.detail || 'Failed to submit upgrade request');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const [portalLoading, setPortalLoading] = useState(false);
  const handleManageBilling = async () => {
    if (!shopId) return;
    setPortalLoading(true);
    try {
      const { subscriptionApi } = await import('@/lib/api');
      const res = await subscriptionApi.getBillingPortal(shopId);
      window.location.href = res.data.portal_url;
    } catch (err: any) {
      setUpgradeError(err.response?.data?.detail || 'Could not open the billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  // ── TheDersi seller experience ─────────────────────────────────────────────
  if (isTheDersiShop) {
    const currentTd = THEDERSI_PLANS.find(p => p.id === theDersiCurrentId) ?? THEDERSI_PLANS[0];

    return (
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-[1px]">
          <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/90 via-purple-950/90 to-pink-950/90 p-6 md:p-8 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-pink-500/10 pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shrink-0">
                  <ShoppingBag className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                      🇱🇰 TheDersi Seller
                    </span>
                    <span className="text-xs bg-green-400/20 text-green-300 border border-green-400/30 px-2 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">Your Seller Dashboard</h1>
                  <p className="text-indigo-200 text-sm mt-1">Powered by ExiusCart · Billing managed by TheDersi</p>
                </div>
              </div>

              <div className="md:ml-auto flex flex-col sm:flex-row gap-3">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-3 text-center">
                  <p className="text-xs text-indigo-200 mb-0.5">Current Plan</p>
                  <p className="text-lg font-bold text-white">{currentTd.name}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-3 text-center">
                  <p className="text-xs text-indigo-200 mb-0.5">Billing Currency</p>
                  <p className="text-lg font-bold text-white">🇱🇰 LKR</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LKR Advantage Strip */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: <BadgeCheck className="w-5 h-5 text-green-500" />, title: 'LKR Pricing', desc: 'Pay in Sri Lankan Rupees — no foreign exchange fees ever', bg: 'bg-green-500/5 border-green-500/20' },
            { icon: <Zap className="w-5 h-5 text-indigo-500" />,       title: 'Auto Order Sync', desc: 'TheDersi orders appear in ExiusCart instantly when paid', bg: 'bg-indigo-500/5 border-indigo-500/20' },
            { icon: <TrendingUp className="w-5 h-5 text-purple-500" />, title: 'Grow Together', desc: 'Upgrade your TheDersi plan to unlock more ExiusCart power', bg: 'bg-purple-500/5 border-purple-500/20' },
          ].map(item => (
            <div key={item.title} className={`rounded-xl border p-4 flex items-start gap-3 ${item.bg}`}>
              <div className="shrink-0 mt-0.5">{item.icon}</div>
              <div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">TheDersi Seller Plans</h2>
              <p className="text-sm text-muted-foreground">All plans billed in LKR through TheDersi — upgrade directly on their website</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {THEDERSI_PLANS.map((plan) => {
              const isCurrent = plan.id === theDersiCurrentId;
              const currentTdRank = TD_RANK[theDersiCurrentId] ?? 0;
              const thisTdRank = TD_RANK[plan.id] ?? 0;
              const isTdUpgrade = !isCurrent && thisTdRank > currentTdRank;
              const isTdDowngrade = !isCurrent && thisTdRank < currentTdRank;
              return (
                <div key={plan.id}
                  className={`relative bg-card rounded-2xl border-2 p-5 flex flex-col transition-shadow hover:shadow-lg ${isCurrent ? 'border-indigo-500 shadow-indigo-500/10 shadow-lg' : plan.color}`}>

                  {/* Badges */}
                  <div className="flex items-center justify-between mb-4">
                    {plan.badge ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        plan.badge === 'Best Value' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {plan.badge === 'Best Value' ? '⭐ ' : ''}{plan.badge}
                      </span>
                    ) : <span />}
                    {isCurrent && (
                      <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full font-semibold">
                        ✓ Your Plan
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-lg font-bold text-foreground">{plan.price}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.priceSub}</p>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {f.ok
                          ? <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/25 shrink-0 mt-0.5" />}
                        <span className={f.ok ? 'text-foreground' : 'text-muted-foreground/60'}>{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-semibold text-center border border-green-500/20">
                      ✓ Current Plan
                    </div>
                  ) : isTdUpgrade ? (
                    <a
                      href={`https://thedersi.lk/seller/upgrade?plan=${plan.upgradeSlug ?? plan.id}&ref=exiuscart`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition flex items-center justify-center gap-2 ${plan.btnColor}`}
                    >
                      Upgrade on TheDersi <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : isTdDowngrade ? (
                    <a
                      href="https://thedersi.lk/seller/account"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition flex items-center justify-center gap-2 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                    >
                      Downgrade on TheDersi <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ExiusCart Standalone Pricing Link */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 p-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Globe className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Want ExiusCart for your own store?</h3>
                <p className="text-slate-400 text-sm mt-0.5">
                  Use ExiusCart independently with AED, USD, EUR, INR or LKR billing — full pricing on our website.
                </p>
              </div>
            </div>
            <a
              href="https://exiuscart.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shrink-0"
            >
              View Pricing <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Billing note */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Billing is handled entirely by TheDersi.</span>{' '}
            When you upgrade your TheDersi plan, ExiusCart features unlock automatically within minutes.
            For billing questions or invoices, contact TheDersi support at{' '}
            <a href="https://thedersi.lk" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline">thedersi.lk</a>.
          </p>
        </div>
      </div>
    );
  }

  // ── Standard ExiusCart billing experience ──────────────────────────────────
  const staffUnlimited = (currentPlan?.staffIncluded ?? 1) === 0;
  const productCap = PRODUCT_CAP[currentPlan?.plan_type ?? 'free_trial'];
  const isScale = currentPlan?.plan_type === 'scale';
  // What was actually charged, shown exactly as recorded (currentPlan.currency)
  // — some existing subscriptions predate the USD-only pivot and were really
  // charged in another currency. Never converted to a "display currency";
  // that's exactly the same-number-different-label bug pricing.ts was
  // written to avoid.
  const planPriceDisplay = currentPlan?.price ?? 0;
  const planPriceCurrency = currentPlan?.currency || 'USD';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/settings" className="hover:text-foreground">Settings</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">Billing &amp; Subscription</span>
      </div>

      {/* Page Header + upsell banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your plan, payment methods, and billing history.</p>
        </div>

        {!isScale && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 px-5 py-4 flex items-center gap-4 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">Grow bigger with ExiusCart</p>
              <p className="text-xs text-muted-foreground">Unlock more features and scale your business.</p>
            </div>
            <Button onClick={() => handleUpgrade('scale')} className="shrink-0">Upgrade Plan</Button>
          </div>
        )}
      </div>

      {/* Payment method notice */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Lock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Payment Method</p>
          <p className="text-xs text-muted-foreground mt-0.5">{PAYMENT_NOTE}</p>
        </div>
      </div>

      {/* Pending upgrade notice */}
      {currentPlan?.status === 'pending' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Upgrade Request Received</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your upgrade request is pending review. Our team will activate it within 24 hours after payment confirmation.
            </p>
          </div>
        </div>
      )}

      {/* Trial Warning */}
      {currentPlan?.daysLeft != null && currentPlan.daysLeft <= 7 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Trial Ending Soon</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your trial ends in {currentPlan.daysLeft} day{currentPlan.daysLeft !== 1 ? 's' : ''}. Upgrade now to keep all features.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !currentPlan ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">No active subscription. Choose a plan below.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              {!currentPlan.is_trial && <Badge variant="success">Active</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Current Plan</p>
            <p className="text-lg font-bold text-foreground">{currentPlan.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentPlan.is_trial ? `${currentPlan.daysLeft ?? 0} day${currentPlan.daysLeft === 1 ? '' : 's'} left` : `Billed ${currentPlan.billing_type}`}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{currentPlan.is_trial ? 'Trial Ends' : 'Next Billing Date'}</p>
            <p className="text-lg font-bold text-foreground">{formatDate(currentPlan.nextBilling)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentPlan.daysLeft != null ? `In ${currentPlan.daysLeft} day${currentPlan.daysLeft === 1 ? '' : 's'}` : '—'}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{currentPlan.billing_type === 'yearly' ? 'Yearly Amount' : 'Monthly Amount'}</p>
            <p className="text-lg font-bold text-foreground">{currentPlan.price === 0 ? 'Free' : fmtRecordedAmount(planPriceDisplay, planPriceCurrency)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentPlan.billing_type === 'yearly' ? `That's ${fmtRecordedAmount(planPriceDisplay / 12, planPriceCurrency)}/month` : ' '}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Staff Allowance</p>
            <p className="text-lg font-bold text-foreground">{staffUnlimited ? 'Unlimited' : `Up to ${currentPlan.staffIncluded}`}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Included in your plan</p>
          </Card>
        </div>
      )}

      {/* Actions */}
      {currentPlan && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setShowAddStaffModal(true)}>
            <Plus className="w-4 h-4" /> Add Staff
          </Button>
          {!currentPlan.is_trial && (
            <Button variant="outline" onClick={handleManageBilling} disabled={portalLoading}
              title="Cancel, pause, or update your payment method on Lemon Squeezy">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Manage Billing
            </Button>
          )}
          {isScale ? (
            <Button variant="outline" onClick={() => handleUpgrade('launch', true)}
              className="border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10">
              Downgrade to Launch
            </Button>
          ) : (
            <Button onClick={() => handleUpgrade('scale')}>
              <Zap className="w-4 h-4" /> Upgrade
            </Button>
          )}
        </div>
      )}

      {/* Plans header + toggle */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Choose the Right Plan for Your Business</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Upgrade, downgrade or customize your plan anytime.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center bg-muted rounded-lg p-1 text-sm font-medium">
              <button type="button" onClick={() => setBillingPeriod('monthly')}
                className={`px-3 py-1.5 rounded-md transition ${billingPeriod === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Monthly
              </button>
              <button type="button" onClick={() => setBillingPeriod('yearly')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${billingPeriod === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Yearly
                <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">Save 25%</span>
              </button>
            </div>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
              <span className="text-lg">🌍</span> USD
            </span>
          </div>
        </div>
      </div>

      {/* Plan grid + sidebar */}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px] items-start">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.name === currentPlan?.name;
            const currentRank = PLAN_RANK[currentPlan?.plan_type ?? 'free_trial'] ?? 0;
            const thisRank = PLAN_RANK[plan.id] ?? 0;
            const isDowngrade = !isCurrent && thisRank < currentRank;
            const PlanIcon = plan.id === 'scale' ? Crown : plan.id === 'launch' ? Zap : TrendingUp;
            return (
              <Card key={plan.id}
                className={`p-5 relative flex flex-col ${plan.popular ? 'border-primary shadow-sm' : ''}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 shadow">
                      <Star className="w-3 h-3" /> {plan.badge}
                    </span>
                  </div>
                )}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${plan.popular ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <PlanIcon className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-1">
                    {plan.price === 0 ? (
                      <span className="text-2xl font-bold text-foreground">Free</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-foreground">{plan.priceLabel}</span>
                        <span className="text-muted-foreground text-sm">/{plan.period}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">{plan.trialNote}, then {plan.priceLabel}/{plan.period}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">{plan.description}</p>
                </div>
                <ul className="space-y-2.5 my-5 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {f.included
                        ? <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                      <span className={f.included ? 'text-foreground' : 'text-muted-foreground'}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent && currentPlan?.is_trial ? (
                  <Button onClick={() => handleUpgrade(plan.id)} className="w-full">
                    Subscribe to {plan.name}
                  </Button>
                ) : isCurrent ? (
                  <Button disabled variant="secondary" className="w-full">Current Plan</Button>
                ) : isDowngrade ? (
                  <Button variant="outline" onClick={() => handleUpgrade(plan.id, true)}
                    className="w-full border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10">
                    Downgrade to {plan.name}
                  </Button>
                ) : (
                  <Button onClick={() => handleUpgrade(plan.id)} variant={plan.popular ? 'default' : 'outline'} className="w-full">
                    {plan.popular ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">Payment Method</h3>
              {!currentPlan?.is_trial && (
                <button type="button" onClick={handleManageBilling} disabled={portalLoading}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-60">
                  Manage
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {currentPlan?.is_trial ? 'No card on file yet' : 'Managed securely via Lemon Squeezy'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{PAYMENT_NOTE}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border-yellow-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-bold text-foreground">Pay with DKC Coin</h3>
              <Badge className="ml-auto bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-transparent text-[10px]">Coming Soon</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pay with <span className="font-semibold text-yellow-600 dark:text-yellow-400">DKC</span>, our native coin, for up to{' '}
              <span className="font-semibold text-foreground">20% off</span>. Early access for holders.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Your Usage</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Products</span>
                  <span className="font-medium text-foreground">
                    {productsUsed ?? '—'}{productCap != null ? ` / ${productCap.toLocaleString()}` : ''}
                  </span>
                </div>
                {productCap != null && productsUsed != null && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (productsUsed / productCap) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Staff Accounts</span>
                <span className="font-medium text-foreground">{staffUnlimited ? 'Unlimited' : `Up to ${currentPlan?.staffIncluded ?? 1}`}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border">
              Extra staff accounts: {fmtPlanPrice(PLAN_PRICING.extraStaff)}/month each.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Need Help?</p>
                <p className="text-xs text-muted-foreground">Our support team is here for you.</p>
              </div>
            </div>
            <Link href="/dashboard/helpdesk" className="mt-3 inline-flex w-full">
              <Button variant="outline" className="w-full">Get Support</Button>
            </Link>
          </Card>
        </div>
      </div>

      {/* Billing History */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Billing History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">View and download your past invoices.</p>
          </div>
          <button type="button" className="text-sm text-primary hover:underline flex items-center gap-1">
            <Download className="w-4 h-4" /> Download All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {['Date','Description','Amount','Status','Invoice'].map((h, i) => (
                  <th key={h} className={`p-4 text-sm font-medium text-muted-foreground ${i >= 2 ? (i === 4 ? 'text-center' : 'text-right') : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {billingHistory.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No billing history yet.</td></tr>
              ) : billingHistory.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition">
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(item.date)}</td>
                  <td className="p-4 text-sm text-foreground">{item.description}</td>
                  <td className="p-4 text-sm text-foreground text-right font-medium">
                    {fmtRecordedAmount(item.amount, item.currency || 'USD')}
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 capitalize">{item.status}</span>
                  </td>
                  <td className="p-4 text-center">
                    <button type="button" className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                      <Receipt className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Extra Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Add Extra Staff</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Cost per extra staff</p>
                <p className="text-3xl font-bold text-foreground">
                  {fmtPlanPrice(PLAN_PRICING.extraStaff)}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Number of staff to add</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setExtraStaffCount(Math.max(1, extraStaffCount - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg text-foreground hover:bg-muted/80 transition">-</button>
                  <span className="flex-1 text-center text-2xl font-bold text-foreground">{extraStaffCount}</span>
                  <button type="button" onClick={() => setExtraStaffCount(extraStaffCount + 1)}
                    className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg text-foreground hover:bg-muted/80 transition">+</button>
                </div>
              </div>
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Monthly cost</span>
                  <span className="text-xl font-bold text-primary">{fmtPlanPrice(extraStaffCount * PLAN_PRICING.extraStaff)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-3 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
                <button type="button" onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition">Add &amp; Pay</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedPlan && (() => {
        const plan = plans.find(p => p.id === selectedPlan)!;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border w-full max-w-md">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">{isDowngradeFlow ? 'Confirm Downgrade' : 'Confirm Upgrade'}</h2>
                <button type="button" onClick={() => setShowUpgradeModal(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">✕</button>
              </div>

              {upgradeSuccess ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-green-400 text-sm font-medium">{upgradeSuccess}</p>
                  <button type="button" onClick={() => setShowUpgradeModal(false)}
                    className="mt-4 px-6 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">Close</button>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{isDowngradeFlow ? 'Downgrading to' : 'Upgrading to'}</p>
                      <p className="text-xl font-bold text-foreground">{plan.name} Plan</p>
                    </div>
                    <div className="text-right">
                      {plan.price === 0 ? (
                        <p className="text-2xl font-bold text-primary">Free</p>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-primary">{plan.priceLabel}</p>
                          <p className="text-xs text-muted-foreground">USD/{plan.period}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${selectedPayment === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <input type="radio" name="payment" value="card" checked={selectedPayment === 'card'} onChange={() => setSelectedPayment('card')} className="accent-primary" />
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Bank Card</p>
                          <p className="text-xs text-muted-foreground">{PAYMENT_NOTE}</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-not-allowed transition opacity-60 border-border">
                        <input type="radio" name="payment" value="dkc" disabled className="accent-yellow-500" />
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">DKC Crypto Coin</p>
                            <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">Coming Soon</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Up to 20% discount — launching soon!</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {isDowngradeFlow
                      ? "Your downgrade request will be sent to our team. We'll process it and adjust your plan within 24 hours."
                      : (selectedPlan === 'launch' || selectedPlan === 'growth' || selectedPlan === 'scale')
                        ? "You'll be redirected to a secure checkout page to complete payment. Your plan activates automatically the moment payment is confirmed."
                        : "Your request will be sent to our team. We'll activate your new plan within 24 hours."}
                  </p>

                  {upgradeError && (
                    <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{upgradeError}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowUpgradeModal(false)}
                      className="flex-1 py-3 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
                    <button type="button" onClick={confirmUpgrade} disabled={upgradeLoading}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                      {upgradeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isDowngradeFlow
                        ? 'Request Downgrade'
                        : (selectedPlan === 'launch' || selectedPlan === 'growth' || selectedPlan === 'scale')
                          ? 'Continue to Checkout'
                          : 'Request Upgrade'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
