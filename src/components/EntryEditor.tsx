import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Trash2,
  Loader2,
  Check,
  CloudCheck,
  RefreshCw,
  Lock,
  KeyRound,
  Sparkles,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { DiaryEntry, DiaryChapter, PaginatedPage } from '../types';
import { MediaLibraryModal } from './MediaLibraryModal';
import { SinhalaUnicodeEditor, SinhalaUnicodeEditorRef } from './SinhalaUnicodeEditor';
import { SinhalaTextInput } from './SinhalaTextInput';
import {
  subscribeToActivePage,
  subscribeToActiveChapter,
  saveChapterToFirestore
} from '../services/firebase';
import { compressHtmlImages } from '../utils/imageCompressor';
import { countWords, paginateChapter } from '../utils/pagination';

interface EntryEditorProps {
  initialEntry?: DiaryEntry | null;
  initialChapter?: DiaryChapter | null;
  wordsPerPage?: number;
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
  initialChapter,
  wordsPerPage = 100,
  onSave,
  onAutoSave,
  onCancel,
  onPreviewInBook,
  mediaList,
  onUploadMedia,
  onDeleteMedia
}) => {
  const effectiveId = initialChapter?.id || initialEntry?.id;
  const effectiveTitle = initialChapter?.chapterTitle || initialEntry?.title || '';
  const effectiveContent = initialChapter?.rawContent || initialEntry?.content || '<p></p>';
  const effectiveDate = initialChapter?.date || initialEntry?.date || new Date().toISOString().split('T')[0];
  const effectiveMood = initialChapter?.mood || initialEntry?.mood || '';
  const effectiveLocation = initialChapter?.location || initialEntry?.location || '';
  const effectiveTags = initialChapter?.tags || initialEntry?.tags || [];
  const effectiveCover = initialChapter?.coverImage || initialEntry?.coverImage || '';
  const effectiveGallery = initialChapter?.gallery || initialEntry?.gallery || [];
  const effectiveStatus = initialChapter?.status || initialEntry?.status || 'published';
  const effectiveOrder = initialChapter?.order || initialEntry?.pageOrder || 1;
  const effectiveIsSecret = Boolean(initialChapter?.isSecret ?? initialEntry?.isSecret);
  const effectiveSecurityKey =
    initialChapter?.securityKey ||
    initialEntry?.securityKey ||
    initialEntry?.secretPasscode ||
    '';
  const effectiveSecurityHint =
    initialChapter?.securityHint ||
    initialEntry?.securityHint ||
    '';

  const [currentId, setCurrentId] = useState<string | undefined>(effectiveId);
  const [title, setTitle] = useState(effectiveTitle);
  const [date, setDate] = useState(effectiveDate);
  const [content, setContent] = useState(effectiveContent);
  const [remoteContent, setRemoteContent] = useState<string | undefined>(undefined);
  const [mood, setMood] = useState(effectiveMood);
  const [location, setLocation] = useState(effectiveLocation);
  const [tagsInput, setTagsInput] = useState(effectiveTags.join(', '));
  const [coverImage, setCoverImage] = useState(effectiveCover);
  const [gallery, setGallery] = useState<string[]>(effectiveGallery);
  const [status, setStatus] = useState<'draft' | 'published'>(effectiveStatus);
  const [pageOrder, setPageOrder] = useState<number>(effectiveOrder);
  const [customPageNumber, setCustomPageNumber] = useState<string>(
    initialEntry?.customPageNumber ? String(initialEntry.customPageNumber) : ''
  );
  const [isSecret, setIsSecret] = useState<boolean>(effectiveIsSecret);
  const [securityKey, setSecurityKey] = useState<string>(effectiveSecurityKey);
  const [securityHint, setSecurityHint] = useState<string>(effectiveSecurityHint);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<'cover' | 'gallery' | 'content'>('cover');
  const [showPageSplits, setShowPageSplits] = useState(false);

  const editorRef = useRef<SinhalaUnicodeEditorRef>(null);
  const titleInputContainerRef = useRef<HTMLDivElement>(null);
  const syncDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Word Count Calculation
  const currentWordCount = useMemo(() => {
    return countWords(content);
  }, [content]);

  // Dynamic Auto-Pagination Calculation
  const dynamicChapterObj: DiaryChapter = useMemo(() => {
    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    return {
      id: currentId || 'temp-chapter',
      chapterTitle: title.trim() || 'Untitled Chapter',
      rawContent: content,
      date,
      mood: mood.trim() || undefined,
      location: location.trim() || undefined,
      tags: parsedTags,
      coverImage: coverImage.trim() || undefined,
      gallery,
      status,
      order: Number(pageOrder) || 1,
      isSecret,
      securityKey: isSecret ? securityKey.trim() : undefined,
      securityHint: isSecret ? securityHint.trim() : undefined,
      createdAt: null,
      updatedAt: null
    };
  }, [currentId, title, content, date, mood, location, tagsInput, coverImage, gallery, status, pageOrder, isSecret, securityKey, securityHint]);

  const paginatedPages = useMemo(() => {
    return paginateChapter(dynamicChapterObj, wordsPerPage || 100);
  }, [dynamicChapterObj, wordsPerPage]);

  // Multi-Device Real-Time Active Document Listener
  useEffect(() => {
    if (!currentId) return;

    // Listen to diary_chapters
    const unsubChapter = subscribeToActiveChapter(currentId, (liveChapter) => {
      if (!liveChapter) return;

      setRemoteContent(liveChapter.rawContent);

      const isTitleFocused = titleInputContainerRef.current?.contains(document.activeElement);
      if (!isTitleFocused && liveChapter.chapterTitle !== title) {
        setTitle(liveChapter.chapterTitle);
      }

      setDate((prev) => (document.activeElement?.id === 'chapter-date-input' ? prev : liveChapter.date || prev));
      setStatus((prev) => liveChapter.status || prev);
      if (liveChapter.mood) setMood(liveChapter.mood);
      if (liveChapter.location) setLocation(liveChapter.location);
      if (liveChapter.coverImage) setCoverImage(liveChapter.coverImage);
      if (liveChapter.gallery) setGallery(liveChapter.gallery);
      if (liveChapter.order) setPageOrder(liveChapter.order);
      if (liveChapter.isSecret !== undefined) setIsSecret(liveChapter.isSecret);
      if (liveChapter.securityKey !== undefined) setSecurityKey(liveChapter.securityKey);
      if (liveChapter.securityHint !== undefined) setSecurityHint(liveChapter.securityHint);
    });

    // Also listen to legacy diary_pages for fallback
    const unsubLegacy = subscribeToActivePage(currentId, (liveEntry) => {
      if (!liveEntry) return;
      if (!remoteContent) {
        setRemoteContent(liveEntry.content);
      }
    });

    return () => {
      unsubChapter();
      unsubLegacy();
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
      securityKey: isSecret ? securityKey.trim() : undefined,
      securityHint: isSecret ? securityHint.trim() : undefined,
      secretPasscode: isSecret ? securityKey.trim() : undefined // Backwards compatibility
    };
  }, [title, date, content, mood, location, tagsInput, coverImage, gallery, status, pageOrder, customPageNumber, isSecret, securityKey, securityHint]);

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

      // Also persist to diary_chapters collection
      await saveChapterToFirestore(
        {
          chapterTitle: title.trim(),
          rawContent: currentHTML,
          date,
          status,
          order: Number(pageOrder) || 1,
          mood: mood.trim() || undefined,
          location: location.trim() || undefined,
          tags: data.tags,
          coverImage: coverImage.trim() || undefined,
          gallery,
          isSecret,
          securityKey: isSecret ? securityKey.trim() : undefined,
          securityHint: isSecret ? securityHint.trim() : undefined
        },
        currentId
      ).catch(() => {});

      setAutoSaveStatus('saved');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);
    } catch (err) {
      console.warn('Dynamic sync error:', err);
      setAutoSaveStatus('unsaved');
    }
  }, [title, content, isSubmitting, getParsedEntryData, onAutoSave, onSave, status, currentId, date, pageOrder, mood, location, coverImage, gallery, isSecret, securityKey, securityHint]);

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
      setValidationError('Please provide a chapter title.');
      return;
    }

    const currentHTML = editorRef.current ? editorRef.current.getHTML() : content;
    if (!currentHTML.trim() || currentHTML === '<p></p>') {
      setValidationError('Please write some thoughts for the chapter.');
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

      let processedHTML = currentHTML;
      try {
        processedHTML = await compressHtmlImages(currentHTML);
      } catch (err) {
        console.warn('Image pre-compression warning:', err);
      }

      const saved = await onSave(
        {
          title: title.trim(),
          date,
          content: processedHTML,
          mood: mood.trim() || undefined,
          location: location.trim() || undefined,
          tags: parsedTags,
          coverImage: coverImage.trim() || undefined,
          gallery,
          status: shouldPublish ? 'published' : 'draft',
          pageOrder: Number(pageOrder) || 1,
          customPageNumber: customPageNumber ? Number(customPageNumber) : undefined,
          isSecret,
          securityKey: isSecret ? securityKey.trim() : undefined,
          securityHint: isSecret ? securityHint.trim() : undefined,
          secretPasscode: isSecret ? securityKey.trim() : undefined
        },
        shouldPublish,
        currentId
      );

      const chapterSaved = await saveChapterToFirestore(
        {
          chapterTitle: title.trim(),
          rawContent: processedHTML,
          date,
          status: shouldPublish ? 'published' : 'draft',
          order: Number(pageOrder) || 1,
          mood: mood.trim() || undefined,
          location: location.trim() || undefined,
          tags: parsedTags,
          coverImage: coverImage.trim() || undefined,
          gallery,
          isSecret,
          securityKey: isSecret ? securityKey.trim() : undefined,
          securityHint: isSecret ? securityHint.trim() : undefined
        },
        currentId
      );

      if (chapterSaved?.id) {
        setCurrentId(chapterSaved.id);
      } else if (saved && (saved as DiaryEntry).id) {
        setCurrentId((saved as DiaryEntry).id);
      }
      setAutoSaveStatus('saved');
    } catch (err: any) {
      setValidationError(err.message || 'Error saving chapter to Firestore.');
      setAutoSaveStatus('unsaved');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    const currentHTML = editorRef.current ? editorRef.current.getHTML() : content;
    const previewEntry: DiaryEntry = {
      id: currentId || 'preview-temp',
      title: title.trim() || 'Untitled Chapter',
      slug: 'preview',
      date,
      content: currentHTML || '<p>A quiet leaf waiting for thoughts…</p>',
      mood: mood.trim() || undefined,
      location: location.trim() || undefined,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      coverImage: coverImage.trim() || undefined,
      gallery,
      status,
      pageOrder: Number(pageOrder) || 1,
      isSecret,
      securityKey: isSecret ? securityKey.trim() : undefined,
      securityHint: isSecret ? securityHint.trim() : undefined,
      secretPasscode: isSecret ? securityKey.trim() : undefined,
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
    <div id="chapter-editor-root" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Top Header & Global Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#252433]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg bg-[#181824] hover:bg-[#232334] text-[#cfc8ba] transition-colors cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-cinzel text-lg sm:text-xl font-bold tracking-[0.18em] uppercase text-[#f5ebd7] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#d4af37]" />
              {currentId ? 'Inscribe Chapter' : 'New Continuous Chapter'}
            </h2>
            {/* Auto-Pagination Status Banner */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1b1a29] border border-[#37354f] text-[11px] font-mono text-[#e8c872]">
                <Layers className="w-3 h-3 text-[#d4af37]" />
                Chapter {pageOrder} • {paginatedPages.length} {paginatedPages.length === 1 ? 'Page' : 'Pages'}
              </span>
              <span className="text-[11px] font-mono text-[#9e978b]">
                ~{currentWordCount} Words • {wordsPerPage} w/p limit
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Sync Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Live Sync Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141d] border border-[#262536] text-xs">
            {autoSaveStatus === 'saving' && (
              <span className="text-[#d4af37] flex items-center gap-1 font-mono text-[11px]">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing Chapter…
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                <CloudCheck className="w-3.5 h-3.5" /> Saved {lastSavedTime && `at ${lastSavedTime}`}
              </span>
            )}
            {autoSaveStatus === 'unsaved' && (
              <span className="text-amber-400/80 font-mono text-[11px]">Unsaved Edits</span>
            )}
            {autoSaveStatus === 'idle' && (
              <span className="text-[#7a7468] font-mono text-[11px]">Auto-Pagination Active</span>
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
            Publish Chapter
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

      {/* Auto-Pagination Breakdown Strip (Live visual page breaks) */}
      <div className="mb-6 bg-[#151421] border border-[#2c2a3e] rounded-xl p-3.5 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
            <h3 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#e5ded0] font-semibold">
              Live Auto-Pagination Preview ({paginatedPages.length} {paginatedPages.length === 1 ? 'Page' : 'Pages'})
            </h3>
            <span className="text-[11px] font-mono text-[#948d7f]">
              Target: ~{wordsPerPage} words/page
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPageSplits(!showPageSplits)}
            className="text-xs text-[#d4af37] hover:text-[#f0d588] flex items-center gap-1 font-cinzel tracking-wider uppercase cursor-pointer"
          >
            {showPageSplits ? (
              <>Hide Page Splits <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>Inspect Page Splits <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>

        {/* Collapsible visual page cards */}
        {showPageSplits && (
          <div className="mt-3.5 pt-3 border-t border-[#262436] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {paginatedPages.map((page, idx) => (
              <div
                key={page.id || idx}
                className="bg-[#0e0e15] border border-[#2d2c3e] rounded-lg p-3 text-xs flex flex-col justify-between hover:border-[#d4af37]/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] text-[#d4af37]">
                    <span className="font-bold">Leaf {idx + 1} of {paginatedPages.length}</span>
                    <span className="text-[#888172]">{page.wordCount} words</span>
                  </div>
                  <div
                    className="text-[#bbb3a4] font-serif-book line-clamp-3 text-[11px] leading-relaxed opacity-85"
                    dangerouslySetInnerHTML={{ __html: page.content || '<em class="opacity-50">Empty leaf…</em>' }}
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-[#1d1c2b] flex items-center justify-between text-[9px] font-mono text-[#787265]">
                  <span>Book Page {page.globalPageNumber}</span>
                  <span>{idx === 0 ? 'Chapter Opening' : idx === paginatedPages.length - 1 ? 'Chapter Conclusion' : 'Flowing Body'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Inscription Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sinhala-Safe Chapter Title Input */}
          <div ref={titleInputContainerRef}>
            <label className="block text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b] mb-1.5">
              Chapter Title * (සිංහල හෝ English)
            </label>
            <SinhalaTextInput
              id="chapter-title-input"
              value={title}
              onValueChange={handleTitleChange}
              placeholder="e.g. Chapter 1: The Beginning, නිහඬ ආරම්භය…"
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
                id="chapter-date-input"
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
                id="chapter-status-select"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setAutoSaveStatus('unsaved');
                }}
                className="w-full h-10 bg-[#121219] border border-[#2d2c3d] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc] focus:outline-none"
              >
                <option value="published">Published (Visible in Book Reader across devices)</option>
                <option value="draft">Draft (Private to Editor)</option>
              </select>
            </div>
          </div>

          {/* Sinhala-Safe Controlled Rich Text Chapter Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-cinzel tracking-[0.2em] uppercase text-[#9e978b]">
                Continuous Chapter Content * (Sinhala / English Unicode Safe)
              </label>
              <span className="text-[10px] text-[#d4af37]/80 font-mono">
                Continuous Inscription • Automatic Page Pagination (~{wordsPerPage} w/p)
              </span>
            </div>

            <SinhalaUnicodeEditor
              ref={editorRef}
              id="chapter-content-editor"
              initialContent={content}
              externalContent={remoteContent}
              onContentChange={handleContentUpdate}
              onOpenMedia={() => openMediaFor('content')}
              minHeight="380px"
              maxHeight="580px"
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
                placeholder="Beginning, Reflections, Autumn"
                className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none text-left ltr"
              />
            </div>
          </div>

          {/* Book Chapter Order */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-4">
            <h4 className="font-cinzel text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold">
              Chapter Ordering
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#8e887d] mb-1">
                  Chapter Number
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
                  Starting Page #
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

          {/* Secret Chapter Protection (Clean Terminology: Security Key) */}
          <div className="bg-[#14141d] border border-[#2c2b3a] rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSecret ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40' : 'bg-[#2c2b3a]/50 text-[#8e887d]'}`}>
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-cinzel text-xs tracking-[0.18em] uppercase text-[#d4af37] font-semibold">
                    Secret Chapter Protection
                  </h4>
                  <p className="text-[10px] text-[#8e887d]">Lock this chapter with a custom security key</p>
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
                    <KeyRound className="w-3 h-3 text-[#d4af37]" /> Security Key *
                  </label>
                  <input
                    type="text"
                    value={securityKey}
                    onChange={(e) => {
                      setSecurityKey(e.target.value);
                      setAutoSaveStatus('unsaved');
                    }}
                    placeholder="e.g. 7482 or secret-token"
                    className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] focus:border-[#d4af37] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-[#8e887d] mt-1 block">
                    The custom security key required to unlock and read this specific chapter.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-[#ded8cc] mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#d4af37]" /> Security Key Hint (Displayed to Readers)
                  </label>
                  <input
                    type="text"
                    value={securityHint}
                    onChange={(e) => {
                      setSecurityHint(e.target.value);
                      setAutoSaveStatus('unsaved');
                    }}
                    placeholder="e.g. The year we first met at the library"
                    className="w-full h-9 bg-[#0b0c10] border border-[#2e2d3d] focus:border-[#d4af37] rounded-lg px-3 text-xs text-[#ded8cc] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8e887d] mt-1 block">
                    The hint you type here will be displayed directly on the locked secret pages.
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
                  alt="Chapter Cover"
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
