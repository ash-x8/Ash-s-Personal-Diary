import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface BookSecretLockedPageProps {
  title: string;
  hint?: string;
  paperColor: 'classic' | 'clean' | 'dark';
  onUnlockAttempt: (key: string) => Promise<void>;
}

export function BookSecretLockedPage({
  title,
  hint,
  paperColor,
  onUnlockAttempt,
}: BookSecretLockedPageProps) {
  const [passkey, setPasskey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = paperColor === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkey.trim()) {
      setError('Enter the passkey for this sealed leaf.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onUnlockAttempt(passkey.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect passkey.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 py-10 text-center">
      <div
        className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${
          isDark
            ? 'border-[#c5a059]/40 bg-[#c5a059]/10 text-[#c5a059]'
            : 'border-[#a88634]/40 bg-[#a88634]/10 text-[#8c6e28]'
        }`}
      >
        <Lock className="h-6 w-6" />
      </div>

      <p
        className={`text-[11px] uppercase tracking-[0.22em] ${
          isDark ? 'text-[#c5a059]' : 'text-[#8c6e28]'
        }`}
      >
        Sealed Memory
      </p>
      <h3
        className={`mt-2 font-serif-book text-xl sm:text-2xl font-semibold ${
          isDark ? 'text-[#f2efe9]' : 'text-[#241d17]'
        }`}
      >
        {title || 'Private Leaf'}
      </h3>

      {hint && (
        <p
          className={`mt-2 max-w-xs text-xs italic ${
            isDark ? 'text-[#9ca1ab]' : 'text-[#6e6357]'
          }`}
        >
          Hint: {hint}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 w-full max-w-xs space-y-3">
        <div className="relative">
          <KeyRound
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
              isDark ? 'text-[#8e929b]' : 'text-[#7d7164]'
            }`}
          />
          <input
            type={showKey ? 'text' : 'password'}
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            placeholder="Enter leaf passkey"
            className={`w-full min-h-[44px] rounded-lg border pl-9 pr-10 text-sm focus:outline-none ${
              isDark
                ? 'border-[#2f3442] bg-[#0e1015] text-[#f2efe9] placeholder-[#656b78] focus:border-[#c5a059]'
                : 'border-[#d6cab7] bg-white/80 text-[#241d17] placeholder-[#8c8073] focus:border-[#96782d]'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide passkey' : 'Show passkey'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 opacity-70 hover:opacity-100"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <p className="text-xs text-[#c94a4a]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-[#c5a059] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50 transition-colors"
        >
          <span>{loading ? 'Verifying…' : 'Unseal Leaf'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
