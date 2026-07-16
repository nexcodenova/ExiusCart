'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard, Check, Crown, Zap, Users, BarChart3,
  MessageCircle, Shield, AlertTriangle, Download,
  Receipt, Plus, Star, Loader2, Globe,
  Coins, Lock, ShoppingBag, ExternalLink, Package,
  GitBranch, Percent, Tag, Clock, HardDrive, Sparkles,
  TrendingUp, BadgeCheck, ArrowRight, Infinity,
} from 'lucide-react';
import { useCurrency, type Currency } from '@/components/providers/currency-provider';

// ── Pricing config ─────────────────────────────────────────────────────────────
const CURRENCY_META: Record<Currency, { symbol: string; flag: string; country: string; paymentNote: string }> = {
  AED: { symbol: 'AED', flag: '🇦🇪', country: 'United Arab Emirates', paymentNote: 'UAE bank cards only (Visa / Mastercard issued in UAE)' },
  USD: { symbol: 'USD', flag: '🌍',   country: 'International',        paymentNote: 'International Visa / Mastercard accepted' },
  LKR: { symbol: 'LKR', flag: '🇱🇰', country: 'Sri Lanka',            paymentNote: 'Sri Lanka bank cards accepted' },
  EUR: { symbol: 'EUR', flag: '🇪🇺', country: 'Europe',               paymentNote: 'European Visa / Mastercard accepted' },
  INR: { symbol: 'INR', flag: '🇮🇳', country: 'India',                paymentNote: 'Indian Visa / Mastercard / UPI accepted' },
};

const PLAN_RANK: Record<string, number> = { free_trial: 0, starter: 1, premium: 2 };
const TD_RANK:   Record<string, number> = { free: 0, growth: 1, pro: 2 };

const PLAN_PRICING: Record<Currency, { starter: number; premium: number; extraStaff: number }> = {
  AED: { starter: 45,   premium: 99,   extraStaff: 15  },
  USD: { starter: 12,   premium: 29,   extraStaff: 5   },
  LKR: { starter: 3800, premium: 8900, extraStaff: 1400 },
  EUR: { starter: 11,   premium: 27,   extraStaff: 4   },
  INR: { starter: 999,  premium: 2399, extraStaff: 399 },
};

// Yearly billing is only wired up to a real Lemon Squeezy checkout for AED
// and USD (the only two currencies with live LS variants right now).
// LKR/EUR/INR are display-only currencies today — a shop on one of those
// still checks out through the AED variant regardless — so we don't offer
// a fabricated yearly price for them until that's resolved.
const YEARLY_PRICING: Partial<Record<Currency, { starter: number; premium: number }>> = {
  AED: { starter: 459, premium: 999 },
  USD: { starter: 120, premium: 290 },
};

type BillingPeriod = 'monthly' | 'yearly';

const makePlans = (currency: Currency, fmt: (n: number) => string, period: BillingPeriod) => {
  const p = PLAN_PRICING[currency];
  const yearly = YEARLY_PRICING[currency];
  const useYearly = period === 'yearly' && !!yearly;
  const starterPrice = useYearly ? yearly!.starter : p.starter;
  const premiumPrice = useYearly ? yearly!.premium : p.premium;
  const periodLabel = useYearly ? 'year' : 'month';
  return [
    {
      id: 'free_trial',
      name: 'Free Trial',
      price: 0,
      priceLabel: 'Free',
      period: '14 days',
      description: 'Explore ExiusCart risk-free',
      badge: null,
      features: [
        { text: '1 Staff account',                    included: true  },
        { text: 'Up to 25 products',                  included: true  },
        { text: '2 GB storage',                       included: true  },
        { text: 'Basic POS',                          included: true  },
        { text: '50 email invoices/month',            included: true  },
        { text: 'TheDersi order sync (50 orders/mo)', included: true  },
        { text: '1 branch / location',                included: true  },
        { text: 'Custom invoice branding',            included: false },
        { text: 'Priority support',                   included: false },
      ],
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      price: starterPrice,
      priceLabel: fmt(starterPrice),
      period: periodLabel,
      description: 'For growing shops ready to scale',
      badge: 'Most Popular',
      features: [
        { text: '3 Staff accounts',                      included: true  },
        { text: 'Up to 1,000 products',                  included: true  },
        { text: '20 GB storage',                         included: true  },
        { text: 'Full POS',                              included: true  },
        { text: '500 email invoices/month + logo',       included: true  },
        { text: 'Advanced analytics',                    included: true  },
        { text: '1 branch / location',                   included: true  },
        { text: 'TheDersi order sync (1,000 orders/mo)', included: true  },
        { text: 'Custom invoice branding',               included: false },
        { text: 'Priority email support',                included: true  },
      ],
      popular: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: premiumPrice,
      priceLabel: fmt(premiumPrice),
      period: periodLabel,
      description: 'Full power for serious operations',
      badge: null,
      features: [
        { text: 'Unlimited staff accounts',        included: true  },
        { text: 'Unlimited products',              included: true  },
        { text: '75 GB storage',                   included: true  },
        { text: 'Full POS + inventory mgmt',       included: true  },
        { text: 'Custom invoice branding',         included: true  },
        { text: 'Full analytics suite',            included: true  },
        { text: 'Multiple branches',               included: true  },
        { text: 'TheDersi order sync (unlimited)', included: true  },
        { text: 'Unlimited email invoices',        included: true  },
        { text: 'Dedicated account manager',       included: true  },
        { text: '24/7 priority support',           included: true  },
      ],
      popular: false,
    },
  ];
};

