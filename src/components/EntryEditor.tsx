import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ImagePlus,
  Lock,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type { DiaryEntry, EntryStatus } from '../types';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import { countWords, paginateChapter } from '../utils/pagination';
import { sanitizeMediaUrl } from '../utils/sanitize';
import { SinhalaTextInput } from './SinhalaTextInput';
import { SinhalaUnicodeEditor } from './SinhalaUnicodeEditor';
import { MediaLibraryModal } from './MediaLibraryModal';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface EntryEditorProps {
  entry: DiaryEntry | null;
  onSaved: (saved: DiaryEntry) => void;
  onCancel: () => void;
}

export function EntryEditor({ entry, onSaved, onCancel }: EntryEditorProps) {
  const { chapters, settings, createEntry, updateEntry } = useDiary();
  const { showToast } = useToast();

  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '<p></p>');
  const [date, setDate] = useState(entry?.date || new Date().toISOString().split('T')[0]);
  const [mood, setMood] = useState(entry?.mood || '');
  const [location, setLocation] = useState(entry?.location || '');
  const [tagsInput, setTagsInput] = useState((entry?.tags || []).join(', '));
  const [chapterId, setChapterId] = useState(entry?.chapterId || '');
  const [coverImage, setCoverImage] = useState(entry?.coverImage || '');
  const [gallery, setGallery] = useState<string[]>(entry?.gallery || []);
  const [status, setStatus] = useState<EntryStatus>(entry?.status || 'draft');
  const [pageOrder, setPageOrder] = useState<number>(entry?.pageOrder || 1);
  const [isSecret, setIsSecret] = useState<boolean>(Boolean(entry?.isSecret));
  const [securityKey, setSecurityKey] = useState(
    entry?.securityKey || entry?.secretPasscode || ''
  );
  const [securityHint, setSecurityHint] = useState(
    entry?.securityHint || entry?.secretHint || ''
  );

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<'cover' | 'gallery' | 'inline' | null>(null);
  const [inlineImageUrl, setInlineImageUrl] = useState<string | null>(null);
  const [showPaginationPreview, setShowPaginationPreview] = useState(false);

  // Sync form when switching edited entry
  useEffect(() => {
    setTitle(entry?.title || '');
    setContent(entry?.content || '<p></p>');
    setDate(entry?.date || new Date().toISOString().split('T')[0]);
    setMood(entry?.mood || '');
    setLocation(entry?.location || '');
    setTagsInput((entry?.tags || []).join(', '));
    setChapterId(entry?.chapterId || '');
    setCoverImage(entry?.coverImage || '');
    setGallery(entry?.gallery || []);
    setStatus(entry?.status || 'draft');
    setPageOrder(entry?.pageOrder || 1);
    setIsSecret(Boolean(entry?.isSecret));
    setSecurityKey(entry?.securityKey || entry?.secretPasscode || '');
    setSecurityHint(entry?.securityHint || entry?.secretHint || '');
    setDirty(false);
    setLastSavedAt(null);
  }, [entry?.id]);

  // Warn before browser unload when unsaved edits exist
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Periodic autosave for existing entries every 15s when dirty
  useEffect(() => {
    if (!entry?.id || !dirty || saving) return;
    const timer = setTimeout(() => {
      void persistEntry(status, true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [entry?.id, dirty, saving, title, content, date, mood, location, tagsInput, chapterId, coverImage, gallery, status, pageOrder, isSecret, securityKey, securityHint]);

  const wordCount = useMemo(() => countWords(content), [content]);

  const paginationPreview = useMemo(() => {
    return paginateChapter(
      {
        id: entry?.id || 'preview',
        chapterTitle: title || 'Untitled Entry',
        rawContent: content,
        createdAt: null,
        updatedAt: null,
        date,
        mood,
        location,
      },
      settings.wordsPerPage || 100,
      1
    );
  }, [entry?.id, title, content, date, mood, location, settings.wordsPerPage]);

  const persistEntry = async (targetStatus: EntryStatus, silent = false) => {
    if (!title.trim()) {
      if (!silent) showToast('Give this diary entry a title before saving.', 'error');
      return;
    }
    if (isSecret && !securityKey.trim()) {
      if (!silent) showToast('Enter a passkey for this sealed entry.', 'error');
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Partial<DiaryEntry> = {
        title: title.trim(),
        content,
        date,
        mood: mood.trim(),
        location: location.trim(),
        tags,
        chapterId: chapterId || undefined,
        coverImage: coverImage.trim(),
        gallery,
        status: targetStatus,
        pageOrder: Number(pageOrder) || 1,
        isSecret,
        securityKey: isSecret ? securityKey.trim() : '',
        securityHint: isSecret ? securityHint.trim() : '',
        secretPasscode: isSecret ? securityKey.trim() : '',
        secretHint: isSecret ? securityHint.trim() : '',
      };

      const saved = entry?.id
        ? await updateEntry(entry.id, payload)
        : await createEntry(payload);

      setStatus(targetStatus);
      setDirty(false);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (!silent) {
        showToast(
          targetStatus === 'published' ? 'Entry published to book.' : 'Draft saved.',
          'success'
        );
        onSaved(saved);
      }
    } catch (err) {
      if (!silent) {
        showToast(err instanceof Error ? err.message : 'Unable to save entry.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty) {
      setDiscardDialogOpen(true);
    } else {
      onCancel();
    }
  };

  const safeCover = sanitizeMediaUrl(coverImage);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e222d] pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#252a38] bg-[#141720] px-3.5 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <div>
            <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
              {entry ? 'Edit Diary Entry' : 'New Diary Entry'}
            </h2>
            <p className="text-xs text-[#8e929b] tabular-nums">
              {wordCount} words · {paginationPreview.length} estimated book{' '}
              {paginationPreview.length === 1 ? 'page' : 'pages'}
              {lastSavedAt ? ` · Autosaved ${lastSavedAt}` : dirty ? ' · Unsaved edits' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPaginationPreview((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#252a38] bg-[#141720] px-3.5 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#c5a059]" />
            <span>{showPaginationPreview ? 'Hide Page Split' : 'Page Split Preview'}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => persistEntry('draft')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#2a2f3d] bg-[#161922] px-4 text-xs font-medium text-[#e8e6e3] hover:border-[#c5a059]/50 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => persistEntry('published')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#c5a059] px-4 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving…' : 'Publish'}</span>
          </button>
        </div>
      </div>

      {/* Main Editor Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Title & Rich Content */}
        <div className="xl:col-span-8 space-y-5">
          <div>
            <label
              htmlFor="entry-title-input"
              className="block text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-1.5"
            >
              Entry Title
            </label>
            <SinhalaTextInput
              id="entry-title-input"
              value={title}
              onChange={(val) => {
                setTitle(val);
                setDirty(true);
              }}
              placeholder="Give this memory a title…"
              className="w-full min-h-[46px] rounded-xl border border-[#242834] bg-[#0e1015] px-4 text-lg font-serif-book font-semibold text-[#f2efe9] placeholder-[#585d6b] focus:border-[#c5a059] focus:outline-none"
            />
          </div>

          <SinhalaUnicodeEditor
            value={content}
            onChange={(html) => {
              setContent(html);
              setDirty(true);
            }}
            onOpenMediaPicker={() => setMediaTarget('inline')}
            insertImageUrl={inlineImageUrl}
            onImageInserted={() => setInlineImageUrl(null)}
          />

          {showPaginationPreview && (
            <div className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-title text-sm font-semibold text-[#f2efe9]">
                  Auto-Pagination Preview ({settings.wordsPerPage || 100} words/leaf)
                </h3>
                <span className="text-xs text-[#9ca1ab] tabular-nums">
                  {paginationPreview.length} leaves
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paginationPreview.map((leaf) => (
                  <div
                    key={leaf.id}
                    className="rounded-lg border border-[#20242f] bg-[#0b0c10] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[#c5a059] mb-1.5 tabular-nums">
                      <span>Leaf {leaf.chapterPageNumber}</span>
                      <span>{leaf.wordCount} words</span>
                    </div>
                    <p className="line-clamp-3 text-[#a0a4ad]">
                      {leaf.content.replace(/<[^>]*>/g, ' ').trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata, Chapter, Cover & Secret Lock */}
        <aside className="xl:col-span-4 space-y-5">
          <div className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-4">
            <h3 className="font-serif-title text-sm font-semibold tracking-wide text-[#f2efe9]">
              Entry Details
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9ca1ab] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9ca1ab] mb-1">
                  Book Order
                </label>
                <input
                  type="number"
                  min={1}
                  value={pageOrder}
                  onChange={(e) => {
                    setPageOrder(Number(e.target.value) || 1);
                    setDirty(true);
                  }}
                  className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca1ab] mb-1">
                Chapter Assignment
              </label>
              <select
                value={chapterId}
                onChange={(e) => {
                  setChapterId(e.target.value);
                  setDirty(true);
                }}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
              >
                <option value="">Standalone Entry</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.chapterTitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9ca1ab] mb-1">
                  Mood
                </label>
                <SinhalaTextInput
                  value={mood}
                  onChange={(v) => {
                    setMood(v);
                    setDirty(true);
                  }}
                  placeholder="e.g. Calm"
                  className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9ca1ab] mb-1">
                  Location
                </label>
                <SinhalaTextInput
                  value={location}
                  onChange={(v) => {
                    setLocation(v);
                    setDirty(true);
                  }}
                  placeholder="e.g. Study"
                  className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca1ab] mb-1">
                Tags (comma separated)
              </label>
              <SinhalaTextInput
                value={tagsInput}
                onChange={(v) => {
                  setTagsInput(v);
                  setDirty(true);
                }}
                placeholder="Memories, Rain, Midnight"
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
              />
            </div>
          </div>

          {/* Cover & Gallery */}
          <div className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-title text-sm font-semibold text-[#f2efe9]">
                Cover & Photographs
              </h3>
              <button
                type="button"
                onClick={() => setMediaTarget('cover')}
                className="inline-flex items-center gap-1 text-xs text-[#c5a059] hover:underline"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Choose Cover</span>
              </button>
            </div>

            {safeCover ? (
              <div className="relative overflow-hidden rounded-lg border border-[#262b38]">
                <img
                  src={safeCover}
                  alt="Entry cover"
                  referrerPolicy="no-referrer"
                  className="h-36 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCoverImage('');
                    setDirty(true);
                  }}
                  aria-label="Remove cover image"
                  className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-white hover:bg-black"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#7c818d]">No cover photograph assigned.</p>
            )}

            <div className="pt-2 border-t border-[#1e222d]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#9ca1ab] tabular-nums">
                  Gallery ({gallery.length})
                </span>
                <button
                  type="button"
                  onClick={() => setMediaTarget('gallery')}
                  className="text-xs text-[#c5a059] hover:underline"
                >
                  + Add Photo
                </button>
              </div>
              {gallery.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((url, idx) => (
                    <div
                      key={`${url.slice(0, 20)}-${idx}`}
                      className="relative aspect-square overflow-hidden rounded-md border border-[#262b38]"
                    >
                      <img
                        src={sanitizeMediaUrl(url)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setGallery((prev) => prev.filter((_, i) => i !== idx));
                          setDirty(true);
                        }}
                        aria-label="Remove gallery photo"
                        className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Private Lock */}
          <div className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-medium text-[#f2efe9]">
                <Lock className="h-4 w-4 text-[#c5a059]" />
                <span>Secret Locked Leaf</span>
              </span>
              <input
                type="checkbox"
                checked={isSecret}
                onChange={(e) => {
                  setIsSecret(e.target.checked);
                  setDirty(true);
                }}
                className="h-4 w-4 accent-[#c5a059]"
              />
            </label>

            {isSecret && (
              <div className="space-y-2.5 pt-2 border-t border-[#1e222d]">
                <input
                  type="text"
                  value={securityKey}
                  onChange={(e) => {
                    setSecurityKey(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Secret passkey for this leaf"
                  className="w-full min-h-[38px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
                />
                <input
                  type="text"
                  value={securityHint}
                  onChange={(e) => {
                    setSecurityHint(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Optional memory hint"
                  className="w-full min-h-[38px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
                />
              </div>
            )}
          </div>
        </aside>
      </div>

      <MediaLibraryModal
        open={Boolean(mediaTarget)}
        onClose={() => setMediaTarget(null)}
        onSelectUrl={(url) => {
          if (mediaTarget === 'cover') {
            setCoverImage(url);
            setDirty(true);
          } else if (mediaTarget === 'gallery') {
            setGallery((prev) => [...prev, url]);
            setDirty(true);
          } else if (mediaTarget === 'inline') {
            setInlineImageUrl(url);
            setDirty(true);
          }
        }}
      />

      <ConfirmDialog
        open={discardDialogOpen}
        title="Discard Unsaved Changes?"
        description="You have unsubmitted changes in this entry. Leaving now will discard edits since your last save."
        confirmLabel="Discard Changes"
        destructive
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onCancel();
        }}
        onCancel={() => setDiscardDialogOpen(false)}
      />
    </div>
  );
}
