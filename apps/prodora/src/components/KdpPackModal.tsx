'use client';

import { useEffect, useState } from 'react';
import { X, Download, Loader2, Copy, Check, ExternalLink, Info } from 'lucide-react';
import { kdpApi, KdpPack } from '@/lib/api';

function errText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Copyable({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        <button onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* blocked */ } }}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
          {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {done ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="max-h-28 overflow-y-auto rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export function KdpPackModal({ bundleId, name, onClose }: { bundleId: number; name: string; onClose: () => void }) {
  const [trim, setTrim] = useState('8.5x11');
  const [paper, setPaper] = useState('white_bw');
  const [pack, setPack] = useState<KdpPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'interior' | 'cover'>('');
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    let stale = false;
    setLoading(true); setError('');
    kdpApi.pack(bundleId, trim, paper)
      .then((r) => { if (!stale) setPack(r); })
      .catch((e) => { if (!stale) setError(errText(e, 'Could not prepare this book.')); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [bundleId, trim, paper]);

  const download = async (kind: 'interior' | 'cover') => {
    setBusy(kind); setError('');
    try {
      const blob = await kdpApi.file(bundleId, kind, trim, paper);
      saveBlob(blob, `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-kdp-${kind}.pdf`);
      kdpApi.track(bundleId).then(() => setTracked(true)).catch(() => {});
    } catch (e: any) {
      let msg = 'Download failed. Try again.';
      try { const t = JSON.parse(await (e?.response?.data as Blob).text()); if (typeof t.detail === 'string') msg = t.detail; } catch { /* keep default */ }
      setError(msg);
    } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-gray-100 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-gray-900">Prepare for Amazon KDP</p>
            <p className="text-xs text-gray-500 line-clamp-1">{name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-xs text-gray-500">
            Print-ready files for a KDP paperback. KDP has no upload connection, so you upload these on kdp.amazon.com yourself. Amazon then prints and ships each order.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold text-gray-600">Trim size (inches)
              <select value={trim} onChange={(e) => setTrim(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-normal text-gray-800">
                {(pack?.choices.trims ?? [trim]).map((t) => <option key={t} value={t}>{t.replace('x', ' × ')}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray-600">Paper and ink
              <select value={paper} onChange={(e) => setPaper(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-normal text-gray-800">
                {Object.entries(pack?.choices.papers ?? { [paper]: paper }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          {loading && <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>}

          {pack && !loading && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-gray-100 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Pages</p>
                  <p className="text-sm font-bold text-gray-800">{pack.interior.final_pages}</p>
                  {pack.interior.blank_pages_added > 0 && <p className="text-[10px] text-gray-400">+{pack.interior.blank_pages_added} blank</p>}
                </div>
                <div className="rounded-lg border border-gray-100 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Spine</p>
                  <p className="text-sm font-bold text-gray-800">{pack.cover.spine_in.toFixed(3)} in</p>
                </div>
                <div className="rounded-lg border border-gray-100 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Cover</p>
                  <p className="text-sm font-bold text-gray-800">{pack.cover.width_in.toFixed(2)} × {pack.cover.height_in.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => download('interior')} disabled={!!busy}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {busy === 'interior' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Interior PDF
                </button>
                <button onClick={() => download('cover')} disabled={!!busy}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  {busy === 'cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Cover PDF
                </button>
                <a href="https://kdp.amazon.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800">Open KDP <ExternalLink className="w-3 h-3" /></a>
              </div>
              {tracked && <p className="text-[11px] font-medium text-green-600">Added to your KDP list in ExiusCart (Sales Channels, Amazon KDP).</p>}

              <div className="space-y-3">
                <Copyable label="Title" text={pack.listing.title} />
                {pack.listing.description && <Copyable label="Description" text={pack.listing.description} />}
                {pack.listing.keywords.length > 0 && <Copyable label="Keyword ideas (KDP allows 7)" text={pack.listing.keywords.join('\n')} />}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-800"><Info className="w-3.5 h-3.5" /> Before you upload</p>
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-amber-800">
                  {pack.checklist.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
