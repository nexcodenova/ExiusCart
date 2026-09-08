import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared focus-visible ring — used by the Tremor-derived components under
// components/charts and components/ui/calendar.tsx (keyboard-nav buttons,
// calendar day cells) so focus state stays consistent between them without
// each one redeclaring the same ring classes.
export const focusRing = [
  'outline outline-offset-2 outline-0 focus-visible:outline-2',
  'outline-blue-500 dark:outline-blue-500',
];
