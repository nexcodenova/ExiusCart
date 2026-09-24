'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CountryFlag } from '@/components/country-flag';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { authApi, usersApi, shopApi } from '@/lib/api';

// Google/Facebook sign-ins — and the streamlined email signup — give us
// a name and email, never a phone number, country or referral code. This asks
// for them once, right after first login. It reappears next session until a
// phone number is saved, so "skip" is a postponement, not a way to never
// answer; and it never blocks the dashboard while open.
const SKIPPED_KEY = 'profile_prompt_skipped_session';
const RECENT_ACCOUNT_MS = 30 * 24 * 60 * 60 * 1000;

export function ProfileCompletionDialog() {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState('');
  const [dial, setDial] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [refCode, setRefCode] = useState('');
  const [refLocked, setRefLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try { if (sessionStorage.getItem(SKIPPED_KEY) === '1') return; } catch {}
    let cancelled = false;
    (async () => {
      try {
        const [me, shop] = await Promise.all([usersApi.getMe(), shopApi.getMyShop().catch(() => null)]);
        if (cancelled || me.data?.phone) return;
        // Only recent accounts — long-standing ones that never gave a phone
        // (e.g. provisioned by a partner) shouldn't be nagged every session.
        const age = me.data?.created_at ? Date.now() - new Date(me.data.created_at).getTime() : 0;
        if (age > RECENT_ACCOUNT_MS) return;
        const c = (me.data?.country || shop?.data?.country || '').toString().toUpperCase();
        const match = COUNTRY_OPTIONS.find((o) => o.code === c);
        if (match) { setCountry(match.code); setDial(match.dialCode); }
        setShopName(shop?.data?.name ?? '');
        // A code carried over from an affiliate link (set on the marketing site).
        const m = document.cookie.match(/exiuscart_ref=([^;]+)/);
        if (m?.[1]) { setRefCode(decodeURIComponent(m[1])); }
        if (me.data?.referred_by_code) { setRefCode(me.data.referred_by_code); setRefLocked(true); }
        setOpen(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const onCountry = (code: string) => {
    setCountry(code);
    const opt = COUNTRY_OPTIONS.find((o) => o.code === code);
    if (opt) setDial(opt.dialCode);
  };

  const skip = () => {
    try { sessionStorage.setItem(SKIPPED_KEY, '1'); } catch {}
    setOpen(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    setSaving(true);
    try {
      const res = await authApi.completeProfile({
        phone: `${dial}${phone.replace(/^0+/, '')}`,
        country: country || undefined,
        shop_name: shopName.trim() || undefined,
        ref_code: refLocked ? undefined : refCode.trim() || undefined,
      });
      // Keep the header/greeting in step with what was just saved.
      try { localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user') || '{}'), ...res.data.user })); } catch {}
      setOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skip(); }}>
      <DialogContent className="max-w-md">
        <form onSubmit={save} className="space-y-4 p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-foreground">Finish setting up your store</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              A few details so invoices, currency and support are right from day one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="pc-shop">Store name</Label>
            <Input id="pc-shop" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Your store name" />
          </div>

          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={country || undefined} onValueChange={onCountry}>
              <SelectTrigger><SelectValue placeholder="Select your country" /></SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-2"><CountryFlag code={c.code} /> {c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-phone">Phone number</Label>
            <div className="flex gap-2">
              <Select value={dial || undefined} onValueChange={setDial}>
                <SelectTrigger className="w-32 shrink-0"><SelectValue placeholder="+" /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.dialCode}>
                      <span className="flex items-center gap-2"><CountryFlag code={c.code} /> {c.dialCode}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input id="pc-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="50 123 4567" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-ref">Referral code <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="pc-ref" value={refCode} onChange={(e) => setRefCode(e.target.value)} disabled={refLocked}
              placeholder="e.g. JOHN8F2A" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={skip}>Skip for now</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and continue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
