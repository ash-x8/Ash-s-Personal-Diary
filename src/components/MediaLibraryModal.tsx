import React, { useState, useRef } from 'react';
import { Upload, X, Trash2, Check, Copy, Image as ImageIcon } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaLibraryModalProps {
  media: MediaItem[];
  onUpload: (file: File) => Promise<MediaItem>;
  onDelete: (id: string) => Promise<void>;
  onSelect?: (url: string) => void;
  onClose: () => void;
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  media,
  onUpload,
  onDelete,
  onSelect,
  onClose
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP, GIF).');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      alert(err.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div 
      role="dialog"
      aria-label="Media Library"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
    >
      <div className="w-full max-w-3xl bg-[#13131a] border border-[#2e2d3d] rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252433] mb-5">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-[#d4af37]" />
            <div>
              <h3 className="font-cinzel text-base tracking-[0.18em] uppercase text-[#f5ebd7] font-semibold">
                Private Media Archive
              </h3>
              <p className="text-xs text-[#827d72] font-serif-book italic">
                Photographs and illustrations preserved in Ash's vault
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8f887b] hover:text-[#f5ebd7] transition-colors rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag & Drop Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-5 ${
            dragActive 
              ? 'border-[#d4af37] bg-[#d4af37]/10' 
              : 'border-[#38374a] hover:border-[#d4af37]/60 bg-[#191924]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#272636] flex items-center justify-center text-[#d4af37]">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-sm font-medium text-[#ded8cc]">
              {isUploading ? "Preserving photograph into memory…" : "Drag & drop photograph here, or click to browse"}
            </div>
            <p className="text-[11px] text-[#716c60]">
              Supports WebP, PNG, JPEG up to 10MB
            </p>
          </div>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {media.length === 0 ? (
            <div className="py-12 text-center text-[#6e685c] font-serif-book italic text-sm">
              No private photographs have been preserved yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border border-[#2f2e3d] bg-[#1a1924] overflow-hidden flex flex-col"
                >
                  <div className="aspect-video w-full overflow-hidden bg-black/40 relative">
                    <img
                      src={item.url}
                      alt={item.originalName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {onSelect && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item.url);
                          onClose();
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-xs text-[#e8c872] font-cinzel tracking-wider uppercase transition-opacity cursor-pointer font-semibold"
                      >
                        <Check className="w-4 h-4" /> Select
                      </button>
                    )}
                  </div>

                  <div className="p-2 flex items-center justify-between text-[11px] text-[#858074]">
                    <span className="truncate max-w-[100px]" title={item.originalName}>
                      {item.originalName}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.url, item.id)}
                        className="p-1 hover:text-[#d4af37] transition-colors rounded"
                        title="Copy image URL"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this photograph from media library?')) {
                            onDelete(item.id);
                          }
                        }}
                        className="p-1 hover:text-rose-400 transition-colors rounded"
                        title="Delete photograph"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#252433] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#201f2b] hover:bg-[#2b2a3a] text-xs font-cinzel uppercase tracking-wider text-[#d6d0c4] transition-colors cursor-pointer"
          >
            Close Archive
          </button>
        </div>
      </div>
    </div>
  );
};
