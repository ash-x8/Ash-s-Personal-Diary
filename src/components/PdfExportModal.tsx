import React, { useMemo, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { DiaryEntry, DiarySettings } from '../types';
import { exportEntriesToPdf, printEntriesDirectly } from '../services/pdfExport';
import { useToast } from '../context/ToastContext';

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  settings: DiarySettings;
}

export function PdfExportModal({ open, onClose, entries, settings }: PdfExportModalProps) {
  const { showToast } = useToast();

  const [scope, setScope] = useState<'published' | 'all' | 'custom'>('published');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paperStyle, setPaperStyle] = useState<'classic' | 'ivory' | 'clean'>('classic');
  const [fontSize, setFontSize] = useState<'standard' | 'large'>('standard');
  const [renderMode, setRenderMode] = useState<'canvas-hd' | 'vector'>('canvas-hd');
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeTableOfContents, setIncludeTableOfContents] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progressText, setProgressText] = useState('');

  const targetEntries = useMemo(() => {
    const base = entries.filter((e) => !e.isLocked);
    if (scope === 'published') return base.filter((e) => e.status === 'published');
    if (scope === 'all') return base;
    return base.filter((e) => selectedIds.has(e.id));
  }, [entries, scope, selectedIds]);

  if (!open) return null;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadPdf = async () => {
    if (targetEntries.length === 0) {
      showToast('Select at least one unlocked entry to export.', 'error');
      return;
    }
    setExporting(true);
    setProgressText('Preparing pages…');
    try {
      await exportEntriesToPdf(targetEntries, settings, {
        includeTitlePage,
        includeTableOfContents,
        includeMetadata,
        paperStyle,
        fontSize,
        renderMode,
        onProgress: (_curr, _tot, msg) => setProgressText(msg),
      });
      showToast('PDF book exported successfully.', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF export failed.', 'error');
    } finally {
      setExporting(false);
      setProgressText('');
    }
  };

  const handlePrint = () => {
    if (targetEntries.length === 0) {
      showToast('Select at least one unlocked entry to print.', 'error');
      return;
    }
    try {
      printEntriesDirectly(targetEntries, settings, {
        includeTitlePage,
        includeTableOfContents,
        includeMetadata,
        paperStyle,
        fontSize,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open print preview.', 'error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export Diary as PDF"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[#252a38] bg-[#111319] text-[#e8e6e3] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#1e222d] px-6 py-4">
          <div>
            <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
              Print & PDF Book Export
            </h2>
            <p className="text-xs text-[#8e929b] tabular-nums">
              {targetEntries.length} entries selected for compilation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="rounded-lg p-2 text-[#8e929b] hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-2">
              Entries to Include
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'published', label: 'Published Only' },
                  { id: 'all', label: 'All Unlocked' },
                  { id: 'custom', label: 'Custom Pick' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  className={`min-h-[40px] rounded-lg border text-xs font-medium transition-colors ${
                    scope === opt.id
                      ? 'border-[#c5a059] bg-[#c5a059]/15 text-[#f2efe9]'
                      : 'border-[#252a38] bg-[#161922] text-[#a0a4ad]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scope === 'custom' && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-[#242834] bg-[#0c0e13] p-2 space-y-1">
                {entries.map((entry) => (
                  <label
                    key={entry.id}
                    className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      disabled={Boolean(entry.isLocked)}
                      onChange={() => toggleSelection(entry.id)}
                      className="accent-[#c5a059]"
                    />
                    <span className="truncate flex-1">{entry.title}</span>
                    <span className="text-[#8e929b] tabular-nums">{entry.date}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-2">
                Paper Finish
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['classic', 'ivory', 'clean'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setPaperStyle(style)}
                    className={`min-h-[38px] rounded-lg border text-xs capitalize ${
                      paperStyle === style
                        ? 'border-[#c5a059] bg-[#c5a059]/15 text-[#f2efe9]'
                        : 'border-[#252a38] bg-[#161922] text-[#a0a4ad]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca1ab] mb-2">
                Typography & Shaping
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRenderMode('canvas-hd')}
                  className={`min-h-[38px] rounded-lg border px-2 text-xs ${
                    renderMode === 'canvas-hd'
                      ? 'border-[#c5a059] bg-[#c5a059]/15 text-[#f2efe9]'
                      : 'border-[#252a38] bg-[#161922] text-[#a0a4ad]'
                  }`}
                >
                  Canvas HD (Sinhala)
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode('vector')}
                  className={`min-h-[38px] rounded-lg border px-2 text-xs ${
                    renderMode === 'vector'
                      ? 'border-[#c5a059] bg-[#c5a059]/15 text-[#f2efe9]'
                      : 'border-[#252a38] bg-[#161922] text-[#a0a4ad]'
                  }`}
                >
                  Vector TTF
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={includeTitlePage}
                onChange={(e) => setIncludeTitlePage(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Include Cover Page</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={includeTableOfContents}
                onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Include Table of Contents</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <span>Include Mood, Location & Tags</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-[#d8d5ce] cursor-pointer">
              <input
                type="checkbox"
                checked={fontSize === 'large'}
                onChange={(e) => setFontSize(e.target.checked ? 'large' : 'standard')}
                className="accent-[#c5a059]"
              />
              <span>Large Print Reading Size</span>
            </label>
          </div>

          {exporting && progressText && (
            <div className="rounded-lg border border-[#c5a059]/30 bg-[#c5a059]/10 px-4 py-2.5 text-xs text-[#f2efe9]">
              {progressText}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#1e222d] bg-[#0e1015] px-6 py-4">
          <button
            type="button"
            onClick={handlePrint}
            disabled={exporting}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#2a2f3d] bg-[#161922] px-4 py-2 text-xs font-medium text-[#e8e6e3] hover:border-[#c5a059]/40 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5 text-[#c5a059]" />
            <span>Direct Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exporting}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#c5a059] px-5 py-2 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Generating PDF…' : 'Download PDF Book'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
