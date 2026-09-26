'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { adminTeamApi } from '@/lib/api';

interface Info { role_name: string; email: string; full_name: string | null; account_exists: boolean }

function AcceptInner() {
  const token = useSearchParams().get('token') ?? '';
  const [info, setInfo] = useState<Info | null>(null);
  const [problem, setProblem] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setProblem('This invitation link is incomplete. Ask the owner to send a new one.'); return; }
    adminTeamApi.inviteInfo(token)
      .then((r) => { setInfo(r.data); setName(r.data.full_name ?? ''); })
      .catch((e) => setProblem(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'This invitation link is invalid or has expired.'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await adminTeamApi.acceptInvite({ token, password, full_name: info?.account_exists ? undefined : name.trim() || undefined });
      localStorage.setItem('admin_access_token', res.data.access_token);
      localStorage.removeItem('admin_access_cache');
      window.location.href = '/dashboard/shopping';
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-700 bg-[#0B1121] px-4 py-3 text-white placeholder-gray-500 transition focus:border-[#6B3FD9] focus:outline-none';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1121] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6B3FD9]/10"><Shield className="h-8 w-8 text-[#6B3FD9]" /></div>
          <h1 className="text-2xl font-bold text-white"><span className="text-[#6B3FD9]">Exius</span>Cart Admin</h1>
          <p className="mt-2 text-sm text-gray-400">You&apos;ve been invited to the admin team</p>
        </div>
        <Card className="border-gray-800 bg-[#151F32] p-6 text-white sm:p-8">
          {problem ? (
            <p className="text-center text-sm text-red-300">{problem}</p>
          ) : !info ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#6B3FD9]" /></div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-lg border border-[#6B3FD9]/30 bg-[#6B3FD9]/10 px-4 py-3 text-sm text-gray-200">
                Joining as <strong className="text-white">{info.role_name}</strong> with <strong className="text-white">{info.email}</strong>
              </div>
              {!info.account_exists && (
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm text-gray-400">Your name</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Full name" />
                </div>
              )}
              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-gray-400">{info.account_exists ? 'Your existing ExiusCart password' : 'Choose a password (8+ characters)'}</label>
                <div className="relative">
                  <input id="password" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-11`} />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {info.account_exists && <p className="mt-2 text-xs text-gray-500">This email already has an ExiusCart login. Enter its password to accept.</p>}
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6B3FD9] py-3 font-semibold text-white transition hover:bg-[#5A2EC9] disabled:opacity-60">
                {busy && <Loader2 className="h-5 w-5 animate-spin" />} Accept invitation
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return <Suspense fallback={null}><AcceptInner /></Suspense>;
}
