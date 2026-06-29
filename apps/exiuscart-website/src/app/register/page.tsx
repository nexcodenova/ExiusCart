'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowLeft, Check, Store, Users, TrendingUp, Shield, Tag, Globe, Mail, Lock } from 'lucide-react';

const COUNTRIES = [
  // Middle East (top — primary market)
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', dialCode: '+971' },
  { code: 'SA', name: 'Saudi Arabia',         flag: '🇸🇦', currency: 'USD', dialCode: '+966' },
  { code: 'KW', name: 'Kuwait',               flag: '🇰🇼', currency: 'USD', dialCode: '+965' },
  { code: 'QA', name: 'Qatar',                flag: '🇶🇦', currency: 'USD', dialCode: '+974' },
  { code: 'BH', name: 'Bahrain',              flag: '🇧🇭', currency: 'USD', dialCode: '+973' },
  { code: 'OM', name: 'Oman',                 flag: '🇴🇲', currency: 'USD', dialCode: '+968' },
  { code: 'JO', name: 'Jordan',               flag: '🇯🇴', currency: 'USD', dialCode: '+962' },
  { code: 'LB', name: 'Lebanon',              flag: '🇱🇧', currency: 'USD', dialCode: '+961' },
  { code: 'IQ', name: 'Iraq',                 flag: '🇮🇶', currency: 'USD', dialCode: '+964' },
  { code: 'EG', name: 'Egypt',                flag: '🇪🇬', currency: 'USD', dialCode: '+20'  },
  { code: 'YE', name: 'Yemen',                flag: '🇾🇪', currency: 'USD', dialCode: '+967' },
  // South Asia
  { code: 'IN', name: 'India',                flag: '🇮🇳', currency: 'USD', dialCode: '+91'  },
  { code: 'PK', name: 'Pakistan',             flag: '🇵🇰', currency: 'USD', dialCode: '+92'  },
  { code: 'BD', name: 'Bangladesh',           flag: '🇧🇩', currency: 'USD', dialCode: '+880' },
  { code: 'LK', name: 'Sri Lanka',            flag: '🇱🇰', currency: 'USD', dialCode: '+94'  },
  { code: 'NP', name: 'Nepal',                flag: '🇳🇵', currency: 'USD', dialCode: '+977' },
  { code: 'AF', name: 'Afghanistan',          flag: '🇦🇫', currency: 'USD', dialCode: '+93'  },
  // Southeast Asia
  { code: 'MY', name: 'Malaysia',             flag: '🇲🇾', currency: 'USD', dialCode: '+60'  },
  { code: 'SG', name: 'Singapore',            flag: '🇸🇬', currency: 'USD', dialCode: '+65'  },
  { code: 'PH', name: 'Philippines',          flag: '🇵🇭', currency: 'USD', dialCode: '+63'  },
  { code: 'ID', name: 'Indonesia',            flag: '🇮🇩', currency: 'USD', dialCode: '+62'  },
  { code: 'TH', name: 'Thailand',             flag: '🇹🇭', currency: 'USD', dialCode: '+66'  },
  { code: 'VN', name: 'Vietnam',              flag: '🇻🇳', currency: 'USD', dialCode: '+84'  },
  // East Asia
  { code: 'CN', name: 'China',                flag: '🇨🇳', currency: 'USD', dialCode: '+86'  },
  { code: 'JP', name: 'Japan',                flag: '🇯🇵', currency: 'USD', dialCode: '+81'  },
  { code: 'KR', name: 'South Korea',          flag: '🇰🇷', currency: 'USD', dialCode: '+82'  },
  // Oceania
  { code: 'AU', name: 'Australia',            flag: '🇦🇺', currency: 'USD', dialCode: '+61'  },
  { code: 'NZ', name: 'New Zealand',          flag: '🇳🇿', currency: 'USD', dialCode: '+64'  },
  // Europe
  { code: 'GB', name: 'United Kingdom',       flag: '🇬🇧', currency: 'USD', dialCode: '+44'  },
  { code: 'DE', name: 'Germany',              flag: '🇩🇪', currency: 'USD', dialCode: '+49'  },
  { code: 'FR', name: 'France',               flag: '🇫🇷', currency: 'USD', dialCode: '+33'  },
  { code: 'IT', name: 'Italy',                flag: '🇮🇹', currency: 'USD', dialCode: '+39'  },
  { code: 'ES', name: 'Spain',                flag: '🇪🇸', currency: 'USD', dialCode: '+34'  },
  { code: 'NL', name: 'Netherlands',          flag: '🇳🇱', currency: 'USD', dialCode: '+31'  },
  { code: 'SE', name: 'Sweden',               flag: '🇸🇪', currency: 'USD', dialCode: '+46'  },
  { code: 'NO', name: 'Norway',               flag: '🇳🇴', currency: 'USD', dialCode: '+47'  },
  { code: 'DK', name: 'Denmark',              flag: '🇩🇰', currency: 'USD', dialCode: '+45'  },
  { code: 'CH', name: 'Switzerland',          flag: '🇨🇭', currency: 'USD', dialCode: '+41'  },
  { code: 'AT', name: 'Austria',              flag: '🇦🇹', currency: 'USD', dialCode: '+43'  },
  { code: 'PL', name: 'Poland',               flag: '🇵🇱', currency: 'USD', dialCode: '+48'  },
  { code: 'PT', name: 'Portugal',             flag: '🇵🇹', currency: 'USD', dialCode: '+351' },
  { code: 'BE', name: 'Belgium',              flag: '🇧🇪', currency: 'USD', dialCode: '+32'  },
  { code: 'GR', name: 'Greece',               flag: '🇬🇷', currency: 'USD', dialCode: '+30'  },
  { code: 'CZ', name: 'Czech Republic',       flag: '🇨🇿', currency: 'USD', dialCode: '+420' },
  { code: 'HU', name: 'Hungary',              flag: '🇭🇺', currency: 'USD', dialCode: '+36'  },
  { code: 'RO', name: 'Romania',              flag: '🇷🇴', currency: 'USD', dialCode: '+40'  },
  { code: 'RU', name: 'Russia',               flag: '🇷🇺', currency: 'USD', dialCode: '+7'   },
  { code: 'TR', name: 'Turkey',               flag: '🇹🇷', currency: 'USD', dialCode: '+90'  },
  // Americas
  { code: 'US', name: 'United States',        flag: '🇺🇸', currency: 'USD', dialCode: '+1'   },
  { code: 'CA', name: 'Canada',               flag: '🇨🇦', currency: 'USD', dialCode: '+1'   },
  { code: 'BR', name: 'Brazil',               flag: '🇧🇷', currency: 'USD', dialCode: '+55'  },
  { code: 'MX', name: 'Mexico',               flag: '🇲🇽', currency: 'USD', dialCode: '+52'  },
  { code: 'AR', name: 'Argentina',            flag: '🇦🇷', currency: 'USD', dialCode: '+54'  },
  { code: 'CL', name: 'Chile',                flag: '🇨🇱', currency: 'USD', dialCode: '+56'  },
  { code: 'CO', name: 'Colombia',             flag: '🇨🇴', currency: 'USD', dialCode: '+57'  },
  // Africa
  { code: 'NG', name: 'Nigeria',              flag: '🇳🇬', currency: 'USD', dialCode: '+234' },
  { code: 'ZA', name: 'South Africa',         flag: '🇿🇦', currency: 'USD', dialCode: '+27'  },
  { code: 'GH', name: 'Ghana',                flag: '🇬🇭', currency: 'USD', dialCode: '+233' },
  { code: 'KE', name: 'Kenya',                flag: '🇰🇪', currency: 'USD', dialCode: '+254' },
  { code: 'ET', name: 'Ethiopia',             flag: '🇪🇹', currency: 'USD', dialCode: '+251' },
  { code: 'TZ', name: 'Tanzania',             flag: '🇹🇿', currency: 'USD', dialCode: '+255' },
  { code: 'UG', name: 'Uganda',               flag: '🇺🇬', currency: 'USD', dialCode: '+256' },
  { code: 'MA', name: 'Morocco',              flag: '🇲🇦', currency: 'USD', dialCode: '+212' },
  { code: 'TN', name: 'Tunisia',              flag: '🇹🇳', currency: 'USD', dialCode: '+216' },
];

