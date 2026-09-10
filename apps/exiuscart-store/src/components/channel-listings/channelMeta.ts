import {
  ShoppingBag, Tag, Music2, Globe, ShoppingCart, CreditCard, Download, Link2, Store, Package, Instagram,
} from 'lucide-react';

// icon/color is the fallback treatment; `logo` points at a real brand SVG
// in /public/channel-logos when one has been added. Most of those files are
// wide wordmark marks (they already contain the brand name), so `wide: true`
// tells the UI to show the logo on its own instead of logo + text label.
export const CHANNEL_META: Record<string, {
  label: string; icon: React.ElementType; color: string; bg: string;
  logo?: string; wide?: boolean;
}> = {
  shopify:     { label: 'Shopify',        icon: ShoppingBag, color: 'text-[#96BF48]', bg: 'bg-[#96BF48]/10', logo: '/channel-logos/shopify.svg' },
  etsy:        { label: 'Etsy',           icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-600/10', logo: '/channel-logos/etsy.svg', wide: true },
  custom:      { label: 'Custom Website', icon: Globe, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  woocommerce: { label: 'WooCommerce',    icon: ShoppingCart, color: 'text-[#7F54B3]', bg: 'bg-[#7F54B3]/10', logo: '/channel-logos/woocommerce.svg', wide: true },
  bigcommerce: { label: 'BigCommerce',    icon: Store, color: 'text-[#00C9A7]', bg: 'bg-[#00C9A7]/10', logo: '/channel-logos/bigcommerce.svg', wide: true },
  ebay:        { label: 'eBay',           icon: Tag, color: 'text-[#E53238]', bg: 'bg-[#E53238]/10', logo: '/channel-logos/ebay.svg', wide: true },
  amazon:      { label: 'Amazon',         icon: Package, color: 'text-orange-400', bg: 'bg-orange-400/10', logo: '/channel-logos/amazon.svg', wide: true },
  walmart:     { label: 'Walmart',        icon: ShoppingCart, color: 'text-[#0071DC]', bg: 'bg-[#0071DC]/10', logo: '/channel-logos/walmart.svg', wide: true },
  wix:         { label: 'Wix',            icon: Globe, color: 'text-foreground', bg: 'bg-foreground/10', logo: '/channel-logos/wix.svg', wide: true },
  tiktok:      { label: 'TikTok Shop',    icon: Music2, color: 'text-foreground', bg: 'bg-foreground/10', logo: '/channel-logos/tiktok.svg' },
  noon:        { label: 'Noon',           icon: ShoppingBag, color: 'text-yellow-500', bg: 'bg-yellow-500/10', logo: '/channel-logos/noon.svg' },
  daraz:       { label: 'Daraz',          icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  thedersi:    { label: 'TheDersi',       icon: Link2, color: 'text-primary', bg: 'bg-primary/10' },
  whop:        { label: 'Whop',           icon: CreditCard, color: 'text-[#FA4616]', bg: 'bg-[#FA4616]/10', logo: '/channel-logos/whop.svg', wide: true },
  gumroad:     { label: 'Gumroad',        icon: Download, color: 'text-[#FF90E8]', bg: 'bg-[#FF90E8]/10', logo: '/channel-logos/gumroad.svg' },
  instagram:   { label: 'Instagram Shopping', icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-500/10', logo: '/channel-logos/instagram.svg' },
  trendyol:    { label: 'Trendyol',       icon: ShoppingBag, color: 'text-[#F27A1A]', bg: 'bg-[#F27A1A]/10', logo: '/channel-logos/trendyol.svg', wide: true },
  jumia:       { label: 'Jumia',          icon: ShoppingBag, color: 'text-[#F68B1E]', bg: 'bg-[#F68B1E]/10', logo: '/channel-logos/jumia.svg', wide: true },
};

export function channelMeta(channelType: string) {
  return CHANNEL_META[channelType] ?? { label: channelType, icon: Store, color: 'text-muted-foreground', bg: 'bg-muted' };
}
