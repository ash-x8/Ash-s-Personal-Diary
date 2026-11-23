import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileText,
  List,
  Lock,
  PenLine,
  Search,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import { paginateAllChapters } from '../utils/pagination';
import { soundService } from '../services/sound';
import { BookPage, type BookLeafData } from './BookPage';

export function BookReader() {
  const navigate = useNavigate();
  const {
    session,
    entries,
    chapters,
    settings,
    dataLoading,
    lockDiary,
    unlockSecretEntry,
    unlockSecretChapter,
    updateSettings,
  } = useDiary();
  const { showToast } = useToast();

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 960 : true
  );
  const [pageCursor, setPageCursor] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Build ordered leaves from published entries first (primary reading unit),
  // or paginated chapters when chapters hold standalone content without entries.
  const leaves: BookLeafData[] = useMemo(() => {
    const visibleEntries = entries
      .filter((e) => session.role === 'EDITOR' || e.status === 'published')
      .sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));

    if (visibleEntries.length > 0) {
      const chapterMap = new Map(chapters.map((c) => [c.id, c.chapterTitle]));
      return visibleEntries.map((entry, idx) => ({
        id: entry.id,
        sourceType: 'entry',
        sourceId: entry.id,
        title: entry.title,
        content: entry.content,
        date: entry.date,
        mood: entry.mood,
        location: entry.location,
        tags: entry.tags,
        coverImage: entry.coverImage,
        gallery: entry.gallery,
        isSecret: entry.isSecret,
        isLocked: entry.isLocked,
        securityHint: entry.securityHint || entry.secretHint,
        pageNumber: entry.customPageNumber || idx + 1,
        subLabel:
          (entry.chapterId && chapterMap.get(entry.chapterId)) ||
          `Entry ${String(idx + 1).padStart(2, '0')}`,
      }));
    }

    const visibleChapters = chapters.filter(
      (c) => session.role === 'EDITOR' || c.status === 'published'
    );
    if (visibleChapters.length === 0) return [];

    const { pages } = paginateAllChapters(visibleChapters, settings.wordsPerPage || 100);
    return pages.map((p) => ({
      id: p.id,
      sourceType: 'chapter',
      sourceId: p.chapterId,
      title: p.chapterTitle,
      content: p.content,
      date: p.date,
      mood: p.mood,
      location: p.location,
      tags: p.tags,
      coverImage: p.coverImage,
      gallery: p.gallery,
      isSecret: p.isSecret,
      isLocked: p.isLocked,
      securityHint: p.securityHint,
      pageNumber: p.globalPageNumber,
      subLabel: `Chapter · Page ${p.chapterPageNumber} of ${p.totalChapterPages}`,
    }));
  }, [entries, chapters, session.role, settings.wordsPerPage]);

  const useTwoPageSpread = isDesktop && settings.twoPageMode;
  const step = useTwoPageSpread ? 2 : 1;

  useEffect(() => {
    if (leaves.length === 0) {
      setPageCursor(0);
    } else if (pageCursor >= leaves.length) {
      setPageCursor(Math.max(0, leaves.length - step));
    }
  }, [leaves.length, pageCursor, step]);

  const goNext = useCallback(() => {
    if (pageCursor + step >= leaves.length) return;
    setFlipDirection('next');
    soundService.playPageTurn();
    setPageCursor((c) => Math.min(leaves.length - 1, c + step));
    setTimeout(() => setFlipDirection(null), 380);
  }, [pageCursor, step, leaves.length]);

  const goPrev = useCallback(() => {
    if (pageCursor <= 0) return;
    setFlipDirection('prev');
    soundService.playPageTurn();
    setPageCursor((c) => Math.max(0, c - step));
    setTimeout(() => setFlipDirection(null), 380);
  }, [pageCursor, step]);

  const jumpToIndex = useCallback(
    (idx: number) => {
      const normalized = useTwoPageSpread ? idx - (idx % 2) : idx;
      soundService.playPageTurn();
      setPageCursor(Math.max(0, Math.min(leaves.length - 1, normalized)));
      setTocOpen(false);
      setSearchOpen(false);
    },
    [useTwoPageSpread, leaves.length]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Escape') {
        setTocOpen(false);
        setSearchOpen(false);
        setCustomizeOpen(false);
        return;
      }
      if (searchOpen || tocOpen) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, searchOpen, tocOpen]);

  const handleUnlockLeaf = async (leaf: BookLeafData, passkey: string) => {
    if (leaf.sourceType === 'entry') {
      await unlockSecretEntry(leaf.sourceId, passkey);
    } else {
      await unlockSecretChapter(leaf.sourceId, passkey);
    }
    showToast('Sealed page unlocked for this session.', 'success');
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leaves;
    return leaves.filter((leaf) => {
      const text = `${leaf.title} ${leaf.subLabel || ''} ${leaf.mood || ''} ${
        leaf.location || ''
      } ${(leaf.tags || []).join(' ')} ${leaf.isLocked ? '' : leaf.content}`.toLowerCase();
      return text.includes(q);
    });
  }, [leaves, searchQuery]);

  const readingContainerMaxWidth = useMemo(() => {
    switch (settings.readingWidth) {
      case 'compact':
        return 'max-w-4xl';
      case 'wide':
        return 'max-w-7xl';
      case 'normal':
      default:
        return 'max-w-6xl';
    }
  }, [settings.readingWidth]);

  const leftLeaf = leaves[pageCursor] || null;
  const rightLeaf = useTwoPageSpread ? leaves[pageCursor + 1] || null : null;

  const canGoPrev = pageCursor > 0;
  const canGoNext = pageCursor + step < leaves.length;

  const animDurationClass =
    settings.pageAnimationSpeed === 'gentle'
      ? 'duration-500'
      : settings.pageAnimationSpeed === 'relaxed'
      ? 'duration-300'
      : 'duration-200';

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#e8e6e3] flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#1c1f29] bg-[#0e1015]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Brand & TOC */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setTocOpen(true)}
              aria-label="Open table of contents"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#242834] bg-[#141720] px-3 text-xs font-medium text-[#d8d5ce] hover:border-[#c5a059]/40 transition-colors"
            >
              <List className="h-4 w-4 text-[#c5a059]" />
              <span className="hidden sm:inline">Contents</span>
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-serif-title text-sm sm:text-base font-semibold tracking-wide text-[#f2efe9]">
                {settings.title || "Ash's Personal Diary"}
              </h1>
              <p className="hidden md:block text-[11px] text-[#8e929b] truncate">
                {settings.subtitle || 'Private Journal'}
              </p>
            </div>
          </div>

          {/* Center: Page Counter */}
          <div className="hidden md:flex items-center gap-2 text-xs text-[#9ca1ab] tabular-nums">
            <BookOpen className="h-3.5 w-3.5 text-[#c5a059]" />
            <span>
              {leaves.length === 0
                ? 'Empty Volume'
                : useTwoPageSpread && rightLeaf
                ? `Pages ${leftLeaf?.pageNumber}–${rightLeaf.pageNumber} of ${leaves.length}`
                : `Page ${leftLeaf?.pageNumber || 1} of ${leaves.length}`}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search entries"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#242834] bg-[#141720] px-2.5 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setCustomizeOpen((v) => !v)}
              aria-label="Reading settings"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#242834] bg-[#141720] px-2.5 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40 transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {session.role === 'EDITOR' && (
              <button
                type="button"
                onClick={() => navigate('/editor')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#c5a059] px-3 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] transition-colors"
              >
                <PenLine className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Studio</span>
              </button>
            )}

            <button
              type="button"
              onClick={lockDiary}
              aria-label="Lock diary"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#242834] bg-[#141720] px-3 text-xs text-[#d8d5ce] hover:border-[#d66363]/50 hover:text-white transition-colors"
            >
              <Lock className="h-3.5 w-3.5 text-[#c5a059]" />
              <span className="hidden sm:inline">Seal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Book Workspace */}
      <main
        className="flex-1 flex flex-col justify-center px-3 py-5 sm:px-6 sm:py-8 pb-24 sm:pb-10"
        onTouchStart={(e) => {
          if (!settings.mobileSwipeEnabled) return;
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (!settings.mobileSwipeEnabled || touchStartX.current === null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
          const delta = endX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) > 55) {
            if (delta < 0) goNext();
            else goPrev();
          }
        }}
      >
        <div className={`mx-auto w-full ${readingContainerMaxWidth}`}>
          {dataLoading && leaves.length === 0 ? (
            <div className="flex h-[480px] items-center justify-center rounded-xl border border-[#1f232e] bg-[#12141a]">
              <p className="font-serif-book text-lg italic text-[#9ca1ab]">Opening pages…</p>
            </div>
          ) : leaves.length === 0 ? (
            <div className="flex h-[460px] flex-col items-center justify-center rounded-xl border border-[#1f232e] bg-[#12141a] p-8 text-center">
              <FileText className="h-8 w-8 text-[#c5a059] mb-3" />
              <h2 className="font-serif-title text-lg text-[#f2efe9]">No Published Pages Yet</h2>
              <p className="mt-1.5 max-w-md text-sm text-[#9ca1ab]">
                This volume currently has no published entries.
              </p>
              {session.role === 'EDITOR' && (
                <button
                  type="button"
                  onClick={() => navigate('/editor')}
                  className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#c5a059] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[#0c0e13]"
                >
                  <PenLine className="h-4 w-4" />
                  Write First Entry
                </button>
              )}
            </div>
          ) : (
            <div className="relative flex items-stretch gap-3 sm:gap-5">
              {/* Desktop Prev Button */}
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Previous page"
                className="hidden lg:flex w-11 shrink-0 items-center justify-center rounded-xl border border-[#20242f] bg-[#12141a]/80 text-[#c5a059] hover:border-[#c5a059]/40 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Book Spread */}
              <div
                className={`flex-1 grid gap-0 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.85)] rounded-xl transition-transform ${animDurationClass} ${
                  flipDirection === 'next'
                    ? '-translate-x-1 opacity-95'
                    : flipDirection === 'prev'
                    ? 'translate-x-1 opacity-95'
                    : 'translate-x-0 opacity-100'
                } ${useTwoPageSpread ? 'grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto w-full'}`}
              >
                {useTwoPageSpread ? (
                  <>
                    <BookPage
                      leaf={leftLeaf}
                      side="left"
                      settings={settings}
                      onUnlockSecret={handleUnlockLeaf}
                    />
                    <BookPage
                      leaf={rightLeaf}
                      side="right"
                      settings={settings}
                      onUnlockSecret={handleUnlockLeaf}
                    />
                  </>
                ) : (
                  <BookPage
                    leaf={leftLeaf}
                    side="single"
                    settings={settings}
                    onUnlockSecret={handleUnlockLeaf}
                  />
                )}
              </div>

              {/* Desktop Next Button */}
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                aria-label="Next page"
                className="hidden lg:flex w-11 shrink-0 items-center justify-center rounded-xl border border-[#20242f] bg-[#12141a]/80 text-[#c5a059] hover:border-[#c5a059]/40 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Mobile & Tablet Fixed Bottom Navigation Bar */}
      {leaves.length > 0 && (
        <nav
          aria-label="Page navigation"
          className="fixed inset-x-0 bottom-0 z-20 flex lg:hidden items-center justify-between border-t border-[#1e222c] bg-[#0e1015]/95 px-4 py-2.5 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#252936] bg-[#141720] px-4 text-xs font-medium text-[#e8e6e3] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4 text-[#c5a059]" />
            <span>Prev</span>
          </button>

          <span className="text-xs text-[#a0a4ad] tabular-nums">
            {leftLeaf?.pageNumber || 1} / {leaves.length}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#252936] bg-[#141720] px-4 text-xs font-medium text-[#e8e6e3] disabled:opacity-35"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4 text-[#c5a059]" />
          </button>
        </nav>
      )}

      {/* Table of Contents Slide-Out Drawer */}
      {tocOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Table of Contents"
          className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm"
          onClick={() => setTocOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-sm border-r border-[#232734] bg-[#101218] p-5 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#1e222d]">
              <div>
                <h2 className="font-serif-title text-base font-semibold tracking-wide text-[#f2efe9]">
                  Table of Contents
                </h2>
                <p className="text-xs text-[#8e929b] tabular-nums">
                  {leaves.length} Recorded Leaves
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                aria-label="Close contents"
                className="rounded-lg p-2 text-[#8e929b] hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-1.5 pr-1">
              {leaves.map((leaf, idx) => {
                const isActive =
                  idx === pageCursor || (useTwoPageSpread && idx === pageCursor + 1);
                return (
                  <button
                    key={leaf.id}
                    type="button"
                    onClick={() => jumpToIndex(idx)}
                    className={`w-full text-left rounded-lg px-3.5 py-2.5 border transition-colors ${
                      isActive
                        ? 'border-[#c5a059]/45 bg-[#c5a059]/10 text-[#f5efe2]'
                        : 'border-transparent hover:bg-white/[0.04] text-[#c8ccd4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#8e929b] tabular-nums">
                      <span className="truncate">{leaf.subLabel}</span>
                      <span>p. {leaf.pageNumber}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-serif-book text-base font-medium">
                      {leaf.isSecret && <Lock className="h-3.5 w-3.5 text-[#c5a059] shrink-0" />}
                      <span className="truncate">{leaf.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* Search Modal */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search diary entries"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-16 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl border border-[#252a38] bg-[#111319] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-[#1e222d] px-4 py-3">
              <Search className="h-4 w-4 text-[#c5a059]" />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles, thoughts, moods, locations, or tags…"
                className="flex-1 bg-transparent text-sm text-[#f2efe9] placeholder-[#686d7a] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-1.5 text-[#8e929b] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-3 space-y-1.5">
              {searchResults.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#8e929b]">
                  No matching entries found.
                </p>
              ) : (
                searchResults.map((leaf) => {
                  const idx = leaves.findIndex((l) => l.id === leaf.id);
                  return (
                    <button
                      key={leaf.id}
                      type="button"
                      onClick={() => jumpToIndex(idx)}
                      className="w-full text-left rounded-lg border border-transparent hover:border-[#2a2f3d] hover:bg-white/[0.03] px-3.5 py-2.5 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs text-[#8e929b] tabular-nums">
                        <span>{leaf.date || leaf.subLabel}</span>
                        <span>Page {leaf.pageNumber}</span>
                      </div>
                      <p className="mt-0.5 font-serif-book text-base font-semibold text-[#f2efe9]">
                        {leaf.title}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reading Customization Drawer/Popover */}
      {customizeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reading preferences"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setCustomizeOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[#252a38] bg-[#111319] p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif-title text-base font-semibold text-[#f2efe9]">
                Reading Experience
              </h2>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                aria-label="Close reading preferences"
                className="p-1.5 text-[#8e929b] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-2">
                Paper Tone
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['classic', 'clean', 'dark'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => updateSettings({ paperColor: tone })}
                    className={`min-h-[40px] rounded-lg border text-xs font-medium capitalize transition-colors ${
                      settings.paperColor === tone
                        ? 'border-[#c5a059] bg-[#c5a059]/15 text-[#f2efe9]'
                        : 'border-[#252a38] bg-[#161922] text-[#a0a4ad]'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-2">
                Text Size
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'large'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateSettings({ fontSize: sz })}
                    className={`min-h-[40px] rounded-lg border text-xs font-medium capitalize transition-colors ${
                      (settings.fontSize || 'normal') === sz
                        ? 'border-[#c5a059] bg-[#c5a059]/15 text-[#f2efe9]'
                        : 'border-[#252a38] bg-[#161922] text-[#a0a4ad]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e222d]">
              <span className="flex items-center gap-2 text-sm text-[#d8d5ce]">
                <Columns2 className="h-4 w-4 text-[#c5a059]" />
                Two-Page Spread (Desktop)
              </span>
              <button
                type="button"
                onClick={() => updateSettings({ twoPageMode: !settings.twoPageMode })}
                className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold ${
                  settings.twoPageMode
                    ? 'border-[#c5a059] bg-[#c5a059] text-[#0c0e13]'
                    : 'border-[#2a2f3d] bg-[#161922] text-[#9ca1ab]'
                }`}
              >
                {settings.twoPageMode ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-[#d8d5ce]">
                {settings.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-[#c5a059]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#8e929b]" />
                )}
                Page Turn Acoustics
              </span>
              <button
                type="button"
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold ${
                  settings.soundEnabled
                    ? 'border-[#c5a059] bg-[#c5a059] text-[#0c0e13]'
                    : 'border-[#2a2f3d] bg-[#161922] text-[#9ca1ab]'
                }`}
              >
                {settings.soundEnabled ? 'On' : 'Muted'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
