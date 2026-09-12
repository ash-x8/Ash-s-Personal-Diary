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
  Check,
  Loader2,
  CloudCheck,
  RefreshCw,
  Lock,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { DiaryEntry } from '../types';
import { MediaLibraryModal } from './MediaLibraryModal';
import { SinhalaUnicodeEditor, SinhalaUnicodeEditorRef } from './SinhalaUnicodeEditor';
import { SinhalaTextInput } from './SinhalaTextInput';
import { subscribeToActivePage } from '../services/firebase';

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
  const [remoteContent, setRemoteContent] = useState<string | undefined>(undefined);
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
  const [isSecret, setIsSecret] = useState<boolean>(initialEntry?.isSecret || false);
  const [secretPasscode, setSecretPasscode] = useState<string>(initialEntry?.secretPasscode || '');
  const [secretHint, setSecretHint] = useState<string>(initialEntry?.secretHint || '');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<'cover' | 'gallery' | 'content'>('cover');

  const editorRef = useRef<SinhalaUnicodeEditorRef>(null);
  const titleInputContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const syncDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Multi-Device Real-Time Active Document Listener (Requirement C)
  useEffect(() => {
    if (!currentId) return;

    const unsubscribe = subscribeToActivePage(currentId, (liveEntry) => {
      if (!liveEntry) return;

      // Remote content sync with Focus Lock
      setRemoteContent(liveEntry.content);

      // Check if Title is currently focused; if not, update title from remote device
      const isTitleFocused = titleInputContainerRef.current?.contains(document.activeElement);
      if (!isTitleFocused && liveEntry.title !== title) {
        setTitle(liveEntry.title);
      }

      // Sync non-focused metadata fields
      setDate((prev) => (document.activeElement?.id === 'entry-date-input' ? prev : liveEntry.date));
      setStatus((prev) => liveEntry.status || prev);
      if (liveEntry.mood) setMood(liveEntry.mood);
      if (liveEntry.location) setLocation(liveEntry.location);
      if (liveEntry.coverImage) setCoverImage(liveEntry.coverImage);
      if (liveEntry.gallery) setGallery(liveEntry.gallery);
      if (liveEntry.pageOrder) setPageOrder(liveEntry.pageOrder);
      if (liveEntry.customPageNumber) setCustomPageNumber(String(liveEntry.customPageNumber));
      if (liveEntry.isSecret !== undefined) setIsSecret(liveEntry.isSecret);
      if (liveEntry.secretPasscode !== undefined) setSecretPasscode(liveEntry.secretPasscode);
      if (liveEntry.secretHint !== undefined) setSecretHint(liveEntry.secretHint);
    });

    return () => {
      unsubscribe();
    };
  }, [currentId]);

  // Construct entry payload
  const getParsedEntryData = useCallback((): Partial<DiaryEntry> => {
    const currentHTML = editorRef.current ? editorRef.current.getHTML() : content;
    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
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
      customPageNumber: customPageNumber ? Number(customPageNumber) : undefined,
      isSecret,
      secretPasscode: isSecret ? secretPasscode.trim() : undefined,
      secretHint: isSecret ? secretHint.trim() : undefined
    };
  }, [title, date, content, mood, location, tagsInput, coverImage, gallery, status, pageOrder, customPageNumber, isSecret, secretPasscode, secretHint]);

  // Execute Firestore dynamic sync (debounced 500ms post-keystroke)
  const performDynamicSync = useCallback(async () => {
    if (!title.trim() || isSubmitting) return;
    const currentHTML = editorRef.current ? editorRef.current.getHTML() : content;
    if (!currentHTML || currentHTML.trim() === '' || currentHTML === '<p></p>') return;

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
      console.warn('Dynamic sync error:', err);
      setAutoSaveStatus('unsaved');
    }
  }, [title, content, isSubmitting, getParsedEntryData, onAutoSave, onSave, status, currentId]);

  // Trigger debounced dynamic sync on changes
  const handleContentUpdate = (newHtml: string) => {
    setContent(newHtml);
    setAutoSaveStatus('unsaved');

    if (syncDebounceTimer.current) {
      clearTimeout(syncDebounceTimer.current);
    }
    syncDebounceTimer.current = setTimeout(() => {
      performDynamicSync();
    }, 500); // 500ms post-keystroke debounce
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setAutoSaveStatus('unsaved');

    if (syncDebounceTimer.current) {
      clearTimeout(syncDebounceTimer.current);
    }
    syncDebounceTimer.current = setTimeout(() => {
      performDynamicSync();
    }, 500);
  };

  // Explicit Save & Publish / Save Draft
  const handleSave = async (shouldPublish: boolean) => {
    setValidationError(null);
    if (!title.trim()) {
      setValidationError('Please provide a title for the entry.');
      return;
    }

    const currentHTML = editorRef.current ? editorRef.current.getHTML() : content;
    if (!currentHTML.trim() || currentHTML === '<p></p>') {
      setValidationError('Please write some thoughts for the entry.');
      return;
    }

    if (syncDebounceTimer.current) {
      clearTimeout(syncDebounceTimer.current);
    }

    setIsSubmitting(true);
    setAutoSaveStatus('saving');
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const saved = await onSave(
        {
          title: title.trim(),
          date,
          content: currentHTML,
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

      if (saved && (saved as DiaryEntry).id) {
        setCurrentId((saved as DiaryEntry).id);
      }
      setAutoSaveStatus('saved');
    } catch (err: any) {
      setValidationError(err.message || 'Error saving entry to Firestore.');
      setAutoSaveStatus('unsaved');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    const currentHTML = editorRef.current ? editorRef.current.getHTML() : content;
    const previewEntry: DiaryEntry = {
      id: currentId || 'preview-temp',
      title: title.trim() || 'Untitled Journal Entry',
      slug: 'preview',
      date,
      content: currentHTML || '<p>A quiet page waiting for thoughts…</p>',
      mood: mood.trim() || undefined,
      location: location.trim() || undefined,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      coverImage: coverImage.trim() || undefined,
      gallery,
      status,
      pageOrder: Number(pageOrder) || 1,
      createdAt: initialEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onPreviewInBook(previewEntry);
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
    } else if (mediaTargetField === 'content' && editorRef.current) {
      editorRef.current.insertHTML(`<p><img src="${url}" alt="Journal memory" class="rounded-lg max-w-full my-3 border border-[#3d3830]" /></p>`);
    }
    setShowMediaModal(false);
  };

  return (
    <div id="entry-editor-root" className="max-w-5xl mx-auto pb-16 animate-fade-in">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#2d2c3d]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="editor-back-btn"
            onClick={onCancel}
            className="p-2 rounded-lg bg-[#1a1926] hover:bg-[#252436] text-[#a8a295] hover:text-[#f5ebd7] transition-colors border border-[#313045] cursor-pointer"
            title="Return to Inscriptions List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-cinzel text-xl text-[#f5ebd7] font-semibold tracking-wide">
              {currentId ? 'Edit Diary Page' : 'New Inscription'}
            </h2>
            <p className="text-xs text-[#8e887d] font-serif-book">
              {currentId ? `Page ID: ${currentId}` : 'Will persist to Firestore automatically'}
            </p>
          </div>
        </div>

        {/* Sync status & Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Live sync badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141d] border border-[#2d2c3d] text-xs">
            {autoSaveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 text-[#d4af37] animate-spin" />
                <span className="text-[#d4af37] font-mono">Syncing…</span>
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono">
                  Synced {lastSavedTime ? `at ${lastSavedTime}` : ''}
                </span>
              </>
            )}
            {autoSaveStatus === 'unsaved' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[#a8a295] font-mono text-[11px]">Unsynced</span>
              </>
            )}
            {autoSaveStatus === 'idle' && (
              <span className="text-[#7a7468] font-mono text-[11px]">Live Sync Ready</span>
            )}
          </div>

          <button
            type="button"
            id="editor-preview-book-btn"
            onClick={handlePreview}
            className="px-3.5 py-2 rounded-lg bg-[#1d1c2b] hover:bg-[#28273d] border border-[#37354f] text-[#d4af37] text-xs font-cinzel tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" /> Book Preview
          </button>

          <button
            type="button"
            id="editor-save-draft-btn"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-lg bg-[#222131] hover:bg-[#2e2d42] border border-[#3e3c59] text-[#e0dacd] text-xs font-cinzel tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>

          <button
            type="button"
            id="editor-publish-btn"
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e8c872] text-[#121217] font-cinzel text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Publish to Reader
          </button>
        </div>
      </div>

      {/* Inline Validation Notice */}
      {validationError && (
        <div 
          id="entry-validation-error"
          role="alert"
          className="mb-6 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between animate-fade-in"
        >
          <span>{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs underline cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Inscription Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sinhala-Safe Title Input */}
          <div ref={titleInputContainerRef}>
            <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5">
              Entry Inscription Title * (සිංහල හෝ English)
            </label>
            <SinhalaTextInput
              id="entry-title-input"
              value={title}
              onValueChange={handleTitleChange}
              placeholder="e.g. A Quiet Night, නිහඬ රැයක සිතුවිලි…"
              className="w-full h-12 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-xl px-4 font-serif-book text-xl text-[#f4eedf] placeholder-[#5a554a] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30"
              required
            />
          </div>

          {/* Date and Publication Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#d4af37]" /> Date of Occurrence
              </label>
              <input
                id="entry-date-input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setAutoSaveStatus('unsaved');
                }}
                className="w-full h-10 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5">
                Publication Status
              </label>
              <select
                id="entry-status-select"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setAutoSaveStatus('unsaved');
                }}
                className="w-full h-10 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc] focus:outline-none"
              >
                <option value="published">Published (Visible in Reader across all devices)</option>
                <option value="draft">Draft (Private to Editor)</option>
              </select>
            </div>
          </div>

          {/* Sinhala-Safe Controlled Rich Text Content Editor (Requirement A & C) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b]">
                Journal Content * (Sinhala / English Unicode Safe)
              </label>
              <span className="text-[10px] text-[#d4af37]/80 font-mono">
                Strict LTR • Wijesekara & Helakuru IME Protected
              </span>
            </div>

            <SinhalaUnicodeEditor
              ref={editorRef}
              id="entry-content-editor"
              initialContent={content}
              externalContent={remoteContent}
              onContentChange={handleContentUpdate}
              onOpenMedia={() => openMediaFor('content')}
              minHeight="340px"
              maxHeight="540px"
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
                onChange={(e) => {
                  setMood(e.target.value);
                  setAutoSaveStatus('unsaved');
                }}
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
                dir="ltr"
                style={{ textAlign: 'left', direction: 'ltr' }}
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setAutoSaveStatus('unsaved');
                }}
                placeholder="e.g. Candlelit Study, High Street…"
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none text-left ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8e887d] mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#d4af37]" /> Tags (comma separated)
              </label>
              <input
                type="text"
                dir="ltr"
                style={{ textAlign: 'left', direction: 'ltr' }}
                value={tagsInput}
                onChange={(e) => {
                  setTagsInput(e.target.value);
                  setAutoSaveStatus('unsaved');
                }}
                placeholder="Night, Reflections, Autumn"
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none text-left ltr"
              />
            </div>
          </div>

          {/* Book Page Order */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-4">
            <h4 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold">
              Book Page Numbering
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#8e887d] mb-1">
                  Sequential Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={pageOrder}
                  onChange={(e) => {
                    setPageOrder(Number(e.target.value) || 1);
                    setAutoSaveStatus('unsaved');
                  }}
                  className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#8e887d] mb-1">
                  Display Page #
                </label>
                <input
                  type="text"
                  value={customPageNumber}
                  onChange={(e) => {
                    setCustomPageNumber(e.target.value);
                    setAutoSaveStatus('unsaved');
                  }}
                  placeholder="Auto"
                  className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Secret Page Protection */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSecret ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40' : 'bg-[#2c2b3a]/50 text-[#8e887d]'}`}>
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-cinzel text-xs tracking-[0.18em] uppercase text-[#d4af37] font-semibold">
                    Secret Page Protection
                  </h4>
                  <p className="text-[10px] text-[#8e887d]">Lock this page with a custom passcode</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSecret(!isSecret);
                  setAutoSaveStatus('unsaved');
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSecret ? 'bg-[#d4af37]' : 'bg-[#2c2b3a]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#0e0e13] shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isSecret ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isSecret && (
              <div className="pt-2 border-t border-[#232330] space-y-3 animate-fade-in">
                <div>
                  <label className="block text-[11px] text-[#ded8cc] mb-1 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-[#d4af37]" /> Secret Passcode *
                  </label>
                  <input
                    type="text"
                    value={secretPasscode}
                    onChange={(e) => {
                      setSecretPasscode(e.target.value);
                      setAutoSaveStatus('unsaved');
                    }}
                    placeholder="e.g. 7482 or secret-word"
                    className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] focus:border-[#d4af37] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-[#8e887d] mt-1 block">
                    The custom password required to unlock and read this specific page.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-[#ded8cc] mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#d4af37]" /> Password Hint (Displayed to Readers)
                  </label>
                  <input
                    type="text"
                    value={secretHint}
                    onChange={(e) => {
                      setSecretHint(e.target.value);
                      setAutoSaveStatus('unsaved');
                    }}
                    placeholder="e.g. The year we first met at the library"
                    className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] focus:border-[#d4af37] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8e887d] mt-1 block">
                    The hint you type here will be displayed directly on the locked secret page.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cover & Atmosphere Imagery */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold">
                Cover Photo
              </h4>
              <button
                type="button"
                onClick={() => openMediaFor('cover')}
                className="text-xs text-[#d4af37] hover:underline cursor-pointer flex items-center gap-1"
              >
                <ImageIcon className="w-3 h-3" /> Select Photo
              </button>
            </div>

            {coverImage ? (
              <div className="relative rounded-lg overflow-hidden border border-[#333144] aspect-video group">
                <img
                  src={coverImage}
                  alt="Entry Cover"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-900 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove cover image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => openMediaFor('cover')}
                className="border border-dashed border-[#2f2e3e] hover:border-[#d4af37]/60 rounded-lg p-6 text-center cursor-pointer transition-colors"
              >
                <ImageIcon className="w-6 h-6 text-[#5b574f] mx-auto mb-1.5" />
                <p className="text-xs text-[#8e887d]">No cover image set</p>
                <span className="text-[10px] text-[#d4af37] font-cinzel uppercase mt-1 inline-block">
                  Click to choose
                </span>
              </div>
            )}
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
