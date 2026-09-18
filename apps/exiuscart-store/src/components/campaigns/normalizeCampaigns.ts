export interface UnifiedCampaign {
  id: string;
  channel: 'Email' | 'SMS' | 'WhatsApp' | 'Social';
  title: string;
  status: string;
  date: string | null; // best available timestamp — sent > scheduled > created
  recipients: number | null;
  href: string;
}

// Each channel's campaign model shapes its own status/timestamp fields
// slightly differently (see marketing.py's EmailCampaign/SMSCampaign,
// whatsapp_marketing.py's WhatsAppCampaign, social_posting.py's SocialPost)
// — this is the one place that difference gets flattened into one list so
// the Campaigns page can sort/filter across all four without each widget
// needing to know about the others.
export function normalizeEmail(rows: any[]): UnifiedCampaign[] {
  return rows.map((c) => ({
    id: `email-${c.id}`, channel: 'Email', title: c.subject || c.name, status: c.status,
    date: c.sent_at || c.scheduled_at || c.created_at || null,
    recipients: c.recipients_count ?? null, href: '/dashboard/email-marketing',
  }));
}

export function normalizeSms(rows: any[]): UnifiedCampaign[] {
  return rows.map((c) => ({
    id: `sms-${c.id}`, channel: 'SMS', title: c.name, status: c.status,
    date: c.sent_at || c.scheduled_at || c.created_at || null,
    recipients: c.recipients_count ?? null, href: '/dashboard/sms-marketing',
  }));
}

export function normalizeWhatsApp(rows: any[]): UnifiedCampaign[] {
  return rows.map((c) => ({
    id: `whatsapp-${c.id}`, channel: 'WhatsApp', title: c.name, status: c.status,
    date: c.sent_at || c.created_at || null,
    recipients: c.total_recipients ?? null, href: '/dashboard/whatsapp-marketing',
  }));
}

export function normalizeSocial(rows: any[]): UnifiedCampaign[] {
  return rows.map((p) => ({
    id: `social-${p.id}`, channel: 'Social', title: p.caption?.slice(0, 60) || '(no caption)', status: p.status,
    date: p.published_at || p.scheduled_at || null,
    recipients: null, href: '/dashboard/social-posting',
  }));
}
