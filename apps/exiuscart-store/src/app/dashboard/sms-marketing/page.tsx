'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Loader2, Lock, Plus, X } from 'lucide-react';
import { smsApi, marketingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import SmsUsageCard, { SmsUsage } from '@/components/sms-marketing/SmsUsageCard';
import SmsCampaignList, { SmsCampaign } from '@/components/sms-marketing/SmsCampaignList';
import SmsCampaignDialog from '@/components/sms-marketing/SmsCampaignDialog';

function shopIdFromStorage() { return typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1'; }

// Sent via ExiusCart's own centralized Twilio account (wholesale, not
// BYOK — see app/core/sms.py's docstring for why) — no "connect your
// account" step, unlike WhatsApp Marketing. Just a plan quota.
export default function SmsMarketingPage() {
  const confirm = useConfirm();
  const [shopId, setShopId] = useState('');
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<SmsUsage | null>(null);
  const [locked, setLocked] = useState(false);
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<SmsCampaign | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [banner, setBanner] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = (sid: string) => {
    setLoading(true);
    Promise.all([smsApi.getUsage(sid), marketingApi.getSmsCampaigns(sid)])
      .then(([usageRes, campaignsRes]) => {
        setUsage(usageRes.data);
        setLocked(usageRes.data.daily_limit === 0 && usageRes.data.monthly_limit === 0);
        setCampaigns(campaignsRes.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (shopId) load(shopId); }, [shopId]);

  const openNew = () => { setEditing(null); setShowDialog(true); };
  const openEdit = (c: SmsCampaign) => { setEditing(c); setShowDialog(true); };

  const handleSave = async (form: { name: string; message: string }) => {
    if (editing) await marketingApi.updateSmsCampaign(shopId, editing.id, form);
    else await marketingApi.createSmsCampaign(shopId, form);
    setShowDialog(false);
    load(shopId);
  };

  const handleSend = async (id: number) => {
    if (!(await confirm({ title: 'Send this campaign to every customer with a phone number on file?' }))) return;
    setSendingId(id);
    try {
      const r = await marketingApi.sendSmsCampaign(shopId, id);
      const skipped = r.data.skipped_for_quota ? ` — ${r.data.skipped_for_quota} skipped (quota reached)` : '';
      setBanner(`Sent ${r.data.sent} of ${r.data.total} — ${r.data.failed} failed${skipped}.`);
      load(shopId);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === 'upgrade_required') setLocked(true);
      else setBanner(detail?.message ?? detail ?? 'Could not send this campaign.');
    } finally { setSendingId(null); }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm({ title: 'Delete this campaign?', variant: 'destructive' }))) return;
    await marketingApi.deleteSmsCampaign(shopId, id);
    load(shopId);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }

  if (locked) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">SMS Marketing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Broadcast text campaigns to every customer with a phone number on file.</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-14 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Upgrade to send SMS</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
              SMS marketing is available on Launch, Growth, and Scale — sent through ExiusCart's own account, no setup required on your end.
            </p>
            <Button asChild className="mt-6"><Link href="/dashboard/billing">Upgrade to unlock</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">SMS Marketing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Broadcast text campaigns to every customer with a phone number on file.</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4" /> New Campaign</Button>
      </div>

      {banner && (
        <div className="flex items-center justify-between gap-2 text-sm bg-muted text-muted-foreground rounded-lg px-3 py-2.5">
          <span>{banner}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBanner('')}><X className="w-3.5 h-3.5" /></Button>
        </div>
      )}

      {usage && <SmsUsageCard usage={usage} />}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Campaigns</h2>
        <SmsCampaignList campaigns={campaigns} sendingId={sendingId} onEdit={openEdit} onSend={handleSend} onDelete={handleDelete} />
      </div>

      <SmsCampaignDialog open={showDialog} editing={editing} onClose={() => setShowDialog(false)} onSaved={handleSave} />
    </div>
  );
}
