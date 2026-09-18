'use client';

import { useState } from 'react';
import { ChevronDown, Edit2, Trash2, Loader2, Users2 } from 'lucide-react';
import { customerSegmentsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { describeRules } from './describeRules';
import type { SegmentRules } from './SegmentRuleBuilder';

interface Member { id: number; name: string; email: string | null; order_count: number; ltv: number }
export interface Segment { id: number; name: string; description: string | null; rules: SegmentRules; member_count: number }

export default function SegmentCard({
  segment, shopId, fmt, onEdit, onDeleted,
}: { segment: Segment; shopId: string; fmt: (n: number) => string; onEdit: () => void; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && members === null) {
      setLoadingMembers(true);
      try {
        const r = await customerSegmentsApi.get(shopId, segment.id);
        setMembers(r.data.members ?? []);
      } catch { setMembers([]); } finally { setLoadingMembers(false); }
    }
    setExpanded((v) => !v);
  };

  const del = async () => {
    if (!confirm(`Delete the "${segment.name}" segment? This doesn't delete any customers.`)) return;
    setDeleting(true);
    try { await customerSegmentsApi.delete(shopId, segment.id); onDeleted(); } finally { setDeleting(false); }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Users2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{segment.name}</p>
            <Badge variant="muted">{segment.member_count} customers</Badge>
          </div>
          {segment.description && <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>}
          <p className="text-xs text-muted-foreground mt-1.5">{describeRules(segment.rules, fmt)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit}><Edit2 className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={del} disabled={deleting} className="hover:text-destructive">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleExpand}>
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </CardContent>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {loadingMembers ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : !members?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No customers currently match this segment.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm py-1.5">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium truncate">{m.name}</p>
                    {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span>{m.order_count} orders</span>
                    <span className="font-medium text-foreground">{fmt(m.ltv)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
