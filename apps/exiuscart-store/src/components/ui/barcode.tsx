'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  showLabel?: boolean;
}

export function BarcodeDisplay({
  value,
  width = 2,
  height = 60,
  fontSize = 14,
  showLabel = true,
}: BarcodeDisplayProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width,
        height,
        fontSize,
        displayValue: showLabel,
        margin: 8,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      // invalid barcode value — silently skip
    }
  }, [value, width, height, fontSize, showLabel]);

  if (!value) return null;
  return <svg ref={ref} className="w-full" />;
}

export function generateBarcode(): string {
  // Generate a unique 12-digit numeric barcode (Code128 compatible)
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000).toString();
  return timestamp + random;
}
