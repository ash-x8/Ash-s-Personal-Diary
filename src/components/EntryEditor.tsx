import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Save,
  Send,
  Eye,
  ArrowLeft,
  Calendar,
  Smile,
  MapPin,
  Tag,
  Image as ImageIcon,
  Plus,
  Trash2,
  Bold,
  Italic,
  Quote,
  Heading2,
  List,
  Link,
  Check,
  Loader2,
  CloudCheck
} from 'lucide-react';
import { DiaryEntry } from '../types';
import { MediaLibraryModal } from './MediaLibraryModal';

interface EntryEditorProps {
  initialEntry?: DiaryEntry | null;
  onSave: (entryData: Partial<DiaryEntry>, publish: boolean, existingId?: string) => Promise<DiaryEntry | void>;
  onAutoSave?: (entryData: Partial<DiaryEntry>, publish: boolean, existingId?: string) => Promise<DiaryEntry | void>;
  onCancel: () => void;
  onPreviewInBook: (entryData: DiaryEntry) => void;
  mediaList: any[];
  onUploadMedia: (file: File) => Promise<any>;
  onDeleteMedia: (id: string) => Promise<void>;
}

const MOOD_OPTIONS = [
  'Calm',
  'Reflective',
  'Nostalgic',
  'Melancholy',
  'Curious',
  'Solitary',
  'Inspired',
  'Wistful',
  'Grateful',
  'Restless'
];

