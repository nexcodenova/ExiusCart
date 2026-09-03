'use client';

import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading, ImageIcon, Loader2, Tags, X } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
  // When provided, shows an "insert image" button — the caller does the
  // actual upload (shop-scoped presign + R2 PUT) and hands back a public
  // URL. Omitted entirely (e.g. email-marketing's usage) hides the button.
  onUploadImage?: (file: File) => Promise<string>;
  maxImages?: number;
  // Shows an "insert tag pills" button — a small popover to type a few
  // short labels (e.g. "Python", "Data Science") that get inserted as a
  // wrapped row of pill chips wherever the cursor is. Opt-in per usage
  // (product description only, for now), same gating pattern as
  // onUploadImage above.
  enableTagPills?: boolean;
}

// Inline styles, not Tailwind classes — this HTML is saved into the
// product description and rendered raw by whatever storefront pulls it
// from the public API (Custom Website/ODTSI, or anywhere else). None of
// those pages load this dashboard's stylesheet, so the pills have to
// carry their own look directly on each element or they'd render as
// plain unstyled text on the real storefront.
const TAG_PILL_ROW_STYLE = 'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;';
const TAG_PILL_STYLE = 'display:inline-block;padding:6px 14px;border:1px solid #E2E4E9;border-radius:9999px;font-size:13px;font-weight:500;color:#1F2937;background:#FAFAFA;';

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

const TOOLBAR_BUTTONS = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

// Pasted content is almost always from somewhere else (a supplier listing,
// another marketplace, a Word doc) — stripping embedded images and any
// script/style tags here closes the exact loophole that let dropship-import
// descriptions end up full of redundant photos: a seller pasting the same
// kind of content by hand would otherwise reintroduce it manually.
function sanitizePastedHtml(html: string): string {
  let clean = html.replace(/<img\b[^>]*>/gi, '');
  clean = clean.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  return clean;
}

export function RichTextEditor({ value, onChange, placeholder, rows = 4, onUploadImage, maxImages = 3, enableTagPills = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [tagPillItems, setTagPillItems] = useState<string[]>([]);
  const [tagPillInput, setTagPillInput] = useState('');

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
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      // document.execCommand('insertImage', ...) — the previous approach
      // here — is deprecated and unreliable in practice: across the real
      // async gap of an actual upload, the saved selection can go stale
      // (the range still exists, but Chrome's insertImage silently no-ops
      // if it doesn't consider the restored selection "live" enough), so
      // the image upload would succeed but nothing ever appeared in the
      // editor — no error either, since execCommand doesn't report failure.
      // Building and inserting the <img> node directly via the real DOM
      // Range API is the modern, reliable replacement — it either works or
      // throws, it doesn't silently do nothing.
      const img = document.createElement('img');
      img.src = url;

      // Restore the saved range only if it's still actually anchored
      // inside this editor — if the DOM shifted enough that it isn't
      // (e.g. the editor's content changed while the upload was in
      // flight), fall back to appending at the end rather than losing the
      // upload entirely or inserting into the wrong place.
      const savedRange = savedRangeRef.current;
      const rangeStillValid = !!savedRange && el.contains(savedRange.startContainer);

      if (rangeStillValid) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
        savedRange.deleteContents();
        savedRange.insertNode(img);
        // Move the cursor to just after the inserted image so typing
        // continues naturally instead of landing back before it.
        savedRange.setStartAfter(img);
        savedRange.setEndAfter(img);
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
      } else {
        el.appendChild(img);
      }

      // Belt-and-suspenders: confirm the node actually landed in the live
      // DOM before treating this as a success — the exact failure mode
      // being fixed here was "upload succeeds, nothing visibly happens,
      // no error either", so silently trusting the insert calls above
      // would just move that same failure mode one line down.
      if (!el.contains(img)) {
        throw new Error('Image insert did not take effect');
      }

      onChange(el.innerHTML);
    } catch {
      setImageError("Couldn't upload that image — try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTagPillsButtonClick = () => {
    // Same reason as the image button: the selection is gone the moment
    // focus leaves the editor for the popover's own input, so save it now.
    const sel = window.getSelection();
    savedRangeRef.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setTagPillItems([]);
    setTagPillInput('');
    setShowTagPopover(true);
  };

  const handleInsertTagPills = () => {
    const labels = [...tagPillItems, tagPillInput.trim()].filter(Boolean);
    if (labels.length === 0) {
      setShowTagPopover(false);
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const wrapper = document.createElement('div');
    wrapper.setAttribute('style', TAG_PILL_ROW_STYLE);
    wrapper.innerHTML = labels.map((label) => `<span style="${TAG_PILL_STYLE}">${escapeHtml(label)}</span>`).join('');

    // Same reliable DOM-Range insert as the image upload above — not
    // execCommand, and not trusted blindly: verify it actually landed.
    const savedRange = savedRangeRef.current;
    const rangeStillValid = !!savedRange && el.contains(savedRange.startContainer);

    if (rangeStillValid) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
      savedRange.deleteContents();
      savedRange.insertNode(wrapper);
      savedRange.setStartAfter(wrapper);
      savedRange.setEndAfter(wrapper);
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    } else {
      el.appendChild(wrapper);
    }

    if (el.contains(wrapper)) {
      onChange(el.innerHTML);
    }

    setShowTagPopover(false);
    setTagPillItems([]);
    setTagPillInput('');
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
        <button
          type="button"
          title="Heading"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('formatBlock', 'h3')}
          className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground"
        >
          <Heading className="w-3.5 h-3.5" />
        </button>
        {onUploadImage && (
          <>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              type="button"
              title={`Insert image (up to ${maxImages})`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleImageButtonClick}
              disabled={uploadingImage}
              className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileSelected} />
          </>
        )}
        {enableTagPills && (
          <>
            <div className="w-px h-4 bg-border mx-0.5" />
            <div className="relative">
              <button
                type="button"
                title="Insert tag pills (e.g. skills, features)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleTagPillsButtonClick}
                className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground"
              >
                <Tags className="w-3.5 h-3.5" />
              </button>
              {showTagPopover && (
                <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-1.5">Short labels, shown as pills wherever your cursor is.</p>
                  <div className="flex flex-wrap items-center gap-1 mb-2 max-h-24 overflow-y-auto">
                    {tagPillItems.map((tag, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full pl-2 pr-1 py-0.5">
                        {tag}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setTagPillItems((prev) => prev.filter((_, idx) => idx !== i))}
                          className="p-0.5 rounded-full hover:bg-primary/20 transition"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={tagPillInput}
                    onChange={(e) => setTagPillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const tag = tagPillInput.trim().replace(/,$/, '');
                        if (tag) setTagPillItems((prev) => [...prev, tag]);
                        setTagPillInput('');
                      } else if (e.key === 'Escape') {
                        setShowTagPopover(false);
                      }
                    }}
                    placeholder="Type a label, press Enter"
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowTagPopover(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleInsertTagPills}
                      className="text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md px-2.5 py-1 transition"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
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
          onPaste={handlePaste}
          className="w-full px-3 py-2.5 outline-none text-foreground text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
      </div>
      {imageError && <p className="text-xs text-destructive px-3 pb-2">{imageError}</p>}
    </div>
  );
}
