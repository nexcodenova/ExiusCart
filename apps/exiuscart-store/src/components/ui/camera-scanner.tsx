'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const readerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch {}
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    stopCamera();

    try {
      const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/browser');

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      // Prefer back camera on mobile
      const backCamera = devices.find(
        (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment')
      );
      const deviceId = backCamera?.deviceId || devices[devices.length - 1]?.deviceId;

      if (!videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, facingMode: { ideal: 'environment' } }
          : { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setStatus('scanning');

      reader.decodeFromVideoElement(videoRef.current, (result, err) => {
        if (result) {
          stopCamera();
          onScan(result.getText());
          onClose();
        }
      });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setErrorMsg('Camera access denied. Please allow camera permission and try again.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setErrorMsg('No camera found on this device.');
      } else {
        setErrorMsg('Could not start camera. ' + msg);
      }
      setStatus('error');
    }
  }, [onScan, onClose, stopCamera]);

  useEffect(() => {
    startScanner();
    return () => stopCamera();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 z-10">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-white" />
          <span className="text-white font-semibold">Scan Barcode</span>
        </div>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Video / States */}
      <div className="relative w-full max-w-sm aspect-square mx-4">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm text-gray-300">Starting camera...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-white text-sm">{errorMsg}</p>
            <button
              onClick={startScanner}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className={`w-full h-full object-cover rounded-2xl ${status !== 'scanning' ? 'invisible' : ''}`}
          muted
          playsInline
        />

        {/* Scanning crosshair overlay */}
        {status === 'scanning' && (
          <>
            {/* Corner brackets */}
            <div className="absolute inset-8 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{ borderWidth: '3px' }} />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" style={{ borderWidth: '3px' }} />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" style={{ borderWidth: '3px' }} />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" style={{ borderWidth: '3px' }} />
              {/* Scan line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-green-400/80 animate-scan-line" />
            </div>
          </>
        )}
      </div>

      {status === 'scanning' && (
        <p className="text-gray-400 text-sm mt-6">Point camera at a barcode</p>
      )}
    </div>
  );
}
