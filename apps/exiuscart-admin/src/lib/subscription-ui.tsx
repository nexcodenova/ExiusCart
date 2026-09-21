import { differenceInCalendarDays } from 'date-fns';

// One place for how a store's plan, status and dates look, so Users, Stores and
// Subscriptions always say the same thing about the same store.

export const PLAN_LABELS: Record<string, string> = {
  free_trial: 'Free Trial',
  thedersi_free_forever: 'TheDersi Free Forever',
  thedersi_lite: 'TheDersi Lite',
  launch: 'Launch',
  growth: 'Growth',
  scale: 'Scale',
  pro: 'Pro',
  starter: 'Starter',
  premium: 'Premium',
};

export const PLAN_TEXT: Record<string, string> = {
  free_trial: 'text-gray-600',
  thedersi_free_forever: 'text-blue-600',
  thedersi_lite: 'text-teal-600',
  launch: 'text-gray-800',
  growth: 'text-[#0D70BB]',
  scale: 'text-[#6B3FD9]',
  pro: 'text-[#6B3FD9]',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trial: 'Trial',
  trial_dollar: '$1 Trial',
  pending_approval: 'Pending',
  expiring: 'Expiring soon',
  expired: 'Expired',
  cancelled: 'Cancelled',
  none: 'No plan',
};

export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600',
  trial: 'bg-blue-500/10 text-blue-600',
  trial_dollar: 'bg-purple-500/10 text-purple-600',
  pending_approval: 'bg-yellow-500/10 text-yellow-700',
  expiring: 'bg-orange-500/10 text-orange-600',
  expired: 'bg-red-500/10 text-red-600',
  cancelled: 'bg-gray-500/10 text-gray-600',
  none: 'bg-gray-500/10 text-gray-500',
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "5 days left", "Expires today", "Expired 3 days ago" — null when there is no expiry. */
export function daysLeftText(iso: string | null | undefined): { text: string; tone: 'ok' | 'soon' | 'gone' } | null {
  if (!iso) return null;
  const d = differenceInCalendarDays(new Date(iso), new Date());
  if (d > 7) return { text: `${d} days left`, tone: 'ok' };
  if (d > 1) return { text: `${d} days left`, tone: 'soon' };
  if (d === 1) return { text: '1 day left', tone: 'soon' };
  if (d === 0) return { text: 'Expires today', tone: 'soon' };
  return { text: `Expired ${-d} ${-d === 1 ? 'day' : 'days'} ago`, tone: 'gone' };
}

export function PlanChip({ plan }: { plan: string | null | undefined }) {
  if (!plan || plan === 'none') return <span className="text-sm text-gray-400">No plan</span>;
  return <span className={`text-sm font-semibold ${PLAN_TEXT[plan] ?? 'text-gray-700'}`}>{PLAN_LABELS[plan] ?? plan}</span>;
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  const s = status || 'none';
  return (
    <span className={`inline-block whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[s] ?? STATUS_STYLES.none}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  );
}

const TONE = { ok: 'text-gray-400', soon: 'text-orange-600', gone: 'text-red-600' } as const;

/** Started / Expires with a live countdown. `status` decides how to word an empty expiry. */
export function PlanDates({
  startsAt, expiresAt, status,
}: { startsAt: string | null | undefined; expiresAt: string | null | undefined; status?: string | null }) {
  if (!status || status === 'none') return <span className="text-sm text-gray-400">—</span>;
  const left = daysLeftText(expiresAt);
  const finished = status === 'expired' || status === 'cancelled' || status === 'pending_approval';
  return (
    <div className="text-xs leading-5 text-gray-600">
      <div><span className="text-gray-400">Started</span> {fmtDate(startsAt)}</div>
      <div>
        <span className="text-gray-400">{status === 'expired' ? 'Expired' : 'Expires'}</span>{' '}
        {expiresAt ? fmtDate(expiresAt) : finished ? '—' : 'Lifetime'}
        {left && !finished && <span className={`ml-1.5 ${TONE[left.tone]}`}>· {left.text}</span>}
      </div>
    </div>
  );
}

// Plan pickers list our own plans first. TheDersi plans are billed by TheDersi,
// so they only appear (in their own group) on a row that already has one, and
// the old generic trial only on a row that still has it.
export const EXIUSCART_PLAN_VALUES = ['launch', 'growth', 'scale'] as const;
const THEDERSI_PLAN_VALUES = ['thedersi_free_forever', 'thedersi_lite'] as const;

/** <option> groups for a plan <select>. `current` is the plan the row has now. */
export function PlanOptions({ current, all = false }: { current?: string; all?: boolean }) {
  const showTheDersi = all || (current ?? '').startsWith('thedersi_');
  const showLegacy = current === 'free_trial'; // never offered as a choice; only shown so a leftover row is not mislabelled
  return (
    <>
      <optgroup label="ExiusCart plans">
        {EXIUSCART_PLAN_VALUES.map((v) => <option key={v} value={v}>{PLAN_LABELS[v]}</option>)}
      </optgroup>
      {showTheDersi && (
        <optgroup label="TheDersi (billed by TheDersi)">
          {THEDERSI_PLAN_VALUES.map((v) => <option key={v} value={v}>{PLAN_LABELS[v]}</option>)}
        </optgroup>
      )}
      {showLegacy && (
        <optgroup label="Old plan">
          <option value="free_trial">Free Trial (old 7-day trial)</option>
        </optgroup>
      )}
    </>
  );
}
