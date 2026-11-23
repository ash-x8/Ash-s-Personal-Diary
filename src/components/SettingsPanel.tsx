import React, { useState } from 'react';
import { Download, KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { SinhalaTextInput } from './SinhalaTextInput';

export function SettingsPanel() {
  const { settings, entries, chapters, session, updateSettings, signInWithGoogleAccount } =
    useDiary();
  const { showToast } = useToast();

  const [title, setTitle] = useState(settings.title);
  const [subtitle, setSubtitle] = useState(settings.subtitle);
  const [coverText, setCoverText] = useState(settings.coverText);
  const [authorName, setAuthorName] = useState(settings.authorName);
  const [theme, setTheme] = useState(settings.theme);
  const [paperColor, setPaperColor] = useState(settings.paperColor);
  const [typography, setTypography] = useState(settings.typography);
  const [fontSize, setFontSize] = useState(settings.fontSize || 'normal');
  const [readingWidth, setReadingWidth] = useState(settings.readingWidth);
  const [pageAnimationSpeed, setPageAnimationSpeed] = useState(settings.pageAnimationSpeed);
  const [wordsPerPage, setWordsPerPage] = useState(settings.wordsPerPage || 100);
  const [twoPageMode, setTwoPageMode] = useState(settings.twoPageMode);
  const [mobileSwipeEnabled, setMobileSwipeEnabled] = useState(settings.mobileSwipeEnabled);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [reducedMotion, setReducedMotion] = useState(Boolean(settings.reducedMotion));
  const [readerAccessEnabled, setReaderAccessEnabled] = useState(settings.readerAccessEnabled);

  const [saving, setSaving] = useState(false);

  // PIN vault rotation
  const [newEditorPin, setNewEditorPin] = useState('');
  const [newReaderPin, setNewReaderPin] = useState('');
  const [updatingPins, setUpdatingPins] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        title: title.trim() || "Ash's Personal Diary",
        subtitle: subtitle.trim(),
        coverText: coverText.trim(),
        authorName: authorName.trim(),
        theme,
        paperColor,
        typography,
        fontSize,
        readingWidth,
        pageAnimationSpeed,
        wordsPerPage: Math.min(400, Math.max(40, Number(wordsPerPage) || 100)),
        twoPageMode,
        mobileSwipeEnabled,
        soundEnabled,
        reducedMotion,
        readerAccessEnabled,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEditorPin.trim() && !newReaderPin.trim()) {
      showToast('Enter a new Editor or Reader PIN to update.', 'error');
      return;
    }
    setUpdatingPins(true);
    try {
      await api.updatePins(
        newEditorPin.trim() || undefined,
        newReaderPin.trim() || undefined
      );
      setNewEditorPin('');
      setNewReaderPin('');
      showToast('Vault PINs updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update PINs.', 'error');
    } finally {
      setUpdatingPins(false);
    }
  };

  const handleDownloadBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      chapters,
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ashs-diary-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Complete diary backup downloaded as JSON.', 'success');
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e222d] pb-4">
          <div>
            <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
              Diary & Reading Preferences
            </h2>
            <p className="text-xs text-[#8e929b]">
              Customize book cover inscription, typography, themes, and pagination rules.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#c5a059] px-5 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving…' : 'Save Preferences'}</span>
          </button>
        </div>

        {/* Cover & Author Identity */}
        <section className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-4">
          <h3 className="font-serif-title text-sm font-semibold text-[#f2efe9]">
            Volume Identity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Diary Title</label>
              <SinhalaTextInput
                value={title}
                onChange={setTitle}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-sm text-[#e8e6e3]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Subtitle</label>
              <SinhalaTextInput
                value={subtitle}
                onChange={setSubtitle}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-sm text-[#e8e6e3]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Leather Cover Embossing</label>
              <SinhalaTextInput
                value={coverText}
                onChange={setCoverText}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-sm text-[#e8e6e3]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Author Name</label>
              <SinhalaTextInput
                value={authorName}
                onChange={setAuthorName}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-sm text-[#e8e6e3]"
              />
            </div>
          </div>
        </section>

        {/* Visual & Typography */}
        <section className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-4">
          <h3 className="font-serif-title text-sm font-semibold text-[#f2efe9]">
            Aesthetics & Pagination
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">App Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as typeof theme)}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
              >
                <option value="dark">Midnight Dark</option>
                <option value="sepia">Warm Sepia</option>
                <option value="light">Soft Ivory</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Book Paper Tone</label>
              <select
                value={paperColor}
                onChange={(e) => setPaperColor(e.target.value as typeof paperColor)}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
              >
                <option value="classic">Classic Parchment</option>
                <option value="clean">Archival Ivory</option>
                <option value="dark">Obsidian Leaf</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Book Typography</label>
              <select
                value={typography}
                onChange={(e) => setTypography(e.target.value as typeof typography)}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
              >
                <option value="garamond">Cormorant & Abhaya Serif</option>
                <option value="cinzel">Cinzel Editorial</option>
                <option value="classic">Modern Sans & Sinhala</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Font Size</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as typeof fontSize)}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
              >
                <option value="compact">Compact</option>
                <option value="normal">Balanced</option>
                <option value="large">Large Reading</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Spread Width</label>
              <select
                value={readingWidth}
                onChange={(e) => setReadingWidth(e.target.value as typeof readingWidth)}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
              >
                <option value="compact">Intimate</option>
                <option value="normal">Standard</option>
                <option value="wide">Wide Folio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9ca1ab] mb-1">Words Per Auto-Page</label>
              <input
                type="number"
                min={40}
                max={400}
                value={wordsPerPage}
                onChange={(e) => setWordsPerPage(Number(e.target.value))}
                className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3] tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1e222d]">
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={twoPageMode}
                onChange={(e) => setTwoPageMode(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Desktop Two-Page Open Book</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={mobileSwipeEnabled}
                onChange={(e) => setMobileSwipeEnabled(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Mobile Swipe Page Turning</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Paper Rustle Acoustics</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Reduced Motion Transitions</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={readerAccessEnabled}
                onChange={(e) => setReaderAccessEnabled(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Allow Guest Reader Access</span>
            </label>
          </div>
        </section>
      </form>

      {/* Vault Access & Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form
          onSubmit={handleUpdatePins}
          className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#c5a059]" />
            <h3 className="font-serif-title text-sm font-semibold text-[#f2efe9]">
              Update Vault Passkeys
            </h3>
          </div>
          <div>
            <label className="block text-xs text-[#9ca1ab] mb-1">New Editor Passkey</label>
            <input
              type="password"
              value={newEditorPin}
              onChange={(e) => setNewEditorPin(e.target.value)}
              placeholder="Leave empty to keep current"
              className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9ca1ab] mb-1">New Reader Passkey</label>
            <input
              type="password"
              value={newReaderPin}
              onChange={(e) => setNewReaderPin(e.target.value)}
              placeholder="Leave empty to keep current"
              className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
            />
          </div>
          <button
            type="submit"
            disabled={updatingPins}
            className="min-h-[40px] rounded-lg border border-[#c5a059]/45 bg-[#c5a059]/10 px-4 text-xs font-semibold text-[#f2efe9] hover:bg-[#c5a059]/20 disabled:opacity-50"
          >
            {updatingPins ? 'Updating…' : 'Rotate Vault PINs'}
          </button>
        </form>

        <div className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#c5a059]" />
              <h3 className="font-serif-title text-sm font-semibold text-[#f2efe9]">
                Cloud Sync & Archive Backup
              </h3>
            </div>
            <p className="text-xs text-[#9ca1ab]">
              {session.authMethod === 'firebase'
                ? `Connected via Google (${session.userEmail || 'Owner'}) with live Cloud Firestore sync.`
                : 'Currently signed in via private server PIN session. Link Google below for live Firestore sync.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {session.authMethod !== 'firebase' && (
              <button
                type="button"
                onClick={() => signInWithGoogleAccount().catch((e) => showToast(e.message, 'error'))}
                className="min-h-[40px] rounded-lg border border-[#2a2f3d] bg-[#161922] px-4 text-xs font-medium text-[#e8e6e3] hover:border-[#c5a059]/40"
              >
                Connect Google Cloud
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadBackupJson}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#191d28] border border-[#2c3242] px-4 text-xs font-medium text-[#e8e6e3] hover:border-[#c5a059]/40"
            >
              <Download className="h-3.5 w-3.5 text-[#c5a059]" />
              <span>Export JSON Backup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
