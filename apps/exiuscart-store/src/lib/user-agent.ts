// Just enough user-agent reading to tell an owner "Chrome on Windows" from
// "Safari on iPhone" at a glance - not a device-detection library. Order
// matters: Edge/Opera/Chrome all contain "Chrome", and iOS/Android agents
// contain "Safari"/"Linux".
export function parseUserAgent(ua: string | null | undefined): { browser: string; os: string; mobile: boolean } {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', mobile: false };
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /python-requests|curl|httpx|axios|node/i.test(ua) ? 'Script' : 'Other';
  const os =
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'Other';
  return { browser, os, mobile: /Mobile|iPhone|Android/.test(ua) };
}

/** "AE" -> "United Arab Emirates" (falls back to the code). */
export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code; } catch { return code; }
}
