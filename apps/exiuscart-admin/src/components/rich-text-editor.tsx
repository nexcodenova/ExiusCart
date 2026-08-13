'use client';

import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading, ImageIcon, Loader2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
  // When provided, shows an "insert image" button — the caller does the
  // actual upload (admin's /admin/shopping/upload-image) and hands back a
  // public URL.
  onUploadImage?: (file: File) => Promise<string>;
  maxImages?: number;
}

const TOOLBAR_BUTTONS = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

// Pasted content is almost always from somewhere else (CJ's own listing,
// AliExpress, a Word doc) — stripping embedded images and any script/style
// tags here matches the same cleanup CJ imports already get server-side
// (admin.py: _strip_description_images), so a pasted description can't
// reintroduce the redundant-image problem by hand.
function sanitizePastedHtml(html: string): string {
  let clean = html.replace(/<img\b[^>]*>/gi, '');
  clean = clean.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  return clean;
}

export function RichTextEditor({ value, onChange, placeholder, rows = 4, onUploadImage, maxImages = 3 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');

  // Sync external value changes (e.g. switching to a different product) into
  // the editor — but only when it's not currently focused, so we never stomp
  // on the user's cursor position while they're actively typing.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const imageCount = () => (editorRef.current?.innerHTML.match(/<img\b/gi) ?? []).length;

  const handleImageButtonClick = () => {
    if (imageCount() >= maxImages) {
      setImageError(`Only ${maxImages} images allowed in the description.`);
      return;
    }
    // Selection is lost the moment the file picker opens — save it now so
    // the image lands where the cursor actually was, not wherever focus
    // ends up after the async upload finishes.
    const sel = window.getSelection();
    savedRangeRef.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadImage) return;
    setImageError('');
    setUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      editorRef.current?.focus();
      const sel = window.getSelection();
      if (sel && savedRangeRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
      document.execCommand('insertImage', false, url);
      onChange(editorRef.current?.innerHTML ?? '');
    } catch {
      setImageError("Couldn't upload that image — try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return; // no HTML on the clipboard — let the browser's default plain-text paste happen, it's already safe
    e.preventDefault();
    document.execCommand('insertHTML', false, sanitizePastedHtml(html));
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div className="border border-gray-700 rounded-lg bg-[#0B1121] overflow-hidden focus-within:border-[#6B3FD9]">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-700 bg-[#151F32]">
        {TOOLBAR_BUTTONS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            title={label}
            onMouseDown={(e) => e.preventDefault()} // keep focus/selection in the editor
            onClick={() => exec(command)}
            className="p-1.5 rounded hover:bg-gray-800 transition text-gray-400 hover:text-white"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <button
          type="button"
          title="Heading"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('formatBlock', 'h3')}
          className="p-1.5 rounded hover:bg-gray-800 transition text-gray-400 hover:text-white"
        >
          <Heading className="w-3.5 h-3.5" />
        </button>
        {onUploadImage && (
          <>
            <div className="w-px h-4 bg-gray-700 mx-0.5" />
            <button
              type="button"
              title={`Insert image (up to ${maxImages})`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleImageButtonClick}
              disabled={uploadingImage}
              className="p-1.5 rounded hover:bg-gray-800 transition text-gray-400 hover:text-white disabled:opacity-50"
            >
              {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileSelected} />
          </>
        )}
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <p className="absolute top-2.5 left-3 text-gray-600 pointer-events-none select-none text-sm">{placeholder}</p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
          onBlur={() => onChange(editorRef.current?.innerHTML ?? '')}
          onPaste={handlePaste}
          className="w-full px-3 py-2.5 outline-none text-white text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
      </div>
      {imageError && <p className="text-xs text-red-400 px-3 pb-2">{imageError}</p>}
    </div>
  );
}
