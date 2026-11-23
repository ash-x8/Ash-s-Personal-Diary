import React, { useMemo, useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import type { DiarySettings } from '../types';
import { sanitizeHtml, sanitizeMediaUrl } from '../utils/sanitize';
import { BookSecretLockedPage } from './BookSecretLockedPage';

export interface BookLeafData {
  id: string;
  sourceType: 'entry' | 'chapter';
  sourceId: string;
  title: string;
  content: string;
  date?: string;
  mood?: string;
  location?: string;
  tags?: string[];
  coverImage?: string;
  gallery?: string[];
  isSecret?: boolean;
  isLocked?: boolean;
  securityHint?: string;
  pageNumber: number;
  subLabel?: string;
}

interface BookPageProps {
  leaf: BookLeafData | null;
  side: 'left' | 'right' | 'single';
  settings: DiarySettings;
  onUnlockSecret: (leaf: BookLeafData, passkey: string) => Promise<void>;
}

export function BookPage({ leaf, side, settings, onUnlockSecret }: BookPageProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const paperStyles = useMemo(() => {
    switch (settings.paperColor) {
      case 'clean':
        return 'bg-[#fcfbf8] text-[#221f1c] border-[#e2ddd3]';
      case 'dark':
        return 'bg-[#16181f] text-[#e6e3dc] border-[#262a36]';
      case 'classic':
      default:
        return 'bg-[#f4ede0] text-[#2b231b] border-[#d8cbb4]';
    }
  }, [settings.paperColor]);

  const fontClass = useMemo(() => {
    switch (settings.typography) {
      case 'cinzel':
        return 'font-serif-title';
      case 'classic':
        return 'font-sans-ui';
      case 'garamond':
      default:
        return 'font-serif-book';
    }
  }, [settings.typography]);

  const proseSizeClass = useMemo(() => {
    switch (settings.fontSize) {
      case 'compact':
        return 'text-[15px] leading-[1.7]';
      case 'large':
        return 'text-[19px] leading-[1.85]';
      case 'normal':
      default:
        return 'text-[17px] leading-[1.78]';
    }
  }, [settings.fontSize]);

  const isDarkPaper = settings.paperColor === 'dark';

  if (!leaf) {
    return (
      <article
        className={`relative flex h-full min-h-[520px] flex-col justify-between border p-6 sm:p-8 ${paperStyles} ${
          side === 'left'
            ? 'rounded-l-xl border-r-0 shadow-inner'
            : side === 'right'
            ? 'rounded-r-xl shadow-inner'
            : 'rounded-xl'
        }`}
      >
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
          <p className="font-serif-book italic text-base">Finis — End of Recorded Pages</p>
        </div>
      </article>
    );
  }

  const safeCover = !coverFailed ? sanitizeMediaUrl(leaf.coverImage) : '';
  const safeGallery = (leaf.gallery || []).map(sanitizeMediaUrl).filter(Boolean);
  const sanitizedProse = sanitizeHtml(leaf.content);

  const formattedDate = leaf.date
    ? new Date(leaf.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const metadataItems: string[] = [];
  if (formattedDate) metadataItems.push(formattedDate);
  if (leaf.mood) metadataItems.push(leaf.mood);
  if (leaf.location) metadataItems.push(leaf.location);

  return (
    <article
      className={`relative flex h-full min-h-[520px] sm:min-h-[600px] flex-col justify-between border p-6 sm:p-9 ${paperStyles} ${
        side === 'left'
          ? 'rounded-l-xl lg:border-r lg:border-r-black/15'
          : side === 'right'
          ? 'rounded-r-xl'
          : 'rounded-xl'
      }`}
    >
      {/* Subtle spine shadow gradient on dual-page spreads */}
      {side === 'left' && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/[0.08] to-transparent" />
      )}
      {side === 'right' && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/[0.08] to-transparent" />
      )}

      {leaf.isLocked ? (
        <BookSecretLockedPage
          title={leaf.title}
          hint={leaf.securityHint}
          paperColor={settings.paperColor}
          onUnlockAttempt={(passkey) => onUnlockSecret(leaf, passkey)}
        />
      ) : (
        <>
          <div className="relative z-10 flex-1 flex flex-col min-h-0">
            {/* Leaf Header */}
            <header className="mb-5 pb-3.5 border-b border-current/15">
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] opacity-65">
                <span className="truncate">{leaf.subLabel || 'Diary Leaf'}</span>
                {leaf.tags && leaf.tags.length > 0 && (
                  <span className="truncate">#{leaf.tags.slice(0, 2).join(' · #')}</span>
                )}
              </div>

              <h2
                className={`mt-2 text-2xl sm:text-[26px] font-semibold leading-snug ${fontClass}`}
              >
                {leaf.title}
              </h2>

              {metadataItems.length > 0 && (
                <p className="mt-1.5 text-xs italic opacity-70 tabular-nums">
                  {metadataItems.join(' · ')}
                </p>
              )}
            </header>

            {/* Optional Cover Illustration */}
            {safeCover && (
              <figure className="mb-5 overflow-hidden rounded-lg border border-current/10 bg-black/5">
                <img
                  src={safeCover}
                  alt={leaf.title}
                  referrerPolicy="no-referrer"
                  onError={() => setCoverFailed(true)}
                  className="max-h-52 w-full object-cover"
                />
              </figure>
            )}
            {leaf.coverImage && coverFailed && (
              <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-current/15 py-6 text-xs opacity-60">
                <ImageOff className="h-4 w-4" />
                <span>Photo could not be displayed</span>
              </div>
            )}

            {/* Sanitized Diary Prose */}
            <div
              className={`diary-prose flex-1 overflow-y-auto pr-1 ${fontClass} ${proseSizeClass} ${
                isDarkPaper ? 'text-[#dedad2]' : 'text-[#2b231b]'
              }`}
              dangerouslySetInnerHTML={{ __html: sanitizedProse }}
            />

            {/* Optional Attached Gallery */}
            {safeGallery.length > 0 && (
              <div className="mt-5 pt-4 border-t border-current/15">
                <div className="grid grid-cols-3 gap-2.5">
                  {safeGallery.slice(0, 6).map((url, idx) => (
                    <button
                      key={`${leaf.id}-gal-${idx}`}
                      type="button"
                      onClick={() => setLightboxUrl(url)}
                      className="group relative aspect-square overflow-hidden rounded-md border border-current/15 bg-black/5 focus:outline-none"
                    >
                      <img
                        src={url}
                        alt={`Memory attachment ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Running Page Footer */}
          <footer className="relative z-10 mt-6 pt-3 border-t border-current/10 flex items-center justify-between text-[11px] opacity-60 tabular-nums">
            <span className="italic truncate max-w-[65%]">{settings.title}</span>
            <span>— {leaf.pageNumber} —</span>
          </footer>
        </>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged diary memory"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </article>
  );
}
