import React, { useState } from 'react';
import {
  X,
  FileDown,
  Printer,
  CheckSquare,
  Square,
  Check,
  Languages,
  Sparkles,
  Loader2
} from 'lucide-react';
import { DiaryEntry, DiarySettings } from '../types';
import {
  exportEntriesToPdf,
  printEntriesDirectly,
  PdfExportOptions,
  DEFAULT_PDF_OPTIONS
} from '../services/pdfExport';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  settings?: DiarySettings;
  preSelectedIds?: string[];
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  settings,
  preSelectedIds
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (preSelectedIds && preSelectedIds.length > 0) {
      return new Set(preSelectedIds);
    }
    return new Set(entries.map((e) => e.id));
  });

  const [options, setOptions] = useState<PdfExportOptions>({
    ...DEFAULT_PDF_OPTIONS,
    renderMode: 'canvas-hd',
    diaryTitle: settings?.title || DEFAULT_PDF_OPTIONS.diaryTitle,
    authorName: settings?.authorName || DEFAULT_PDF_OPTIONS.authorName
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const sortedEntries = [...entries].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  const selectedEntries = sortedEntries.filter((e) => selectedIds.has(e.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(entries.map((e) => e.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDownloadPdf = async () => {
    if (selectedEntries.length === 0) return;
    setIsGenerating(true);
    setProgressMsg('Preparing Sinhala typography & document layout…');
    setExportSuccess(null);
    try {
      await exportEntriesToPdf(selectedEntries, settings, {
        ...options,
        onProgress: (_current, _total, message) => {
          setProgressMsg(message);
        }
      });
      setExportSuccess(`Successfully exported PDF for ${selectedEntries.length} entries with full Sinhala font support.`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert(err.message || 'Failed to generate PDF document.');
    } finally {
      setIsGenerating(false);
      setProgressMsg('');
    }
  };

  const handleDirectPrint = () => {
    if (selectedEntries.length === 0) return;
    try {
      printEntriesDirectly(selectedEntries, settings, options);
    } catch (err: any) {
      console.error('Print error:', err);
      alert(err.message || 'Failed to launch print view.');
    }
  };

  return (
    <div
      id="pdf-export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-export-title"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#15141d] border border-[#2e2d3f] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252435] bg-[#111018]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#d4af37]/60 shrink-0 bg-black shadow-md">
              <img
                src="/logo.png"
                alt="Ash's Personal Diary Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 id="pdf-export-title" className="font-cinzel text-lg font-bold text-[#f5ebd7] tracking-wider">
                Export Formatted PDF
              </h3>
              <p className="text-xs text-[#8e8779] font-serif-book">
                Export diary entries into a printable manuscript with full Sinhala (සිංහල) and English typography.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#8a8477] hover:text-[#f5ebd7] hover:bg-[#201f2e] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sinhala & Unicode Font Banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1c1a27] border border-[#4d4024] text-xs">
            <div className="w-8 h-8 rounded-lg bg-[#2b271a] flex items-center justify-center text-[#e8c872] shrink-0 border border-[#6b582b]">
              <Languages className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-cinzel text-xs font-semibold text-[#f5ebd7]">
                <span>Sinhala Font Engine Active</span>
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                  Abhaya Libre + Noto Serif
                </span>
              </div>
              <p className="text-[11px] text-[#a89f8f] font-serif-book mt-0.5">
                Full HarfBuzz ligature rendering enabled — vowel signs (කො, ක්), yansaya (්‍ය), and bandi akuru are properly shaped and will not display as broken characters.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end shrink-0 pl-2">
              <span className="font-sinhala text-sm text-[#e8c872] font-semibold">
                මගේ දිනපොත
              </span>
              <span className="text-[10px] text-[#736c5e]">Unicode Compliant</span>
            </div>
          </div>

          {/* Status Message */}
          {exportSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs font-serif-book animate-fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {/* Progress Indicator */}
          {isGenerating && progressMsg && (
            <div className="p-3 bg-[#1e1c2e] border border-[#48402c] rounded-xl flex items-center gap-3 text-xs text-[#e8c872] animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-[#d4af37] shrink-0" />
              <span className="font-serif-book font-medium">{progressMsg}</span>
            </div>
          )}

          {/* Section 1: Selection bar */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-xs uppercase tracking-wider text-[#d4af37] font-semibold">
                  Select Entries to Include
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#201f2e] text-[#b8b0a1] border border-[#302f42]">
                  {selectedEntries.length} of {entries.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-cinzel tracking-wider uppercase">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 rounded bg-[#201f2e] hover:bg-[#2a293e] text-[#c4bcad] hover:text-[#f5ebd7] transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-2.5 py-1 rounded bg-[#201f2e] hover:bg-[#2a293e] text-[#8e8779] hover:text-[#d4af37] transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Entry Checklist */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 bg-[#0c0c12] border border-[#232230] rounded-xl pr-1.5">
              {sortedEntries.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#7d776a] font-serif-book italic">
                  No diary entries available to export.
                </div>
              ) : (
                sortedEntries.map((entry) => {
                  const isChecked = selectedIds.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => toggleSelect(entry.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-[#1e1c2a] border-[#524a35] text-[#f5ebd7]'
                          : 'bg-[#12111a] border-transparent text-[#7d776a] hover:bg-[#181724]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="text-[#d4af37] focus:outline-none cursor-pointer"
                          aria-label={isChecked ? 'Deselect' : 'Select'}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#4a475a]" />
                          )}
                        </button>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-cinzel text-[11px] text-[#d4af37]">
                              #{entry.pageOrder}
                            </span>
                            <span className="font-serif-book text-sm font-semibold truncate text-[#ded7c8]">
                              {entry.title || 'Untitled Entry'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#787265] flex items-center gap-2 mt-0.5">
                            <span>{entry.date}</span>
                            {entry.mood && <span>• {entry.mood}</span>}
                            {entry.status === 'draft' && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400">
                                Draft
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-cinzel text-[#857f72] shrink-0 ml-3">
                        {entry.tags?.length ? `${entry.tags.length} tags` : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: PDF Rendering Mode & Paper Tone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Render Mode */}
            <div className="p-4 bg-[#111018] border border-[#232231] rounded-xl space-y-2">
              <label className="block text-xs font-cinzel uppercase tracking-wider text-[#d4af37] font-semibold">
                Export Typography Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, renderMode: 'canvas-hd' })}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    options.renderMode === 'canvas-hd'
                      ? 'bg-[#252233] border-[#d4af37] text-[#d4af37]'
                      : 'bg-[#171622] border-[#2d2c3e] text-[#8e8779] hover:text-[#d4af37]'
                  }`}
                >
                  <div className="text-xs font-cinzel font-semibold flex items-center gap-1.5">
                    <span>Book HD</span>
                    <Sparkles className="w-3 h-3 text-[#d4af37]" />
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">Full Sinhala ligatures & parchment texture</div>
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, renderMode: 'vector' })}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    options.renderMode === 'vector'
                      ? 'bg-[#252233] border-[#d4af37] text-[#d4af37]'
                      : 'bg-[#171622] border-[#2d2c3e] text-[#8e8779] hover:text-[#d4af37]'
                  }`}
                >
                  <div className="text-xs font-cinzel font-semibold">Vector PDF</div>
                  <div className="text-[10px] opacity-75 mt-0.5">Embedded TTF font, selectable text</div>
                </button>
              </div>
            </div>

            {/* Paper Theme */}
            <div className="p-4 bg-[#111018] border border-[#232231] rounded-xl space-y-2">
              <label className="block text-xs font-cinzel uppercase tracking-wider text-[#d4af37] font-semibold">
                Paper Tone & Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'classic', label: 'Parchment', desc: 'Warm Classic' },
                  { id: 'ivory', label: 'Ivory', desc: 'Soft & Light' },
                  { id: 'clean', label: 'Clean', desc: 'Crisp White' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOptions({ ...options, paperStyle: p.id as any })}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      options.paperStyle === p.id
                        ? 'bg-[#252233] border-[#d4af37] text-[#d4af37]'
                        : 'bg-[#171622] border-[#2d2c3e] text-[#8e8779] hover:text-[#d4af37]'
                    }`}
                  >
                    <div className="text-xs font-cinzel font-semibold">{p.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Document Layout Components */}
          <div className="p-4 bg-[#111018] border border-[#232231] rounded-xl space-y-3">
            <span className="block text-xs font-cinzel uppercase tracking-wider text-[#d4af37] font-semibold">
              Manuscript Components
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#cfc8b8]">
              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#181724] border border-[#2a293b] cursor-pointer hover:border-[#403e58] transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeTitlePage}
                  onChange={(e) => setOptions({ ...options, includeTitlePage: e.target.checked })}
                  className="rounded border-[#413f54] text-[#d4af37] focus:ring-0 cursor-pointer"
                />
                <span className="font-serif-book">Title Cover Page</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#181724] border border-[#2a293b] cursor-pointer hover:border-[#403e58] transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeTableOfContents}
                  onChange={(e) => setOptions({ ...options, includeTableOfContents: e.target.checked })}
                  className="rounded border-[#413f54] text-[#d4af37] focus:ring-0 cursor-pointer"
                />
                <span className="font-serif-book">Table of Contents</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#181724] border border-[#2a293b] cursor-pointer hover:border-[#403e58] transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeMetadata}
                  onChange={(e) => setOptions({ ...options, includeMetadata: e.target.checked })}
                  className="rounded border-[#413f54] text-[#d4af37] focus:ring-0 cursor-pointer"
                />
                <span className="font-serif-book">Mood & Tags Header</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-[#252435] bg-[#111018]">
          <div className="text-xs text-[#8e8779] font-serif-book">
            {selectedEntries.length === 0 ? (
              <span className="text-rose-400">Please select at least one entry to export.</span>
            ) : (
              <span>Ready to export {selectedEntries.length} entries with Sinhala & English typography.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#201f2e] hover:bg-[#2c2a3e] text-[#b8b0a1] hover:text-[#f5ebd7] font-cinzel text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              id="pdf-print-view-btn"
              disabled={selectedEntries.length === 0 || isGenerating}
              onClick={handleDirectPrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#222030] hover:bg-[#2d2b40] text-[#e8c872] border border-[#48402f] font-cinzel text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Open browser print dialog with full vector Sinhala typography"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              id="pdf-download-file-btn"
              disabled={selectedEntries.length === 0 || isGenerating}
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#8a7238] to-[#d4af37] hover:from-[#9c8240] hover:to-[#e3bd42] text-[#19140a] font-cinzel text-xs uppercase tracking-wider font-semibold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating PDF…</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download Formatted PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
