import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookMarked,
  Edit3,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DiaryChapter } from '../types';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import { countWords } from '../utils/pagination';
import { SinhalaTextInput } from './SinhalaTextInput';
import { SinhalaUnicodeEditor } from './SinhalaUnicodeEditor';
import { ConfirmDialog } from './ui/ConfirmDialog';

export function ChapterManager() {
  const {
    chapters,
    entries,
    createChapter,
    updateChapter,
    deleteChapter,
    reorderChapters,
  } = useDiary();
  const { showToast } = useToast();

  const [editing, setEditing] = useState<DiaryChapter | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rawContent, setRawContent] = useState('<p></p>');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [isSecret, setIsSecret] = useState(false);
  const [securityKey, setSecurityKey] = useState('');
  const [securityHint, setSecurityHint] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DiaryChapter | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openNew = () => {
    setEditing(null);
    setCreating(true);
    setTitle('');
    setDescription('');
    setRawContent('<p></p>');
    setStatus('published');
    setIsSecret(false);
    setSecurityKey('');
    setSecurityHint('');
  };

  const openEdit = (ch: DiaryChapter) => {
    setCreating(false);
    setEditing(ch);
    setTitle(ch.chapterTitle || '');
    setDescription(ch.description || '');
    setRawContent(ch.rawContent || '<p></p>');
    setStatus(ch.status === 'draft' ? 'draft' : 'published');
    setIsSecret(Boolean(ch.isSecret));
    setSecurityKey(ch.securityKey || ch.secretPasscode || '');
    setSecurityHint(ch.securityHint || ch.secretHint || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Chapter title is required.', 'error');
      return;
    }
    if (isSecret && !securityKey.trim()) {
      showToast('Enter a passkey to lock this chapter.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<DiaryChapter> = {
        chapterTitle: title.trim(),
        description: description.trim(),
        rawContent,
        status,
        isSecret,
        securityKey: isSecret ? securityKey.trim() : '',
        securityHint: isSecret ? securityHint.trim() : '',
      };
      if (editing) {
        await updateChapter(editing.id, payload);
        showToast('Chapter updated.', 'success');
      } else {
        await createChapter(payload);
        showToast('Chapter created.', 'success');
      }
      setEditing(null);
      setCreating(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save chapter.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveChapter = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= chapters.length) return;
    const ids = chapters.map((c) => c.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(targetIdx, 0, moved);
    try {
      await reorderChapters(ids);
      showToast('Chapter order updated.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChapter(deleteTarget.id);
      showToast('Chapter removed. Assigned entries remain preserved.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete chapter.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (creating || editing) {
    return (
      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e222d] pb-4">
          <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
            {editing ? 'Edit Chapter' : 'Create New Chapter'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              className="min-h-[40px] rounded-lg border border-[#2a2f3d] px-4 text-xs text-[#c8ccd4]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#c5a059] px-5 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Chapter'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#9ca1ab] mb-1.5">
                Chapter Title
              </label>
              <SinhalaTextInput
                value={title}
                onChange={setTitle}
                placeholder="e.g. Volume II — Monsoon Evenings"
                className="w-full min-h-[44px] rounded-xl border border-[#242834] bg-[#0e1015] px-4 text-base font-serif-book font-semibold text-[#f2efe9] focus:border-[#c5a059] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#9ca1ab] mb-1.5">
                Chapter Synopsis
              </label>
              <SinhalaTextInput
                multiline
                rows={2}
                value={description}
                onChange={setDescription}
                placeholder="Brief summary of this chapter…"
                className="w-full rounded-xl border border-[#242834] bg-[#0e1015] px-4 py-2.5 text-sm text-[#e8e6e3] focus:border-[#c5a059] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#9ca1ab] mb-1.5">
                Continuous Chapter Manuscript (Auto-Paginated)
              </label>
              <SinhalaUnicodeEditor value={rawContent} onChange={setRawContent} />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-[#242834] bg-[#101218] p-5 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#9ca1ab] mb-1.5">
                  Publication Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value === 'draft' ? 'draft' : 'published')
                  }
                  className="w-full min-h-[40px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
                >
                  <option value="published">Published in Book</option>
                  <option value="draft">Draft (Hidden from Readers)</option>
                </select>
              </div>

              <label className="flex items-center justify-between pt-2 border-t border-[#1e222d] cursor-pointer">
                <span className="flex items-center gap-2 text-sm text-[#e8e6e3]">
                  <Lock className="h-4 w-4 text-[#c5a059]" />
                  <span>Seal Chapter</span>
                </span>
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="h-4 w-4 accent-[#c5a059]"
                />
              </label>

              {isSecret && (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    placeholder="Chapter passkey"
                    className="w-full min-h-[38px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
                  />
                  <input
                    type="text"
                    value={securityHint}
                    onChange={(e) => setSecurityHint(e.target.value)}
                    placeholder="Optional hint"
                    className="w-full min-h-[38px] rounded-lg border border-[#262b38] bg-[#0c0e13] px-3 text-xs text-[#e8e6e3]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
            Chapters & Volumes
          </h2>
          <p className="text-xs text-[#8e929b]">
            Organize entries into volumes or write continuous auto-paginated chapters.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#c5a059] px-4 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a]"
        >
          <Plus className="h-4 w-4" />
          <span>New Chapter</span>
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#262b38] bg-[#101218] p-12 text-center">
          <BookMarked className="mx-auto h-7 w-7 text-[#c5a059] mb-2" />
          <p className="text-sm font-medium text-[#e8e6e3]">No chapters created yet</p>
          <p className="mt-1 text-xs text-[#8e929b]">
            Create volumes to group your diary entries chronologically or thematically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {chapters.map((ch, idx) => {
            const linkedCount = entries.filter((e) => e.chapterId === ch.id).length;
            const words = countWords(ch.rawContent);

            return (
              <div
                key={ch.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#242834] bg-[#101218] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#9ca1ab] tabular-nums">
                    <span>Chapter {String(idx + 1).padStart(2, '0')}</span>
                    <span>·</span>
                    <span>{ch.status === 'draft' ? 'Draft' : 'Published'}</span>
                    <span>·</span>
                    <span>{linkedCount} entries</span>
                    <span>·</span>
                    <span>{words} words</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {ch.isSecret && <Lock className="h-3.5 w-3.5 text-[#c5a059] shrink-0" />}
                    <h3 className="truncate font-serif-book text-lg font-semibold text-[#f2efe9]">
                      {ch.chapterTitle}
                    </h3>
                  </div>
                  {ch.description && (
                    <p className="mt-0.5 text-xs text-[#8e929b] line-clamp-1">
                      {ch.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveChapter(idx, -1)}
                    aria-label="Move chapter up"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#9ca1ab] hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === chapters.length - 1}
                    onClick={() => moveChapter(idx, 1)}
                    aria-label="Move chapter down"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#9ca1ab] hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(ch)}
                    aria-label="Edit chapter"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#262b38] px-3 text-xs text-[#e8e6e3] hover:border-[#c5a059]/40"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#c5a059]" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(ch)}
                    aria-label="Delete chapter"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#9ca1ab] hover:border-[#d66363]/50 hover:text-[#e07b7b]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Chapter?"
        description={`Remove "${deleteTarget?.chapterTitle}"? Any diary entries assigned to this chapter will remain safe as standalone entries.`}
        confirmLabel="Delete Chapter"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
