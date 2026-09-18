'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { SmsCampaign } from './SmsCampaignList';

export default function SmsCampaignDialog({
  open, editing, onClose, onSaved,
}: { open: boolean; editing: SmsCampaign | null; onClose: () => void; onSaved: (form: { name: string; message: string }) => Promise<void> }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [message, setMessage] = useState(editing?.message ?? '');
  const [saving, setSaving] = useState(false);
  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  const save = async () => {
    if (!name.trim() || !message.trim()) return;
    setSaving(true);
    try { await onSaved({ name: name.trim(), message: message.trim() }); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Campaign' : 'New SMS Campaign'}</DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-name">Campaign Name</Label>
            <Input id="sms-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Flash Sale Alert" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-message">Message</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{charCount}/160 chars · {smsCount} SMS</span>
            </div>
            <Textarea id="sms-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              placeholder="Get 20% off today only! Use code SALE20. Reply STOP to unsubscribe." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim() || !message.trim()}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
