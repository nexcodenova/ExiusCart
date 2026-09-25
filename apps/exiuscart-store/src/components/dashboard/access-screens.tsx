'use client';

import Link from 'next/link';
import { Lock, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccess } from '@/components/providers/access-provider';
import { menuItems } from '@/components/layout/sidebar';

// Shown to a team member who opens (or bookmarked) a page their role doesn't
// include. The API would refuse it anyway - this just replaces a screen of
// failed requests with a plain explanation.
export function NoAccess() {
  const { roleName } = useAccess();
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">You don&apos;t have access to this page</h1>
          <p className="text-sm text-muted-foreground">
            {roleName ? <>Your role, <span className="font-medium text-foreground">{roleName}</span>, doesn&apos;t include it.</> : 'Your role doesn’t include it.'}{' '}
            Ask the store owner if you need it.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// The owner's plan has lapsed. Only they can renew it, so unlike the owner's
// lock screen this has no Billing button.
export function PlanEnded() {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">This store&apos;s plan has ended</h1>
          <p className="text-sm text-muted-foreground">
            Access is paused until the store owner renews the plan. Let them know, and everything will be back as you left it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccessLoading() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// A team member whose role has no Reports & analytics permission can't use
// the stats dashboard, so their landing page is a shortcut list of exactly
// the areas they can open.
export function StaffHome() {
  const { canPath, roleName } = useAccess();
  const seen = new Set<string>();
  const links = menuItems.filter((item) => {
    const href = item.href.split('?')[0];
    if (href === '/dashboard' || seen.has(href) || !canPath(href)) return false;
    seen.add(href);
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl pt-4">
      <h1 className="text-xl font-bold text-foreground">Welcome</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {roleName ? <>You&apos;re signed in as <span className="font-medium text-foreground">{roleName}</span>. </> : null}
        Here&apos;s what you can work on.
      </p>
      {links.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Your role doesn&apos;t include any pages yet. Ask the store owner to update it.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="transition hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
