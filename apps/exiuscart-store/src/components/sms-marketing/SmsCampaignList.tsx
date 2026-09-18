import { Send, Trash2, Edit2, Loader2, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface SmsCampaign {
  id: number; name: string; message: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipients_count: number; delivered_count: number;
  created_at: string | null; sent_at: string | null;
}

const STATUS_VARIANT: Record<SmsCampaign['status'], { variant: 'muted' | 'success' | 'default'; label: string; className?: string }> = {
  draft: { variant: 'muted', label: 'Draft' },
  sending: { variant: 'default', label: 'Sending…', className: 'bg-amber-500/10 text-amber-600' },
  sent: { variant: 'success', label: 'Sent' },
  failed: { variant: 'default', label: 'Failed', className: 'bg-destructive/10 text-destructive' },
};

export default function SmsCampaignList({
  campaigns, sendingId, onEdit, onSend, onDelete,
}: {
  campaigns: SmsCampaign[];
  sendingId: number | null;
  onEdit: (c: SmsCampaign) => void;
  onSend: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (!campaigns.length) {
    return (
      <Card>
        <CardContent className="py-14 flex flex-col items-center text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No SMS campaigns yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {campaigns.map((c) => {
        const meta = STATUS_VARIANT[c.status] ?? STATUS_VARIANT.draft;
        return (
          <Card key={c.id}>
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <Badge variant={meta.variant} className={meta.className}>{meta.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {c.message}
                  {c.status !== 'draft' && (
                    <span className="ml-2">
                      · {c.delivered_count} delivered
                      {c.recipients_count > c.delivered_count && (
                        <span className="text-destructive"> · {c.recipients_count - c.delivered_count} failed</span>
                      )}
                    </span>
                  )}
                </p>
              </div>
              {c.status === 'draft' && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(c)}><Edit2 className="w-4 h-4" /></Button>
                  <Button size="sm" onClick={() => onSend(c.id)} disabled={sendingId === c.id}>
                    {sendingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)} className="hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