const registerSchema = z
  .object({
    shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
    ownerName: z.string().min(2, 'Your name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    phone: z.string().min(9, 'Please enter a valid phone number'),
    country: z.string().min(1, 'Please select your country'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    refCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const features = [
  { icon: Store, text: 'Easy store setup in minutes' },
  { icon: Users, text: 'Manage staff & teams' },
  { icon: TrendingUp, text: 'Real-time sales analytics' },
  { icon: Shield, text: 'Secure payment processing' },
];

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
  const [phoneDialCode, setPhoneDialCode] = useState('+971');
  const searchParams = useSearchParams();
  const router = useRouter();
  const refFromUrl = searchParams.get('ref') || '';
  const [isRefLocked, setIsRefLocked] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { refCode: '', country: '' },
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
          document.cookie = `exiuscart_ref=${code}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Lax`;
        } else {
          // Invalid or inactive — clear and unlock
          document.cookie = 'exiuscart_ref=; max-age=0; path=/';
          setValue('refCode', '');
          setIsRefLocked(false);
        }
      })
      .catch(() => {
        // Network error: keep locked so the code isn't lost
      });
  }, [refFromUrl, setValue]);

  const refCode = watch('refCode');
  const selectedCountry = watch('country');
  const countryObj = COUNTRIES.find(c => c.code === selectedCountry);

  useEffect(() => {
    if (countryObj?.dialCode) setPhoneDialCode(countryObj.dialCode);
  }, [countryObj]);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: data.shopName,
          owner_name: data.ownerName,
          email: data.email,
          phone: `${phoneDialCode}${data.phone}`,
          password: data.password,
          ref_code: data.refCode || undefined,
          country: data.country || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Registration failed');
      }
      const body = await res.json();
      if (data.country) {
        const c = COUNTRIES.find(x => x.code === data.country);
        if (c) {
          localStorage.setItem('user_country', data.country);
          localStorage.setItem('billing_currency', c.currency);
        }
      }
      if (body.status === 'otp_sent') {
        setPendingEmail(body.email);
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login?registered=1'), 1500);
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid code');
      }
        setSuccess(true);
      setTimeout(() => { window.location.href = 'https://store.exiuscart.com/login'; }, 2000);
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
      <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-8 text-center">
        <div className="w-16 h-16 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Mail className="w-8 h-8 text-[#6B3FD9]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-gray-400 text-sm mb-1">We sent a 6-digit code to</p>
        <p className="text-white font-medium text-sm mb-6">{pendingEmail}</p>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full text-center text-3xl font-bold tracking-[0.5em] bg-[#0B1121] border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:border-[#6B3FD9] focus:ring-1 focus:ring-[#6B3FD9] outline-none transition mb-4"
        />

        {otpError && (
          <p className="text-red-400 text-sm mb-4">{otpError}</p>
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
            <span className="text-green-400">Code resent!</span>
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
        <p className="text-gray-600 text-xs mt-3">Code expires in 10 minutes</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-8 text-center">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-3">Email Verified!</h2>
        <p className="text-gray-400 text-sm mb-4">
          Your email has been verified successfully. Our team will review and approve your account shortly. You will receive an email once approved.
        </p>
        <p className="text-gray-500 text-xs flex items-center justify-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Redirecting to login...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6 sm:p-8">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Create Your Account</h1>
      <p className="text-gray-400 mb-6 text-sm sm:text-base">
        Start your 14-day free trial today
      </p>

      {/* Trial Badge */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
        <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
        <p className="text-green-400 text-sm">No credit card required for trial</p>
      </div>

      {/* Referral Badge */}
      {refCode && (
        <div className="bg-[#6B3FD9]/10 border border-[#6B3FD9]/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#6B3FD9] flex-shrink-0" />
          <p className="text-[#6B3FD9] text-sm">
            Referred by <span className="font-semibold">{refCode}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="shopName" className="block text-sm text-gray-400 mb-2">
            Shop Name
          </label>
          <input
            id="shopName"
            type="text"
            {...register('shopName')}
            className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm sm:text-base"
            placeholder="Your store name"
          />
          {errors.shopName && (
            <p className="text-red-400 text-sm mt-1">{errors.shopName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="ownerName" className="block text-sm text-gray-400 mb-2">
            Your Name
          </label>
          <input
            id="ownerName"
            type="text"
            {...register('ownerName')}
            className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm sm:text-base"
            placeholder="Your full name"
          />
          {errors.ownerName && (
            <p className="text-red-400 text-sm mt-1">{errors.ownerName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm text-gray-400 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm sm:text-base"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm text-gray-400 mb-2">
            Phone Number
          </label>
          <div className="flex">
            <select
              value={phoneDialCode}
              onChange={(e) => setPhoneDialCode(e.target.value)}
              className="bg-[#0B1121] border border-gray-700 border-r-0 rounded-l-lg pl-3 pr-1 py-3 text-white focus:border-[#6B3FD9] focus:outline-none transition text-sm appearance-none cursor-pointer w-28 shrink-0"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.dialCode}>
                  {c.flag} {c.dialCode}
                </option>
              ))}
            </select>
            <input
              id="phone"
              type="tel"
              {...register('phone')}
              className="flex-1 min-w-0 px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-r-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm sm:text-base"
              placeholder="50 123 4567"
            />
          </div>
          {errors.phone && (
            <p className="text-red-400 text-sm mt-1">{errors.phone.message}</p>
          )}
        </div>

        {/* Country */}
        <div>
          <label htmlFor="country" className="block text-sm text-gray-400 mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Country <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <select
              id="country"
              {...register('country')}
              className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm sm:text-base appearance-none"
            >
              <option value="">Select your country...</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
            {countryObj && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="text-xs text-[#6B3FD9] font-medium bg-[#6B3FD9]/10 px-2 py-0.5 rounded-full">{countryObj.currency}</span>
              </div>
            )}
          </div>
          {errors.country && (
            <p className="text-red-400 text-sm mt-1">{errors.country.message}</p>
          )}
          {countryObj && countryObj.code === 'AE' && (
            <p className="text-[#6B3FD9] text-xs mt-1">Pricing shown in AED • Payments via UAE bank cards</p>
          )}
          {countryObj && countryObj.code !== 'AE' && countryObj.code !== '' && (
            <p className="text-gray-400 text-xs mt-1">Pricing shown in USD • International cards accepted</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition pr-12 text-sm sm:text-base"
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm text-gray-400 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
            className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm sm:text-base"
            placeholder="Confirm your password"
          />
          {errors.confirmPassword && (
            <p className="text-red-400 text-sm mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Referral Code Field */}
        <div>
          <label htmlFor="refCode" className="block text-sm text-gray-400 mb-2 flex items-center gap-1.5">
            Referral Code
            {isRefLocked
              ? <span className="text-[#6B3FD9] text-xs font-medium">(applied)</span>
              : <span className="text-gray-600">(optional)</span>
            }
          </label>
          <div className="relative">
            <input
              id="refCode"
              type="text"
              {...register('refCode')}
              readOnly={isRefLocked}
              className={`w-full px-4 py-3 pr-10 rounded-lg text-white placeholder-gray-500 focus:outline-none transition text-sm sm:text-base uppercase ${
                isRefLocked
                  ? 'bg-[#6B3FD9]/5 border border-[#6B3FD9]/30 cursor-not-allowed text-[#9B6FFF]'
                  : 'bg-[#0B1121] border border-gray-700 focus:border-[#6B3FD9]'
              }`}
              placeholder="e.g., JOHN8F2A"
            />
            {isRefLocked && (
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B3FD9]" />
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 pt-2">
          <input
            type="checkbox"
            id="terms"
            required
            className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-[#0B1121] text-[#6B3FD9] focus:ring-[#6B3FD9] focus:ring-offset-0"
          />
          <label htmlFor="terms" className="text-sm text-gray-400">
            I agree to the{' '}
            <Link href="/terms" className="text-[#6B3FD9] hover:text-[#8B5CF6] transition">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-[#6B3FD9] hover:text-[#8B5CF6] transition">
              Privacy Policy
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 sm:py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
        >
          {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          Create Account
        </button>
      </form>

      <p className="text-center mt-6 text-gray-400 text-sm sm:text-base">
        Already have an account?{' '}
        <Link href="/login" className="text-[#6B3FD9] font-semibold hover:text-[#8B5CF6] transition">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#0B1121] flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#151F32] to-[#0B1121] flex-col justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#6B3FD9] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#6B3FD9] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 mb-12">
            <span className="text-2xl font-bold text-white tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          </Link>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Start Your Business<br />
            <span className="text-[#6B3FD9]">Journey Today</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10">
            Everything you need to run your shop — products, orders, customers, and more in one place.
          </p>

          <div className="space-y-5">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-[#6B3FD9]" />
                </div>
                <span className="text-gray-300 text-base">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <header className="p-4 sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <Link href="/" className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <span className="text-2xl font-bold text-white tracking-tight">
                <span className="text-[#6B3FD9]">Exius</span>Cart
              </span>
            </Link>

            <Suspense fallback={null}>
              <RegisterForm />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

