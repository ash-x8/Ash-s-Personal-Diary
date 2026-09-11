import React, { useState } from 'react';
import { Save, Book, Volume2, Shield, Sliders, Check } from 'lucide-react';
import { DiarySettings } from '../types';

interface SettingsPanelProps {
  settings: DiarySettings;
  onSave: (updates: Partial<DiarySettings>) => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSave }) => {
  const [form, setForm] = useState<DiarySettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto py-6 px-4 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#292837]">
        <div>
          <h2 className="font-cinzel text-xl text-[#f5ebd7] tracking-[0.18em] uppercase font-bold">
            Diary Architecture & Aesthetics
          </h2>
          <p className="text-xs text-[#857f72] font-serif-book italic mt-0.5">
            Configure book cover, archival paper palettes, and reader behavior
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a7238] to-[#d4af37] text-[#19140a] font-cinzel text-xs uppercase tracking-wider font-semibold shadow-lg hover:from-[#9c8240] hover:to-[#e3bd42] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isSaving ? (
            <span>Preserving…</span>
          ) : showSavedToast ? (
            <>
              <Check className="w-4 h-4 text-emerald-950" />
              <span>Preserved</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Book Cover & Title Info */}
      <div className="bg-[#13131c] border border-[#2b2a3a] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#232230]">
          <Book className="w-4 h-4 text-[#d4af37]" />
          <h3 className="font-cinzel text-sm text-[#e8c872] tracking-[0.2em] uppercase font-semibold">
            Cover & Inscription Identity
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.18em] uppercase text-[#9e978b] mb-1.5">
              Book Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-10 bg-[#0c0c11] border border-[#2e2d3e] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.18em] uppercase text-[#9e978b] mb-1.5">
              Cover Text (Embossed)
            </label>
            <input
              type="text"
              value={form.coverText}
              onChange={(e) => setForm({ ...form, coverText: e.target.value })}
              className="w-full h-10 bg-[#0c0c11] border border-[#2e2d3e] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.18em] uppercase text-[#9e978b] mb-1.5">
              Subtitle
            </label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="w-full h-10 bg-[#0c0c11] border border-[#2e2d3e] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.18em] uppercase text-[#9e978b] mb-1.5">
              Author / Keeper Name
            </label>
            <input
              type="text"
              value={form.authorName}
              onChange={(e) => setForm({ ...form, authorName: e.target.value })}
              className="w-full h-10 bg-[#0c0c11] border border-[#2e2d3e] focus:border-[#d4af37] rounded-lg px-3 text-sm text-[#ded8cc]"
            />
          </div>
        </div>
      </div>

      {/* Reader & Physical Book Feel */}
      <div className="bg-[#13131c] border border-[#2b2a3a] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#232230]">
          <Sliders className="w-4 h-4 text-[#d4af37]" />
          <h3 className="font-cinzel text-sm text-[#e8c872] tracking-[0.2em] uppercase font-semibold">
            Paper & Physical Reading Experience
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.18em] uppercase text-[#9e978b] mb-1.5">
              Default Archival Paper Texture
            </label>
            <select
              value={form.paperColor}
              onChange={(e) => setForm({ ...form, paperColor: e.target.value as any })}
              className="w-full h-10 bg-[#0c0c11] border border-[#2e2d3e] rounded-lg px-3 text-xs text-[#ded8cc]"
            >
              <option value="classic">Classic Warm Ivory (Warm Sepia Ink)</option>
              <option value="clean">Clean Soft White (Editorial Charcoal)</option>
              <option value="dark">Dark Journal (Dark Charcoal & Warm Gold)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-cinzel tracking-[0.18em] uppercase text-[#9e978b] mb-1.5">
              Page-Turn Animation Pace
            </label>
            <select
              value={form.pageAnimationSpeed}
              onChange={(e) => setForm({ ...form, pageAnimationSpeed: e.target.value as any })}
              className="w-full h-10 bg-[#0c0c11] border border-[#2e2d3e] rounded-lg px-3 text-xs text-[#ded8cc]"
            >
              <option value="normal">Normal (Smooth 3D page curl)</option>
              <option value="relaxed">Relaxed (Slow cinematic turning)</option>
              <option value="gentle">Gentle (Minimalist transition)</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#191924] border border-[#2e2d3e] cursor-pointer">
            <input
              type="checkbox"
              checked={form.soundEnabled}
              onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#d4af37]"
            />
            <div>
              <span className="text-xs font-medium text-[#ded8cc] flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" /> Archival Paper Rustle Audio
              </span>
              <p className="text-[10px] text-[#787265] mt-0.5">
                Synthesizes realistic whisper-soft page turns
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#191924] border border-[#2e2d3e] cursor-pointer">
            <input
              type="checkbox"
              checked={form.mobileSwipeEnabled}
              onChange={(e) => setForm({ ...form, mobileSwipeEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#d4af37]"
            />
            <div>
              <span className="text-xs font-medium text-[#ded8cc]">
                Mobile Touch Swipe Gestures
              </span>
              <p className="text-[10px] text-[#787265] mt-0.5">
                Swipe left for next page, right for previous
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Security & Access Review */}
      <div className="bg-[#13131c] border border-[#2b2a3a] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#232230]">
          <Shield className="w-4 h-4 text-[#d4af37]" />
          <h3 className="font-cinzel text-sm text-[#e8c872] tracking-[0.2em] uppercase font-semibold">
            Security & Cryptographic Gate
          </h3>
        </div>

        <div className="text-xs text-[#9c9586] leading-relaxed space-y-2">
          <p>
            • <strong>Editor Access</strong>: Inscribes and manages all content. Validated strictly via server-side session token.
          </p>
          <p>
            • <strong>Reader Access</strong>: Permits reading published entries only. Unfinished drafts and editor endpoints remain protected.
          </p>
          <p>
            • <strong>SEO Protection</strong>: Search engine crawlers are automatically instructed not to index these private pages (<code className="text-[#d4af37]">noindex, nofollow</code>).
          </p>
        </div>
      </div>
    </form>
  );
};
