'use client';

import { colorNameToHex } from '@/lib/color-utils';

interface ColorSwatchProps {
  name?: string | null;
  hex?: string | null;
  size?: number;
}

/** A small circle showing a variant's actual color — an explicit color_hex
 * always wins, otherwise guessed from the color name. Shows a dashed "no
 * preview" circle rather than guessing wrong when neither is available. */
export function ColorSwatch({ name, hex, size = 16 }: ColorSwatchProps) {
  const resolved = hex || colorNameToHex(name);
  const style = { width: size, height: size };

  if (!resolved) {
    return (
      <span
        className="inline-block rounded-full border border-dashed border-muted-foreground/40 shrink-0"
        style={style}
        title="No color preview"
      />
    );
  }

  return (
    <span
      className="inline-block rounded-full border border-border shrink-0"
      style={{ ...style, backgroundColor: resolved }}
      title={name || resolved}
    />
  );
}
