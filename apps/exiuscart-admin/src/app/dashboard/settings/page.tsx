'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Bell, Shield, CreditCard, Database,
  Save, Check, Loader2, Eye, EyeOff,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

type S = Record<string, any>;

function ToggleField({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#6B3FD9]' : 'bg-gray-700'}`}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === 'password';
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
        />
        {isSecret && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#151F32] rounded-xl border border-gray-800 p-6 space-y-4">
      <h2 className="text-base font-semibold text-white border-b border-gray-800 pb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getSettings().then((res) => { setS(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const set = (key: string, value: any) => setS((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateSettings(s);
      setS(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {/* no-op */}
    setSaving(false);
  };

  const tabs = [
    { id: 'general',       label: 'General',           icon: <Settings className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications',     icon: <Bell className="w-4 h-4" /> },
    { id: 'security',      label: 'Security',          icon: <Shield className="w-4 h-4" /> },
    { id: 'payment',       label: 'Payment',           icon: <CreditCard className="w-4 h-4" /> },
    { id: 'api',           label: 'API & Integrations',icon: <Database className="w-4 h-4" /> },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage platform configuration and preferences</p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving}
          className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-4 py-2.5 rounded-lg transition w-full sm:w-auto disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#151F32] border border-gray-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.id ? 'bg-[#6B3FD9] text-black' : 'text-gray-400 hover:text-white'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {/* ── General ── */}
        {activeTab === 'general' && (
          <>
            <Section title="Platform Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Platform Name" value={s.platform_name ?? ''} onChange={(v) => set('platform_name', v)} />
                <InputField label="Support Email" value={s.support_email ?? ''} onChange={(v) => set('support_email', v)} />
                <InputField label="Contact Phone" value={s.contact_phone ?? ''} onChange={(v) => set('contact_phone', v)} />
                <InputField label="Website URL" value={s.website_url ?? ''} onChange={(v) => set('website_url', v)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Platform Description</label>
                <textarea
                  value={s.platform_description ?? ''}
                  onChange={(e) => set('platform_description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition resize-none"
                />
              </div>
            </Section>
          </>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'notifications' && (
          <>
            <Section title="Email Notifications">
              <ToggleField label="New Store Registration" description="Receive email when a new store registers" checked={s.notify_new_store ?? true} onChange={(v) => set('notify_new_store', v)} />
              <ToggleField label="Payment Received" description="Receive email for successful payments" checked={s.notify_payment_received ?? true} onChange={(v) => set('notify_payment_received', v)} />
              <ToggleField label="Payment Pending Approval" description="Receive email when bank transfer needs approval" checked={s.notify_payment_pending ?? true} onChange={(v) => set('notify_payment_pending', v)} />
              <ToggleField label="Subscription Expiring" description="Receive email for subscriptions expiring in 7 days" checked={s.notify_subscription_expiring ?? true} onChange={(v) => set('notify_subscription_expiring', v)} />
              <ToggleField label="Support Tickets" description="Alert for new support tickets" checked={s.notify_support_tickets ?? false} onChange={(v) => set('notify_support_tickets', v)} />
            </Section>
            <Section title="Admin Alerts">
              <ToggleField label="System Errors" description="Alert when system errors occur" checked={s.alert_system_errors ?? true} onChange={(v) => set('alert_system_errors', v)} />
              <ToggleField label="High Traffic Warning" description="Alert when traffic exceeds normal levels" checked={s.alert_high_traffic ?? true} onChange={(v) => set('alert_high_traffic', v)} />
              <ToggleField label="Failed Login Attempts" description="Alert for multiple failed login attempts" checked={s.alert_failed_logins ?? true} onChange={(v) => set('alert_failed_logins', v)} />
            </Section>
            <Section title="Notification Recipients">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Primary Email" value={s.notification_email_primary ?? ''} onChange={(v) => set('notification_email_primary', v)} />
                <InputField label="Secondary Email (optional)" value={s.notification_email_secondary ?? ''} onChange={(v) => set('notification_email_secondary', v)} placeholder="Optional backup email" />
              </div>
            </Section>
          </>
        )}

        {/* ── Security ── */}
        {activeTab === 'security' && (
          <>
            <Section title="Session Settings">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Session Timeout (minutes)" value={String(s.session_timeout_minutes ?? 30)} onChange={(v) => set('session_timeout_minutes', parseInt(v) || 30)} />
                <InputField label="Max Active Sessions" value={String(s.max_active_sessions ?? 3)} onChange={(v) => set('max_active_sessions', parseInt(v) || 3)} />
              </div>
            </Section>
            <Section title="Two-Factor Authentication">
              <ToggleField label="Require 2FA for Admins" description="Force two-factor authentication for all admin users" checked={s.require_2fa_admins ?? true} onChange={(v) => set('require_2fa_admins', v)} />
              <ToggleField label="Require 2FA for Store Owners" description="Force two-factor authentication for store owners" checked={s.require_2fa_store_owners ?? false} onChange={(v) => set('require_2fa_store_owners', v)} />
            </Section>
          </>
        )}

        {/* ── Payment ── */}
        {activeTab === 'payment' && (
          <>
            <Section title="Lemon Squeezy (Direct Seller Payments)">
              <p className="text-xs text-gray-500 -mt-2">Used when ExiusCart direct sellers pay for their subscription. Worldwide payments, no company registration needed.</p>
              <div className="space-y-4">
                <InputField label="API Key" value={s.lemonsqueezy_api_key ?? ''} onChange={(v) => set('lemonsqueezy_api_key', v)} type="password" placeholder="eyJ0eXAiOiJKV1Qi..." />
                <InputField label="Store ID" value={s.lemonsqueezy_store_id ?? ''} onChange={(v) => set('lemonsqueezy_store_id', v)} placeholder="12345" />
                <InputField label="Webhook Secret" value={s.lemonsqueezy_webhook_secret ?? ''} onChange={(v) => set('lemonsqueezy_webhook_secret', v)} type="password" placeholder="whsec_..." />
              </div>
              <div className="mt-2 bg-[#0B1121] rounded-lg px-4 py-3 text-xs text-gray-400">
                Set your webhook endpoint in Lemon Squeezy to:{' '}
                <span className="text-[#6B3FD9] font-mono">https://api.exiuscart.com/api/v1/webhooks/lemonsqueezy</span>
              </div>
            </Section>

            <Section title="Bank Transfer">
              <ToggleField label="Accept Bank Transfers" description="Allow customers to pay via manual bank transfer" checked={s.bank_transfer_enabled ?? true} onChange={(v) => set('bank_transfer_enabled', v)} />
              {s.bank_transfer_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <InputField label="Bank Name" value={s.bank_name ?? ''} onChange={(v) => set('bank_name', v)} placeholder="e.g. Emirates NBD" />
                  <InputField label="Account Name" value={s.account_name ?? ''} onChange={(v) => set('account_name', v)} placeholder="Your name / company name" />
                  <InputField label="Account Number" value={s.account_number ?? ''} onChange={(v) => set('account_number', v)} />
                  <InputField label="IBAN" value={s.iban ?? ''} onChange={(v) => set('iban', v)} placeholder="AExx xxxx xxxx xxxx xxxx xxx" />
                  <InputField label="SWIFT / BIC Code" value={s.swift_code ?? ''} onChange={(v) => set('swift_code', v)} placeholder="e.g. EABORAED" />
                  <InputField label="Branch" value={s.branch ?? ''} onChange={(v) => set('branch', v)} placeholder="e.g. Dubai Main Branch" />
                </div>
              )}
            </Section>

            <Section title="Invoice Settings">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Invoice Prefix" value={s.invoice_prefix ?? 'INV-'} onChange={(v) => set('invoice_prefix', v)} />
                <InputField label="VAT / TRN Number" value={s.vat_number ?? ''} onChange={(v) => set('vat_number', v)} placeholder="TRN123456789" />
                <InputField label="VAT Rate — AED orders (%)" value={String(s.vat_rate_aed ?? 5)} onChange={(v) => set('vat_rate_aed', parseFloat(v) || 0)} />
                <InputField label="VAT Rate — USD orders (%)" value={String(s.vat_rate_usd ?? 0)} onChange={(v) => set('vat_rate_usd', parseFloat(v) || 0)} />
              </div>
              <ToggleField label="Auto-generate Invoices" description="Automatically generate invoices for payments" checked={s.auto_generate_invoices ?? true} onChange={(v) => set('auto_generate_invoices', v)} />
              <div className="bg-[#0B1121] rounded-lg px-4 py-3 text-xs text-gray-400 mt-2">
                AED invoices include {s.vat_rate_aed ?? 5}% VAT &nbsp;·&nbsp; USD invoices include {s.vat_rate_usd ?? 0}% VAT (export rule)
              </div>
            </Section>
          </>
        )}

        {/* ── API & Integrations ── */}
        {activeTab === 'api' && (
          <>
            <Section title="Partner Integrations">
              <p className="text-sm text-gray-400">
                External platforms like <span className="text-white font-medium">TheDersi</span> connect to ExiusCart via the Partner API.
                Their sellers are provisioned automatically when they sign up on TheDersi.
              </p>
              <div className="bg-[#0B1121] rounded-lg px-4 py-3 space-y-2 text-xs font-mono text-gray-400">
                <p><span className="text-[#6B3FD9]">POST</span> /api/v1/partner/thedersi/provision</p>
                <p><span className="text-[#6B3FD9]">PUT</span>  /api/v1/partner/thedersi/upgrade</p>
                <p><span className="text-[#6B3FD9]">GET</span>  /api/v1/partner/thedersi/status</p>
              </div>
              <p className="text-xs text-gray-500">Partner API key and HMAC secret are set in the server <span className="font-mono text-gray-400">.env</span> file on the droplet.</p>
            </Section>

            <Section title="External Store Connection (Coming Soon)">
              <p className="text-sm text-gray-400">
                Future feature: store owners on Shopify or custom platforms will be able to install an ExiusCart plugin to sync their products, orders, and inventory with ExiusCart.
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 px-3 py-2 rounded-lg">
                Planned — not yet available
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
