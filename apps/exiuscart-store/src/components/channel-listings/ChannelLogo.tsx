'use client';

import { useState } from 'react';
import { channelMeta } from './channelMeta';

// Renders the real brand SVG from /public/channel-logos when channelMeta has
// a `logo` for this channel, cleanly falling back to the brand-coloured
// lucide icon if the file 404s or none is defined. Wide wordmark logos keep
// their aspect ratio (height fixed, width auto); square icons render size×size.
export default function ChannelLogo({
  channelType,
  size = 14,
  className = '',
}: {
  channelType: string;
  size?: number;
  className?: string;
}) {
  const meta = channelMeta(channelType);
  const [fileOk, setFileOk] = useState(Boolean(meta.logo));
  const Icon = meta.icon;

  if (fileOk && meta.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={meta.logo}
        alt={meta.label}
        title={meta.label}
        className={className}
        style={
          meta.wide
            ? { height: size, width: 'auto', maxWidth: size * 4, objectFit: 'contain' }
            : { height: size, width: size, objectFit: 'contain' }
        }
        onError={() => setFileOk(false)}
      />
    );
  }

  return <Icon className={`${meta.color} ${className}`} style={{ width: size, height: size }} />;
}
