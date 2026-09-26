// Store team access - what the signed-in person may open in the dashboard.
//
// The SERVER is the real enforcement (app/core/shop_access.py answers 403 to
// anything a role doesn't allow). This file only decides what to *show*: which
// menu items to hide and which pages to replace with "no access", so nobody
// clicks into a screen full of errors. If the two ever drift, the worst case
// is a visible link that then says "not allowed" - never extra access.

export type Level = 'view' | 'manage';

export interface AccessInfo {
  shop_id: number;
  shop_name: string;
  is_owner: boolean;
  role: { id: number; name: string } | null;
  permissions: string[];
  plan_expired: boolean;
  // Non-financial slice of the shop's plan - lets a team member's menu know which
  // sections are locked behind Growth/Scale without giving them billing access.
  plan?: { type: string; label: string; days_left: number | null; is_thedersi: boolean };
}

export interface PermissionArea {
  key: string;
  label: string;
  description: string;
}

// Dashboard route -> the permission area whose API it depends on. Mirrors
// PATH_AREAS in the backend (which is keyed by API path, not by page).
// A page NOT listed here is owner-only: billing, settings, integrations,
// channels, payouts, the team itself... - so a new page is private to the
// owner until someone deliberately opens it up.
const ROUTE_AREAS: Array<[string, string]> = [
  // orders
  ['/dashboard/orders', 'orders'], ['/dashboard/pos', 'orders'], ['/dashboard/credit-notes', 'orders'],
  ['/dashboard/recurring-invoices', 'orders'], ['/dashboard/quotations', 'orders'], ['/dashboard/notifications', 'orders'],
  // products
  ['/dashboard/products', 'products'], ['/dashboard/inventory', 'products'], ['/dashboard/suppliers', 'products'],
  ['/dashboard/purchases', 'products'], ['/dashboard/discounts', 'products'],
  // customers
  ['/dashboard/customers', 'customers'], ['/dashboard/customer-segments', 'customers'], ['/dashboard/leads', 'customers'],
  ['/dashboard/helpdesk', 'customers'], ['/dashboard/surveys', 'customers'],
  // marketing
  ['/dashboard/marketing', 'marketing'], ['/dashboard/campaigns', 'marketing'], ['/dashboard/ads', 'marketing'],
  ['/dashboard/email-marketing', 'marketing'], ['/dashboard/sms-marketing', 'marketing'],
  ['/dashboard/whatsapp-marketing', 'marketing'], ['/dashboard/social-posting', 'marketing'],
  ['/dashboard/popups', 'marketing'], ['/dashboard/signup-forms', 'marketing'], ['/dashboard/reviews', 'marketing'],
  ['/dashboard/blog', 'marketing'], ['/dashboard/drip-flows', 'marketing'], ['/dashboard/loyalty', 'marketing'],
  ['/dashboard/ai-marketing', 'marketing'], ['/dashboard/ai-seo', 'marketing'],
  // analytics
  ['/dashboard/analytics', 'analytics'], ['/dashboard/reports', 'analytics'], ['/dashboard/storefront-insights', 'analytics'],
  // finance
  ['/dashboard/expenses', 'finance'], ['/dashboard/wholesale', 'finance'], ['/dashboard/accounting', 'finance'],
  // hr
  ['/dashboard/hr', 'hr'], ['/dashboard/recruitment', 'hr'], ['/dashboard/attendance', 'hr'],
  // fulfillment
  ['/dashboard/dropshipping', 'fulfillment'],
  // operations
  ['/dashboard/fleet', 'operations'], ['/dashboard/projects', 'operations'], ['/dashboard/appointments', 'operations'],
  ['/dashboard/reservations', 'operations'], ['/dashboard/events', 'operations'],
];

// Pages every signed-in person may open regardless of role (their own profile).
const OPEN_ROUTES = ['/dashboard/profile', '/dashboard/support'];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/');

/** 'open' | 'owner' | <area key> */
export function routeArea(pathname: string): string {
  const path = pathname.split('?')[0];
  if (path === '/dashboard') return 'home';
  if (OPEN_ROUTES.some((p) => matches(path, p))) return 'open';
  const hit = ROUTE_AREAS.find(([prefix]) => matches(path, prefix));
  return hit ? hit[1] : 'owner';
}

export function hasPermission(permissions: string[], area: string, level: Level): boolean {
  if (permissions.includes(`${area}.manage`)) return true; // manage implies view
  return level === 'view' && permissions.includes(`${area}.view`);
}