export const EntryEditor: React.FC<EntryEditorProps> = ({
  initialEntry,
  onSave,
  onAutoSave,
  onCancel,
  onPreviewInBook,
  mediaList,
  onUploadMedia,
  onDeleteMedia
}) => {
  const [currentId, setCurrentId] = useState<string | undefined>(initialEntry?.id);
  const [title, setTitle] = useState(initialEntry?.title || '');
  const [date, setDate] = useState(initialEntry?.date || new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState(initialEntry?.content || '<p></p>');
  const [mood, setMood] = useState(initialEntry?.mood || '');
  const [location, setLocation] = useState(initialEntry?.location || '');
  const [tagsInput, setTagsInput] = useState((initialEntry?.tags || []).join(', '));
  const [coverImage, setCoverImage] = useState(initialEntry?.coverImage || '');
  const [gallery, setGallery] = useState<string[]>(initialEntry?.gallery || []);
  const [status, setStatus] = useState<'draft' | 'published'>(initialEntry?.status || 'published');
  const [pageOrder, setPageOrder] = useState<number>(initialEntry?.pageOrder || 1);
  const [customPageNumber, setCustomPageNumber] = useState<string>(
    initialEntry?.customPageNumber ? String(initialEntry.customPageNumber) : ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<'cover' | 'gallery' | 'content'>('cover');

  const contentEditorRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isComposingRef = useRef(false);

  // Apply rich-text command
  const formatDoc = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
    if (contentEditorRef.current) {
      setContent(contentEditorRef.current.innerHTML);
    }
  };

  const handleInsertQuote = () => {
    formatDoc('formatBlock', '<blockquote>');
  };

  const handleInsertHeading = () => {
    formatDoc('formatBlock', '<h3>');
  };

  const handleInsertList = () => {
    formatDoc('insertUnorderedList');
  };

  const getParsedEntryData = useCallback((): Partial<DiaryEntry> => {
    const currentHTML = contentEditorRef.current ? contentEditorRef.current.innerHTML : content;
    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    return {
      title: title.trim(),
      date,
      content: currentHTML,
      mood: mood.trim() || undefined,
      location: location.trim() || undefined,
      tags: parsedTags,
      coverImage: coverImage.trim() || undefined,
      gallery,
      status,
      pageOrder: Number(pageOrder) || 1,
      customPageNumber: customPageNumber ? Number(customPageNumber) : undefined
    };
  }, [title, date, content, mood, location, tagsInput, coverImage, gallery, status, pageOrder, customPageNumber]);

  // Execute silent background auto-save
  const performAutoSave = useCallback(async () => {
    if (!title.trim() || isSubmitting || isComposingRef.current) return;
    const currentHTML = contentEditorRef.current ? contentEditorRef.current.innerHTML : content;
    if (!currentHTML || currentHTML === '<p></p>' || currentHTML.trim() === '') return;

    setAutoSaveStatus('saving');
    try {
      const data = getParsedEntryData();
      const saveHandler = onAutoSave || onSave;
      const res = await saveHandler(data, status === 'published', currentId);
      if (res && (res as DiaryEntry).id) {
        setCurrentId((res as DiaryEntry).id);
      }
      setAutoSaveStatus('saved');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);
    } catch (err) {
      console.warn('Auto-save error:', err);
      setAutoSaveStatus('unsaved');
    }
  }, [title, content, isSubmitting, getParsedEntryData, onAutoSave, onSave, status, currentId]);

  // Initialize innerHTML on initial load / entry change without re-rendering contentEditable on every stroke
  useEffect(() => {
    if (contentEditorRef.current) {
      if (contentEditorRef.current.innerHTML !== content) {
        contentEditorRef.current.innerHTML = content || '<p></p>';
      }
    }
  }, [initialEntry?.id]);

  // Setup compositionstart and compositionend event listeners for Sinhala / IME support
  useEffect(() => {
    const el = contentEditorRef.current;
    if (!el) return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
      if (contentEditorRef.current) {
        setContent(contentEditorRef.current.innerHTML);
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSave();
      }, 500);
    };

    el.addEventListener('compositionstart', handleCompositionStart);
    el.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      el.removeEventListener('compositionstart', handleCompositionStart);
      el.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [performAutoSave]);

  // Debounced auto-save effect whenever inputs change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isComposingRef.current) {
      return;
    }

    setAutoSaveStatus('unsaved');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, date, content, mood, location, tagsInput, coverImage, gallery, status, pageOrder, customPageNumber, performAutoSave]);

  const handleSave = async (shouldPublish: boolean) => {
    const saveTitle = title.trim() || 'Untitled Entry';
    const currentHTML = contentEditorRef.current ? contentEditorRef.current.innerHTML : content;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setIsSubmitting(true);
    setAutoSaveStatus('saving');
    try {
      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const result = await onSave(
        {
          title: saveTitle,
          date,
          content: currentHTML || '<p></p>',
          mood: mood.trim() || undefined,
          location: location.trim() || undefined,
          tags: parsedTags,
          coverImage: coverImage.trim() || undefined,
          gallery,
          status: shouldPublish ? 'published' : 'draft',
          pageOrder: Number(pageOrder) || 1,
          customPageNumber: customPageNumber ? Number(customPageNumber) : undefined
        },
        shouldPublish,
        currentId
      );
      if (result && result.id) {
        setCurrentId(result.id);
      }
      setAutoSaveStatus('saved');
    } catch (err: any) {
      alert(err.message || 'Error saving entry.');
      setAutoSaveStatus('unsaved');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    const currentHTML = contentEditorRef.current ? contentEditorRef.current.innerHTML : content;
    const mockEntry: DiaryEntry = {
      id: currentId || 'preview-temp',
      title: title.trim() || 'Untitled Journal Entry',
      slug: 'preview',
      date,
      content: currentHTML || '<p>A quiet page waiting for thoughts…</p>',
      mood: mood.trim() || undefined,
      location: location.trim() || undefined,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      coverImage: coverImage.trim() || undefined,
      gallery,
      status,
      pageOrder: Number(pageOrder) || 1,
      createdAt: initialEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onPreviewInBook(mockEntry);
  };

  const openMediaFor = (target: 'cover' | 'gallery' | 'content') => {
    setMediaTargetField(target);
    setShowMediaModal(true);
  };

  const handleSelectMedia = (url: string) => {
    if (mediaTargetField === 'cover') {
      setCoverImage(url);
    } else if (mediaTargetField === 'gallery') {
      setGallery([...gallery, url]);
    } else if (mediaTargetField === 'content') {
      formatDoc('insertImage', url);
    }
  };

  return (
    <div 
      id="entry-editor-form"
      className="w-full max-w-4xl mx-auto py-6 px-4 select-text animate-fade-in"
    >
      {/* Top action bar with live auto-save indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#292837] mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1924] hover:bg-[#252433] text-[#a8a296] hover:text-[#f5ebd7] transition-colors text-xs font-cinzel tracking-wider uppercase cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>

          {/* Live Auto-save indicator */}
          <div className="flex items-center gap-1.5">
            {autoSaveStatus === 'saving' && (
              <span 
                id="autosave-status-saving"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#252219] border border-[#d4af37]/40 text-[#e8c872] text-[11px] font-mono"
              >
                <Loader2 className="w-3 h-3 animate-spin text-[#d4af37]" />
                Auto-saving…
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span 
                id="autosave-status-saved"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#122319] border border-emerald-500/40 text-emerald-400 text-[11px] font-mono"
              >
                <Check className="w-3 h-3" />
                Auto-saved {lastSavedTime ? `at ${lastSavedTime}` : ''}
              </span>
            )}
            {autoSaveStatus === 'unsaved' && (
              <span 
                id="autosave-status-unsaved"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#231f1c] border border-amber-600/30 text-amber-400/90 text-[11px] font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Unsaved changes
              </span>
            )}
            {autoSaveStatus === 'idle' && lastSavedTime && (
              <span className="text-[11px] text-[#857f73] font-mono">
                Saved at {lastSavedTime}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePreview}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1f1e29] hover:bg-[#2b2a39] text-[#e8c872] border border-[#4a4029] text-xs font-cinzel tracking-wider uppercase transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" /> Preview as Reader
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSave(false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#252430] hover:bg-[#323140] text-[#ded8cc] border border-[#3f3e4e] text-xs font-cinzel tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSave(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#8a7238] to-[#d4af37] hover:from-[#9c8240] hover:to-[#e3bd42] text-[#1a140a] font-semibold text-xs font-cinzel tracking-wider uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> {initialEntry ? 'Save & Publish' : 'Inscribe into Book'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Inscription Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5">
              Entry Inscription Title *
            </label>
            <input
              type="text"
              dir="ltr"
              style={{ textAlign: 'left' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A Quiet Night, Things I Never Said…"
              className="w-full h-12 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-xl px-4 font-serif-book text-xl text-[#f4eedf] placeholder-[#5a554a] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30"
              required
            />
          </div>

          {/* Date and Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#d4af37]" /> Date of Occurrence
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5">
                Publication Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc] focus:outline-none"
              >
                <option value="published">Published (Visible in Reader)</option>
                <option value="draft">Draft (Private to Editor)</option>
              </select>
            </div>
          </div>

          {/* Rich Content Editor */}
          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5">
              Journal Content *
            </label>

            {/* Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-[#171722] border border-[#2f2e3e] rounded-t-xl text-[#a8a295]">
              <button
                type="button"
                onClick={() => formatDoc('bold')}
                className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => formatDoc('italic')}
                className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleInsertHeading}
                className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
                title="Section Heading"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleInsertQuote}
                className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
                title="Blockquote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleInsertList}
                className="p-1.5 hover:bg-[#282736] hover:text-[#f5ebd7] rounded transition-colors"
                title="Unordered List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => openMediaFor('content')}
                className="p-1.5 hover:bg-[#282736] hover:text-[#d4af37] rounded transition-colors flex items-center gap-1 text-xs"
                title="Insert Photo from Archive"
              >
                <ImageIcon className="w-4 h-4" /> Insert Photo
              </button>
            </div>

            {/* Editable Content Area */}
            <div
              ref={contentEditorRef}
              contentEditable
              dir="ltr"
              style={{ textAlign: 'left' }}
              onInput={() => {
                if (!isComposingRef.current && contentEditorRef.current) {
                  setContent(contentEditorRef.current.innerHTML);
                }
              }}
              onBlur={() => {
                if (contentEditorRef.current) {
                  setContent(contentEditorRef.current.innerHTML);
                }
              }}
              className="w-full min-h-[300px] max-h-[500px] overflow-y-auto bg-[#121219] border border-t-0 border-[#2f2e3e] rounded-b-xl p-5 font-serif-book text-base sm:text-lg text-[#ded8cc] leading-relaxed focus:outline-none diary-prose"
            />
          </div>
        </div>

        {/* Right 1 Col: Metadata, Media, Atmosphere */}
        <div className="space-y-6">
          {/* Atmosphere: Mood & Location */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-4">
            <h4 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold">
              Atmosphere & Location
            </h4>

            <div>
              <label className="block text-[11px] text-[#8e887d] mb-1 flex items-center gap-1">
                <Smile className="w-3.5 h-3.5 text-[#d4af37]" /> Mood / Emotion
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-2 text-xs text-[#ded8cc] focus:outline-none"
              >
                <option value="">(None specified)</option>
                {MOOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#8e887d] mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#d4af37]" /> Setting / Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Candlelit Study, High Street…"
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8e887d] mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#d4af37]" /> Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Memories, Autumn, Rain"
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
              />
            </div>
          </div>

          {/* Featured Visual */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Featured Photograph
              </h4>
              <button
                type="button"
                onClick={() => openMediaFor('cover')}
                className="text-[10px] font-cinzel uppercase text-[#d4af37] hover:underline cursor-pointer"
              >
                Pick from Media
              </button>
            </div>

            {coverImage ? (
              <div className="relative rounded-lg overflow-hidden border border-[#38374a] group">
                <img
                  src={coverImage}
                  alt="Featured"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-rose-950 text-white rounded transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="Image URL or pick from media archive…"
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
              />
            )}
          </div>

          {/* Ordering & Layout */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-3">
            <h4 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold">
              Book Placement
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#8e887d] mb-1">
                  Chronological Order
                </label>
                <input
                  type="number"
                  min={1}
                  value={pageOrder}
                  onChange={(e) => setPageOrder(Number(e.target.value))}
                  className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8e887d] mb-1">
                  Custom Page No.
                </label>
                <input
                  type="number"
                  value={customPageNumber}
                  onChange={(e) => setCustomPageNumber(e.target.value)}
                  placeholder="Auto"
                  className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media Library Modal */}
      {showMediaModal && (
        <MediaLibraryModal
          media={mediaList}
          onUpload={onUploadMedia}
          onDelete={onDeleteMedia}
          onSelect={handleSelectMedia}
          onClose={() => setShowMediaModal(false)}
        />
      )}
    </div>
  );
};
