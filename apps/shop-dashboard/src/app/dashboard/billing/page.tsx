'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard, Check, Crown, Zap, Users, BarChart3,
  MessageCircle, Shield, AlertTriangle, Download,
  Receipt, Plus, Star, Loader2, Globe, ChevronDown,
  Coins, Lock,
} from 'lucide-react';

// ── Pricing config ─────────────────────────────────────────────────────────────
type Currency = 'AED' | 'LKR' | 'USD';

const CURRENCY_META: Record<Currency, { symbol: string; flag: string; country: string; paymentNote: string }> = {
  AED: { symbol: 'AED', flag: '🇦🇪', country: 'United Arab Emirates', paymentNote: 'UAE bank cards only (Visa / Mastercard issued in UAE)' },
  LKR: { symbol: 'LKR', flag: '🇱🇰', country: 'Sri Lanka',            paymentNote: 'Sri Lankan bank cards only (Visa / Mastercard issued in Sri Lanka)' },
  USD: { symbol: 'USD', flag: '🌍',   country: 'International',        paymentNote: 'International Visa / Mastercard accepted' },
};

const PLAN_PRICING: Record<Currency, { starter: number; pro: number; enterprise: number; extraStaff: number }> = {
  AED: { starter: 99,    pro: 199,    enterprise: 399,    extraStaff: 59    },
  LKR: { starter: 7900,  pro: 15900,  enterprise: 31900,  extraStaff: 4900  },
  USD: { starter: 27,    pro: 54,     enterprise: 109,    extraStaff: 16    },
};

function fmt(amount: number, currency: Currency) {
  if (currency === 'LKR') return `LKR ${amount.toLocaleString()}`;
  if (currency === 'AED') return `AED ${amount}`;
  return `$${amount}`;
}

function getCurrencyFromCountry(countryCode: string): Currency {
  if (countryCode === 'AE') return 'AED';
  if (countryCode === 'LK') return 'LKR';
  return 'USD';
}

const makePlans = (currency: Currency) => {
  const p = PLAN_PRICING[currency];
  return [
    {
      id: 'starter', name: 'Starter', price: p.starter, period: 'month',
      description: 'Perfect for small shops getting started',
      features: [
        { text: '1 Staff Account', included: true },
        { text: 'Up to 100 Products', included: true },
        { text: 'Basic POS', included: true },
        { text: 'Invoice Generation', included: true },
        { text: 'Basic Reports', included: true },
        { text: 'WhatsApp Integration', included: false },
        { text: 'Multi-device Login', included: false },
        { text: 'Priority Support', included: false },
      ],
      popular: false,
    },
    {
      id: 'pro', name: 'Pro', price: p.pro, period: 'month',
      description: 'Best for growing businesses',
      features: [
        { text: '2 Staff Accounts', included: true },
        { text: 'Unlimited Products', included: true },
        { text: 'Advanced POS', included: true },
        { text: 'Invoice Generation', included: true },
        { text: 'Advanced Reports & Analytics', included: true },
        { text: 'WhatsApp Integration', included: true },
        { text: '2 Device Login per User', included: true },
        { text: 'Priority Support', included: false },
      ],
      popular: true,
    },
    {
      id: 'enterprise', name: 'Enterprise', price: p.enterprise, period: 'month',
      description: 'For large operations with multiple staff',
      features: [
        { text: '5 Staff Accounts', included: true },
        { text: 'Unlimited Products', included: true },
        { text: 'Advanced POS + Inventory', included: true },
        { text: 'Custom Invoice Branding', included: true },
        { text: 'Full Analytics Suite', included: true },
        { text: 'WhatsApp Business API', included: true },
        { text: 'Unlimited Device Login', included: true },
        { text: '24/7 Priority Support', included: true },
      ],
      popular: false,
    },
  ];
};

// ── Component ──────────────────────────────────────────────────────────────────
import { useCurrency } from '@/components/providers/currency-provider';

