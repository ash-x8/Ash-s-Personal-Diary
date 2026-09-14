import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Sparkles, X, Check, Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import { DiaryEntry } from '../types';

interface SecretPageModalProps {
  isOpen: boolean;
  entry: DiaryEntry | null;
  onClose: () => void;
  onSave: (entryId: string, isSecret: boolean, securityKey: string, hint: string) => Promise<void>;
}

export const SecretPageModal: React.FC<SecretPageModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSave
}) => {
  const [isSecret, setIsSecret] = useState(false);
  const [securityKey, setSecurityKey] = useState('');
  const [hint, setHint] = useState('');
  const [showSecurityKey, setShowSecurityKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setIsSecret(Boolean(entry.isSecret));
      setSecurityKey(entry.securityKey || entry.secretPasscode || '');
      setHint(entry.securityHint || entry.secretHint || '');
      setErrorMsg(null);
    }
  }, [entry, isOpen]);

  if (!isOpen || !entry) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSecret && !securityKey.trim()) {
      setErrorMsg('Please specify a security key before sealing this page.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onSave(entry.id, isSecret, securityKey.trim(), hint.trim());
      onClose();
    } catch (err) {
      setErrorMsg('Failed to save security key settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[#14141d] border border-[#363447] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#252436] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-cinzel text-sm uppercase tracking-wider text-[#f5ebd7] font-semibold">
                Secret Page Security Key
              </h3>
              <p className="text-xs text-[#8e887d] truncate max-w-[260px] font-serif-book">
                {entry.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7c766b] hover:text-[#ded8cc] hover:bg-[#201f2e] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Secret Page Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#191826] border border-[#2c2b3d]">
            <div>
              <div className="flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wider text-[#ded8cc] font-semibold">
                <span>Seal as Secret Page</span>
                {isSecret && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8e887d] mt-0.5">
                Lock this individual page with its own independent security key
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsSecret(!isSecret)}
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

          {isSecret ? (
            <div className="space-y-3.5 pt-1 animate-fade-in">
              {/* Security Key Input */}
              <div>
                <label className="block text-[11px] font-cinzel tracking-wider uppercase text-[#ded8cc] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#d4af37]" /> Page Security Key *
                  </span>
                  <span className="text-[10px] text-[#8e887d] normal-case font-sans">
                    Unique to this page
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showSecurityKey ? "text" : "password"}
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    placeholder="Enter custom security key for this page…"
                    className="w-full h-10 bg-[#0b0c10] border border-[#2f2e42] focus:border-[#d4af37] rounded-lg px-3 pr-10 text-xs text-[#ded8cc] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecurityKey(!showSecurityKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d776a] hover:text-[#ded8cc]"
                  >
                    {showSecurityKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Security Hint Input */}
              <div>
                <label className="block text-[11px] font-cinzel tracking-wider uppercase text-[#ded8cc] mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" /> Security Key Hint (Visible on Page)
                </label>
                <textarea
                  rows={2}
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="Type a clue here to guide authorized readers (e.g. Our secret trip date)…"
                  className="w-full bg-[#0b0c10] border border-[#2f2e42] focus:border-[#d4af37] rounded-lg p-3 text-xs text-[#ded8cc] focus:outline-none resize-none"
                />
                <p className="text-[10px] text-[#8e887d] mt-1 italic">
                  Note: The exact hint you type above will be displayed on the page when locked.
                </p>
              </div>

              {/* Preview Box */}
              <div className="p-3 rounded-xl bg-[#181724] border border-[#d4af37]/30 text-center space-y-1.5">
                <span className="text-[10px] font-cinzel tracking-widest uppercase text-[#d4af37] block">
                  Reader Lock Preview
                </span>
                <p className="text-xs font-serif-book italic text-[#ded8cc] opacity-90 break-words">
                  "{hint.trim() ? hint : 'No hint specified.'}"
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#161520] text-center text-xs text-[#8e887d] font-serif-book italic">
              This page is currently open and visible to authorized readers of your book without a secondary security key.
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/50 flex items-center gap-2 text-xs text-red-300">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#252436]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-cinzel uppercase tracking-wider text-[#8e887d] hover:text-[#ded8cc] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a7238] to-[#d4af37] hover:from-[#9c8240] hover:to-[#e3bd42] text-[#14141a] font-cinzel text-xs uppercase tracking-wider font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
                <span>Saving…</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Security Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

