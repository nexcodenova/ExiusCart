'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { shopApi, subscriptionApi } from '@/lib/api';
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Lock,
  Receipt,
  Percent,
  Calculator,
  Webhook,
  ChevronRight,
  Loader2,
  Check,
} from 'lucide-react';

type SettingsTab = 'general' | 'tax' | 'security' | 'notifications';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxSaved, setTaxSaved] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [isTheDersiSeller, setIsTheDersiSeller] = useState(false);

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [settings, setSettings] = useState({
    language: 'en',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    theme: 'system',
    vatEnabled: false,
    vatRate: 0,
    pricesIncludeVat: false,
    showVatBreakdown: false,
    emailNotifications: true,
    pushNotifications: true,
    orderAlerts: true,
    lowStockAlerts: true,
    twoFactorEnabled: false,
  });

  useEffect(() => {
    shopApi.getMyShop().then((res) => {
      const shop = res.data;
      setSettings((prev) => ({
        ...prev,
        currency: shop.currency ?? 'AED',
        vatEnabled: shop.vat_enabled ?? false,
        vatRate: shop.vat_rate ?? 0,
        pricesIncludeVat: shop.prices_include_vat ?? false,
        showVatBreakdown: shop.show_vat_breakdown ?? false,
      }));
    }).catch(() => {});

    if (shopId) {
      subscriptionApi.getCurrent(shopId)
        .then((r) => {
          const plan = r.data?.plan?.plan_type || '';
          const isDersi = plan.startsWith('thedersi');
          setIsTheDersiSeller(isDersi);
          if (isDersi) {
            setSettings((prev) => ({ ...prev, currency: 'LKR' }));
          }
        })
        .catch(() => {});
    }
  }, [shopId]);

  const handleSaveGeneral = async () => {
    setGeneralSaving(true);
    try {
      await shopApi.updateShop({ currency: isTheDersiSeller ? 'LKR' : settings.currency });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 3000);
    } catch {
      alert('Failed to save settings.');
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleSaveTax = async () => {
    setTaxSaving(true);
    try {
      await shopApi.updateShop({
        vat_enabled: settings.vatEnabled,
        vat_rate: settings.vatRate,
        prices_include_vat: settings.pricesIncludeVat,
        show_vat_breakdown: settings.showVatBreakdown,
      });
      setTaxSaved(true);
      setTimeout(() => setTaxSaved(false), 3000);
    } catch {
      alert('Failed to save tax settings.');
    } finally {
      setTaxSaving(false);
    }
  };

  const tabs = [
    { id: 'general' as SettingsTab, label: 'General', icon: Settings },
    { id: 'tax' as SettingsTab, label: 'Tax & VAT', icon: Receipt },
    { id: 'security' as SettingsTab, label: 'Security', icon: Shield },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your shop preferences</p>
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border p-1.5">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* General Settings */}
      {/* Quick links to sub-settings pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/dashboard/settings/webhooks"
          className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:border-primary/50 transition group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Webhook className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">API Webhooks</p>
              <p className="text-xs text-muted-foreground">Real-time event notifications</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
        </Link>
        <Link href="/dashboard/settings/product-fields"
          className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:border-primary/50 transition group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Product Fields</p>
              <p className="text-xs text-muted-foreground">Custom attributes for products</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
        </Link>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Regional Settings
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="language-select" className="text-sm text-muted-foreground mb-1.5 block">Language</label>
                <select
                  id="language-select"
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
              <div>
                <label htmlFor="currency-select" className="text-sm text-muted-foreground mb-1.5 block">
                  Currency {isTheDersiSeller && <span className="text-xs text-indigo-500 ml-1">(TheDersi — locked to LKR)</span>}
                </label>
                {isTheDersiSeller ? (
                  <div className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground flex items-center gap-2 cursor-not-allowed">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    LKR - Sri Lanka Rupee
                  </div>
                ) : (
                  <select
                    id="currency-select"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                  >
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="LKR">LKR - Sri Lanka Rupee</option>
                    <option value="BDT">BDT - Bangladeshi Taka</option>
                    <option value="PKR">PKR - Pakistani Rupee</option>
                    <option value="MYR">MYR - Malaysian Ringgit</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="QAR">QAR - Qatari Riyal</option>
                    <option value="KWD">KWD - Kuwaiti Dinar</option>
                    <option value="BHD">BHD - Bahraini Dinar</option>
                    <option value="OMR">OMR - Omani Rial</option>
                    <option value="EGP">EGP - Egyptian Pound</option>
                    <option value="NGN">NGN - Nigerian Naira</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="ZAR">ZAR - South African Rand</option>
                    <option value="TRY">TRY - Turkish Lira</option>
                    <option value="IDR">IDR - Indonesian Rupiah</option>
                    <option value="PHP">PHP - Philippine Peso</option>
                    <option value="THB">THB - Thai Baht</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="timezone-select" className="text-sm text-muted-foreground mb-1.5 block">Timezone</label>
                <select
                  id="timezone-select"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                >
                  <option value="Asia/Dubai">Dubai (GMT+4)</option>
                  <option value="Asia/Riyadh">Riyadh (GMT+3)</option>
                  <option value="Asia/Colombo">Colombo (GMT+5:30)</option>
                  <option value="Asia/Kolkata">India (GMT+5:30)</option>
                  <option value="Asia/Karachi">Karachi (GMT+5)</option>
                  <option value="Asia/Dhaka">Dhaka (GMT+6)</option>
                  <option value="Asia/Kuala_Lumpur">Kuala Lumpur (GMT+8)</option>
                  <option value="Asia/Singapore">Singapore (GMT+8)</option>
                  <option value="Asia/Jakarta">Jakarta (GMT+7)</option>
                  <option value="Asia/Manila">Manila (GMT+8)</option>
                  <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
                  <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                  <option value="Asia/Shanghai">Shanghai (GMT+8)</option>
                  <option value="Asia/Kuwait">Kuwait (GMT+3)</option>
                  <option value="Asia/Qatar">Qatar (GMT+3)</option>
                  <option value="Asia/Bahrain">Bahrain (GMT+3)</option>
                  <option value="Asia/Muscat">Muscat (GMT+4)</option>
                  <option value="Africa/Cairo">Cairo (GMT+3)</option>
                  <option value="Africa/Lagos">Lagos (GMT+1)</option>
                  <option value="Africa/Nairobi">Nairobi (GMT+3)</option>
                  <option value="Africa/Johannesburg">Johannesburg (GMT+2)</option>
                  <option value="Europe/London">London (GMT+0/+1)</option>
                  <option value="Europe/Paris">Paris (GMT+1/+2)</option>
                  <option value="Europe/Istanbul">Istanbul (GMT+3)</option>
                  <option value="America/New_York">New York (GMT-5/-4)</option>
                  <option value="America/Los_Angeles">Los Angeles (GMT-8/-7)</option>
                  <option value="America/Toronto">Toronto (GMT-5/-4)</option>
                  <option value="Australia/Sydney">Sydney (GMT+10/+11)</option>
                </select>
              </div>
              <div>
                <label htmlFor="theme-select" className="text-sm text-muted-foreground mb-1.5 block">Theme</label>
                <select
                  id="theme-select"
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveGeneral}
                disabled={generalSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-60"
              >
                {generalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : generalSaved ? <Check className="w-4 h-4" /> : null}
                {generalSaved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax & VAT Settings */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          {/* VAT Configuration */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              VAT Configuration
            </h2>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-foreground font-medium">Tax / VAT Configuration</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enable VAT only if your country requires it. Disable to charge no tax.
              </p>
            </div>

            <div className="space-y-6">
              {/* VAT Enabled Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Enable VAT</p>
                  <p className="text-sm text-muted-foreground">Apply VAT to transactions</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, vatEnabled: !settings.vatEnabled })}
                  aria-label={`Enable VAT - currently ${settings.vatEnabled ? 'on' : 'off'}`}
                  className={`relative w-12 h-6 rounded-full transition ${
                    settings.vatEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    settings.vatEnabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {settings.vatEnabled && (
                <>
                  {/* VAT Rate */}
                  <div>
                    <label htmlFor="vatRate" className="text-sm text-muted-foreground mb-1.5 block">VAT Rate (%)</label>
                    <select
                      id="vatRate"
                      title="VAT Rate"
                      value={settings.vatRate}
                      onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) })}
                      className="w-full sm:w-48 px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                    >
                      <option value={0}>0% (Exempt / No Tax)</option>
                      <option value={5}>5%</option>
                      <option value={8}>8%</option>
                      <option value={10}>10%</option>
                      <option value={15}>15%</option>
                      <option value={18}>18%</option>
                      <option value={20}>20%</option>
                    </select>
                  </div>

                  {/* Prices Include VAT - IMPORTANT SETTING */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calculator className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          <p className="font-semibold text-foreground">Prices Include VAT</p>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {settings.pricesIncludeVat
                            ? "Your product prices already include VAT. No extra VAT will be added at checkout."
                            : "Your product prices do NOT include VAT. 5% VAT will be added at checkout."
                          }
                        </p>
                        <div className="bg-background/50 rounded-lg p-3 text-xs">
                          <p className="font-medium text-foreground mb-1">Example: product priced at 1,000 {settings.currency}</p>
                          {settings.pricesIncludeVat ? (
                            <div className="text-muted-foreground space-y-0.5">
                              <p>• Customer pays: <span className="text-foreground font-medium">1,000 {settings.currency}</span></p>
                              <p>• VAT included: <span className="text-foreground">{(1000 * (settings.vatRate / 100) / (1 + settings.vatRate / 100)).toFixed(2)} {settings.currency}</span></p>
                              <p>• Net price: <span className="text-foreground">{(1000 / (1 + settings.vatRate / 100)).toFixed(2)} {settings.currency}</span></p>
                            </div>
                          ) : (
                            <div className="text-muted-foreground space-y-0.5">
                              <p>• Product price: <span className="text-foreground">1,000 {settings.currency}</span></p>
                              <p>• VAT ({settings.vatRate}%): <span className="text-foreground">+{(1000 * settings.vatRate / 100).toFixed(2)} {settings.currency}</span></p>
                              <p>• Customer pays: <span className="text-foreground font-medium">{(1000 + 1000 * settings.vatRate / 100).toFixed(2)} {settings.currency}</span></p>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, pricesIncludeVat: !settings.pricesIncludeVat })}
                        aria-label={`Prices include VAT - currently ${settings.pricesIncludeVat ? 'on' : 'off'}`}
                        className={`relative w-14 h-7 rounded-full transition flex-shrink-0 ${
                          settings.pricesIncludeVat ? 'bg-green-500' : 'bg-muted'
                        }`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow ${
                          settings.pricesIncludeVat ? 'left-8' : 'left-1'
                        }`} />
                      </button>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 font-medium">
                      {settings.pricesIncludeVat ? '✓ Recommended for UAE retail shops' : '⚠️ VAT will be added to all prices at checkout'}
                    </p>
                  </div>

                  {/* Show VAT Breakdown */}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-foreground">Show VAT Breakdown on Receipt</p>
                      <p className="text-sm text-muted-foreground">Display VAT amount separately on invoices</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, showVatBreakdown: !settings.showVatBreakdown })}
                      aria-label={`Show VAT breakdown on receipt - currently ${settings.showVatBreakdown ? 'on' : 'off'}`}
                      className={`relative w-12 h-6 rounded-full transition ${
                        settings.showVatBreakdown ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        settings.showVatBreakdown ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tax Registration Info */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Tax Registration</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">TRN (Tax Registration Number)</label>
                <input
                  type="text"
                  placeholder="100123456789003"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">15-digit TRN from Federal Tax Authority</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Trade License Number</label>
                <input
                  type="text"
                  placeholder="TL-2024-123456"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveTax}
              disabled={taxSaving}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-60"
            >
              {taxSaving ? 'Saving...' : taxSaved ? 'Saved!' : 'Save Tax Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Password
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="current-password" className="text-sm text-muted-foreground mb-1.5 block">Current Password</label>
                <input
                  type="password"
                  id="current-password"
                  placeholder="Enter current password"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-password" className="text-sm text-muted-foreground mb-1.5 block">New Password</label>
                  <input
                    type="password"
                    id="new-password"
                    placeholder="Enter new password"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="text-sm text-muted-foreground mb-1.5 block">Confirm Password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground"
                  />
                </div>
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition"
              >
                Update Password
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, twoFactorEnabled: !settings.twoFactorEnabled })}
                aria-label={`Two-Factor Authentication - currently ${settings.twoFactorEnabled ? 'on' : 'off'}`}
                className={`relative w-12 h-6 rounded-full transition ${
                  settings.twoFactorEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  settings.twoFactorEnabled ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notification Preferences
            </h2>
            <div className="space-y-4">
              {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                { key: 'pushNotifications', label: 'Push Notifications', desc: 'Browser push notifications' },
                { key: 'orderAlerts', label: 'Order Alerts', desc: 'Get notified for new orders' },
                { key: 'lowStockAlerts', label: 'Low Stock Alerts', desc: 'Alert when stock is low' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key as keyof typeof settings] })}
                    aria-label={`${item.label} - currently ${settings[item.key as keyof typeof settings] ? 'on' : 'off'}`}
                    className={`relative w-12 h-6 rounded-full transition ${
                      settings[item.key as keyof typeof settings] ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      settings[item.key as keyof typeof settings] ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
