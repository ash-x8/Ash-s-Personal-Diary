import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, Sparkles, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { DiaryEntry } from '../types';
import { soundService } from '../services/sound';

interface BookSecretLockedPageProps {
  entry: DiaryEntry;
  onUnlock: () => void;
  isEditor?: boolean;
}

export const BookSecretLockedPage: React.FC<BookSecretLockedPageProps> = ({
  entry,
  onUnlock,
  isEditor = false
}) => {
  const [securityKey, setSecurityKey] = useState('');
  const [error, setError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSecurityKey, setShowSecurityKey] = useState(false);

  const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleAttemptUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(false);

    const enteredClean = securityKey.trim();
    const targetKey = (entry.securityKey || entry.secretPasscode || '').trim();

    // If no key was configured, or matches entered key
    if (!targetKey || enteredClean === targetKey) {
      setIsSuccess(true);
      soundService.playUnlock();
      setTimeout(() => {
        onUnlock();
      }, 400);
    } else {
      setError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleAuthorBypass = () => {
    setIsSuccess(true);
    soundService.playUnlock();
    setTimeout(() => {
      onUnlock();
    }, 200);
  };

  return (
    <div className="h-full flex flex-col justify-between py-2 px-1 text-center select-none">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-center gap-2 text-[10px] tracking-[0.25em] uppercase font-cinzel opacity-60 mb-2">
          <Lock className="w-3 h-3 text-[#d4af37]" />
          <span>Secret Archived Page</span>
        </div>

        <div className="font-serif-book text-xs uppercase tracking-[0.18em] opacity-70 mb-2">
          {formattedDate}
        </div>

        <h3 className="font-serif-book text-xl sm:text-2xl font-semibold tracking-tight opacity-90 mb-1">
          {entry.title || 'Sealed Chapter'}
        </h3>
      </div>

      {/* Centerpiece: Wax Seal / Antique Lock motif & Hint card */}
      <div className="my-auto py-2 flex flex-col items-center">
        {/* Ornate Wax Seal */}
        <div className="relative mb-4 group">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#8a1c14] via-[#68100a] to-[#450703] shadow-lg border-2 border-[#d4af37]/60 flex items-center justify-center relative overflow-hidden transition-transform duration-300 transform group-hover:scale-105">
            <div className="absolute inset-1 rounded-full border border-dashed border-[#d4af37]/40 pointer-events-none" />
            <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-[#d4af37] filter drop-shadow-md" />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#18181c] border border-[#d4af37]/40 text-[9px] font-cinzel tracking-widest text-[#d4af37] whitespace-nowrap shadow-xs">
            SEALED
          </div>
        </div>

        <p className="font-serif-book italic text-xs sm:text-sm opacity-75 max-w-xs mb-3">
          "This page has been locked under a private security key."
        </p>

        {/* The Hint typed by the author */}
        <div className="w-full max-w-sm mx-auto my-2 p-3.5 sm:p-4 rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/10 text-center shadow-xs">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#d4af37] font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Security Key Hint</span>
          </div>
          <p className="font-serif-book italic text-sm sm:text-base text-current opacity-95 leading-relaxed break-words">
            {entry.securityHint && entry.securityHint.trim()
              ? `"${entry.securityHint}"`
              : (entry.secretHint && entry.secretHint.trim() ? `"${entry.secretHint}"` : "No hint provided for this secret page.")}
          </p>
        </div>

        {/* Security Key Input Form */}
        <form
          onSubmit={handleAttemptUnlock}
          className={`w-full max-w-xs mx-auto space-y-2.5 mt-2 transition-transform ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          <div className="relative">
            <input
              type={showSecurityKey ? "text" : "password"}
              value={securityKey}
              onChange={(e) => {
                setSecurityKey(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Enter security key to read…"
              autoComplete="off"
              className={`w-full h-10 px-3 pr-10 text-xs sm:text-sm bg-black/15 dark:bg-black/30 border rounded-lg text-center tracking-widest focus:outline-none transition-colors ${
                error
                  ? 'border-red-500/80 text-red-500 focus:border-red-500'
                  : 'border-current/25 focus:border-[#d4af37]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowSecurityKey(!showSecurityKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-90 p-1 text-current"
              title={showSecurityKey ? "Hide key" : "Show key"}
            >
              {showSecurityKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-sans animate-fade-in">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Incorrect security key. Check the hint above.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!securityKey.trim() || isSuccess}
            className={`w-full h-9 rounded-lg font-cinzel text-xs uppercase tracking-[0.2em] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
              isSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-[#d4af37] hover:bg-[#c49f2e] text-[#14141a] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Page Unlocked</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>Unlock Secret Page</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer / Author Bypass */}
      <div className="pt-2 border-t border-current/10 flex items-center justify-between text-[10px] font-cinzel opacity-60">
        <span className="tracking-widest uppercase">Keyed Inscription</span>
        {isEditor && (
          <button
            type="button"
            onClick={handleAuthorBypass}
            className="text-[10px] text-[#d4af37] hover:underline uppercase tracking-wider cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Author Bypass
          </button>
        )}
      </div>
    </div>
  );
};
