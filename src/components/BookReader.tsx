import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Search,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Lock,
  X,
  Palette,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { DiaryEntry, DiarySettings } from '../types';
import { soundService } from '../services/sound';
import {
  BookPageContainer,
  BookTitlePage,
  BookTableOfContents,
  BookEntryLeftPage,
  BookEntryRightPage
} from './BookPage';
import { BookSecretLockedPage } from './BookSecretLockedPage';

interface BookReaderProps {
  entries: DiaryEntry[];
  settings: DiarySettings;
  onLockDiary: () => void;
  onUpdateSettings?: (updates: Partial<DiarySettings>) => void;
  isEditorPreview?: boolean;
  onClosePreview?: () => void;
}

interface FlipState {
  direction: 'next' | 'prev';
  fromSpread: number;
  toSpread: number;
}

interface MobileFlipState {
  direction: 'next' | 'prev';
  fromIndex: number;
  toIndex: number;
}

export const BookReader: React.FC<BookReaderProps> = ({
  entries,
  settings,
  onLockDiary,
  onUpdateSettings,
  isEditorPreview = false,
  onClosePreview
}) => {
  // Current spread index (in 2-page mode, each spread contains 2 pages: 2*spread and 2*spread + 1)
  // Spread 0: Left = Title Page, Right = Table of Contents
  // Spread 1..N: Left = Entry Left, Right = Entry Right
  const [currentSpread, setCurrentSpread] = useState(0);
  const [flipState, setFlipState] = useState<FlipState | null>(null);
  const [mobileFlipState, setMobileFlipState] = useState<MobileFlipState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paperTheme, setPaperTheme] = useState<'classic' | 'clean' | 'dark'>(settings.paperColor || 'classic');
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled !== false);
  const [showTOCModal, setShowTOCModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobilePageIndex, setMobilePageIndex] = useState(0);
  const [unlockedSecretIds, setUnlockedSecretIds] = useState<Set<string>>(new Set());

  const handleUnlockEntry = (entryId: string) => {
    setUnlockedSecretIds((prev) => {
      const updated = new Set(prev);
      updated.add(entryId);
      return updated;
    });
  };

  // Touch gesture handling for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Total spreads calculation
  // Spread 0: [Title Page, Table of Contents]
  // Each entry takes 1 spread
  const totalSpreads = Math.max(1, entries.length + 1);
  const totalMobilePages = Math.max(2, entries.length * 2 + 2);

  // Resize listener to detect mobile vs desktop
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update sound service preference
  useEffect(() => {
    soundService.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Keep page and spread index within bounds when entries are updated/deleted
  useEffect(() => {
    if (currentSpread >= totalSpreads) {
      setCurrentSpread(Math.max(0, totalSpreads - 1));
    }
  }, [totalSpreads, currentSpread]);

  useEffect(() => {
    if (mobilePageIndex >= totalMobilePages) {
      setMobilePageIndex(Math.max(0, totalMobilePages - 1));
    }
  }, [totalMobilePages, mobilePageIndex]);

  const isTransitioning = Boolean(flipState || mobileFlipState);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearchModal || showTOCModal) {
        if (e.key === 'Escape') {
          setShowSearchModal(false);
          setShowTOCModal(false);
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSpread, mobilePageIndex, isMobileView, flipState, mobileFlipState, showSearchModal, showTOCModal, totalSpreads]);

  // Page Turn Actions with Realistic 3D Turn Mechanics
  const goToNext = () => {
    if (isTransitioning) return;

    if (isMobileView) {
      if (mobilePageIndex < totalMobilePages - 1) {
        soundService.playPageTurn();
        const nextIdx = mobilePageIndex + 1;
        setMobileFlipState({
          direction: 'next',
          fromIndex: mobilePageIndex,
          toIndex: nextIdx
        });
        setTimeout(() => {
          setMobilePageIndex(nextIdx);
          setMobileFlipState(null);
        }, 550);
      }
    } else {
      if (currentSpread < totalSpreads - 1) {
        soundService.playPageTurn();
        const nextSpread = currentSpread + 1;
        setFlipState({
          direction: 'next',
          fromSpread: currentSpread,
          toSpread: nextSpread
        });
        setTimeout(() => {
          setCurrentSpread(nextSpread);
          setFlipState(null);
        }, 720);
      }
    }
  };

  const goToPrev = () => {
    if (isTransitioning) return;

    if (isMobileView) {
      if (mobilePageIndex > 0) {
        soundService.playPageTurn();
        const prevIdx = mobilePageIndex - 1;
        setMobileFlipState({
          direction: 'prev',
          fromIndex: mobilePageIndex,
          toIndex: prevIdx
        });
        setTimeout(() => {
          setMobilePageIndex(prevIdx);
          setMobileFlipState(null);
        }, 550);
      }
    } else {
      if (currentSpread > 0) {
        soundService.playPageTurn();
        const prevSpread = currentSpread - 1;
        setFlipState({
          direction: 'prev',
          fromSpread: currentSpread,
          toSpread: prevSpread
        });
        setTimeout(() => {
          setCurrentSpread(prevSpread);
          setFlipState(null);
        }, 720);
      }
    }
  };

  const jumpToEntry = (entryIdx: number) => {
    soundService.playPageTurn();
    const targetSpread = entryIdx + 1;
    if (isMobileView) {
      const targetPage = (entryIdx + 1) * 2;
      if (targetPage !== mobilePageIndex) {
        const dir = targetPage > mobilePageIndex ? 'next' : 'prev';
        setMobileFlipState({ direction: dir, fromIndex: mobilePageIndex, toIndex: targetPage });
        setTimeout(() => {
          setMobilePageIndex(targetPage);
          setMobileFlipState(null);
        }, 550);
      }
    } else {
      if (targetSpread !== currentSpread) {
        const dir = targetSpread > currentSpread ? 'next' : 'prev';
        setFlipState({ direction: dir, fromSpread: currentSpread, toSpread: targetSpread });
        setTimeout(() => {
          setCurrentSpread(targetSpread);
          setFlipState(null);
        }, 720);
      }
    }
    setShowTOCModal(false);
    setShowSearchModal(false);
  };

  const jumpToCover = () => {
    soundService.playPageTurn();
    if (isMobileView) {
      if (mobilePageIndex !== 0) {
        setMobileFlipState({ direction: 'prev', fromIndex: mobilePageIndex, toIndex: 0 });
        setTimeout(() => {
          setMobilePageIndex(0);
          setMobileFlipState(null);
        }, 550);
      }
    } else {
      if (currentSpread !== 0) {
        setFlipState({ direction: 'prev', fromSpread: currentSpread, toSpread: 0 });
        setTimeout(() => {
          setCurrentSpread(0);
          setFlipState(null);
        }, 720);
      }
    }
    setShowTOCModal(false);
  };

  // Modular page renderers for both static spread and 3D turning leaf
  const renderSpreadLeft = (spreadIdx: number) => {
    if (spreadIdx === 0) {
      return (
        <BookPageContainer
          pageNumber={1}
          totalPages={totalSpreads * 2}
          settings={settings}
          paperTheme={paperTheme}
          side="left"
        >
          <BookTitlePage
            settings={settings}
            authorName={settings.authorName}
            totalEntries={entries.length}
          />
        </BookPageContainer>
      );
    }

    const entry = entries[spreadIdx - 1];
    if (!entry) {
      return (
        <BookPageContainer
          pageNumber={spreadIdx * 2}
          totalPages={totalSpreads * 2}
          settings={settings}
          paperTheme={paperTheme}
          side="left"
        >
          <div className="h-full flex items-center justify-center text-center opacity-60 font-serif-book italic">
            <p>End of inscribed journal pages.</p>
          </div>
        </BookPageContainer>
      );
    }

    const isSecretLocked = Boolean(entry.isSecret && !unlockedSecretIds.has(entry.id));

    if (isSecretLocked) {
      return (
        <BookPageContainer
          pageNumber={spreadIdx * 2}
          totalPages={totalSpreads * 2}
          settings={settings}
          paperTheme={paperTheme}
          side="left"
        >
          <BookSecretLockedPage
            entry={entry}
            onUnlock={() => handleUnlockEntry(entry.id)}
            isEditor={isEditorPreview}
          />
        </BookPageContainer>
      );
    }

    return (
      <BookPageContainer
        pageNumber={spreadIdx * 2}
        totalPages={totalSpreads * 2}
        settings={settings}
        paperTheme={paperTheme}
        side="left"
      >
        <BookEntryLeftPage entry={entry} entryIndex={spreadIdx - 1} />
      </BookPageContainer>
    );
  };

  const renderSpreadRight = (spreadIdx: number) => {
    if (spreadIdx === 0) {
      return (
        <BookPageContainer
          pageNumber={2}
          totalPages={totalSpreads * 2}
          settings={settings}
          paperTheme={paperTheme}
          side="right"
        >
          <BookTableOfContents
            entries={entries}
            onSelectEntry={jumpToEntry}
          />
        </BookPageContainer>
      );
    }

    const entry = entries[spreadIdx - 1];
    if (!entry) {
      return (
        <BookPageContainer
          pageNumber={spreadIdx * 2 + 1}
          totalPages={totalSpreads * 2}
          settings={settings}
          paperTheme={paperTheme}
          side="right"
        >
          <div className="h-full flex items-center justify-center text-center opacity-60 font-serif-book italic">
            <p>The quiet unwritten tomorrow.</p>
          </div>
        </BookPageContainer>
      );
    }

    const isSecretLocked = Boolean(entry.isSecret && !unlockedSecretIds.has(entry.id));

    if (isSecretLocked) {
      return (
        <BookPageContainer
          pageNumber={spreadIdx * 2 + 1}
          totalPages={totalSpreads * 2}
          settings={settings}
          paperTheme={paperTheme}
          side="right"
        >
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 select-none opacity-85">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#d4af37]/40 flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#d4af37]" />
            </div>
            <h4 className="font-cinzel text-xs tracking-[0.25em] uppercase text-[#d4af37] font-semibold">
              Passcode Protected Archive
            </h4>
            <p className="font-serif-book italic text-base opacity-80 max-w-xs leading-relaxed">
              "The inscription on this leaf remains veiled until the secret passcode is entered."
            </p>
            <div className="w-12 h-px bg-current opacity-20 my-2" />
            <span className="text-[10px] font-cinzel tracking-widest uppercase opacity-60">
              Provide key on the facing page to unlock
            </span>
          </div>
        </BookPageContainer>
      );
    }

    return (
      <BookPageContainer
        pageNumber={spreadIdx * 2 + 1}
        totalPages={totalSpreads * 2}
        settings={settings}
        paperTheme={paperTheme}
        side="right"
      >
        <BookEntryRightPage entry={entry} />
      </BookPageContainer>
    );
  };

  const renderMobilePage = (pageIdx: number) => {
    if (pageIdx === 0) {
      return (
        <BookPageContainer
          pageNumber={1}
          totalPages={totalMobilePages}
          settings={settings}
          paperTheme={paperTheme}
          side="single"
        >
          <BookTitlePage
            settings={settings}
            authorName={settings.authorName}
            totalEntries={entries.length}
          />
        </BookPageContainer>
      );
    }

    if (pageIdx === 1) {
      return (
        <BookPageContainer
          pageNumber={2}
          totalPages={totalMobilePages}
          settings={settings}
          paperTheme={paperTheme}
          side="single"
        >
          <BookTableOfContents
            entries={entries}
            onSelectEntry={jumpToEntry}
          />
        </BookPageContainer>
      );
    }

    const entryIndex = Math.floor((pageIdx - 2) / 2);
    const isLeftPage = (pageIdx - 2) % 2 === 0;
    const entry = entries[entryIndex];

    if (!entry) {
      return (
        <BookPageContainer
          pageNumber={pageIdx + 1}
          totalPages={totalMobilePages}
          settings={settings}
          paperTheme={paperTheme}
          side="single"
        >
          <div className="h-full flex items-center justify-center text-center">
            <p className="font-serif-book italic opacity-70">
              End of inscribed pages.
            </p>
          </div>
        </BookPageContainer>
      );
    }

    const isSecretLocked = Boolean(entry.isSecret && !unlockedSecretIds.has(entry.id));

    if (isSecretLocked) {
      return (
        <BookPageContainer
          pageNumber={pageIdx + 1}
          totalPages={totalMobilePages}
          settings={settings}
          paperTheme={paperTheme}
          side="single"
        >
          <BookSecretLockedPage
            entry={entry}
            onUnlock={() => handleUnlockEntry(entry.id)}
            isEditor={isEditorPreview}
          />
        </BookPageContainer>
      );
    }

    return (
      <BookPageContainer
        pageNumber={pageIdx + 1}
        totalPages={totalMobilePages}
        settings={settings}
        paperTheme={paperTheme}
        side="single"
      >
        {isLeftPage ? (
          <BookEntryLeftPage entry={entry} entryIndex={entryIndex} />
        ) : (
          <BookEntryRightPage entry={entry} />
        )}
      </BookPageContainer>
    );
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      // Swiped left -> next page
      goToNext();
    } else if (distance < -minSwipeDistance) {
      // Swiped right -> prev page
      goToPrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Search filtering
  const filteredSearchResults = searchQuery.trim()
    ? entries.filter(e => {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          e.date.includes(q) ||
          (e.mood && e.mood.toLowerCase().includes(q)) ||
          e.tags.some(t => t.toLowerCase().includes(q))
        );
      })
    : [];

  // Theme switcher handler
  const handleThemeChange = (newTheme: 'classic' | 'clean' | 'dark') => {
    setPaperTheme(newTheme);
    if (onUpdateSettings) {
      onUpdateSettings({ paperColor: newTheme });
    }
  };

  return (
    <div
      id="book-reader-view"
      className={`relative min-h-screen w-full flex flex-col items-center justify-between bg-[#0b0c10] text-[#e8e6e3] select-none transition-all duration-700 ${
        isFullscreen ? 'fixed inset-0 z-50 p-2 sm:p-4' : 'p-3 sm:p-6 md:p-8'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Floating Control Bar */}
      <header className="relative z-30 w-full max-w-6xl flex items-center justify-between py-2 px-3 sm:px-5 bg-[#14141a]/80 backdrop-blur-md rounded-xl border border-[#272732] shadow-xl text-xs">
        {/* Left: Book Branding & Cover Link */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={jumpToCover}
            className="flex items-center gap-2 text-[#d4af37] hover:text-[#f5ebd7] font-cinzel tracking-[0.18em] uppercase font-semibold transition-colors cursor-pointer"
            title="Return to Cover Page"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{settings.title || "Ash's Diary"}</span>
          </button>

          {isEditorPreview && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f0dfad] text-[10px] uppercase tracking-wider font-cinzel">
              <Sparkles className="w-3 h-3" /> Reader Preview Mode
            </span>
          )}
        </div>

        {/* Center: Table of Contents & Search quick access */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="reader-contents-btn"
            onClick={() => setShowTOCModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1e26] hover:bg-[#2b2a36] text-[#d6d0c4] border border-[#343342] transition-colors cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="font-cinzel tracking-wider">Contents</span>
          </button>

          <button
            type="button"
            id="reader-search-btn"
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1e26] hover:bg-[#2b2a36] text-[#d6d0c4] border border-[#343342] transition-colors cursor-pointer"
            title="Search Diary Entries"
          >
            <Search className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="hidden md:inline font-cinzel tracking-wider">Search</span>
          </button>
        </div>

        {/* Right: Sound, Paper Theme, Fullscreen, Lock/Exit */}
        <div className="flex items-center gap-2">
          {/* Live Sync Badge */}
          <div
            id="reader-firestore-live-badge"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181824] border border-[#2e2d3d] text-[11px]"
            title="Real-time multi-device synchronization active via Cloud Firestore"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] tracking-wider text-emerald-400/90 font-medium">Live Sync</span>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            id="reader-sound-toggle-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-[#9e978b] hover:text-[#f5ebd7] transition-colors cursor-pointer"
            title={soundEnabled ? "Sound ON (Page turns)" : "Sound OFF"}
            aria-label="Toggle page turn audio"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#d4af37]" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Paper Theme selector */}
          <div className="relative group">
            <button
              type="button"
              id="reader-theme-toggle-btn"
              className="flex items-center gap-1 p-1.5 rounded-lg text-[#9e978b] hover:text-[#f5ebd7] transition-colors cursor-pointer"
              title="Change Paper Palette"
              aria-label="Change paper palette"
            >
              <Palette className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col gap-1 p-2 bg-[#17171e] border border-[#31303d] rounded-lg shadow-2xl z-50 text-[11px] min-w-[120px]">
              <button
                type="button"
                onClick={() => handleThemeChange('classic')}
                className={`text-left px-2 py-1 rounded transition-colors ${paperTheme === 'classic' ? 'text-[#d4af37] bg-[#272632]' : 'text-[#bdb8ad] hover:bg-[#202029]'}`}
              >
                Classic Ivory
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('clean')}
                className={`text-left px-2 py-1 rounded transition-colors ${paperTheme === 'clean' ? 'text-[#d4af37] bg-[#272632]' : 'text-[#bdb8ad] hover:bg-[#202029]'}`}
              >
                Clean White
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`text-left px-2 py-1 rounded transition-colors ${paperTheme === 'dark' ? 'text-[#d4af37] bg-[#272632]' : 'text-[#bdb8ad] hover:bg-[#202029]'}`}
              >
                Dark Journal
              </button>
            </div>
          </div>

          {/* Fullscreen Reading Mode */}
          <button
            type="button"
            id="reader-fullscreen-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-[#9e978b] hover:text-[#f5ebd7] transition-colors cursor-pointer hidden sm:inline-flex"
            title={isFullscreen ? "Exit Reading Mode" : "Immersive Reading Mode"}
            aria-label="Toggle full screen reading mode"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close / Return or Lock Diary */}
          {isEditorPreview && onClosePreview ? (
            <button
              type="button"
              id="exit-preview-btn"
              onClick={onClosePreview}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#2a241a] hover:bg-[#3d3324] text-[#e8c872] border border-[#594726] rounded-lg font-cinzel text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit Preview</span>
            </button>
          ) : (
            <button
              type="button"
              id="lock-diary-btn"
              onClick={onLockDiary}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#201815] to-[#2e211b] hover:from-[#2e211b] hover:to-[#382820] text-[#d4af37] border border-[#523d2b] rounded-lg font-cinzel text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
              title="Lock Diary and Return to Cover"
            >
              <Lock className="w-3 h-3" />
              <span className="hidden sm:inline">Lock Diary</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Digital Book Container */}
      <main 
        id="digital-book-stage"
        aria-label="Interactive Book Reader"
        className="relative z-10 w-full max-w-6xl my-auto py-2 flex items-center justify-center perspective-book"
      >
        {/* Previous Page Floating Button */}
        <button
          type="button"
          id="prev-page-arrow-btn"
          onClick={goToPrev}
          disabled={isMobileView ? mobilePageIndex === 0 : currentSpread === 0}
          className="absolute -left-2 sm:left-2 lg:-left-6 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#181820]/80 hover:bg-[#252532] text-[#d4af37] border border-[#3b3a4a] shadow-2xl flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* NEXT Page Floating Button */}
        <button
          type="button"
          id="next-page-arrow-btn"
          onClick={goToNext}
          disabled={isMobileView ? mobilePageIndex >= totalMobilePages - 1 : currentSpread >= totalSpreads - 1}
          className="absolute -right-2 sm:right-2 lg:-right-6 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#181820]/80 hover:bg-[#252532] text-[#d4af37] border border-[#3b3a4a] shadow-2xl flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* The Open Book Itself */}
        <div 
          id="open-book-frame"
          className="relative w-full max-w-5xl h-[580px] sm:h-[640px] md:h-[680px] rounded-xl flex items-stretch shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9)] border border-black/40 overflow-hidden transform-style-3d"
        >
          {/* Mobile Single Page View */}
          {isMobileView ? (
            <div className="w-full h-full relative overflow-hidden transform-style-3d">
              {mobileFlipState ? (
                <>
                  {/* Target page situated underneath */}
                  <div className="absolute inset-0 z-10 w-full h-full">
                    {renderMobilePage(mobileFlipState.toIndex)}
                  </div>

                  {/* Flipping page on top performing the 3D curl */}
                  <div
                    className={`absolute inset-0 z-20 w-full h-full ${
                      mobileFlipState.direction === 'next' ? 'anim-mobile-next' : 'anim-mobile-prev'
                    }`}
                  >
                    {renderMobilePage(mobileFlipState.fromIndex)}
                  </div>
                </>
              ) : (
                <div className="w-full h-full">
                  {renderMobilePage(mobilePageIndex)}
                </div>
              )}
            </div>
          ) : (
            /* Desktop / Tablet Two-Page Spread with Physical 3D Turning Leaf */
            <div className="w-full h-full flex items-stretch relative transform-style-3d">
              {flipState?.direction === 'next' ? (
                <>
                  {/* Left Page (from current spread, stays stationary until covered) */}
                  <div id="book-left-page" className="w-1/2 h-full relative z-10">
                    {renderSpreadLeft(flipState.fromSpread)}
                  </div>

                  {/* Spine Crease */}
                  <div 
                    aria-hidden="true" 
                    className="w-4 h-full book-spine-crease z-20 shrink-0 pointer-events-none" 
                  />

                  {/* Right Page (revealed underneath as leaf turns forward) */}
                  <div id="book-right-page" className="w-1/2 h-full relative z-10 overflow-hidden">
                    {renderSpreadRight(flipState.toSpread)}
                    {/* Shadow cast on revealed right page by turning leaf */}
                    <div className="absolute inset-0 pointer-events-none anim-cast-shadow z-20 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
                  </div>

                  {/* Physical 3D Turning Leaf: starts on right, rotates 180° over spine to left */}
                  <div 
                    className="w-1/2 h-full absolute right-0 top-0 bottom-0 z-30 transform-style-3d anim-leaf-next pointer-events-none"
                    style={{ transformOrigin: 'left center' }}
                  >
                    {/* Front Face: current right page being turned */}
                    <div className="absolute inset-0 backface-hidden overflow-hidden rounded-r-lg shadow-2xl">
                      {renderSpreadRight(flipState.fromSpread)}
                      <div className="absolute inset-0 pointer-events-none anim-shadow-front bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
                    </div>

                    {/* Back Face: target left page (rotated 180° so it settles upright on the left) */}
                    <div 
                      className="absolute inset-0 backface-hidden overflow-hidden rounded-l-lg shadow-2xl"
                      style={{ transform: 'rotateY(180deg)' }}
                    >
                      {renderSpreadLeft(flipState.toSpread)}
                      <div className="absolute inset-0 pointer-events-none anim-shadow-back bg-gradient-to-l from-black/60 via-black/25 to-transparent" />
                    </div>
                  </div>
                </>
              ) : flipState?.direction === 'prev' ? (
                <>
                  {/* Left Page (revealed underneath as leaf turns backward) */}
                  <div id="book-left-page" className="w-1/2 h-full relative z-10 overflow-hidden">
                    {renderSpreadLeft(flipState.toSpread)}
                    {/* Shadow cast on revealed left page by turning leaf */}
                    <div className="absolute inset-0 pointer-events-none anim-cast-shadow z-20 bg-gradient-to-l from-black/50 via-black/20 to-transparent" />
                  </div>

                  {/* Spine Crease */}
                  <div 
                    aria-hidden="true" 
                    className="w-4 h-full book-spine-crease z-20 shrink-0 pointer-events-none" 
                  />

                  {/* Right Page (from current spread) */}
                  <div id="book-right-page" className="w-1/2 h-full relative z-10">
                    {renderSpreadRight(flipState.fromSpread)}
                  </div>

                  {/* Physical 3D Turning Leaf: starts on left, rotates 180° over spine to right */}
                  <div 
                    className="w-1/2 h-full absolute left-0 top-0 bottom-0 z-30 transform-style-3d anim-leaf-prev pointer-events-none"
                    style={{ transformOrigin: 'right center' }}
                  >
                    {/* Front Face: current left page being turned */}
                    <div className="absolute inset-0 backface-hidden overflow-hidden rounded-l-lg shadow-2xl">
                      {renderSpreadLeft(flipState.fromSpread)}
                      <div className="absolute inset-0 pointer-events-none anim-shadow-front bg-gradient-to-l from-black/60 via-black/25 to-transparent" />
                    </div>

                    {/* Back Face: target right page (rotated 180° so it settles upright on the right) */}
                    <div 
                      className="absolute inset-0 backface-hidden overflow-hidden rounded-r-lg shadow-2xl"
                      style={{ transform: 'rotateY(180deg)' }}
                    >
                      {renderSpreadRight(flipState.toSpread)}
                      <div className="absolute inset-0 pointer-events-none anim-shadow-back bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
                    </div>
                  </div>
                </>
              ) : (
                /* Stationary Spread */
                <>
                  {/* LEFT PAGE */}
                  <div id="book-left-page" className="w-1/2 h-full">
                    {renderSpreadLeft(currentSpread)}
                  </div>

                  {/* Realistic Center Book Spine Crease */}
                  <div 
                    aria-hidden="true" 
                    className="w-4 h-full book-spine-crease z-20 shrink-0 pointer-events-none" 
                  />

                  {/* RIGHT PAGE */}
                  <div id="book-right-page" className="w-1/2 h-full">
                    {renderSpreadRight(currentSpread)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Status & Page Navigation Indicators */}
      <footer className="relative z-30 w-full max-w-6xl flex items-center justify-between py-2 px-4 text-xs text-[#8f887b] font-cinzel">
        <div className="flex items-center gap-2">
          <span>← Previous</span>
          <span className="text-[#555047]">•</span>
          <span>Next →</span>
        </div>

        <div className="tracking-[0.2em] uppercase font-medium text-[#c4b9a7]">
          {isMobileView ? (
            `Page ${mobilePageIndex + 1} of ${totalMobilePages}`
          ) : (
            `Spread ${currentSpread + 1} of ${totalSpreads} (Pages ${currentSpread * 2 + 1}–${currentSpread * 2 + 2})`
          )}
        </div>

        <div className="text-[11px] font-sans opacity-75 hidden sm:block">
          Use Arrow Keys or Swipe to turn pages
        </div>
      </footer>

      {/* TABLE OF CONTENTS MODAL */}
      {showTOCModal && (
        <div 
          role="dialog"
          aria-label="Table of Contents Modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-lg bg-[#14141c] border border-[#313040] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#282736] mb-5">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#d4af37]" />
                <h3 className="font-cinzel text-base tracking-[0.2em] uppercase text-[#f5ebd7] font-semibold">
                  Table of Contents
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTOCModal(false)}
                className="p-1 text-[#8f887b] hover:text-[#f5ebd7] transition-colors rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={jumpToCover}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1a1924] hover:bg-[#252433] text-left transition-colors cursor-pointer"
              >
                <span className="font-cinzel text-sm text-[#e8c872]">
                  Cover & Title Page
                </span>
                <span className="font-mono text-xs text-[#8f887b]">Page 01</span>
              </button>

              {entries.map((entry, idx) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => jumpToEntry(idx)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1a1924] hover:bg-[#252433] text-left transition-colors cursor-pointer group"
                >
                  <div className="truncate pr-4">
                    <div className="font-serif-book text-base text-[#ded8cc] group-hover:text-[#f5ebd7] truncate font-medium">
                      {String(idx + 1).padStart(2, '0')}. {entry.title}
                    </div>
                    <div className="text-[11px] text-[#787265] mt-0.5">
                      {new Date(entry.date).toLocaleDateString()} {entry.mood && `• ${entry.mood}`}
                    </div>
                  </div>
                  <span className="font-serif-book text-xs text-[#a89f8e] shrink-0 font-semibold">
                    Page {idx * 2 + 3}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE SEARCH MODAL */}
      {showSearchModal && (
        <div 
          role="dialog"
          aria-label="Private Diary Search Modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-lg bg-[#14141c] border border-[#313040] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#282736] mb-5">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#d4af37]" />
                <h3 className="font-cinzel text-base tracking-[0.2em] uppercase text-[#f5ebd7] font-semibold">
                  Private Diary Search
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="p-1 text-[#8f887b] hover:text-[#f5ebd7] transition-colors rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories by title, date, mood, or keyword…"
                className="w-full h-11 bg-[#0b0c10] border border-[#353344] focus:border-[#d4af37] rounded-lg px-4 text-sm text-[#f4eedf] placeholder-[#6b665c] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {searchQuery.trim() === '' ? (
                <div className="text-center py-8 text-[#706b60] font-serif-book italic text-sm">
                  Type a word or phrase to explore recorded diary pages.
                </div>
              ) : filteredSearchResults.length === 0 ? (
                <div className="text-center py-8 text-[#706b60] font-serif-book italic text-sm">
                  No memories matched "{searchQuery}".
                </div>
              ) : (
                filteredSearchResults.map((entry) => {
                  const entryIdx = entries.findIndex(e => e.id === entry.id);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => jumpToEntry(entryIdx)}
                      className="w-full p-3 rounded-lg bg-[#1a1924] hover:bg-[#252433] text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-serif-book text-base text-[#f5ebd7] font-medium group-hover:underline">
                          {entry.title}
                        </span>
                        <span className="text-[10px] font-cinzel text-[#d4af37] tracking-wider">
                          Page {entryIdx * 2 + 3}
                        </span>
                      </div>
                      <p className="text-xs text-[#9c9485] line-clamp-2 font-serif-book">
                        {entry.content.replace(/<[^>]*>/g, '')}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
