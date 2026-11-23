import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  List,
  Palette,
  Quote,
  Type,
} from 'lucide-react';
import { sanitizeHtml } from '../utils/sanitize';

interface SinhalaUnicodeEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onOpenMediaPicker?: () => void;
  insertImageUrl?: string | null;
  onImageInserted?: () => void;
}

const TEXT_COLORS = [
  { label: 'Default Ink', value: '#e8e6e3' },
  { label: 'Champagne Gold', value: '#c5a059' },
  { label: 'Rosewood', value: '#d98c8c' },
  { label: 'Sage', value: '#8db89d' },
];

export function SinhalaUnicodeEditor({
  value,
  onChange,
  placeholder = 'Begin writing your thoughts here…',
  onOpenMediaPicker,
  insertImageUrl,
  onImageInserted,
}: SinhalaUnicodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastEmittedRef = useRef<string>(value || '');
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  // Sync external value changes without disrupting IME or cursor
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isComposingRef.current) return;
    if (value !== lastEmittedRef.current && value !== el.innerHTML) {
      el.innerHTML = sanitizeHtml(value || '');
      lastEmittedRef.current = value || '';
    }
  }, [value]);

  // Insert picked media image at current caret or end
  useEffect(() => {
    if (!insertImageUrl || !editorRef.current) return;
    editorRef.current.focus();
    const cleanImg = sanitizeHtml(
      `<p><img src="${insertImageUrl}" alt="Diary photograph" /></p>`
    );
    document.execCommand('insertHTML', false, cleanImg);
    const updated = sanitizeHtml(editorRef.current.innerHTML);
    lastEmittedRef.current = updated;
    onChange(updated);
    onImageInserted?.();
  }, [insertImageUrl, onChange, onImageInserted]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el || isComposingRef.current) return;
    const clean = sanitizeHtml(el.innerHTML);
    lastEmittedRef.current = clean;
    onChange(clean);
  };

  const execFormat = (command: string, commandVal?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandVal);
    emitChange();
  };

  return (
    <div className="rounded-xl border border-[#242834] bg-[#0e1015] overflow-hidden">
      {/* Rich Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1e222d] bg-[#13161e] px-3 py-2">
        <button
          type="button"
          onClick={() => execFormat('bold')}
          title="Bold"
          aria-label="Bold"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <Bold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => execFormat('italic')}
          title="Italic"
          aria-label="Italic"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <Italic className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => execFormat('formatBlock', 'h3')}
          title="Section Heading"
          aria-label="Section Heading"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <Heading2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => execFormat('formatBlock', 'blockquote')}
          title="Quote"
          aria-label="Quote"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <Quote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => execFormat('insertUnorderedList')}
          title="Bullet List"
          aria-label="Bullet List"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <List className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-[#242834]" />

        <button
          type="button"
          onClick={() => execFormat('justifyLeft')}
          title="Align Left"
          aria-label="Align Left"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <AlignLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => execFormat('justifyCenter')}
          title="Align Center"
          aria-label="Align Center"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <AlignCenter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => execFormat('justifyRight')}
          title="Align Right"
          aria-label="Align Right"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-[#242834]" />

        <button
          type="button"
          onClick={() => execFormat('fontSize', '4')}
          title="Emphasized Text Size"
          aria-label="Larger Text"
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          <Type className="h-3.5 w-3.5" />
          <span>Large</span>
        </button>

        <button
          type="button"
          onClick={() => execFormat('fontSize', '3')}
          title="Standard Text Size"
          aria-label="Standard Text"
          className="inline-flex h-9 items-center rounded-md px-2 text-xs text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
        >
          Normal
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setColorMenuOpen((v) => !v)}
            title="Ink Color"
            aria-label="Ink Color"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#b7bac2] hover:bg-white/5 hover:text-[#f2efe9]"
          >
            <Palette className="h-4 w-4" />
          </button>
          {colorMenuOpen && (
            <div className="absolute left-0 top-10 z-20 w-44 rounded-lg border border-[#2a2f3d] bg-[#141720] p-1.5 shadow-xl">
              {TEXT_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onClick={() => {
                    execFormat('foreColor', col.value);
                    setColorMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs text-[#e8e6e3] hover:bg-white/5"
                >
                  <span
                    className="h-3 w-3 rounded-full border border-white/20"
                    style={{ backgroundColor: col.value }}
                  />
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {onOpenMediaPicker && (
          <button
            type="button"
            onClick={onOpenMediaPicker}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-[#2c3140] bg-[#191d28] px-3 text-xs font-medium text-[#d8d5ce] hover:border-[#c5a059]/50"
          >
            <ImagePlus className="h-3.5 w-3.5 text-[#c5a059]" />
            <span>Insert Photo</span>
          </button>
        )}
      </div>

      {/* ContentEditable Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="ltr"
        data-placeholder={placeholder}
        onInput={emitChange}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          emitChange();
        }}
        style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}
        className="diary-prose min-h-[320px] max-h-[540px] overflow-y-auto px-5 py-4 text-[#e8e6e3] font-serif-book text-[18px] leading-[1.8] focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[#585d6b]"
      />
    </div>
  );
}
