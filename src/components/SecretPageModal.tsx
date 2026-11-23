import React, { useEffect, useState } from 'react';
import { Lock, Unlock, X } from 'lucide-react';

interface SecretPageModalProps {
  open: boolean;
  targetTitle: string;
  initialIsSecret: boolean;
  initialKey?: string;
  initialHint?: string;
  onSave: (payload: { isSecret: boolean; securityKey: string; securityHint: string }) => Promise<void>;
  onClose: () => void;
}

export function SecretPageModal({
  open,
  targetTitle,
  initialIsSecret,
  initialKey = '',
  initialHint = '',
  onSave,
  onClose,
}: SecretPageModalProps) {
  const [isSecret, setIsSecret] = useState(initialIsSecret);
  const [securityKey, setSecurityKey] = useState(initialKey);
  const [securityHint, setSecurityHint] = useState(initialHint);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsSecret(initialIsSecret);
      setSecurityKey(initialKey);
      setSecurityHint(initialHint);
      setError(null);
    }
  }, [open, initialIsSecret, initialKey, initialHint]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSecret && !securityKey.trim()) {
      setError('Set a secret passkey to seal this entry.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        isSecret,
        securityKey: isSecret ? securityKey.trim() : '',
        securityHint: isSecret ? securityHint.trim() : '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lock settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Secret Lock Configuration"
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-[#252a38] bg-[#111319] text-[#e8e6e3] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#1e222d] px-6 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock className="h-4 w-4 text-[#c5a059] shrink-0" />
            <h2 className="font-serif-title text-base font-semibold truncate text-[#f2efe9]">
              Vault Seal — {targetTitle || 'Untitled'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#8e929b] hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="flex items-center justify-between rounded-lg border border-[#242834] bg-[#0c0e13] px-4 py-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm text-[#e8e6e3]">
              {isSecret ? (
                <Lock className="h-4 w-4 text-[#c5a059]" />
              ) : (
                <Unlock className="h-4 w-4 text-[#8e929b]" />
              )}
              <span>Require Passkey to Read</span>
            </span>
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
              className="h-4 w-4 accent-[#c5a059]"
            />
          </label>

          {isSecret && (
            <>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-1.5">
                  Leaf Passkey
                </label>
                <input
                  type="text"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  placeholder="Enter a secret word or PIN"
                  className="w-full min-h-[42px] rounded-lg border border-[#2a2f3d] bg-[#0c0e13] px-3.5 text-sm text-[#f2efe9] focus:border-[#c5a059] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-1.5">
                  Memory Hint (Optional)
                </label>
                <input
                  type="text"
                  value={securityHint}
                  onChange={(e) => setSecurityHint(e.target.value)}
                  placeholder="Clue shown on the locked leaf"
                  className="w-full min-h-[42px] rounded-lg border border-[#2a2f3d] bg-[#0c0e13] px-3.5 text-sm text-[#f2efe9] focus:border-[#c5a059] focus:outline-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-[#e07b7b]">{error}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#2a2f3d] px-4 py-2 text-xs text-[#c8ccd4]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#c5a059] px-5 py-2 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Seal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
