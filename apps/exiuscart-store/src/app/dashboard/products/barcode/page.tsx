'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';

interface LabelData {
  name: string;
  sku: string;
  barcode: string;
  price: string;
}

function BarcodeLabel({ label, copies }: { label: LabelData; copies: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !label.barcode) return;
    try {
      JsBarcode(ref.current, label.barcode, {
        format: 'CODE128',
        width: 2,
        height: 50,
        fontSize: 11,
        displayValue: true,
        margin: 6,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch { /* invalid value */ }
  }, [label.barcode]);

  return (
    <>
      {Array.from({ length: copies }).map((_, i) => (
        <div
          key={i}
          className="border border-gray-300 rounded p-2 flex flex-col items-center justify-center bg-white"
          style={{ width: '200px', minHeight: '100px', pageBreakInside: 'avoid' }}
        >
          <p className="text-xs font-semibold text-center truncate w-full text-center" style={{ maxWidth: '180px' }}>
            {label.name}
          </p>
          {label.sku && <p className="text-xs text-gray-500">{label.sku}</p>}
          <svg ref={ref} style={{ width: '180px' }} />
          {label.price && <p className="text-sm font-bold mt-1">{label.price}</p>}
        </div>
      ))}
    </>
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

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Controls — hidden when printing */}
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
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
              className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
            />
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            <Printer className="w-4 h-4" /> Print Labels
          </button>
        </div>
      </div>

      {/* Label grid */}
      <div className="p-6 print:p-0">
        {labels.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>No barcode data provided.</p>
            <p className="text-sm mt-1">Open this page from the Products list by clicking Print Barcode.</p>
          </div>
        ) : (
          <div
            className="flex flex-wrap gap-3 print:gap-2"
            style={{ maxWidth: '900px', margin: '0 auto' }}
          >
            {labels.map((label, i) => (
              <BarcodeLabel key={i} label={label} copies={copies} />
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
