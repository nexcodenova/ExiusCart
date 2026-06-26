'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';

const PUBLIC_BASE = 'https://exiuscart.com';

interface LabelData {
  name: string;
  sku: string;
  barcode: string;
  price: string;
}

function SingleLabel({ label }: { label: LabelData }) {
  const ref = useRef<SVGSVGElement>(null);
  const qrUrl = `${PUBLIC_BASE}/p/${label.barcode}`;

  useEffect(() => {
    if (!ref.current || !label.barcode) return;
    try {
      JsBarcode(ref.current, label.barcode, {
        format: 'CODE128',
        width: 1.8,
        height: 36,
        fontSize: 10,
        displayValue: true,
        margin: 3,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch { /* invalid value — skip */ }
  }, [label.barcode]);

  return (
    <div
      className="border border-gray-300 rounded flex flex-col items-center bg-white text-black p-2 gap-1"
      style={{ width: '240px', minHeight: '140px', pageBreakInside: 'avoid' }}
    >
      {/* Product name */}
      <p className="text-xs font-semibold text-center leading-tight text-black w-full px-1 line-clamp-2" style={{ maxWidth: '230px' }}>
        {label.name}
      </p>
      {label.sku && <p className="text-[9px] text-gray-500">SKU: {label.sku}</p>}

      {/* Price */}
      {label.price && (
        <p className="text-base font-extrabold text-black leading-none">{label.price}</p>
      )}

      {/* CODE128 barcode (for POS scanner) */}
      {label.barcode ? (
        <svg ref={ref} style={{ width: '200px' }} />
      ) : (
        <p className="text-[11px] text-gray-400 my-2">No barcode set</p>
      )}

      {/* Divider + QR section */}
      {label.barcode && (
        <div className="w-full border-t border-gray-200 pt-1.5 flex items-center gap-2 justify-center">
          <QRCodeSVG
            value={qrUrl}
            size={52}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
          />
          <div className="text-left">
            <p className="text-[8px] text-gray-500 leading-tight">Scan QR to view</p>
            <p className="text-[8px] text-gray-500 leading-tight">stock & details</p>
            <p className="text-[8px] text-gray-400 font-mono leading-tight mt-0.5">exiuscart.com/p/</p>
            <p className="text-[8px] text-gray-400 font-mono leading-tight">{label.barcode.slice(-6)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarcodePrintPage() {
  const params = useSearchParams();
  const [copies, setCopies] = useState(1);

  const labels: LabelData[] = [];
  try {
    const raw = params.get('data');
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) labels.push(...parsed);
      else labels.push(parsed);
    }
  } catch { /* invalid data */ }

  const allLabels: LabelData[] = labels.flatMap((l) =>
    Array.from({ length: copies }, () => l)
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="print:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between gap-4">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Copies per label:</label>
            <input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center text-black"
            />
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            <Printer className="w-4 h-4" /> Print Labels
          </button>
        </div>
      </div>

      <div className="p-6 print:p-0">
        {allLabels.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>No barcode data provided.</p>
            <p className="text-sm mt-1">Open this page from the Products list by clicking Print Barcode.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 print:gap-2" style={{ maxWidth: '960px', margin: '0 auto' }}>
            {allLabels.map((label, i) => (
              <SingleLabel key={i} label={label} />
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:gap-2 { gap: 0.5rem !important; }
        }
      `}</style>
    </div>
  );
}
