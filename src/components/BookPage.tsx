import React from 'react';
import { MapPin, Smile, Tag, Calendar, Sparkles, Lock } from 'lucide-react';
import { DiaryEntry, DiarySettings } from '../types';

interface BookPageProps {
  pageNumber: number;
  totalPages: number;
  settings: DiarySettings;
  paperTheme: 'classic' | 'clean' | 'dark';
  side: 'left' | 'right' | 'single';
  children: React.ReactNode;
}

export const BookPageContainer: React.FC<BookPageProps> = ({
  pageNumber,
  totalPages,
  settings,
  paperTheme,
  side,
  children
}) => {
  // Theme styling definitions
  const themeClasses = {
    classic: {
      bg: 'bg-[#f7f2e7]',
      text: 'text-[#2b241d]',
      subtext: 'text-[#7d7062]',
      border: 'border-[#dfd7c5]',
      spineShadow: side === 'left' ? 'paper-shadow-left' : side === 'right' ? 'paper-shadow-right' : 'shadow-2xl',
      texture: 'bg-[radial-gradient(#d6ccb8_0.6px,transparent_0.6px)] [background-size:24px_24px]'
    },
    clean: {
      bg: 'bg-[#faf9f6]',
      text: 'text-[#1d1d21]',
      subtext: 'text-[#6e6e78]',
      border: 'border-[#e4e2dd]',
      spineShadow: side === 'left' ? 'paper-shadow-left' : side === 'right' ? 'paper-shadow-right' : 'shadow-2xl',
      texture: 'bg-[radial-gradient(#e5e2db_0.6px,transparent_0.6px)] [background-size:24px_24px]'
    },
    dark: {
      bg: 'bg-[#18181c]',
      text: 'text-[#e5e1d8]',
      subtext: 'text-[#8a857b]',
      border: 'border-[#2d2c34]',
      spineShadow: side === 'left' ? 'paper-shadow-left' : side === 'right' ? 'paper-shadow-right' : 'shadow-2xl',
      texture: 'bg-[radial-gradient(#26252c_0.6px,transparent_0.6px)] [background-size:24px_24px]'
    }
  }[paperTheme];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between p-6 sm:p-9 md:p-11 select-text transition-colors duration-500 overflow-hidden ${
        themeClasses.bg
      } ${themeClasses.text} ${themeClasses.spineShadow} ${
        side === 'left' ? 'rounded-l-lg md:rounded-r-none' : side === 'right' ? 'rounded-r-lg md:rounded-l-none' : 'rounded-lg'
      }`}
    >
      {/* Subtle paper grain texture */}
      <div 
        aria-hidden="true" 
        className={`pointer-events-none absolute inset-0 opacity-40 ${themeClasses.texture}`} 
      />

      {/* Edge vignette & inner spine crease effect */}
      {side === 'left' && (
        <div 
          aria-hidden="true" 
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/15 to-transparent hidden md:block" 
        />
      )}
      {side === 'right' && (
        <div 
          aria-hidden="true" 
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/15 to-transparent hidden md:block" 
        />
      )}

      {/* Subtle top page header */}
      <div className="relative z-10 flex items-center justify-between text-[10px] tracking-[0.22em] uppercase font-cinzel opacity-70 pb-3 border-b border-black/10 dark:border-white/10 mb-5">
        <span className="truncate max-w-[200px]">
          {side === 'left' ? settings.title : settings.subtitle}
        </span>
        <span className="italic font-serif-book font-normal lowercase text-[12px] opacity-80">
          private pages
        </span>
      </div>

      {/* Main Page Content Body */}
      <div className="relative z-10 flex-1 overflow-y-auto pr-1">
        {children}
      </div>

      {/* Page Footer with Page Number */}
      <div className="relative z-10 pt-4 flex items-center justify-between text-[11px] font-serif-book opacity-65 border-t border-black/10 dark:border-white/10 mt-4">
        {side === 'left' ? (
          <>
            <span className="tracking-widest font-semibold">{pageNumber}</span>
            <span className="text-[9px] font-cinzel tracking-widest uppercase opacity-70">
              Ash-x8
            </span>
          </>
        ) : (
          <>
            <span className="text-[9px] font-cinzel tracking-widest uppercase opacity-70">
              Journal
            </span>
            <span className="tracking-widest font-semibold">{pageNumber}</span>
          </>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   INSIDE TITLE / PROLOGUE PAGE
   ========================================================================== */

interface BookTitlePageProps {
  settings: DiarySettings;
  authorName?: string;
  totalEntries: number;
}

const BookTitlePageComponent: React.FC<BookTitlePageProps> = ({ settings, authorName = 'ASH-X8', totalEntries }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <div className="w-12 h-12 rounded-full border border-current opacity-30 flex items-center justify-center mb-6">
        <Sparkles className="w-5 h-5 opacity-70" />
      </div>

      <span className="text-xs font-cinzel tracking-[0.3em] uppercase opacity-60 mb-2">
        {settings.subtitle || 'Private Journal'}
      </span>

      <h1 className="font-cinzel text-2xl sm:text-3xl font-bold tracking-[0.16em] uppercase mb-4 leading-tight">
        {settings.title}
      </h1>

      <div className="w-16 h-px bg-current opacity-25 my-4" />

      <p className="font-serif-book italic text-base sm:text-lg opacity-85 max-w-xs leading-relaxed mb-8">
        "Some memories are meant to stay between pages, sheltered from the velocity of the world."
      </p>

      <div className="mt-auto pt-6 text-[10px] font-cinzel tracking-[0.25em] uppercase opacity-60 space-y-1">
        <div>Compiled by {authorName}</div>
        <div>{totalEntries} Recorded Entries</div>
        <div>Volume I • 2026</div>
      </div>
    </div>
  );
};
export const BookTitlePage = React.memo(BookTitlePageComponent);

/* ==========================================================================
   TABLE OF CONTENTS PAGE
   ========================================================================== */

interface BookTableOfContentsProps {
  entries: DiaryEntry[];
  onSelectEntry: (index: number) => void;
}

const BookTableOfContentsComponent: React.FC<BookTableOfContentsProps> = ({ entries, onSelectEntry }) => {
  return (
    <div className="h-full flex flex-col justify-start">
      <div className="text-center pb-5 mb-4 border-b border-current opacity-30">
        <h2 className="font-cinzel text-xl sm:text-2xl font-bold tracking-[0.25em] uppercase">
          Contents
        </h2>
        <p className="font-serif-book italic text-xs opacity-75 mt-1">
          Chronicles of thought & quiet hours
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="my-auto text-center py-12">
          <p className="font-serif-book italic text-base opacity-70">
            This diary is still waiting for its first page.
          </p>
        </div>
      ) : (
        <div className="space-y-4 my-auto overflow-y-auto max-h-[460px] pr-2">
          {entries.map((entry, idx) => {
            const pageNum = idx * 2 + 3; // TOC layout page jump
            const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelectEntry(idx)}
                className="w-full text-left group flex items-baseline justify-between gap-3 py-1.5 hover:opacity-100 transition-opacity cursor-pointer opacity-80"
              >
                <div className="flex-1 truncate">
                  <div className="flex items-baseline gap-2">
                    <span className="font-cinzel text-xs opacity-60">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span className="font-serif-book text-base sm:text-lg font-medium group-hover:underline underline-offset-4 truncate">
                      {entry.title}
                    </span>
                    {entry.isSecret && (
                      <span className="inline-flex items-center gap-1 text-[9px] text-[#d4af37] font-cinzel uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#d4af37]/10 border border-[#d4af37]/30 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Secret
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-sans opacity-60 ml-6">
                    {formattedDate} {entry.mood && `• ${entry.mood}`}
                  </div>
                </div>

                <div className="flex-1 border-b border-dotted border-current opacity-25 mx-2 hidden sm:block" />

                <span className="font-serif-book text-sm font-semibold opacity-70 group-hover:opacity-100">
                  {pageNum}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-auto pt-4 text-center">
        <span className="text-[10px] font-cinzel tracking-[0.2em] uppercase opacity-50">
          Touch or click an entry to turn to page
        </span>
      </div>
    </div>
  );
};
export const BookTableOfContents = React.memo(BookTableOfContentsComponent);

/* ==========================================================================
   ENTRY SPREAD (LEFT PAGE: HERO & METADATA)
   ========================================================================== */

interface BookEntryLeftPageProps {
  entry: DiaryEntry;
  entryIndex: number;
}

const BookEntryLeftPageComponent: React.FC<BookEntryLeftPageProps> = ({ entry, entryIndex }) => {
  const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="h-full flex flex-col justify-between">
      {/* Date & Chapter */}
      <div>
        <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase font-cinzel opacity-60 mb-2">
          <Calendar className="w-3 h-3" />
          <span>Entry {String(entryIndex + 1).padStart(2, '0')}</span>
        </div>

        <div className="font-serif-book text-xs sm:text-sm uppercase tracking-[0.18em] opacity-80 mb-3">
          {formattedDate}
        </div>

        <h2 
          dir="ltr"
          style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
          className="font-serif-book text-2xl sm:text-3xl font-semibold tracking-tight leading-snug mb-3 text-left ltr"
        >
          {entry.title}
        </h2>

        {/* Metadata badges: Mood & Location */}
        <div className="flex flex-wrap items-center gap-2 text-xs opacity-75 mb-6">
          {entry.mood && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-current/20 text-[11px] font-serif-book italic">
              <Smile className="w-3 h-3" />
              {entry.mood}
            </span>
          )}
          {entry.location && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-current/20 text-[11px] font-serif-book">
              <MapPin className="w-3 h-3" />
              {entry.location}
            </span>
          )}
        </div>
      </div>

      {/* Featured visual or atmospheric illustration */}
      {entry.coverImage ? (
        <div className="my-auto py-2">
          <div className="relative overflow-hidden rounded shadow-md border border-current/15 max-h-56 sm:max-h-64">
            <img
              src={entry.coverImage}
              alt={entry.title}
              className="w-full h-full object-cover filter contrast-[1.03] sepia-[0.1]"
              loading="lazy"
            />
          </div>
          <p className="text-[10px] font-serif-book italic opacity-60 text-center mt-2">
            Photograph recorded with entry
          </p>
        </div>
      ) : (
        <div className="my-auto py-6 text-center border-y border-current/15">
          <p className="font-handwriting text-2xl sm:text-3xl opacity-80 leading-relaxed">
            "{entry.title}"
          </p>
          <span className="text-[10px] font-cinzel tracking-[0.25em] uppercase opacity-50 block mt-2">
            Inscribed in quiet thought
          </span>
        </div>
      )}

      {/* Tags footer */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="pt-4 border-t border-current/10 flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3 h-3 opacity-50" />
          {entry.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] font-serif-book tracking-wider opacity-60 lowercase mr-2"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
export const BookEntryLeftPage = React.memo(BookEntryLeftPageComponent);

/* ==========================================================================
   ENTRY SPREAD (RIGHT PAGE: RICH TEXT BODY & GALLERY)
   ========================================================================== */

interface BookEntryRightPageProps {
  entry: DiaryEntry;
}

const BookEntryRightPageComponent: React.FC<BookEntryRightPageProps> = ({ entry }) => {
  return (
    <div className="h-full flex flex-col justify-between">
      {/* Editorial Content */}
      <div 
        dir="ltr"
        style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
        className="font-serif-book text-base sm:text-lg leading-relaxed sm:leading-[1.75] space-y-4 diary-prose select-text text-left ltr"
        dangerouslySetInnerHTML={{ __html: entry.content }}
      />

      {/* Optional Gallery thumbnails */}
      {entry.gallery && entry.gallery.length > 0 && (
        <div className="pt-5 mt-6 border-t border-current/15">
          <span className="text-[9px] font-cinzel tracking-[0.22em] uppercase opacity-60 block mb-2">
            Attached Memories ({entry.gallery.length})
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {entry.gallery.map((imgUrl, i) => (
              <img
                key={i}
                src={imgUrl}
                alt={`Attachment ${i + 1}`}
                className="w-16 h-16 rounded object-cover border border-current/20 shadow-sm"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {/* Signature sign-off */}
      <div className="pt-4 text-right">
        <span className="font-handwriting text-xl sm:text-2xl opacity-75 inline-block -rotate-3">
          — Ash
        </span>
      </div>
    </div>
  );
};
export const BookEntryRightPage = React.memo(BookEntryRightPageComponent);
