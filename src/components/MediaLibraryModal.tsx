import React, { useState } from 'react';
import { Check, ImageOff, Plus, Trash2, Upload, X } from 'lucide-react';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import { compressImage } from '../utils/imageCompressor';
import { sanitizeMediaUrl } from '../utils/sanitize';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelectUrl?: (url: string) => void;
  title?: string;
}

export function MediaLibraryModal({
  open,
  onClose,
  onSelectUrl,
  title = 'Media Archive',
}: MediaLibraryModalProps) {
  const { media, uploadMedia, deleteMedia } = useDiary();
  const { showToast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, {
        maxDimension: 1200,
        quality: 0.8,
        maxSizeBytes: 180 * 1024,
      });

      const blob = await fetch(compressed.dataUrl).then((r) => r.blob());
      const compressedFile = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, '.jpg'),
        { type: 'image/jpeg' }
      );

      const saved = await uploadMedia(compressedFile);
      showToast('Photograph uploaded to archive.', 'success');
      if (onSelectUrl) {
        onSelectUrl(saved.url);
        onClose();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload image.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteMedia(deleteTargetId);
      showToast('Image removed from archive.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl border border-[#252a38] bg-[#111319] text-[#e8e6e3] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#1e222d] px-6 py-4">
          <div>
            <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">{title}</h2>
            <p className="text-xs text-[#8e929b] tabular-nums">
              {media.length} archived photographs
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg bg-[#c5a059] px-4 py-2 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] transition-colors">
              <Upload className="h-3.5 w-3.5" />
              <span>{uploading ? 'Optimizing…' : 'Upload Photo'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close media modal"
              className="rounded-lg p-2 text-[#8e929b] hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {media.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2a2f3d] py-16 text-center">
              <Plus className="h-7 w-7 text-[#c5a059] mb-2" />
              <p className="text-sm font-medium text-[#d8d5ce]">No photographs uploaded yet</p>
              <p className="mt-1 text-xs text-[#8e929b]">
                Upload JPG, PNG, or WebP memories to attach them to chapters or entries.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {media.map((item) => {
                const safeUrl = sanitizeMediaUrl(item.url);
                const failed = brokenIds.has(item.id) || !safeUrl;
                return (
                  <div
                    key={item.id}
                    className="group relative rounded-lg border border-[#242834] bg-[#0c0e13] overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full bg-[#161922] flex items-center justify-center overflow-hidden">
                      {failed ? (
                        <ImageOff className="h-6 w-6 text-[#686d7a]" />
                      ) : (
                        <img
                          src={safeUrl}
                          alt={item.originalName}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenIds((prev) => new Set(prev).add(item.id))}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2.5">
                      <span className="truncate text-[11px] text-[#9ca1ab]">
                        {item.originalName}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {onSelectUrl && safeUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectUrl(safeUrl);
                              onClose();
                            }}
                            title="Use this image"
                            aria-label="Select image"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#c5a059] text-[#0c0e13] hover:bg-[#d4b06a]"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(item.id)}
                          title="Delete image"
                          aria-label="Delete image"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2f3d] text-[#9ca1ab] hover:border-[#d66363]/50 hover:text-[#e07b7b]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="Remove Photograph?"
        description="This permanently deletes the image from the media archive. Entries already referencing it may no longer display the photo."
        confirmLabel="Remove Photo"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
