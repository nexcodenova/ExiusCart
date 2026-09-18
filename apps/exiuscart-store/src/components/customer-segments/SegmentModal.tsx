'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { customerSegmentsApi } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SegmentRuleBuilder, { SegmentRules, EMPTY_RULES } from './SegmentRuleBuilder';
import type { Segment } from './SegmentCard';

export default function SegmentModal({
  shopId, editing, availableTags, availableSources, currencySymbol, onClose, onSaved,
}: {
  shopId: string; editing: Segment | null; availableTags: string[]; availableSources: string[]; currencySymbol: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [rules, setRules] = useState<SegmentRules>(editing?.rules ?? EMPTY_RULES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) { setError('Segment name is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), description: description.trim() || null, rules };
      if (editing) await customerSegmentsApi.update(shopId, editing.id, payload);
      else await customerSegmentsApi.create(shopId, payload);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not save this segment.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Segment' : 'New Customer Segment'}</DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="space-y-1.5">
            <Label htmlFor="seg-name">Segment Name</Label>
            <Input id="seg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP customers" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seg-description">Description</Label>
            <Input id="seg-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="border-t border-border pt-4">
            <SegmentRuleBuilder rules={rules} setRules={setRules} availableTags={availableTags} availableSources={availableSources} currencySymbol={currencySymbol} />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Segment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
