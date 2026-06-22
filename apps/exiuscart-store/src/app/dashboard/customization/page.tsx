'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Paintbrush, Receipt, Palette, Upload, Type, AlignLeft,
  CheckCircle, ChevronRight, Store, Phone, Mail, Globe,
  Image as ImageIcon, FileText, Sliders,
} from 'lucide-react';
import { shopApi } from '@/lib/api';

type Tab = 'branding' | 'invoice' | 'receipt' | 'theme';

const COLOR_PRESETS = [
  { name: 'Indigo',  primary: '#6366f1', accent: '#818cf8' },
  { name: 'Blue',    primary: '#3b82f6', accent: '#60a5fa' },
  { name: 'Emerald', primary: '#10b981', accent: '#34d399' },
  { name: 'Orange',  primary: '#f97316', accent: '#fb923c' },
  { name: 'Rose',    primary: '#f43f5e', accent: '#fb7185' },
  { name: 'Violet',  primary: '#8b5cf6', accent: '#a78bfa' },
  { name: 'Teal',    primary: '#14b8a6', accent: '#2dd4bf' },
  { name: 'Amber',   primary: '#f59e0b', accent: '#fbbf24' },
];

const FONT_OPTIONS = ['Inter', 'Roboto', 'Poppins', 'Nunito', 'Open Sans', 'Lato', 'Montserrat'];

