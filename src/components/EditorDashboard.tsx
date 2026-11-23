import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BookMarked,
  BookOpen,
  Edit3,
  FileDown,
  Image,
  LayoutDashboard,
  Lock,
  Menu,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import type { DiaryEntry } from '../types';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import { EntryEditor } from './EntryEditor';
import { ChapterManager } from './ChapterManager';
import { SettingsPanel } from './SettingsPanel';
import { MediaLibraryModal } from './MediaLibraryModal';
import { PdfExportModal } from './PdfExportModal';
import { SecretPageModal } from './SecretPageModal';
import { ConfirmDialog } from './ui/ConfirmDialog';

type DashboardTab =
  | 'overview'
  | 'entries'
  | 'chapters'
  | 'editor'
  | 'vault'
  | 'settings';

export function EditorDashboard() {
  const navigate = useNavigate();
  const {
    entries,
    chapters,
    settings,
    stats,
    media,
    lockDiary,
    updateEntry,
    deleteEntry,
    reorderEntries,
  } = useDiary();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'secret'>('all');

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [secretTarget, setSecretTarget] = useState<DiaryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiaryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...entries]
      .sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0))
      .filter((entry) => {
        if (statusFilter === 'published' && entry.status !== 'published') return false;
        if (statusFilter === 'draft' && entry.status !== 'draft') return false;
        if (statusFilter === 'secret' && !entry.isSecret) return false;
        if (!q) return true;
        return (
          entry.title.toLowerCase().includes(q) ||
          (entry.mood || '').toLowerCase().includes(q) ||
          (entry.location || '').toLowerCase().includes(q) ||
          entry.tags.some((t) => t.toLowerCase().includes(q))
        );
      });
  }, [entries, searchQuery, statusFilter]);

  const secretEntries = useMemo(() => entries.filter((e) => e.isSecret), [entries]);

  const openNewEntry = () => {
    setEditingEntry(null);
    setActiveTab('editor');
    setMobileMenuOpen(false);
  };

  const openEditEntry = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setActiveTab('editor');
    setMobileMenuOpen(false);
  };

  const togglePublish = async (entry: DiaryEntry) => {
    const nextStatus = entry.status === 'published' ? 'draft' : 'published';
    try {
      await updateEntry(entry.id, { status: nextStatus });
      showToast(
        nextStatus === 'published' ? 'Entry published to book.' : 'Entry moved to drafts.',
        'info'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const moveEntry = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= filteredEntries.length) return;
    const allSorted = [...entries].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
    const currentItem = filteredEntries[idx];
    const swapItem = filteredEntries[targetIdx];
    const ids = allSorted.map((e) => e.id);
    const posA = ids.indexOf(currentItem.id);
    const posB = ids.indexOf(swapItem.id);
    if (posA === -1 || posB === -1) return;
    [ids[posA], ids[posB]] = [ids[posB], ids[posA]];
    try {
      await reorderEntries(ids);
      showToast('Page order updated.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reorder failed.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEntry(deleteTarget.id);
      showToast('Entry permanently deleted.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const navItems: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'entries', label: 'Diary Entries', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'chapters', label: 'Chapters', icon: <BookMarked className="h-4 w-4" /> },
    { id: 'editor', label: 'Write Entry', icon: <PenLine className="h-4 w-4" /> },
    { id: 'vault', label: 'Secret Vault', icon: <Shield className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#e8e6e3] flex flex-col">
      {/* Top Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[#1c1f29] bg-[#0e1015]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open studio navigation"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#242834] bg-[#141720] text-[#e8e6e3]"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-serif-title text-sm sm:text-base font-semibold tracking-wide text-[#f2efe9]">
                {settings.title} — Author Studio
              </h1>
              <p className="hidden sm:block text-[11px] text-[#8e929b]">
                {settings.authorName} · Private Archive Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMediaModalOpen(true)}
              className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#242834] bg-[#141720] px-3 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40"
            >
              <Image className="h-3.5 w-3.5 text-[#c5a059]" />
              <span>Media</span>
            </button>

            <button
              type="button"
              onClick={() => setPdfModalOpen(true)}
              className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#242834] bg-[#141720] px-3 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40"
            >
              <FileDown className="h-3.5 w-3.5 text-[#c5a059]" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/reader')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#c5a059] px-3.5 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Open Book</span>
            </button>

            <button
              type="button"
              onClick={lockDiary}
              aria-label="Lock diary"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#242834] bg-[#141720] px-3 text-xs text-[#d8d5ce] hover:border-[#d66363]/50"
            >
              <Lock className="h-3.5 w-3.5 text-[#c5a059]" />
              <span className="hidden md:inline">Seal</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'editor' && activeTab !== 'editor') {
                    setEditingEntry(null);
                  }
                  setActiveTab(item.id);
                }}
                className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3.5 text-xs font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-[#c5a059]/15 text-[#f2efe9] border border-[#c5a059]/35'
                    : 'text-[#a0a4ad] hover:bg-white/[0.04] hover:text-[#e8e6e3] border border-transparent'
                }`}
              >
                <span className={activeTab === item.id ? 'text-[#c5a059]' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="rounded-xl border border-[#20242f] bg-[#101218] p-4 space-y-2 text-xs">
            <p className="font-medium text-[#f2efe9] tabular-nums">
              {stats.totalWords.toLocaleString()} inscribed words
            </p>
            <p className="text-[#8e929b] tabular-nums">
              {stats.published} published · {stats.drafts} drafts · {media.length} media
            </p>
          </div>
        </aside>

        {/* Main Studio Workspace */}
        <main className="min-w-0 flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif-title text-xl font-semibold text-[#f2efe9]">
                    Archive Overview
                  </h2>
                  <p className="text-xs text-[#8e929b]">
                    Manage chapters, entries, secret leaves, and print editions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewEntry}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#c5a059] px-4 text-xs font-semibold text-[#0c0e13] hover:bg-[#d4b06a]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Write New Entry</span>
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Entries', value: stats.totalEntries },
                  { label: 'Published Leaves', value: stats.published },
                  { label: 'Chapters', value: chapters.length },
                  { label: 'Total Words', value: stats.totalWords.toLocaleString() },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-[#242834] bg-[#101218] p-5"
                  >
                    <p className="text-[11px] uppercase tracking-wider text-[#8e929b]">
                      {card.label}
                    </p>
                    <p className="mt-2 font-serif-title text-2xl font-semibold text-[#f2efe9] tabular-nums">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#242834] bg-[#101218] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif-title text-base font-semibold text-[#f2efe9]">
                    Recent Diary Entries
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('entries')}
                    className="text-xs text-[#c5a059] hover:underline"
                  >
                    View All
                  </button>
                </div>

                {entries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#8e929b]">
                    Begin your journal by writing your first entry.
                  </p>
                ) : (
                  <div className="divide-y divide-[#1c202b]">
                    {entries.slice(0, 5).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {entry.isSecret && <Lock className="h-3.5 w-3.5 text-[#c5a059]" />}
                            <p className="truncate font-serif-book text-base font-semibold text-[#f2efe9]">
                              {entry.title}
                            </p>
                          </div>
                          <p className="text-xs text-[#8e929b] tabular-nums">
                            {entry.date} · {entry.status === 'published' ? 'Published' : 'Draft'}
                            {entry.mood ? ` · ${entry.mood}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditEntry(entry)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#262b38] px-3 text-xs text-[#e8e6e3] hover:border-[#c5a059]/40"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#c5a059]" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'entries' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
                  All Diary Entries
                </h2>
                <button
                  type="button"
                  onClick={openNewEntry}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#c5a059] px-4 text-xs font-semibold text-[#0c0e13]"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Entry</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e929b]" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by title, mood, location, or tag…"
                    className="w-full min-h-[42px] rounded-lg border border-[#242834] bg-[#101218] pl-10 pr-4 text-xs text-[#f2efe9] focus:border-[#c5a059] focus:outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="min-h-[42px] rounded-lg border border-[#242834] bg-[#101218] px-3.5 text-xs text-[#e8e6e3]"
                >
                  <option value="all">All Entries ({entries.length})</option>
                  <option value="published">Published ({stats.published})</option>
                  <option value="draft">Drafts ({stats.drafts})</option>
                  <option value="secret">Secret Vault ({secretEntries.length})</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#242834] bg-[#101218] p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-[#8e929b] tabular-nums">
                        <span>#{entry.pageOrder}</span>
                        <span>·</span>
                        <span>{entry.date}</span>
                        <span>·</span>
                        <span>{entry.status === 'published' ? 'Published' : 'Draft'}</span>
                        {entry.mood && (
                          <>
                            <span>·</span>
                            <span>{entry.mood}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {entry.isSecret && <Lock className="h-3.5 w-3.5 text-[#c5a059]" />}
                        <h3 className="truncate font-serif-book text-lg font-semibold text-[#f2efe9]">
                          {entry.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveEntry(idx, -1)}
                        aria-label="Move entry up"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#9ca1ab] hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === filteredEntries.length - 1}
                        onClick={() => moveEntry(idx, 1)}
                        aria-label="Move entry down"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#9ca1ab] hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePublish(entry)}
                        className="inline-flex h-9 items-center rounded-lg border border-[#262b38] px-3 text-xs text-[#d8d5ce] hover:border-[#c5a059]/40"
                      >
                        {entry.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSecretTarget(entry)}
                        aria-label="Configure secret lock"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#c5a059]"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditEntry(entry)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#262b38] px-3 text-xs text-[#f2efe9] hover:border-[#c5a059]/40"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-[#c5a059]" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        aria-label="Delete entry"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#262b38] text-[#9ca1ab] hover:border-[#d66363]/50 hover:text-[#e07b7b]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chapters' && <ChapterManager />}

          {activeTab === 'editor' && (
            <EntryEditor
              entry={editingEntry}
              onSaved={() => setActiveTab('entries')}
              onCancel={() => setActiveTab('entries')}
            />
          )}

          {activeTab === 'vault' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif-title text-lg font-semibold text-[#f2efe9]">
                  Private Secret Vault
                </h2>
                <p className="text-xs text-[#8e929b]">
                  Passkey-protected leaves are redacted server-side for guest readers until verified.
                </p>
              </div>
              {secretEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#262b38] bg-[#101218] p-12 text-center">
                  <Shield className="mx-auto h-7 w-7 text-[#c5a059] mb-2" />
                  <p className="text-sm text-[#e8e6e3]">No sealed entries yet</p>
                  <p className="mt-1 text-xs text-[#8e929b]">
                    Use the lock icon on any entry to seal it with a private passkey.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {secretEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#242834] bg-[#101218] p-4"
                    >
                      <div>
                        <p className="font-serif-book text-base font-semibold text-[#f2efe9]">
                          {entry.title}
                        </p>
                        <p className="text-xs text-[#8e929b]">
                          Hint: {entry.securityHint || entry.secretHint || 'None'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSecretTarget(entry)}
                          className="min-h-[38px] rounded-lg border border-[#262b38] px-3.5 text-xs text-[#e8e6e3]"
                        >
                          Manage Key
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditEntry(entry)}
                          className="min-h-[38px] rounded-lg bg-[#c5a059] px-3.5 text-xs font-semibold text-[#0c0e13]"
                        >
                          Open Editor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && <SettingsPanel />}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex bg-black/75 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-72 border-r border-[#232734] bg-[#101218] p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1e222d]">
              <span className="font-serif-title text-sm font-semibold text-[#f2efe9]">
                Author Studio
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-[#8e929b]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3.5 text-xs font-medium ${
                    activeTab === item.id
                      ? 'bg-[#c5a059]/15 text-[#f2efe9]'
                      : 'text-[#a0a4ad]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setMediaModalOpen(true);
                }}
                className="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3.5 text-xs font-medium text-[#a0a4ad]"
              >
                <Image className="h-4 w-4" />
                <span>Media Archive</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPdfModalOpen(true);
                }}
                className="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3.5 text-xs font-medium text-[#a0a4ad]"
              >
                <FileDown className="h-4 w-4" />
                <span>Export PDF</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      <MediaLibraryModal open={mediaModalOpen} onClose={() => setMediaModalOpen(false)} />
      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        entries={entries}
        settings={settings}
      />
      <SecretPageModal
        open={Boolean(secretTarget)}
        targetTitle={secretTarget?.title || ''}
        initialIsSecret={Boolean(secretTarget?.isSecret)}
        initialKey={secretTarget?.securityKey || secretTarget?.secretPasscode || ''}
        initialHint={secretTarget?.securityHint || secretTarget?.secretHint || ''}
        onSave={async (payload) => {
          if (!secretTarget) return;
          await updateEntry(secretTarget.id, {
            isSecret: payload.isSecret,
            securityKey: payload.securityKey,
            securityHint: payload.securityHint,
            secretPasscode: payload.securityKey,
            secretHint: payload.securityHint,
          });
          showToast(
            payload.isSecret ? 'Leaf sealed with passkey.' : 'Passkey seal removed.',
            'success'
          );
        }}
        onClose={() => setSecretTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Diary Entry?"
        description={`Permanently delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Entry"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
