'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { teamApi } from '@/lib/api';
import { hasPermission, routeArea, type AccessInfo, type Level } from '@/lib/access';

interface AccessContextValue {
  /** True until the first answer (or failure) comes back and nothing is cached. */
  loading: boolean;
  isOwner: boolean;
  roleName: string | null;
  /** A team member whose shop's plan has lapsed - they can't fix it, so the dashboard says so. */
  planExpired: boolean;
  /** The shop's plan, for a team member (who can't read the billing endpoint). Null for owners - the sidebar already loads theirs. */
  plan: { type: string; label: string; daysLeft: number | null; isTheDersi: boolean } | null;
  can: (area: string, level?: Level) => boolean;
  canPath: (pathname: string) => boolean;
}

const AccessContext = createContext<AccessContextValue | null>(null);

// Fail OPEN in the UI on purpose: if this lookup errors (network blip, an
// account that has no shop yet mid-signup), show the owner's normal
// dashboard rather than a blank screen. That costs nothing security-wise -
// the API enforces every permission itself and answers 403 to anything a
// role doesn't allow; this context only tidies what gets displayed.
const OWNER_LIKE: AccessContextValue = {
  loading: false,
  isOwner: true,
  roleName: null,
  planExpired: false,
  plan: null,
  can: () => true,
  canPath: () => true,
};

// Until we know who this is, show nothing rather than flash a full menu at a
// team member.
const UNKNOWN: AccessContextValue = {
  loading: true,
  isOwner: false,
  roleName: null,
  planExpired: false,
  plan: null,
  can: () => false,
  canPath: () => false,
};

// The last answer, kept per login (keyed to the end of the session token, so
// a different person signing in on the same browser never inherits it). It
// lets an owner's dashboard paint immediately on every visit instead of
// waiting on this request; the fresh answer replaces it a moment later.
const CACHE_KEY = 'access_cache';
const tokenTag = () => (localStorage.getItem('access_token') ?? '').slice(-24);

function readCache(): AccessInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: string; info: AccessInfo };
    return parsed.t === tokenTag() ? parsed.info : null;
  } catch {
    return null;
  }
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<AccessInfo | null>(() => (typeof window === 'undefined' ? null : readCache()));
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(false);

  const refresh = useCallback(() => {
    teamApi.myAccess()
      .then((res) => {
        const next = res.data as AccessInfo;
        setInfo(next);
        setFailed(false);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: tokenTag(), info: next })); } catch { /* private mode */ }
      })
      .catch(() => { setFailed(true); })
      .finally(() => setSettled(true));
  }, []);

  // Fetched at load, whenever the tab regains focus, and every minute - so a
  // role the owner just edited (or a suspension) reaches the team member
  // without them having to log out and back in.
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, [refresh]);

  const value = useMemo<AccessContextValue>(() => {
    if (!info) return settled && failed ? OWNER_LIKE : UNKNOWN;
    if (info.is_owner) return OWNER_LIKE;
    const perms = info.permissions;
    const can = (area: string, level: Level = 'view') => hasPermission(perms, area, level);
    return {
      loading: false,
      isOwner: false,
      roleName: info.role?.name ?? null,
      planExpired: info.plan_expired,
      plan: info.plan ? { type: info.plan.type, label: info.plan.label, daysLeft: info.plan.days_left, isTheDersi: info.plan.is_thedersi } : null,
      can,
      canPath: (pathname: string) => {
        const area = routeArea(pathname);
        if (area === 'open' || area === 'home') return true;
        if (area === 'owner') return false;
        return can(area, 'view');
      },
    };
  }, [info, failed, settled]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  return useContext(AccessContext) ?? OWNER_LIKE;
}
