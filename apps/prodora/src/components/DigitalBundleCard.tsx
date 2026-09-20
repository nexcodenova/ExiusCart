'use client';

import { useState } from 'react';
import { Download, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { digitalBundlesApi, DigitalBundle } from '@/lib/api';
import { DotsLoader } from '@/components/LoadingImage';

export function DigitalBundleCard({ bundle }: { bundle: DigitalBundle }) {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ product_id: number; name: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [links, setLinks] = useState<{ editable_file_url: string | null; pdf_file_url: string | null } | null>(null);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setDownloading(true); setError('');
    try {
      const r = await digitalBundlesApi.download(bundle.id);
      setLinks(r);
    } catch {
      setError('Could not load download links.');
    } finally { setDownloading(false); }
  };

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const r = await digitalBundlesApi.import(bundle.id);
      setImported(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Import failed.');
    } finally { setImporting(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-gray-50">
        {bundle.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bundle.cover_image_url} alt={bundle.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Download className="w-8 h-8 text-gray-300" /></div>
        )}
        {bundle.purchased && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 bg-green-500 text-white rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Purchased
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2">{bundle.name}</p>
        {bundle.description && <p className="text-xs text-gray-500 line-clamp-2">{bundle.description}</p>}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-800">${bundle.price.toFixed(2)}</span>
          {bundle.suggested_resale_price && (
            <span className="text-green-600 font-medium">Resell ~${bundle.suggested_resale_price.toFixed(2)}</span>
          )}
        </div>
        {bundle.resale_notes && <p className="text-[11px] text-gray-400 line-clamp-2">{bundle.resale_notes}</p>}

        {error && <p className="text-[11px] text-red-500">{error}</p>}

        <div className="mt-auto pt-1 space-y-1.5">
          {!bundle.purchased ? (
            <a href={bundle.whop_checkout_url || '#'} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition">
              Buy on Whop <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <>
              {!links ? (
                <button onClick={handleDownload} disabled={downloading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition disabled:opacity-60">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {downloading ? 'Loading…' : 'Get Download Links'}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  {links.editable_file_url && (
                    <a href={links.editable_file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-semibold text-gray-700">Editable</a>
                  )}
                  {links.pdf_file_url && (
                    <a href={links.pdf_file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-semibold text-gray-700">PDF</a>
                  )}
                </div>
              )}
              {imported ? (
                <p className="text-center text-[11px] text-green-600 font-medium py-1.5">Added to your store as &ldquo;{imported.name}&rdquo; ✓</p>
              ) : (
                <button onClick={handleImport} disabled={importing}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {importing ? 'Adding…' : 'Import to My Store'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="relative aspect-square bg-gray-100"><DotsLoader /></div>
      <div className="p-3 flex flex-col gap-2 animate-pulse">
        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-100 rounded w-2/5 mt-1" />
      </div>
    </div>
  );
}
