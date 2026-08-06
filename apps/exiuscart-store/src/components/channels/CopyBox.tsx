'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-xs text-foreground break-all font-mono">
          {value}
        </code>
        <button type="button" onClick={copy}
          className="shrink-0 p-2 rounded-lg border border-border hover:bg-muted transition" title="Copy">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
