'use client';

import { useEffect, useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { Package } from 'lucide-react';

// Four blue dots that light up in turn while an image loads. Fills its
// (relative) parent, so it doubles as the placeholder for skeleton tiles.
export function DotsLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white" role="status" aria-label="Loading image">
      <span className="dots-loader" aria-hidden="true"><i /><i /><i /><i /></span>
    </div>
  );
}

// next/image that fades in over the animated dots until the picture
// has actually loaded. The parent element must be `position: relative`.
export default function LoadingImage({ className = '', onLoad, onError, ...props }: Omit<ImageProps, 'fill'>) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setLoaded(false); setFailed(false); }, [props.src]);

  if (failed) {
    return <div className="absolute inset-0 flex items-center justify-center bg-gray-50"><Package className="h-14 w-14 text-gray-300" /></div>;
  }

  return (
    <>
      {!loaded && <DotsLoader />}
      <Image
        {...props} fill
        onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
        onError={(e) => { setFailed(true); onError?.(e); }}
        className={`transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </>
  );
}
