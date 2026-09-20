// Solid, chunky navigation icons (the outline set reads thin and small next
// to a dark sidebar). Each one inherits colour from `currentColor`.
type P = { className?: string };

const base = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const;

// Four tiles, one of them turned — "product research".
export function WinningIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="2.5" width="8.5" height="8.5" rx="2.2" />
      <rect x="2.5" y="13" width="8.5" height="8.5" rx="2.2" />
      <rect x="13" y="13" width="8.5" height="8.5" rx="2.2" />
      <rect x="14.1" y="1.6" width="7.4" height="7.4" rx="1.8" transform="rotate(45 17.8 5.3)" />
    </svg>
  );
}

export function MarketplaceIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M5.4 8h13.2a1 1 0 0 1 1 .93l.95 11.2a1.6 1.6 0 0 1-1.6 1.72H5.05a1.6 1.6 0 0 1-1.6-1.72l.95-11.2A1 1 0 0 1 5.4 8Z" />
      <path d="M8.4 9V6.9a3.6 3.6 0 0 1 7.2 0V9" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function StoreIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4.2 2.5h15.6a1 1 0 0 1 .96.72L22.4 9a3.3 3.3 0 0 1-5.6 2.4 3.3 3.3 0 0 1-4.8 0 3.3 3.3 0 0 1-4.8 0A3.3 3.3 0 0 1 1.6 9l1.64-5.78a1 1 0 0 1 .96-.72Z" />
      <path d="M3.6 13.1a5 5 0 0 0 2.2-.6V20a1.5 1.5 0 0 0 1.5 1.5h9.4A1.5 1.5 0 0 0 18.2 20v-7.5a5 5 0 0 0 2.2.6V20a3 3 0 0 1-3 3H6.6a3 3 0 0 1-3-3v-6.9Z" />
      <rect x="9.3" y="15.2" width="5.4" height="6.3" rx="1" />
    </svg>
  );
}

// Open guide book — "instructions".
export function InstructionsIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5.4C10.4 4 8.2 3.3 5.4 3.3H3.9A1.4 1.4 0 0 0 2.5 4.7v12.6a1.4 1.4 0 0 0 1.4 1.4h1.5c2.4 0 4.3.6 5.7 1.9.3.3.9.1.9-.4V6.3c0-.3-.1-.6-.3-.9Z" />
      <path d="M12 5.4c1.6-1.4 3.8-2.1 6.6-2.1h1.5a1.4 1.4 0 0 1 1.4 1.4v12.6a1.4 1.4 0 0 1-1.4 1.4h-1.5c-2.4 0-4.3.6-5.7 1.9-.3.3-.9.1-.9-.4V6.3c0-.3.1-.6.3-.9Z" opacity="0.72" />
    </svg>
  );
}

// Filled disc with a play triangle cut out.
export function AcademyIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path fillRule="evenodd" d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm-2.3 6.1v8.2a.7.7 0 0 0 1.06.6l6.7-4.1a.7.7 0 0 0 0-1.2l-6.7-4.1a.7.7 0 0 0-1.06.6Z" />
    </svg>
  );
}
