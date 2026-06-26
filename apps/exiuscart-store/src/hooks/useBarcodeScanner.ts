'use client';

import { useEffect, useRef, useCallback } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;       // min chars to consider a barcode (default: 3)
  maxDelay?: number;        // max ms between keystrokes for scanner (default: 50ms)
  enabled?: boolean;
}

/**
 * Detects barcode scanner input.
 * Barcode scanners act as keyboards but type VERY fast (< 50ms between chars)
 * and always end with an Enter key press.
 * This hook captures that pattern and fires onScan with the barcode value.
 */
export function useBarcodeScanner({
  onScan,
  minLength = 3,
  maxDelay = 100,
  enabled = true,
}: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    bufferRef.current = '';
    lastKeyTimeRef.current = 0;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        // Allow barcode scanner in barcode-specific inputs
        if (!target.hasAttribute('data-barcode-input')) return;
      }

      const now = Date.now();
      const timeSinceLast = now - lastKeyTimeRef.current;

      // If too much time passed, reset buffer (user typing manually)
      if (lastKeyTimeRef.current > 0 && timeSinceLast > maxDelay) {
        reset();
      }

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= minLength) {
          onScan(barcode);
        }
        reset();
        return;
      }

      // Only capture printable characters
      if (e.key.length === 1) {
        lastKeyTimeRef.current = now;
        bufferRef.current += e.key;

        // Auto-clear buffer after maxDelay * 10 in case no Enter is sent
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(reset, maxDelay * 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      reset();
    };
  }, [enabled, maxDelay, minLength, onScan, reset]);
}
