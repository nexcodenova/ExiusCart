'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Check, Tag, Mail, Zap, ShieldCheck, Globe2 } from 'lucide-react';
import { AuthHeader } from '@/components/auth/auth-header';
import { SocialAuthButtons, type SocialProvider } from '@/components/auth/social-auth-buttons';
import { SupportCard } from '@/components/auth/support-card';

// Deliberately short: name, email, password. Store name, phone, country and
// referral code are collected once inside the dashboard right after first
// login (the "Finish setting up" step) - the same step social sign-ins use,
// since Google/Apple/Facebook can't supply them either.
const registerSchema = z.object({
  ownerName: z.string().min(2, 'Your name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  refCode: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  // Controlled so the social buttons can require it too — a first-time
  // Google/Apple/Facebook sign-in creates an account, same as this form.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get('ref') || '';
  const [isRefLocked, setIsRefLocked] = useState(false);
  // Arriving from the pricing page's Launch "Try for free" CTA carries the
  // plan — a real 7-day free trial (no card), same length as the generic
  // fallback copy below. Growth/Scale never link here — they have no free
  // week, only the $1
  // checkout flow (see /checkout?trial=dollar). No plan param = organic
  // signup, unchanged.
  const planFromUrl = searchParams.get('plan');
  const billingFromUrl = searchParams.get('billing') || 'monthly';
  const chosenPlan = planFromUrl === 'launch' ? planFromUrl : null;
  const chosenPlanLabel = chosenPlan ? 'Launch' : null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { refCode: '' },
  });

  useEffect(() => {
    const code = refFromUrl || (() => {
      const m = document.cookie.match(/exiuscart_ref=([^;]+)/);
      return m?.[1] || '';
    })();
    if (!code) return;

    // Fill and lock immediately while we validate
    setValue('refCode', code);
    setIsRefLocked(true);

    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';
    fetch(`${API}/api/v1/public/check-ref/${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(({ valid }) => {
        if (valid) {
          // Valid — save 30-day tracking cookie
          document.cookie = `exiuscart_ref=${code}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Lax`;
        } else {
          // Invalid/inactive — clear stale cookie but keep field showing the code
          document.cookie = 'exiuscart_ref=; max-age=0; path=/';
        }
        // Field stays filled and locked regardless — the backend rejects invalid codes at signup
      })
      .catch(() => {
        // Network error — keep locked and coded
      });
  }, [refFromUrl, setValue]);

  const refCode = watch('refCode');

  const requireTerms = () => {
    if (termsAccepted) return true;
    setError('Please tick the Terms of Service and Privacy Policy box below to continue.');
    document.getElementById('terms')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  };

  const handleSocial = async (provider: SocialProvider, token: string, extra?: { name?: string }) => {
    setError('');
    const res = await fetch(`${API_BASE}/api/v1/auth/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider, token, name: extra?.name,
        ref_code: refCode || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Sign-in failed. Please try again.');
    setSuccess(true);
    // Same hand-off as email signup: the token rides in the hash fragment
    // (never sent to a server) so the dashboard opens already signed in.
    window.location.href = `https://store.exiuscart.com/login#token=${body.access_token}`;
  };

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: data.ownerName,
          email: data.email,
          password: data.password,
          ref_code: data.refCode || undefined,
          plan_type: chosenPlan || undefined,
          billing_type: chosenPlan ? billingFromUrl : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Registration failed');
      }
      const body = await res.json();
      if (body.status === 'otp_sent') {
        setPendingEmail(body.email);
      } else {
        setSuccess(true);
        setTimeout(() => { window.location.href = 'https://store.exiuscart.com/login?registered=1'; }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, otp_code: otpCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Invalid code');
      }
      setSuccess(true);
      // Immediate access — verify-otp already returns a real access token (no
      // more admin-approval wait), so hand it straight to the dashboard via
      // hash fragment (never sent to a server) instead of making them log in
      // again with a password they just typed seconds ago.
      const token = body.access_token;
      setTimeout(() => {
        window.location.href = token
          ? `https://store.exiuscart.com/login#token=${token}`
          : 'https://store.exiuscart.com/login';
      }, 1500);
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    setResendSent(false);
    try {
      await fetch(`${API_BASE}/api/v1/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  };

  if (pendingEmail && !success) {
    return (
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-16 h-16 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Mail className="w-8 h-8 text-[#6B3FD9]" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-1">We sent a 6-digit code to</p>
        <p className="text-gray-900 font-medium text-sm mb-6">{pendingEmail}</p>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full text-center text-3xl font-bold tracking-[0.5em] bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-900 placeholder-gray-300 focus:ring-2 focus:ring-[#6B3FD9] outline-none transition mb-4"
        />

        {otpError && (
          <p className="text-red-600 text-sm mb-4">{otpError}</p>
        )}

        <button
          onClick={handleVerifyOtp}
          disabled={otpCode.length !== 6 || otpLoading}
          className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] disabled:bg-[#6B3FD9]/40 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 mb-5"
        >
          {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Email'}
        </button>

        <p className="text-gray-500 text-sm">
          Didn't receive it?{' '}
          {resendSent ? (
            <span className="text-emerald-600">Code resent!</span>
          ) : (
            <button
              onClick={handleResendOtp}
              disabled={resendLoading}
              className="text-[#6B3FD9] hover:underline disabled:opacity-50"
            >
              {resendLoading ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
        <p className="text-gray-400 text-xs mt-3">Code expires in 10 minutes</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Email Verified!</h2>
        <p className="text-gray-500 text-sm mb-4">
          Your account is ready — taking you to your dashboard now.
        </p>
        <p className="text-gray-400 text-xs flex items-center justify-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  const input = 'w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#6B3FD9] focus:border-transparent focus:outline-none transition text-sm [@media(max-height:760px)]:py-1.5';
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm w-full max-w-md mx-auto [@media(max-height:760px)]:p-4">
      <h1 className="text-xl font-bold text-gray-900 text-center">Sign up for ExiusCart</h1>
      <p className="text-gray-500 mb-3 mt-0.5 text-sm text-center [@media(max-height:700px)]:hidden">
        {chosenPlan ? `Start your ${chosenPlanLabel} plan — free for 7 days` : 'Start your 7-day free trial — no credit card'}
      </p>

      {refCode && (
        <div className="bg-[#6B3FD9]/5 border border-[#6B3FD9]/20 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#6B3FD9] flex-shrink-0" />
          <p className="text-[#6B3FD9] text-xs">
            Referred by <span className="font-semibold">{refCode}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="mb-2.5">
        <SocialAuthButtons apiBase={API_BASE} beforeStart={requireTerms} onToken={handleSocial} onError={setError} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
        <div>
          <label htmlFor="ownerName" className="text-xs font-medium text-gray-800 mb-0.5 block">Name</label>
          <input id="ownerName" type="text" {...register('ownerName')} className={input} placeholder="Enter your name" />
          {errors.ownerName && <p className="text-red-600 text-xs mt-1">{errors.ownerName.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="text-xs font-medium text-gray-800 mb-0.5 block">Email</label>
          <input id="email" type="email" {...register('email')} className={input} placeholder="Enter your email address" />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="text-xs font-medium text-gray-800 mb-0.5 block">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} {...register('password')}
              className={`${input} pr-11`} placeholder="Create a password (min 8 characters)" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div className="flex items-start gap-2.5">
          <input
            type="checkbox" id="terms" required
            checked={termsAccepted}
            onChange={(e) => { setTermsAccepted(e.target.checked); if (e.target.checked) setError(''); }}
            className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-gray-50 text-[#6B3FD9] focus:ring-[#6B3FD9] focus:ring-offset-0"
          />
          <label htmlFor="terms" className="text-xs text-gray-600 leading-snug">
            I agree to ExiusCart&apos;s{' '}
            <Link href="/terms" className="text-[#6B3FD9] hover:text-[#5A2EC9] transition">terms of use</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-[#6B3FD9] hover:text-[#5A2EC9] transition">privacy policy</Link>.
          </label>
        </div>

        <button
          type="submit" disabled={isLoading}
          className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="text-center mt-3 text-gray-600 text-sm">
        Already have an account?{' '}
        <a href="https://store.exiuscart.com/login" className="text-[#6B3FD9] font-semibold hover:text-[#5A2EC9] transition">
          Log in
        </a>
      </p>
    </div>
  );
}

function Showcase() {
  return (
    <div className="hidden lg:flex flex-col justify-center">
      <div className="rounded-3xl bg-gradient-to-br from-[#1B1146] via-[#2B1A6E] to-[#4A2EC9] p-8 shadow-xl">
        <h2 className="text-3xl font-bold text-white leading-tight">
          Run your whole business<br />from one dashboard.
        </h2>
        <p className="mt-2 text-sm text-indigo-200">POS, inventory, invoicing and every sales channel — free for 7 days.</p>
        <div className="mt-6 overflow-hidden rounded-xl border border-white/15 shadow-2xl">
          <Image src="/auth-preview.webp" alt="ExiusCart dashboard" width={1400} height={933} priority className="h-auto w-full" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-indigo-100">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-300" /> Set up in minutes</div>
          <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-sky-300" /> Sell on every channel</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> No card needed</div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col">
      <AuthHeader />
      <div className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-10 px-4 py-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Suspense fallback={null}>
            <RegisterForm />
          </Suspense>
          <SupportCard text="Need a hand signing up?" />
        </div>
        <Showcase />
      </div>
    </div>
  );
}
