'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { adminAccessApi, type AdminAccess } from '@/lib/api';

// Which admin page needs which permission. The OWNER opens everything; a staff
// member opens only the pages listed here that their role allows (the server
// enforces the same rules - this is what keeps the menu and pages tidy).
// Longest prefix wins, so /shopping/add is checked before /shopping.
export const ROUTE_PERMS: { prefix: string; perm: string }[] = [
  { prefix: '/dashboard/shopping/add', perm: 'prodora.add' },
  { prefix: '/dashboard/shopping', perm: 'prodora.view' },
  { prefix: '/dashboard/digital-bundles', perm: 'prodora.digital' },
];

interface Ctx {
  loaded: boolean;
  access: AdminAccess | null;
  isOwner: boolean;
  can: (perm: string) => boolean;
  canOpen: (path: string) => boolean;
  firstAllowedPath: () => string | null;
}

const AccessContext = createContext<Ctx>({
  loaded: false, access: null, isOwner: false, can: () => false, canOpen: () => false, firstAllowedPath: () => null,
});

export const useAdminAccess = () => useContext(AccessContext);

// Remembered on this device so the menu draws instantly on every page load
// instead of flashing empty while /admin/me answers. It is only a display
// cache: the server still decides what anyone may do, and the fresh answer
// replaces it a moment later.
const CACHE_KEY = 'admin_access_cache';
function readCache(): AdminAccess | null {
  try {
    if (!localStorage.getItem('admin_access_token')) return null;
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AdminAccess) : null;
  } catch { return null; }
}
export function clearAccessCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Safe to read localStorage here: the dashboard layout only renders this
  // provider on the client, after it has confirmed there is a token.
  const [access, setAccess] = useState<AdminAccess | null>(() => readCache());
  const [loaded, setLoaded] = useState(() => readCache() !== null);

  useEffect(() => {
    let cancelled = false;
    adminAccessApi.me()
      .then((r) => {
        if (cancelled) return;
        setAccess(r.data);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(r.data)); } catch { /* ignore */ }
      })
      .catch((e) => {
        // 401 is handled by the shared interceptor (back to login). A 403 means
        // this account has no admin access at all (suspended or removed).
        if (!cancelled && e?.response?.status === 403) {
          localStorage.removeItem('admin_access_token');
          clearAccessCache();
          window.location.href = '/login?reason=no_access';
        }
      })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<Ctx>(() => {
    const isOwner = !!access?.is_owner;
    const perms = new Set(access?.permissions ?? []);
    const can = (perm: string) => isOwner || perms.has(perm);
    const canOpen = (path: string) => {
      if (isOwner) return true;
      const rule = [...ROUTE_PERMS].sort((a, b) => b.prefix.length - a.prefix.length).find((r) => path === r.prefix || path.startsWith(r.prefix + '/'));
      return !!rule && perms.has(rule.perm);
    };
    const firstAllowedPath = () => ROUTE_PERMS.find((r) => r.prefix !== '/dashboard/shopping/add' && perms.has(r.perm))?.prefix ?? null;
    return { loaded, access, isOwner, can, canOpen, firstAllowedPath };
  }, [access, loaded]);

  // A staff member who lands on a page they can't use is moved to one they can.
  useEffect(() => {
    if (!loaded || !access || access.is_owner) return;
    if (!value.canOpen(pathname)) {
      const to = value.firstAllowedPath();
      if (to) router.replace(to);
    }
  }, [loaded, access, pathname, value, router]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
