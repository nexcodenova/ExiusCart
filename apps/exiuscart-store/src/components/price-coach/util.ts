/** The message the server sent (a string, or {error, message}), or a plain fallback. */
export function errText(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') return (d as { message: string }).message;
  return fallback;
}

/** The machine code the server attached to an error ("limit_reached", "plan_required"...), if any. */
export function errCode(e: unknown): string | null {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return d && typeof d === 'object' && typeof (d as { error?: unknown }).error === 'string' ? (d as { error: string }).error : null;
}
