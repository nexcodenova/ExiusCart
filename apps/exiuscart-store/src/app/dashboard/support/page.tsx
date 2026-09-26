'use client';

import { useState } from 'react';
import { ArrowUpRight, Clock, HelpCircle, Mail, MessageCircle, Phone, ClipboardList, MessageSquarePlus, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// The same contact details as exiuscart.com/contact.
const WHATSAPP_NUMBER = '971562393573';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi ExiusCart support, I need help with my store.')}`;
const EMAIL = 'support@exiuscart.com';
const PHONE_DISPLAY = '+971 562 393 573';

const CHANNELS = [
  {
    icon: MessageCircle, tint: 'bg-[#25D366]/15 text-[#25D366]', title: 'WhatsApp chat', tag: 'Fastest',
    detail: PHONE_DISPLAY, text: 'Chat with our team directly. Best for quick questions and help with setup.',
    action: { label: 'Chat on WhatsApp', href: WHATSAPP_URL },
  },
  {
    icon: Mail, tint: 'bg-primary/10 text-primary', title: 'Email', tag: null,
    detail: EMAIL, text: 'Best for billing, invoices, and longer problems where you want to send screenshots.',
    action: { label: 'Send an email', href: `mailto:${EMAIL}?subject=${encodeURIComponent('ExiusCart support')}` },
  },
  {
    icon: Phone, tint: 'bg-primary/10 text-primary', title: 'Phone', tag: null,
    detail: PHONE_DISPLAY, text: 'For something urgent that is stopping your store from selling.',
    action: { label: 'Call us', href: `tel:+${WHATSAPP_NUMBER}` },
  },
];

const HOURS = [
  { day: 'Sunday to Thursday', time: '9 AM to 6 PM' },
  { day: 'Friday', time: '9 AM to 12 PM' },
  { day: 'Saturday', time: 'Closed' },
];

const INCLUDE = [
  'Your shop name and the email you sign in with',
  'The page you were on and what you clicked',
  'A screenshot, or the exact error message you saw',
  'For orders or suppliers: the order number, or which supplier',
];

const TOPICS = [
  'Billing, plans and invoices', 'Sales channels and integrations', 'Suppliers and dropshipping',
  'Prodora and product imports', 'Amazon KDP files', 'Team members and roles', 'Store setup and products', 'Orders and fulfilment',
];

// The support team photo, same one as the login and register screens.
function SupportPhoto() {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative inline-flex">
      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#25D366]/15 text-[#25D366] ring-2 ring-[#25D366]/30">
        {failed
          ? <MessageCircle className="h-6 w-6" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src="/support/support_2.jpg" alt="ExiusCart support" className="h-full w-full object-cover" onError={() => setFailed(true)} />}
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-white ring-2 ring-card">
        <MessageCircle className="h-3 w-3" />
      </span>
    </span>
  );
}

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">Talk to the ExiusCart team. Choose the way that suits you</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {CHANNELS.map((c) => (
          <Card key={c.title}>
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between">
                {c.title === 'WhatsApp chat'
                  ? <SupportPhoto />
                  : <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.tint}`}><c.icon className="h-5 w-5" /></span>}
                {c.tag && <Badge variant="success">{c.tag}</Badge>}
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{c.title}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{c.detail}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
              </div>
              <Button asChild className="mt-auto w-full" variant={c.tag ? 'default' : 'outline'}>
                <a href={c.action.href} target={c.action.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                  {c.action.label} <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Clock className="h-4 w-4 text-muted-foreground" /> Business hours</p>
            <ul className="divide-y divide-border text-sm">
              {HOURS.map((h) => (
                <li key={h.day} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">{h.day}</span>
                  <span className="font-medium text-foreground">{h.time}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">You can message us at any time. We reply during business hours.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><ClipboardList className="h-4 w-4 text-muted-foreground" /> Get help faster: include these</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {INCLUDE.map((i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {i}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><HelpCircle className="h-4 w-4 text-muted-foreground" /> What we can help with</p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => <Badge key={t} variant="muted" className="py-1.5">{t}</Badge>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold text-foreground">More ways to get help</p>
            <a href="https://exiuscart.com/faq" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground transition hover:bg-muted">
              <span className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> Answers (FAQ)</span><ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </a>
            <a href="https://exiuscart.com/contact" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground transition hover:bg-muted">
              <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> Contact form</span><ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </a>
            <p className="flex items-start gap-2 px-3 pt-1 text-xs text-muted-foreground">
              <MessageSquarePlus className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Have an idea or found a bug? Use the Feedback button at the top of any page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
