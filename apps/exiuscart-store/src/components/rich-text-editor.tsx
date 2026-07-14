'use client';

import { useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

const TOOLBAR_BUTTONS = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

export function RichTextEditor({ value, onChange, placeholder, rows = 4 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. switching to a different product) into the
  // editor — but only when it's not currently focused, so we never stomp on the
  // user's cursor position while they're actively typing.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div className="border border-border rounded-lg bg-muted overflow-hidden focus-within:ring-2 focus-within:ring-primary">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card">
        {TOOLBAR_BUTTONS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            title={label}
            onMouseDown={(e) => e.preventDefault()} // keep focus/selection in the editor
            onClick={() => exec(command)}
            className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <p className="absolute top-2.5 left-3 text-muted-foreground pointer-events-none select-none">{placeholder}</p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
          onBlur={() => onChange(editorRef.current?.innerHTML ?? '')}
          className="w-full px-3 py-2.5 outline-none text-foreground text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
      </div>
    </div>
  );
}
