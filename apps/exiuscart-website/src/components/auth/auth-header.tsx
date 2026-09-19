import Link from 'next/link';
import Image from 'next/image';

// Minimal top bar for the sign-in / sign-up screens: centred logo, one
// "Support" link on the right. No product navigation — nothing to lead the
// visitor away from finishing the form.
export function AuthHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-center px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="ExiusCart home">
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
          <span className="text-xl font-bold tracking-tight text-gray-900">
            <span className="text-[#6B3FD9]">Exius</span>Cart
          </span>
        </Link>
        <Link href="/contact" className="absolute right-6 text-sm font-semibold text-gray-900 transition hover:text-[#6B3FD9]">
          Support
        </Link>
      </div>
    </header>
  );
}
