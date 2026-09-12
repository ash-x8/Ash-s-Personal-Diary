import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Bold,
  Italic,
  Heading2,
  Quote,
  List,
  Image as ImageIcon
} from 'lucide-react';

export interface SinhalaUnicodeEditorRef {
  insertHTML: (html: string) => void;
  getHTML: () => string;
  focus: () => void;
}

interface SinhalaUnicodeEditorProps {
  id?: string;
  initialContent: string;
  externalContent?: string;
  onContentChange: (html: string) => void;
  onOpenMedia?: () => void;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  className?: string;
}

export const SinhalaUnicodeEditor = forwardRef<SinhalaUnicodeEditorRef, SinhalaUnicodeEditorProps>(({
  id = "sinhala-rich-editor",
  initialContent,
  externalContent,
  onContentChange,
  onOpenMedia,
  minHeight = "320px",
  maxHeight = "520px",
  placeholder = "Write your thoughts in Sinhala or English… (සිංහලෙන් හෝ ඉංග්‍රීසියෙන් ලියන්න)",
  className = ""
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    insertHTML: (html: string) => {
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, html);
        scheduleSync();
      }
    },
    getHTML: () => {
      return editorRef.current ? editorRef.current.innerHTML : '';
    },
    focus: () => {
      editorRef.current?.focus();
    }
  }));

  // Initialize innerHTML on initial mount
  useEffect(() => {
    if (!hasInitialized.current && editorRef.current) {
      editorRef.current.innerHTML = initialContent || '<p></p>';
      hasInitialized.current = true;
    }
  }, [initialContent]);

  // Focus-locked external sync (Multi-device remote update listener)
  // RULE: When incoming snapshot updates arrive, do NOT overwrite the local editor state
  // if the active editor element currently holds user focus or is in IME composition
  useEffect(() => {
    if (!editorRef.current || !hasInitialized.current) return;

    const isFocused = 
      document.activeElement === editorRef.current || 
      Boolean(editorRef.current.contains(document.activeElement));

    if (!isFocused && !isComposing.current && externalContent !== undefined) {
      if (externalContent !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = externalContent;
      }
    }
  }, [externalContent]);

  // 500ms debounced sync handler
  const scheduleSync = () => {
    // STRICT RULE: NEVER trigger parent state updates or Firestore sync while composing
    if (isComposing.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (isComposing.current) return;
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        onContentChange(html);
      }
    }, 500); // 500ms post-keystroke debounce timer
  };

  // Rich text formatting commands
  const execFormat = (cmd: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(cmd, false, value);
      scheduleSync();
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
    // Clear any pending sync to prevent intermediate composition writes
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
    // Execute dynamic sync immediately after composition finishes
    scheduleSync();
  };

  const handleInput = () => {
    // Only schedule sync when not composing
    if (!isComposing.current) {
      scheduleSync();
    }
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!isComposing.current && editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`sinhala-editor-container border border-[#2f2e3e] rounded-xl overflow-hidden ${className}`}>
      {/* Formatting Toolbar */}
      <div 
        id="editor-toolbar"
        className="flex flex-wrap items-center gap-1 p-2 bg-[#171722] border-b border-[#2f2e3e] text-[#a8a295]"
      >
        <button
          type="button"
          onClick={() => execFormat('bold')}
          className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('italic')}
          className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('formatBlock', '<h3>')}
          className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
          title="Heading"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('formatBlock', '<blockquote>')}
          className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('insertUnorderedList')}
          className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        {onOpenMedia && (
          <button
            type="button"
            onClick={onOpenMedia}
            className="p-1.5 hover:bg-[#282736] hover:text-[#d4af37] rounded transition-colors flex items-center gap-1 text-xs ml-auto text-[#d4af37]"
            title="Insert Photo from Archive"
          >
            <ImageIcon className="w-4 h-4" /> Insert Photo
          </button>
        )}
      </div>

      {/* Strict LTR Controlled Editable Surface */}
      <div
        id={id}
        ref={editorRef}
        contentEditable
        dir="ltr"
        style={{
          direction: 'ltr',
          textAlign: 'left',
          unicodeBidi: 'plaintext',
          minHeight,
          maxHeight
        }}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onBlur={handleBlur}
        data-placeholder={placeholder}
        className="w-full overflow-y-auto bg-[#121219] p-5 font-serif-book text-base sm:text-lg text-[#ded8cc] leading-relaxed focus:outline-none diary-prose text-left ltr empty:before:content-[attr(data-placeholder)] empty:before:text-[#635d50] empty:before:pointer-events-none"
      />
    </div>
  );
});

SinhalaUnicodeEditor.displayName = 'SinhalaUnicodeEditor';
