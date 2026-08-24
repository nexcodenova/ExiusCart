'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface DownloadInfo {
  product_name: string;
  shop_name: string;
}

export default function DownloadGatePage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundOrExpired, setNotFoundOrExpired] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ file_url: string; file_name: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/v1/public/download/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setNotFoundOrExpired(body.detail || 'This download link is no longer valid.');
          return;
        }
        setInfo(await res.json());
      })
      .catch(() => setNotFoundOrExpired('Could not load this page. Try again shortly.'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/download/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || 'That code doesn\'t match. Check the email and try again.');
        return;
      }
      setResult(body);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="bg-[#0B1121] px-6 py-5 border-b border-gray-800">
            <span className="text-lg font-black text-white"><span className="text-[#7B4FE9]">Exius</span>Cart</span>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading…</span>
              </div>
            ) : notFoundOrExpired ? (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Link unavailable</p>
                <p className="text-gray-500 text-sm">{notFoundOrExpired}</p>
              </div>
            ) : result ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Verified!</p>
                <p className="text-gray-500 text-sm mb-5">Your download is ready.</p>
                <a
                  href={result.file_url}
                  download={result.file_name}
                  className="inline-flex items-center gap-2 bg-[#10b981] text-white font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition"
                >
                  <Download className="w-4 h-4" /> Download {result.file_name}
                </a>
              </div>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#7B4FE9]/15 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-6 h-6 text-[#7B4FE9]" />
                  </div>
                  <p className="text-white font-bold text-lg leading-tight">{info?.product_name}</p>
                  {info?.shop_name && <p className="text-gray-500 text-xs mt-1">{info.shop_name}</p>}
                </div>

                <form onSubmit={submit} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Access Code</label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="From your confirmation email"
                      autoFocus
                      className="w-full bg-[#0B1121] border border-gray-800 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-widest placeholder:text-gray-700 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-[#7B4FE9]"
                    />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-red-400 text-xs">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={verifying || !code.trim()}
                    className="w-full bg-[#7B4FE9] text-white font-bold text-sm py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                    {verifying ? 'Checking…' : 'Unlock My Download'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        <p className="text-center text-gray-700 text-xs mt-4">Powered by ExiusCart</p>
      </div>
    </div>
  );
}
