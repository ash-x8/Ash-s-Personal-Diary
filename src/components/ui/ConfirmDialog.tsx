import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#2a2e38] bg-[#12141a] text-[#e8e6e3] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                destructive
                  ? 'border-[#d66363]/40 bg-[#d66363]/10 text-[#e07b7b]'
                  : 'border-[#c5a059]/30 bg-[#c5a059]/10 text-[#c5a059]'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="font-serif-title text-base font-semibold tracking-wide text-[#f2efe9]"
              >
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#a0a4ad]">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-1.5 text-[#8e929b] hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#1e222b] bg-[#0e1015] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-[40px] rounded-lg border border-[#2a2e38] px-4 py-2 text-xs font-medium text-[#c8ccd4] hover:bg-white/5 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              destructive
                ? 'bg-[#b84545] text-white hover:bg-[#c95353] disabled:opacity-50'
                : 'bg-[#c5a059] text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50'
            }`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