export default function BillingPage() {
  const { currency, setCurrency: setGlobalCurrency } = useCurrency();
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
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

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    import('@/lib/api').then(({ subscriptionApi }) => {
      subscriptionApi.getCurrent(shopId)
        .then((res) => {
          setCurrentPlan(res.data?.plan ?? null);
          setBillingHistory(res.data?.history ?? []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [shopId]);

  const plans = makePlans(currency);
  const meta = CURRENCY_META[currency];

  function changeCurrency(c: Currency) {
    setGlobalCurrency(c);
    setShowCurrencyPicker(false);
  }

  const handleUpgrade = (planId: string) => {
    setSelectedPlan(planId);
    setUpgradeSuccess('');
    setUpgradeError('');
    setSelectedPayment('card');
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan || !shopId) return;
    if (selectedPayment === 'dkc') return; // Coming Soon — do nothing
    setUpgradeLoading(true);
    setUpgradeError('');
    try {
      const { subscriptionApi } = await import('@/lib/api');
      await subscriptionApi.requestUpgrade(shopId, selectedPlan);
      const plan = plans.find(p => p.id === selectedPlan);
      setUpgradeSuccess(`Upgrade to ${plan?.name} requested! Our team will activate it shortly.`);
    } catch (err: any) {
      setUpgradeError(err.response?.data?.detail || 'Failed to submit upgrade request');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm">Manage your plan and billing</p>
        </div>

        {/* Currency Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl bg-card hover:bg-muted transition text-sm font-medium text-foreground"
          >
            <span className="text-lg">{meta.flag}</span>
            <span>{currency}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showCurrencyPicker ? 'rotate-180' : ''}`} />
          </button>

          {showCurrencyPicker && (
            <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl z-20 w-72 overflow-hidden">
              <div className="p-3 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Your Region</p>
              </div>
              {(Object.entries(CURRENCY_META) as [Currency, typeof CURRENCY_META.AED][]).map(([code, m]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => changeCurrency(code)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition text-left ${currency === code ? 'bg-primary/5' : ''}`}
                >
                  <span className="text-2xl">{m.flag}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{m.country}</p>
                    <p className="text-xs text-muted-foreground">{m.paymentNote}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${currency === code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {code}
                  </span>
                </button>
              ))}
            </div>
          )}
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

      {/* Trial Warning */}
      {currentPlan?.daysLeft != null && currentPlan.daysLeft <= 7 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Trial Ending Soon</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your trial ends in {currentPlan.daysLeft} days. Upgrade now to continue using all features.
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
                  {currentPlan.price} {currency}/month • Next billing: {formatDate(currentPlan.nextBilling)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddStaffModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">
                <Plus className="w-4 h-4" /> Add Staff
              </button>
              <button type="button" onClick={() => handleUpgrade('enterprise')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
                <Zap className="w-4 h-4" /> Upgrade
              </button>
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
              <span className="font-bold text-foreground">{fmt(PLAN_PRICING[currency].extraStaff, currency)}/month</span> each.
              Each staff member gets their own login with up to 2 device access.
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Available Plans</h2>
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span className="text-lg">{meta.flag}</span> Prices in {currency}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id}
              className={`bg-card rounded-xl border-2 p-6 relative ${plan.popular ? 'border-primary' : 'border-border'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </span>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm"> {currency}/{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {f.included
                      ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />}
                    <span className={f.included ? 'text-foreground' : 'text-muted-foreground'}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => handleUpgrade(plan.id)}
                disabled={plan.name === currentPlan?.name}
                className={`w-full py-3 rounded-lg font-medium transition ${
                  plan.name === currentPlan?.name
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}>
                {plan.name === currentPlan?.name ? 'Current Plan' : 'Select Plan'}
              </button>
            </div>
          ))}
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
                  {fmt(PLAN_PRICING[currency].extraStaff, currency)}
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
                  <span className="text-xl font-bold text-primary">{fmt(extraStaffCount * PLAN_PRICING[currency].extraStaff, currency)}</span>
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
                <h2 className="text-lg font-semibold text-foreground">Confirm Upgrade</h2>
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
                  {/* Plan summary */}
                  <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Upgrading to</p>
                      <p className="text-xl font-bold text-foreground">{plan.name} Plan</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{plan.price.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{currency}/month</p>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
                    <div className="space-y-2">
                      {/* Card */}
                      <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${selectedPayment === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <input type="radio" name="payment" value="card" checked={selectedPayment === 'card'} onChange={() => setSelectedPayment('card')} className="accent-primary" />
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Bank Card</p>
                          <p className="text-xs text-muted-foreground">{meta.paymentNote}</p>
                        </div>
                      </label>

                      {/* DKC */}
                      <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-not-allowed transition opacity-60 border-border`}>
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
                    Your upgrade request will be sent to our team. We&apos;ll activate your new plan within 24 hours after payment confirmation.
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
                      Request Upgrade
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
