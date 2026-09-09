import {
  ShoppingBag, Tag, Music2, Globe, ShoppingCart, CreditCard, Download, Link2, Store, Package,
} from 'lucide-react';

// Same icon/color choices already used on the Channels page's own cards —
// kept consistent so a seller recognizes a channel at a glance regardless
// of which page they're on. Real logos to be swapped in later.
export const CHANNEL_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  shopify: { label: 'Shopify', icon: ShoppingBag, color: 'text-[#96BF48]', bg: 'bg-[#96BF48]/10' },
  etsy: { label: 'Etsy', icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-600/10' },
  custom: { label: 'Custom Website', icon: Globe, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  woocommerce: { label: 'WooCommerce', icon: ShoppingCart, color: 'text-[#7F54B3]', bg: 'bg-[#7F54B3]/10' },
  bigcommerce: { label: 'BigCommerce', icon: Store, color: 'text-[#00C9A7]', bg: 'bg-[#00C9A7]/10' },
  ebay: { label: 'eBay', icon: Tag, color: 'text-[#E53238]', bg: 'bg-[#E53238]/10' },
  amazon: { label: 'Amazon', icon: Package, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  tiktok: { label: 'TikTok Shop', icon: Music2, color: 'text-foreground', bg: 'bg-foreground/10' },
  noon: { label: 'Noon', icon: ShoppingBag, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  daraz: { label: 'Daraz', icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  thedersi: { label: 'TheDersi', icon: Link2, color: 'text-primary', bg: 'bg-primary/10' },
  whop: { label: 'Whop', icon: CreditCard, color: 'text-[#FA4616]', bg: 'bg-[#FA4616]/10' },
  gumroad: { label: 'Gumroad', icon: Download, color: 'text-[#FF90E8]', bg: 'bg-[#FF90E8]/10' },
};

export function channelMeta(channelType: string) {
  return CHANNEL_META[channelType] ?? { label: channelType, icon: Store, color: 'text-muted-foreground', bg: 'bg-muted' };
}