export default function CustomizationPage() {
  const [tab, setTab] = useState<Tab>('branding');
  const [saved, setSaved] = useState(false);

  // Branding
  const [shopName, setShopName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');

  // Theme
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [accentColor, setAccentColor] = useState('#818cf8');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [borderRadius, setBorderRadius] = useState('12');

  // Invoice
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [invoiceFooter, setInvoiceFooter] = useState('Thank you for your business!');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showTaxNum, setShowTaxNum] = useState(true);

  // Receipt
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('Thank you, visit again!');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptWebsite, setReceiptWebsite] = useState('');
  const [printCopies, setPrintCopies] = useState('1');

  useEffect(() => {
    shopApi.getMyShop().then(res => {
      const s = res.data;
      setShopName(s.name || '');
      setTagline(s.tagline || '');
      setLogoUrl(s.logo_url || '');
      setReceiptPhone(s.phone || '');
      setReceiptEmail(s.email || '');
      setReceiptWebsite(s.website || '');
    }).catch(() => {});
  }, []);

  function applyPreset(idx: number) {
    setSelectedPreset(idx);
    setPrimaryColor(COLOR_PRESETS[idx].primary);
    setAccentColor(COLOR_PRESETS[idx].accent);
  }

  async function handleSave() {
    try {
      const payload: any = { name: shopName };
      if (tagline) payload.tagline = tagline;
      if (logoUrl) payload.logo_url = logoUrl;
      await shopApi.updateShop(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'branding', label: 'Branding',      icon: Store     },
    { key: 'theme',    label: 'Theme & Colors', icon: Palette   },
    { key: 'invoice',  label: 'Invoice',        icon: FileText  },
    { key: 'receipt',  label: 'Receipt',        icon: Receipt   },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customization</h1>
          <p className="text-sm text-muted-foreground">Personalize your store without writing a single line of code</p>
        </div>
        <button onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Paintbrush className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Left nav */}
        <aside className="lg:w-52 shrink-0">
          <nav className="bg-card border border-border rounded-xl p-2 space-y-0.5">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
            <div className="pt-2 border-t border-border mt-2">
              <Link href="/dashboard/settings/product-fields"
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition">
                <div className="flex items-center gap-3"><Sliders className="w-4 h-4" /> Custom Fields</div>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 bg-card border border-border rounded-xl p-6 space-y-6">

          {/* ── BRANDING ── */}
          {tab === 'branding' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Store Branding</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Store Name</label>
                  <input value={shopName} onChange={e => setShopName(e.target.value)}
                    placeholder="My Awesome Store"
                    className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tagline</label>
                  <input value={tagline} onChange={e => setTagline(e.target.value)}
                    placeholder="Quality products at great prices"
                    className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Appears on invoices and receipts</p>
                </div>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Logo URL</label>
                  <div className="flex gap-3 items-start">
                    <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                      placeholder="https://yourdomain.com/logo.png"
                      className="flex-1 max-w-md px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                    {logoUrl && (
                      <img src={logoUrl} alt="Logo preview" className="w-12 h-12 object-contain border border-border rounded-lg bg-muted" />
                    )}
                    {!logoUrl && (
                      <div className="w-12 h-12 border border-dashed border-border rounded-lg flex items-center justify-center bg-muted">
                        <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Provide a URL to your logo image (PNG, SVG recommended)</p>
                </div>

                {/* Favicon */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Favicon URL</label>
                  <input value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)}
                    placeholder="https://yourdomain.com/favicon.ico"
                    className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Small icon shown in browser tab (32×32 px)</p>
                </div>
              </div>

              {/* Quick links */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">More Settings</p>
                <div className="space-y-1">
                  {[
                    { href: '/dashboard/settings', label: 'General Settings (currency, language, timezone)' },
                    { href: '/dashboard/settings', label: 'Tax & VAT Settings' },
                    { href: '/dashboard/settings/product-fields', label: 'Custom Product Fields' },
                    { href: '/dashboard/settings/webhooks', label: 'Webhook Integrations' },
                  ].map(({ href, label }) => (
                    <Link key={label} href={href}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition">
                      <span>{label}</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── THEME ── */}
          {tab === 'theme' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Theme &amp; Colors</h2>
              <p className="text-sm text-muted-foreground -mt-2">Changes are applied to your dashboard and storefront.</p>

              {/* Color Presets */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">Color Presets</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {COLOR_PRESETS.map((p, i) => (
                    <button key={p.name} onClick={() => applyPreset(i)}
                      title={p.name}
                      className={`relative h-10 rounded-lg transition ring-2 ring-offset-2 ${selectedPreset === i ? 'ring-foreground ring-offset-card' : 'ring-transparent hover:ring-border'}`}
                      style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}>
                      {selectedPreset === i && (
                        <CheckCircle className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Selected: {COLOR_PRESETS[selectedPreset].name}</p>
              </div>

              {/* Custom colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); setSelectedPreset(-1); }}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-background p-0.5" />
                    <input value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); setSelectedPreset(-1); }}
                      className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={accentColor} onChange={e => { setAccentColor(e.target.value); setSelectedPreset(-1); }}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-background p-0.5" />
                    <input value={accentColor} onChange={e => { setAccentColor(e.target.value); setSelectedPreset(-1); }}
                      className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground font-mono" />
                  </div>
                </div>
              </div>

              {/* Font */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Font Family</label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Border radius */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Border Radius — <span className="font-mono text-primary">{borderRadius}px</span>
                </label>
                <input type="range" min="0" max="24" step="2" value={borderRadius}
                  onChange={e => setBorderRadius(e.target.value)}
                  className="w-full max-w-xs accent-primary" />
                <div className="flex gap-3 mt-3">
                  {['0', '4', '8', '12', '16', '24'].map(v => (
                    <div key={v} className="w-10 h-10 border-2 border-primary/40 bg-primary/10"
                      style={{ borderRadius: `${v}px` }} title={`${v}px`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Preview of different radius values</p>
              </div>

              {/* Preview */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button style={{ backgroundColor: primaryColor, borderRadius: `${borderRadius}px` }}
                    className="px-4 py-2 text-white text-sm font-medium">
                    Primary Button
                  </button>
                  <button style={{ backgroundColor: accentColor, borderRadius: `${borderRadius}px` }}
                    className="px-4 py-2 text-white text-sm font-medium">
                    Accent Button
                  </button>
                  <span style={{ color: primaryColor, fontFamily, borderRadius: `${borderRadius}px` }}
                    className="text-lg font-bold">
                    {shopName || 'Your Store Name'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── INVOICE ── */}
          {tab === 'invoice' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Invoice Template</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Invoice Number Prefix</label>
                  <input value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)}
                    placeholder="INV-"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground font-mono" />
                  <p className="text-xs text-muted-foreground mt-1">Example: {invoicePrefix}0001</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Show on Invoice</p>
                {[
                  { label: 'Company Logo', val: showLogo, set: setShowLogo },
                  { label: 'Business Address', val: showAddress, set: setShowAddress },
                  { label: 'Tax Registration Number', val: showTaxNum, set: setShowTaxNum },
                ].map(({ label, val, set }) => (
                  <label key={label} className="flex items-center justify-between px-4 py-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50">
                    <span className="text-sm text-foreground">{label}</span>
                    <div onClick={() => set(!val)}
                      className={`w-10 h-5 rounded-full transition relative cursor-pointer ${val ? 'bg-primary' : 'bg-muted'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${val ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Footer Message</label>
                <input value={invoiceFooter} onChange={e => setInvoiceFooter(e.target.value)}
                  placeholder="Thank you for your business!"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Additional Notes / Terms</label>
                <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)}
                  rows={3} placeholder="Payment due within 30 days. Late payments subject to 1.5% monthly interest..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground resize-none" />
              </div>

              {/* Invoice preview */}
              <div className="border border-border rounded-xl p-5 bg-white dark:bg-zinc-900 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain mb-2" />}
                    <p className="font-bold text-foreground text-lg">{shopName || 'Your Store'}</p>
                    {tagline && <p className="text-xs text-muted-foreground">{tagline}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-xl">INVOICE</p>
                    <p className="text-sm text-muted-foreground">{invoicePrefix}0001</p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded p-2">
                    {['Item', 'Qty', 'Total'].map(h => <span key={h} className="font-medium">{h}</span>)}
                    {['Sample Product', '2', '100.00'].map((v, i) => <span key={i}>{v}</span>)}
                  </div>
                  {invoiceFooter && <p className="mt-3 text-center italic">{invoiceFooter}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── RECEIPT ── */}
          {tab === 'receipt' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">POS Receipt Template</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Header Text</label>
                  <input value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)}
                    placeholder="Welcome to our store!"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Footer Message</label>
                  <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)}
                    placeholder="Thank you, visit again!"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </label>
                  <input value={receiptPhone} onChange={e => setReceiptPhone(e.target.value)}
                    placeholder="+XX X XXX XXXX"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <input value={receiptEmail} onChange={e => setReceiptEmail(e.target.value)}
                    placeholder="info@yourstore.com"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Website
                  </label>
                  <input value={receiptWebsite} onChange={e => setReceiptWebsite(e.target.value)}
                    placeholder="www.yourstore.com"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Print Copies</label>
                  <select value={printCopies} onChange={e => setPrintCopies(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    <option value="1">1 copy</option>
                    <option value="2">2 copies</option>
                    <option value="3">3 copies</option>
                  </select>
                </div>
              </div>

              {/* Receipt preview */}
              <div className="max-w-xs border border-border rounded-xl p-4 bg-white dark:bg-zinc-900 text-center space-y-2 mx-auto font-mono text-xs">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain mx-auto" />}
                <p className="font-bold text-base text-foreground">{shopName || 'Your Store'}</p>
                {receiptHeader && <p className="text-muted-foreground">{receiptHeader}</p>}
                <div className="border-t border-dashed border-border pt-2 space-y-1 text-left">
                  <div className="flex justify-between"><span>Sample Item</span><span>50.00</span></div>
                  <div className="flex justify-between"><span>Another Item</span><span>30.00</span></div>
                  <div className="flex justify-between border-t border-dashed border-border pt-1 font-bold">
                    <span>TOTAL</span><span>80.00</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-border pt-2 text-muted-foreground space-y-0.5">
                  {receiptPhone && <p><Phone className="w-3 h-3 inline mr-1" />{receiptPhone}</p>}
                  {receiptEmail && <p><Mail className="w-3 h-3 inline mr-1" />{receiptEmail}</p>}
                  {receiptWebsite && <p><Globe className="w-3 h-3 inline mr-1" />{receiptWebsite}</p>}
                  {receiptFooter && <p className="italic pt-1">{receiptFooter}</p>}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
