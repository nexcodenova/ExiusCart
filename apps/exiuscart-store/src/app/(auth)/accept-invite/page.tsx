'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Users } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { shopApi, teamApi } from '@/lib/api';

interface InviteInfo {
  shop_name: string;
  role_name: string;
  email: string;
  full_name: string | null;
  account_exists: boolean;
}

function AcceptInviteForm() {
  const token = useSearchParams().get('token') ?? '';
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(!!token);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    teamApi.inviteInfo(token)
      .then((res) => { setInfo(res.data); setName(res.data.full_name ?? ''); })
      .catch((err) => {
        const d = err?.response?.data?.detail;
        setLoadError(typeof d === 'string' ? d : 'This invitation link is invalid or has expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!info?.account_exists) {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (password !== confirm) { setError('Passwords don’t match.'); return; }
    }
    setSubmitting(true);
    try {
      const res = await teamApi.acceptInvite({ token, password, full_name: name.trim() || undefined });
      // Same as a normal sign-in: keep the session, learn which shop this is, go in.
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      try {
        const shopRes = await shopApi.getMyShop();
        if (shopRes.data?.id) localStorage.setItem('shop_id', String(shopRes.data.id));
      } catch { /* the dashboard re-syncs it on load */ }
      window.location.href = '/dashboard';
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (!token || loadError) {
    return (
      <AuthShell title="Invitation problem" subtitle={loadError || 'This page needs the link from your invitation email.'}>
        <p className="mb-5 text-sm text-gray-600">Ask the store owner to send you a new invitation.</p>
        <Link href="/login" className="block rounded-2xl bg-[#6B3FD9] py-3 text-center font-semibold text-white hover:bg-[#5A2EC9]">
          Go to login
        </Link>
      </AuthShell>
    );
  }

  if (loading || !info) {
    return (
      <AuthShell title="Loading invitation…">
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      </AuthShell>
    );
  }

  const field = 'h-12 w-full rounded-xl border-gray-200 bg-gray-50 px-4 text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#6B3FD9]';
  return (
    <AuthShell title={`Join ${info.shop_name}`} subtitle={`You've been invited as ${info.role_name}.`}>
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6B3FD9]/10 text-[#6B3FD9]"><Users className="h-4 w-4" /></div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Signing up as</p>
          <p className="truncate text-sm font-medium text-gray-900">{info.email}</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        {info.account_exists ? (
          <div className="space-y-1.5">
            <p className="text-sm text-gray-600">You already have an ExiusCart account with this email. Enter its password to join.</p>
            <Label htmlFor="password" className="text-xs font-medium text-gray-500">Your password</Label>
            <div className="relative">
              <Input id="password" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-12`} />
              <ToggleEye show={show} onClick={() => setShow(!show)} />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-gray-500">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-gray-500">Choose a password</Label>
              <div className="relative">
                <Input id="password" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${field} pr-12`} />
                <ToggleEye show={show} onClick={() => setShow(!show)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-medium text-gray-500">Confirm password</Label>
              <Input id="confirm" type={show ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" className={field} />
            </div>
          </>
        )}
        <Button type="submit" disabled={submitting} className="h-12 w-full rounded-2xl bg-[#6B3FD9] font-semibold text-white hover:bg-[#5A2EC9]">
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          Accept invitation
        </Button>
      </form>
    </AuthShell>
  );
}

function ToggleEye({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={show ? 'Hide password' : 'Show password'}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
      {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
