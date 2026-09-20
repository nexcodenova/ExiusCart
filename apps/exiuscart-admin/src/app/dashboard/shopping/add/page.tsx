'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { SupplierLogo } from '@/components/supplier-logo';

type Status = 'loading' | 'connected' | 'disconnected';

// Where new Prodora products come from. Picking a supplier opens its import
// window on the All Products page; anything added is saved there with the
// next ID for that supplier (CJ001, AL001, ...).
export default function AddProductsPage() {
  const [cj, setCj] = useState<Status>('loading');
  const [ali, setAli] = useState<Status>('loading');

  useEffect(() => {
    adminApi.cjStatus().then((r: any) => setCj(r.data?.connected ? 'connected' : 'disconnected')).catch(() => setCj('disconnected'));
    adminApi.aliexpressStatus().then((r: any) => setAli(r.data?.connected ? 'connected' : 'disconnected')).catch(() => setAli('disconnected'));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Products</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose where the product comes from. These are the suppliers ExiusCart supports. Connect a supplier once, then add as many products as you like.
          Everything you add is saved in <Link href="/dashboard/shopping" className="font-medium text-[#6B3FD9] hover:underline">All Products</Link> with
          its own ID, such as CJ001 or AL001.
        </p>
      </div>

      <SectionTitle title="Dropshipping suppliers" text="Products ship straight from the supplier to the customer." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SupplierCard
          name="CJ Dropshipping" idExample="CJ001" logo="cj" status={cj}
          text="Search the CJ catalogue, browse trending and category lists, and import products with their photos and variants."
          href="/dashboard/shopping?add=cj"
          action={cj === 'connected' ? 'Add from CJ' : 'Connect CJ'}
        />
        <SupplierCard
          name="AliExpress" idExample="AL001" logo="aliexpress" status={ali}
          text="Paste an AliExpress product link and Prodora pulls in the name, photos, price and variants."
          href="/dashboard/shopping?add=aliexpress"
          action={ali === 'connected' ? 'Add from AliExpress' : 'Connect AliExpress'}
        />
        <SupplierCard
          name="HyperSKU" idExample="HS001" logo="hypersku" status="soon"
          text="Sellers can already connect HyperSKU in their store. Adding its products to Prodora is not built yet."
        />
        <SupplierCard
          name="EPROLO" idExample="EP001" logo="eprolo" status="soon"
          text="Sellers can already connect EPROLO in their store. Adding its products to Prodora is not built yet."
        />
        <SupplierCard
          name="1688 (Alibaba)" idExample="AB001" logo="1688" status="soon"
          text="Wholesale products from 1688.com, Alibaba's domestic marketplace. Not built for Prodora yet."
        />
      </div>

      <SectionTitle title="Print on demand" text="Designs are printed and shipped by the provider for each order." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SupplierCard
          name="Printful" idExample="PF001" logo="printful" status="soon"
          text="Sellers can already connect Printful in their store. Adding its catalogue to Prodora is not built yet."
        />
        <SupplierCard
          name="Printify" idExample="PY001" logo="printify" status="soon"
          text="Sellers can already connect Printify in their store. Adding its catalogue to Prodora is not built yet."
        />
        <SupplierCard
          name="Gelato" idExample="GL001" logo="gelato" status="soon"
          text="Sellers can already connect Gelato in their store. Adding its catalogue to Prodora is not built yet."
        />
      </div>

      <SectionTitle title="Your own products" text="No supplier involved." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SupplierCard
          name="Add manually" idExample="MN001" logo="manual" status="ready"
          text="Type in a product yourself: name, photos, prices, supplier details and research data."
          href="/dashboard/shopping?add=manual" action="Add a product"
        />
        <SupplierCard
          name="Digital product" idExample="DG001" logo="digital" status="ready"
          text="Ebooks, coloring books and design bundles that ExiusCart makes and sells to sellers."
          href="/dashboard/digital-bundles?add=1" action="Add a digital product"
        />
      </div>
    </div>
  );
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function SupplierCard({
  name, idExample, logo, text, status, href, action,
}: {
  name: string; idExample: string; logo: string; text: string;
  status: Status | 'soon' | 'ready'; href?: string; action?: string;
}) {
  const badge =
    status === 'connected' ? <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600"><CheckCircle2 className="h-3 w-3" /> Connected</span>
    : status === 'disconnected' ? <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">Not connected</span>
    : status === 'soon' ? <span className="rounded-full bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-500">Coming soon</span>
    : status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
    : null;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <SupplierLogo supplier={logo} label={name} className="h-12 w-12" />
        {badge}
      </div>
      <h2 className="mt-4 text-base font-semibold text-gray-900">{name}</h2>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">{text}</p>
      <p className="mt-3 text-xs text-gray-500">Product IDs look like <span className="font-mono font-semibold text-gray-700">{idExample}</span></p>
      {href && action ? (
        <Link href={href} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#6B3FD9] px-4 text-sm font-semibold text-white transition hover:bg-[#5A2EC9]">
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-400">Not available yet</span>
      )}
    </div>
  );
}
