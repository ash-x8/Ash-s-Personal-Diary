import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Sparkles, BookOpen } from 'lucide-react';
import { soundService } from '../services/sound';
import { UserRole } from '../types';

interface ClosedBookAccessProps {
  onUnlock: (role: UserRole) => void;
  unlockApi: (code: string) => Promise<{ success: boolean; role: UserRole }>;
  bookTitle?: string;
  bookSubtitle?: string;
  authorName?: string;
}

export const ClosedBookAccess: React.FC<ClosedBookAccessProps> = ({
  onUnlock,
  unlockApi,
  bookTitle = "ASH'S PERSONAL DIARY",
  bookSubtitle = "Private Journal",
  authorName = "ASH-X8"
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isUnlockedOpening, setIsUnlockedOpening] = useState(false);
  const [unlockedRole, setUnlockedRole] = useState<UserRole | null>(null);

  // Focus input automatically on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const inputEl = document.getElementById('access-code-input');
      if (inputEl) inputEl.focus();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await unlockApi(code.trim());
      soundService.playUnlock();
      setIsUnlockedOpening(true);
      setUnlockedRole(result.role);

      // Allow opening animation to play
      setTimeout(() => {
        onUnlock(result.role);
      }, 1100);
    } catch (err: any) {
      setError(err.message || 'Invalid access code.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      id="closed-book-stage"
      aria-label="Ash's Personal Diary Access Screen"
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0d] px-4 py-8 select-none"
    >
      {/* Ambient background lighting & floating dust */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Soft overhead reading lamp effect */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-b from-[#d4af37]/10 via-[#c5a059]/5 to-transparent blur-3xl rounded-full" />
        
        {/* Deep table vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,20,17,0.3)_0%,rgba(6,6,8,0.95)_75%)]" />

        {/* Subtle floating ambient dust particles */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      {/* Main presentation area */}
      <div 
        id="book-vault-container"
        className={`relative z-10 w-full max-w-md flex flex-col items-center transition-all duration-1000 ease-out ${
          isUnlockedOpening ? 'scale-105 opacity-0 blur-sm pointer-events-none' : 'scale-100 opacity-100'
        }`}
      >
        {/* 3D Physical Book Silhouette */}
        <div 
          id="closed-book-object"
          className="relative w-64 h-84 sm:w-72 sm:h-96 rounded-r-xl rounded-l-sm leather-texture flex flex-col justify-between p-7 sm:p-8 text-center transition-transform duration-700 hover:scale-[1.015] mb-8"
          style={{
            transform: 'perspective(1200px) rotateY(-8deg) rotateX(4deg)',
            boxShadow: '18px 25px 45px -8px rgba(0, 0, 0, 0.85), -6px 8px 24px rgba(0, 0, 0, 0.6), inset 2px 0 6px rgba(255, 255, 255, 0.08)'
          }}
        >
          {/* Spine ridge highlight */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/80 via-white/5 to-transparent rounded-l-sm border-r border-black/50" />
          
          {/* Subtle gold foil border inlay */}
          <div className="absolute inset-3.5 sm:inset-4 border border-[#d4af37]/25 rounded-r-lg rounded-l-xs pointer-events-none" />
          <div className="absolute inset-4 sm:inset-4.5 border border-[#d4af37]/15 rounded-r-lg rounded-l-xs pointer-events-none" />

          {/* Book Header Crest */}
          <div className="pt-2 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full border border-[#d4af37]/30 flex items-center justify-center mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]/70" />
            </div>
            <span className="text-[10px] tracking-[0.28em] uppercase text-[#d4af37]/60 font-cinzel">
              {bookSubtitle}
            </span>
          </div>

          {/* Book Title Embossed */}
          <div className="my-auto py-4">
            <h1 className="font-cinzel text-xl sm:text-2xl font-bold tracking-[0.18em] text-[#e8c872] gold-emboss leading-snug">
              {bookTitle}
            </h1>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent mx-auto mt-4" />
          </div>

          {/* Book Footer Author */}
          <div className="pb-1 text-center">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[#a39a88] font-cinzel">
              {authorName}
            </span>
            <div className="text-[9px] text-[#787163] tracking-widest mt-1">
              VOL. MMXXVI
            </div>
          </div>

          {/* Lock latch ornament */}
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-gradient-to-r from-[#8a7238] to-[#d4af37] rounded-r-md border border-[#f3e5ab]/30 shadow-lg flex items-center justify-center">
            <Lock className="w-3 h-3 text-[#2a2010]" />
          </div>
        </div>

        {/* Access Vault Card */}
        <div 
          id="access-vault-form-card"
          className={`w-full bg-[#121217]/90 border border-[#2a2622] rounded-xl p-6 sm:p-7 backdrop-blur-md shadow-2xl transition-transform ${
            isShaking ? 'translate-x-[-8px]' : ''
          }`}
          style={{
            transition: isShaking ? 'transform 0.08s ease-in-out' : 'transform 0.3s ease'
          }}
        >
          {/* Header copy */}
          <div className="text-center mb-5">
            <h2 className="font-cinzel text-base tracking-[0.2em] text-[#d4af37] uppercase font-semibold">
              Ash's Personal Diary
            </h2>
            <p className="font-serif-book italic text-[#aba495] text-sm mt-1 leading-relaxed">
              "Some memories are meant to stay between pages."
            </p>
          </div>

          {/* Security key input form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label 
                  htmlFor="access-code-input"
                  className="text-[11px] tracking-[0.25em] text-[#d4af37]/90 uppercase font-semibold font-cinzel"
                >
                  ENTER ACCESS PASSCODE
                </label>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#857b6b] pointer-events-none">
                  <KeyRound className="w-4 h-4" />
                </div>

                <input
                  id="access-code-input"
                  name="accessCode"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={10}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full h-12 bg-[#0a0a0d] border border-[#38332c] focus:border-[#d4af37]/70 rounded-lg px-10 text-center font-mono text-lg tracking-[0.35em] text-[#f4eedf] placeholder-[#5c5446] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30 transition-colors"
                  aria-invalid={!!error}
                  aria-describedby={error ? "access-error-msg" : undefined}
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div 
                id="access-error-msg"
                role="alert"
                className="text-center text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 py-2 px-3 rounded font-medium tracking-wide animate-fade-in"
              >
                {error}
              </div>
            )}

            {/* Unlock Button */}
            <button
              type="submit"
              id="unlock-diary-btn"
              disabled={isLoading || !code.trim()}
              className="w-full h-11 bg-gradient-to-r from-[#2a2218] via-[#3d3324] to-[#2a2218] hover:from-[#3d3324] hover:to-[#3d3324] text-[#e8c872] border border-[#6b5832] rounded-lg font-cinzel text-xs tracking-[0.25em] uppercase font-semibold transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                  <span>Unlocking Vault…</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>OPEN DIARY</span>
                </>
              )}
            </button>
          </form>

          {/* Secure footer notice */}
          <div className="mt-5 pt-4 border-t border-[#24201c] flex items-center justify-center gap-3 text-[10px] tracking-[0.2em] text-[#716a5d] uppercase">
            <span>Private</span>
            <span className="w-1 h-1 rounded-full bg-[#4a4439]" />
            <span>Personal</span>
            <span className="w-1 h-1 rounded-full bg-[#4a4439]" />
            <span>Secure</span>
          </div>
        </div>

        {/* Quiet footer prompt */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-[#71695b] tracking-wider font-serif-book italic">
            Protected personal diary • Authorized access only
          </p>
        </div>
      </div>

      {/* Opening sequence overlay */}
      {isUnlockedOpening && (
        <div 
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07070a] text-center p-6 animate-fade-in"
        >
          <div className="w-16 h-16 rounded-full border border-[#d4af37]/40 flex items-center justify-center mb-6 animate-pulse">
            <BookOpen className="w-8 h-8 text-[#d4af37]" />
          </div>
          <h2 className="font-cinzel text-xl sm:text-2xl text-[#f5ebd7] tracking-[0.2em] uppercase mb-2">
            {unlockedRole === 'EDITOR' ? "Welcome Back, Ash" : "Opening Your Pages"}
          </h2>
          <p className="font-serif-book italic text-[#a89f8e] text-base">
            {unlockedRole === 'EDITOR' 
              ? "Preparing your private editor workshop…" 
              : "Opening the diary to your quiet reading space…"}
          </p>
        </div>
      )}
    </main>
  );
};
