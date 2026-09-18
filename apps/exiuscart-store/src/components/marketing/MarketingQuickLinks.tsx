import Link from 'next/link';
import {
  Rocket, Target, Users2, Mail, MessageSquare, MessageCircle, Undo2, Share2,
  Megaphone, BookOpen, FormInput, Sparkles, Calendar, ClipboardCheck, BarChart3,
} from 'lucide-react';

const LINKS: { href: string; label: string; description: string; icon: React.ElementType }[] = [
  { href: '/dashboard/campaigns', label: 'Campaigns', description: 'All your Email/SMS/WhatsApp/Social campaigns in one place', icon: Rocket },
  { href: '/dashboard/leads', label: 'Lead Management', description: 'Every captured lead, scored hot to cold', icon: Target },
  { href: '/dashboard/customer-segments', label: 'Customer Segments', description: 'Group customers by behavior for targeted sends', icon: Users2 },
  { href: '/dashboard/email-marketing', label: 'Email Marketing', description: 'Build and send email campaigns', icon: Mail },
  { href: '/dashboard/sms-marketing', label: 'SMS Marketing', description: 'Text campaigns via your own Twilio account', icon: MessageSquare },
  { href: '/dashboard/whatsapp-marketing', label: 'WhatsApp Marketing', description: 'Approved template broadcasts via your own WABA', icon: MessageCircle },
  { href: '/dashboard/drip-flows', label: 'Abandoned Cart & Automations', description: 'Automatic recovery flows and drip sequences', icon: Undo2 },
  { href: '/dashboard/social-posting', label: 'Social Media', description: 'Schedule posts to Facebook, Instagram, TikTok', icon: Share2 },
  { href: '/dashboard/ads', label: 'Ads', description: "Research real running ads on Meta's Ad Library", icon: Megaphone },
  { href: '/dashboard/blog', label: 'Blog', description: 'Publish content to drive organic traffic', icon: BookOpen },
  { href: '/dashboard/signup-forms', label: 'Signup Forms', description: 'Embeddable forms that feed leads in', icon: FormInput },
  { href: '/dashboard/popups', label: 'Smart Upsells', description: 'On-site popups and upsell offers', icon: Sparkles },
  { href: '/dashboard/events', label: 'Events', description: 'Bookable events and appointment slots', icon: Calendar },
  { href: '/dashboard/surveys', label: 'Surveys', description: 'Collect structured customer feedback', icon: ClipboardCheck },
  { href: '/dashboard/storefront-insights', label: 'Storefront Insights', description: 'Live visitor and browsing activity', icon: BarChart3 },
];

export default function MarketingQuickLinks() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {LINKS.map(({ href, label, description, icon: Icon }) => (
        <Link key={href} href={href}
          className="flex items-start gap-3 border border-border rounded-xl p-4 bg-card hover:border-primary/50 hover:shadow-sm transition">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
