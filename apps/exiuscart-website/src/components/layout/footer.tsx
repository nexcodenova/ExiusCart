import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Facebook, Linkedin, Twitter } from 'lucide-react';

const NAV = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',     href: '/features'     },
      { label: 'Pricing',      href: '/pricing'      },
      { label: 'Integrations', href: '/integrations' },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { label: 'Marketplace',           href: '/industries'    },
      { label: 'Shopify & Custom Sites', href: '/integrations'},
      { label: 'Physical Shops',        href: '/industries'   },
      { label: 'All Industries', href: '/industries'          },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Blog',       href: '/blog'      },
      { label: 'FAQ',        href: '/faq'       },
      { label: 'Affiliates', href: '/affiliate' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact Us',            href: '/contact'                        },
      { label: 'support@exiuscart.com', href: 'mailto:support@exiuscart.com'   },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',       href: '/about'                    },
      { label: 'Careers',     href: '/careers'                  },
      { label: 'NexCodeNova', href: 'https://nexcodenova.com'  },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy',   href: '/privacy'       },
      { label: 'Terms of Service', href: '/terms'         },
      { label: 'Refund Policy',    href: '/refund-policy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#060A14] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">

        {/* Nav columns — full width */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-10 py-14">
          {NAV.map((col) => (
            <div key={col.heading}>
              <p className="text-white text-xs font-semibold uppercase tracking-widest mb-5">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-gray-500 hover:text-gray-200 text-sm transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Logo + Socials row */}
        <div className="flex items-center justify-between py-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo.svg" alt="ExiusCart" width={26} height={26} />
            <span className="text-lg font-bold text-white tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <SocialIcon href="https://linkedin.com/company/nexcodenova" aria="LinkedIn">
              <Linkedin className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://twitter.com/exiuscart" aria="Twitter / X">
              <Twitter className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://instagram.com/exiuscart" aria="Instagram">
              <Instagram className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://facebook.com/exiuscart" aria="Facebook">
              <Facebook className="w-4 h-4" />
            </SocialIcon>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Copyright row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-6">
          <p className="text-gray-600 text-xs">
            &copy; {new Date().getFullYear()} ExiusCart — a brand of{' '}
            <span className="text-gray-500">Fairam Private Limited</span>.
            {' '}All rights reserved.
          </p>
          <p className="text-gray-600 text-xs">
            Developed by{' '}
            <a
              href="https://nexcodenova.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6B3FD9] hover:text-[#a78bfa] transition-colors"
            >
              NexCodeNova
            </a>
          </p>
        </div>

      </div>
    </footer>
  );
}

function SocialIcon({ href, aria, children }: { href: string; aria: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={aria}
      className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
    >
      {children}
    </a>
  );
}