// ── TheDersi plans ─────────────────────────────────────────────────────────────
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
      { text: '50 orders / month',                ok: true  },
      { text: '50 marketing emails / month',      ok: true  },
      { text: 'Your own storefront page',         ok: true  },
      { text: 'Sales dashboard',                  ok: true  },
      { text: '24hr approval',                    ok: true  },
      { text: 'Bi-weekly payout',                 ok: true  },
      { text: 'Priority approval',                ok: false },
      { text: 'Verified seller badge',            ok: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'LKR 799',
    priceSub: '8% commission + LKR 799/mo',
    badge: 'Popular',
    color: 'border-indigo-500',
    btnColor: 'bg-indigo-600 text-white hover:bg-indigo-700',
    upgradeSlug: 'growth',
    features: [
      { text: 'Up to 1,000 product listings',     ok: true  },
      { text: '1,000 orders / month',             ok: true  },
      { text: '500 marketing emails / month',     ok: true  },
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
      { text: 'Up to 1,000 product listings',     ok: true  },
      { text: 'Unlimited orders / month',         ok: true  },
      { text: '500 marketing emails / month',     ok: true  },
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
  const { currency, fmt } = useCurrency();
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
    });
  }, [shopId]);

  const yearlyAvailable = !!YEARLY_PRICING[currency];
  const effectivePeriod: BillingPeriod = yearlyAvailable ? billingPeriod : 'monthly';
  const plans = makePlans(currency, fmt, effectivePeriod);
  const meta = CURRENCY_META[currency];

  const theDersiPlanType = currentPlan?.plan_type ?? 'thedersi_basic';
  const theDersiCurrentId =
    theDersiPlanType === 'thedersi_pro' || theDersiPlanType === 'pro' ? 'pro' :
    theDersiPlanType === 'thedersi_growth' || theDersiPlanType === 'starter' || theDersiPlanType === 'growth' ? 'growth' :
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
      if (!isDowngradeFlow && (selectedPlan === 'starter' || selectedPlan === 'premium')) {
        const res = await subscriptionApi.createCheckout(shopId, selectedPlan, effectivePeriod);
        window.location.href = res.data.checkout_url;
        return;
      }

      // Downgrades (and any other plan changes) stay as an offline request —
      // no payment is needed to move to a lower/free plan.
      await subscriptionApi.requestUpgrade(shopId, selectedPlan, effectivePeriod);
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
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm">Manage your plan and billing</p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl bg-card text-sm font-medium text-foreground">
          <span className="text-lg">{meta.flag}</span>
          <span>{currency}</span>
        </div>
      </div>

      {/* Payment method notice */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Lock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Payment Method for {meta.country}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.paymentNote}</p>
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

      {/* Current Plan */}
      <div className="bg-card rounded-xl border border-border p-6">
        {loading ? (
          <div className="h-20 bg-muted rounded-lg animate-pulse" />
        ) : !currentPlan ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">No active subscription. Choose a plan below.</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                <Crown className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{currentPlan.name} Plan</h2>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Current</span>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {currentPlan.is_trial
                    ? `Free trial${currentPlan.daysLeft != null ? ` · ${currentPlan.daysLeft} day${currentPlan.daysLeft !== 1 ? 's' : ''} left` : ''}`
                    : `${currentPlan.price} ${currency}/${currentPlan.billing_type === 'yearly' ? 'year' : 'month'}${currentPlan.nextBilling ? ` · Next billing: ${formatDate(currentPlan.nextBilling)}` : ''}`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddStaffModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">
                <Plus className="w-4 h-4" /> Add Staff
              </button>
              {!currentPlan.is_trial && (
                <button type="button" onClick={handleManageBilling} disabled={portalLoading}
                  title="Cancel, pause, or update your payment method on Lemon Squeezy"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition disabled:opacity-60">
                  {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Manage Billing
                </button>
              )}
              {currentPlan?.plan_type === 'premium' ? (
                <button type="button" onClick={() => handleUpgrade('starter', true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-500/10 transition">
                  Downgrade to Starter
                </button>
              ) : (
                <button type="button" onClick={() => handleUpgrade('premium')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
                  <Zap className="w-4 h-4" /> Upgrade
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Staff Pricing Info */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Need More Staff?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add extra staff accounts for just{' '}
              <span className="font-bold text-foreground">{fmt(PLAN_PRICING[currency].extraStaff)}/month</span> each.
              Each staff member gets their own login with up to 2-device access.
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Available Plans</h2>
          <div className="flex items-center gap-3">
            {yearlyAvailable && (
              <div className="inline-flex items-center bg-muted rounded-lg p-1 text-sm font-medium">
                <button type="button" onClick={() => setBillingPeriod('monthly')}
                  className={`px-3 py-1.5 rounded-md transition ${billingPeriod === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  Monthly
                </button>
                <button type="button" onClick={() => setBillingPeriod('yearly')}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${billingPeriod === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  Yearly
                  <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">Save ~15%</span>
                </button>
              </div>
            )}
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="text-lg">{meta.flag}</span> Prices in {currency}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.name === currentPlan?.name;
            const currentRank = PLAN_RANK[currentPlan?.plan_type ?? 'free_trial'] ?? 0;
            const thisRank = PLAN_RANK[plan.id] ?? 0;
            const isDowngrade = !isCurrent && thisRank < currentRank;
            return (
              <div key={plan.id}
                className={`bg-card rounded-xl border-2 p-6 relative ${plan.popular ? 'border-primary' : 'border-border'}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" /> {plan.badge}
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-2">
                    {plan.price === 0 ? (
                      <span className="text-3xl font-bold text-foreground">Free</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-foreground">{plan.priceLabel}</span>
                        <span className="text-muted-foreground text-sm">/{plan.period}</span>
                      </>
                    )}
                  </div>
                  {plan.id === 'free_trial' && (
                    <p className="text-xs text-orange-500 font-medium mt-1">14-day trial</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {f.text.includes('storage')
                        ? <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />
                        : f.included
                        ? <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                      <span className={f.included ? 'text-foreground' : 'text-muted-foreground'}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button disabled className="w-full py-3 rounded-lg font-medium bg-muted text-muted-foreground cursor-not-allowed">
                    Current Plan
                  </button>
                ) : plan.id === 'free_trial' ? null : isDowngrade ? (
                  <button type="button" onClick={() => handleUpgrade(plan.id, true)}
                    className="w-full py-3 rounded-lg font-medium transition border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10">
                    Downgrade to {plan.name}
                  </button>
                ) : (
                  <button type="button" onClick={() => handleUpgrade(plan.id)}
                    className={`w-full py-3 rounded-lg font-medium transition ${plan.popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border text-foreground hover:bg-muted'}`}>
                    Upgrade to {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DKC Crypto Banner */}
      <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coins className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Pay with DKC Coin</h3>
              <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Pay for your subscription using <span className="font-semibold text-yellow-600 dark:text-yellow-400">DKC</span> — our native crypto coin.
              Enjoy up to <span className="font-semibold text-foreground">20% discount</span> when paying with DKC.
              Get early access by holding DKC in your wallet.
            </p>
          </div>
          <button type="button"
            className="px-4 py-2 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-lg text-sm font-medium border border-yellow-500/30 cursor-not-allowed opacity-70"
            disabled>
            Coming Soon
          </button>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Billing History</h2>
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
                  <td className="p-4 text-sm text-foreground text-right font-medium">{item.amount} {currency}</td>
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
      </div>

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
                  {fmt(PLAN_PRICING[currency].extraStaff)}
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
                  <span className="text-xl font-bold text-primary">{fmt(extraStaffCount * PLAN_PRICING[currency].extraStaff)}</span>
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
                          <p className="text-xs text-muted-foreground">{currency}/{plan.period}</p>
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
                          <p className="text-xs text-muted-foreground">{meta.paymentNote}</p>
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
                      : (selectedPlan === 'starter' || selectedPlan === 'premium')
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
                        : (selectedPlan === 'starter' || selectedPlan === 'premium')
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
