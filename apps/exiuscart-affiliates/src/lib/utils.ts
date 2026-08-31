// This app has no shadcn setup yet (no clsx/tailwind-merge dependency),
// so cn() here is a plain join — no conflicting-class dedup like the
// real clsx+tailwind-merge version other apps use (exiuscart-store,
// exiuscart-admin). Fine for the one component (Card) that currently
// uses it; upgrade to the real thing if this app adopts shadcn more
// broadly later.
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}
