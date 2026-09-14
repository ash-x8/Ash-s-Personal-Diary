import React, { useState, useEffect, useMemo } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { api } from './services/api';
import { soundService } from './services/sound';
import {
  db,
  subscribeToPublishedEntries,
  subscribeToAllEntries,
  subscribeToDiaryChapters,
  subscribeToSettings,
  subscribeToMedia,
  saveEntryToFirestore,
  saveChapterToFirestore,
  deleteEntryFromFirestore,
  deleteChapterFromFirestore,
  reorderEntriesInFirestore,
  reorderChaptersInFirestore,
  saveSettingsToFirestore,
  fetchPublishedEntriesFromFirestore,
  fetchAllEntriesFromFirestore,
  fetchPublishedChaptersFromFirestore,
  fetchAllChaptersFromFirestore,
  handleAddPage
} from './services/firebase';
import { ClosedBookAccess } from './components/ClosedBookAccess';
import { BookReader } from './components/BookReader';
import { EditorDashboard } from './components/EditorDashboard';
import {
  AuthSession,
  DashboardStats,
  DiaryEntry,
  DiaryChapter,
  DiarySettings,
  MediaItem,
  UserRole
} from './types';
import { paginateAllChapters } from './utils/pagination';

export function App() {
  const [session, setSession] = useState<AuthSession>({ authenticated: false });
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeView, setActiveView] = useState<'closed-book' | 'reader' | 'editor' | 'preview'>('closed-book');
  
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [chapters, setChapters] = useState<DiaryChapter[]>([]);
  const [settings, setSettings] = useState<DiarySettings>({
    title: "Ash's Personal Diary",
    subtitle: "Private Journal",
    coverText: "ASH'S PERSONAL DIARY",
    authorName: "ASH-X8",
    paperColor: "classic",
    typography: "garamond",
    soundEnabled: true,
    twoPageMode: true,
    mobileSwipeEnabled: true,
    theme: "dark",
    readingWidth: "normal",
    pageAnimationSpeed: "normal",
    autoPageTurn: false,
    readerAccessEnabled: true,
    editorAccessEnabled: true,
    wordsPerPage: 100,
    lastUpdated: new Date().toISOString()
  });

  const [stats, setStats] = useState<DashboardStats>({
    totalEntries: 0,
    published: 0,
    drafts: 0,
    thisMonth: 0,
    totalPages: 0,
    lastUpdated: ''
  });

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Dynamic pagination engine: Convert continuous chapters to paginated book reader leaves
  const effectiveReaderEntries: DiaryEntry[] = useMemo(() => {
    if (chapters.length > 0) {
      const { pages } = paginateAllChapters(chapters, settings.wordsPerPage || 100);
      return pages.map((page, idx) => ({
        id: page.id,
        title: page.pageIndex === 0 ? page.chapterTitle : `${page.chapterTitle} (Part ${page.pageIndex + 1})`,
        slug: page.id,
        content: page.content,
        date: page.date,
        mood: page.mood,
        location: page.location,
        tags: page.tags || [],
        coverImage: page.coverImage,
        gallery: page.gallery || [],
        status: page.status,
        pageOrder: idx + 1,
        customPageNumber: idx + 1,
        isSecret: page.isSecret,
        securityKey: page.securityKey,
        securityHint: page.securityHint,
        secretPasscode: page.securityKey,
        createdAt: page.date,
        updatedAt: page.date,
        chapterId: page.chapterId
      }));
    }
    return entries;
  }, [chapters, entries, settings.wordsPerPage]);

  // Initialize session and book data
  useEffect(() => {
    const initApp = async () => {
      try {
        const currentSession = await api.getSession();
        setSession(currentSession);

        const loadedSettings = await api.getSettings();
        setSettings(loadedSettings);
        soundService.setEnabled(loadedSettings.soundEnabled !== false);

        if (currentSession.authenticated && currentSession.role) {
          await loadDataForRole(currentSession.role);
          setActiveView(currentSession.role === 'EDITOR' ? 'editor' : 'reader');
        } else {
          setActiveView('closed-book');
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();
  }, []);

  // Real-time Firestore Synchronization across all devices (onSnapshot)
  useEffect(() => {
    if (!session.authenticated || !session.role) {
      setIsLiveConnected(false);
      return;
    }

    // 1. Live settings subscription
    const unsubSettings = subscribeToSettings((liveSettings) => {
      setSettings((prev) => ({ ...prev, ...liveSettings }));
      if (liveSettings.soundEnabled !== undefined) {
        soundService.setEnabled(liveSettings.soundEnabled);
      }
      setIsLiveConnected(true);
    });

    // 2. Live chapters subscription
    const unsubChapters = subscribeToDiaryChapters(
      (liveChapters) => {
        if (liveChapters && liveChapters.length > 0) {
          setChapters(liveChapters);
          setIsLiveConnected(true);
        }
      },
      session.role === 'READER'
    );

    // 3. Live entries subscription (fallback / companion)
    let unsubEntries: () => void;
    if (session.role === 'EDITOR') {
      unsubEntries = subscribeToAllEntries((liveEntries) => {
        setEntries(liveEntries);
        setIsLiveConnected(true);
        setStats((prev) => ({
          ...prev,
          totalEntries: liveEntries.length,
          published: liveEntries.filter(e => e.status === 'published').length,
          drafts: liveEntries.filter(e => e.status === 'draft').length,
          totalPages: liveEntries.length,
          lastUpdated: new Date().toISOString()
        }));
      });
    } else {
      unsubEntries = subscribeToPublishedEntries((liveEntries) => {
        setEntries(liveEntries);
        setIsLiveConnected(true);
      });
    }

    // 4. Live media subscription (for Editor)
    let unsubMedia: (() => void) | undefined;
    if (session.role === 'EDITOR') {
      unsubMedia = subscribeToMedia((liveMedia) => {
        setMedia(liveMedia);
      });
    }

    // 5. Background visibility sync check for offline/reconnect resiliency
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session.role) {
        loadDataForRole(session.role);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      unsubSettings();
      unsubChapters();
      if (unsubEntries) unsubEntries();
      if (unsubMedia) unsubMedia();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [session.authenticated, session.role]);

  const loadDataForRole = async (role: UserRole) => {
    try {
      if (role === 'READER') {
        const [firestoreChapters, firestoreEntries] = await Promise.all([
          fetchPublishedChaptersFromFirestore().catch(() => []),
          fetchPublishedEntriesFromFirestore().catch(() => [])
        ]);
        if (firestoreChapters.length > 0) setChapters(firestoreChapters);
        if (firestoreEntries.length > 0) setEntries(firestoreEntries);
      } else {
        const [firestoreChapters, firestoreEntries] = await Promise.all([
          fetchAllChaptersFromFirestore().catch(() => []),
          fetchAllEntriesFromFirestore().catch(() => [])
        ]);
        if (firestoreChapters.length > 0) setChapters(firestoreChapters);
        if (firestoreEntries.length > 0) setEntries(firestoreEntries);

        setStats((prev) => ({
          ...prev,
          totalEntries: firestoreEntries.length,
          published: firestoreEntries.filter(e => e.status === 'published').length,
          drafts: firestoreEntries.filter(e => e.status === 'draft').length,
          totalPages: firestoreEntries.length,
          lastUpdated: new Date().toISOString()
        }));

        const [dashboardStats, mediaList] = await Promise.all([
          api.getStats().catch(() => ({
            totalEntries: firestoreEntries.length,
            published: firestoreEntries.filter(e => e.status === 'published').length,
            drafts: firestoreEntries.filter(e => e.status === 'draft').length,
            thisMonth: firestoreEntries.length,
            totalPages: firestoreEntries.length,
            lastUpdated: new Date().toISOString()
          })),
          api.getMedia().catch(() => [])
        ]);
        if (dashboardStats) setStats(dashboardStats);
        if (mediaList) setMedia(mediaList);
      }
    } catch (err: any) {
      console.warn('Error loading diary records from Firestore:', err);
    }
  };

  // Handle access code unlock from Closed Book
  const handleUnlockCode = async (code: string) => {
    const res = await api.unlock(code);
    setSession({ authenticated: true, role: res.role });
    await loadDataForRole(res.role);
    return res;
  };

  const handleUnlockSuccess = (role: UserRole) => {
    if (role === 'EDITOR') {
      setActiveView('editor');
    } else {
      setActiveView('reader');
    }
  };

  // Lock diary / logout back to closed book
  const handleLockDiary = async () => {
    try {
      await api.lock();
    } catch {}
    setSession({ authenticated: false });
    setActiveView('closed-book');
  };

  // CRUD actions for Editor - saves directly to Cloud Firestore
  const handleSaveEntry = async (entryData: Partial<DiaryEntry>, publish: boolean, existingId?: string): Promise<DiaryEntry> => {
    // 1. Direct write to Cloud Firestore entry collection
    const saved = await saveEntryToFirestore(entryData, existingId);

    // 2. Also mirror to diary_chapters for continuous pagination
    await saveChapterToFirestore(
      {
        chapterTitle: entryData.title || 'Untitled Chapter',
        rawContent: entryData.content || '',
        date: entryData.date,
        status: entryData.status || (publish ? 'published' : 'draft'),
        order: entryData.pageOrder || 1,
        mood: entryData.mood,
        location: entryData.location,
        tags: entryData.tags,
        coverImage: entryData.coverImage,
        gallery: entryData.gallery,
        isSecret: entryData.isSecret,
        securityKey: entryData.securityKey,
        securityHint: entryData.securityHint
      },
      existingId || saved.id
    ).catch(() => {});

    // 3. Sync to API / local cache in background
    try {
      if (existingId) {
        await api.updateEntry(existingId, entryData);
      } else {
        await api.createEntry(entryData);
      }
    } catch (err) {
      console.warn('API sync deferred:', err);
    }

    // 4. Update local state immediately for instant feedback
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
    });

    return saved;
  };

  const handleDeleteEntry = async (id: string) => {
    // Delete from Firestore diary_pages and diary_chapters
    try {
      await deleteDoc(doc(db, "diary_pages", id));
      await deleteDoc(doc(db, "entries", id)).catch(() => {});
      await deleteDoc(doc(db, "diary_chapters", id)).catch(() => {});
    } catch (error) {
      console.error("Error deleting entry from Firestore:", error);
    }
    await deleteEntryFromFirestore(id).catch(() => {});
    await deleteChapterFromFirestore(id).catch(() => {});

    try {
      await api.deleteEntry(id);
    } catch {}

    setEntries((prev) => prev.filter((e) => e.id !== id));
    setChapters((prev) => prev.filter((c) => c.id !== id));
  };

  const handleReorderEntries = async (order: { id: string; pageOrder: number }[]) => {
    await reorderEntriesInFirestore(order);
    await reorderChaptersInFirestore(order.map(o => ({ id: o.id, order: o.pageOrder }))).catch(() => {});

    try {
      await api.reorderEntries(order);
    } catch {}

    setEntries((prev) => {
      const orderMap = new Map(order.map((o) => [o.id, o.pageOrder]));
      return [...prev]
        .map((e) => ({ ...e, pageOrder: orderMap.get(e.id) ?? e.pageOrder }))
        .sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
    });
  };

  const handleSaveSettings = async (updates: Partial<DiarySettings>) => {
    await saveSettingsToFirestore(updates);

    try {
      await api.updateSettings(updates);
    } catch {}

    setSettings((prev) => ({ ...prev, ...updates }));
    if (updates.soundEnabled !== undefined) {
      soundService.setEnabled(updates.soundEnabled);
    }
  };

  const handleUploadMedia = async (file: File) => {
    const item = await api.uploadMedia(file);
    setMedia([item, ...media]);
    return item;
  };

  const handleDeleteMedia = async (id: string) => {
    await api.deleteMedia(id);
    setMedia(media.filter(m => m.id !== id));
  };

  // Loading Screen
  if (isInitializing) {
    return (
      <div 
        id="app-loading-screen"
        className="min-h-screen w-full flex flex-col items-center justify-center bg-[#07070a] text-[#f4eedf] p-4 select-none"
      >
        <div className="w-16 h-16 rounded-full border border-[#d4af37]/60 overflow-hidden shadow-2xl mb-5 animate-pulse bg-black ring-2 ring-[#d4af37]/20">
          <img
            src="/logo.png"
            alt="Ash's Personal Diary Logo"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="font-cinzel text-lg tracking-[0.25em] uppercase text-[#e8c872]">
          Opening your diary…
        </h2>
        <p className="font-serif-book italic text-xs text-[#8c8577] mt-1.5">
          Retrieving private chapters & pages
        </p>
      </div>
    );
  }

  return (
    <div id="ash-diary-app-root" className="min-h-screen bg-[#07070a] text-[#f4eedf] antialiased">
      {/* View 1: Closed Book Access Vault */}
      {activeView === 'closed-book' && (
        <ClosedBookAccess
          onUnlock={handleUnlockSuccess}
          unlockApi={handleUnlockCode}
          bookTitle={settings.coverText || settings.title}
          bookSubtitle={settings.subtitle}
          authorName={settings.authorName}
        />
      )}

      {/* View 2: Digital Book Reader (Reader Mode) */}
      {activeView === 'reader' && (
        <BookReader
          entries={effectiveReaderEntries}
          settings={settings}
          onLockDiary={handleLockDiary}
          onUpdateSettings={handleSaveSettings}
        />
      )}

      {/* View 3: Editor Dashboard CMS (Editor Mode) */}
      {activeView === 'editor' && (
        <EditorDashboard
          entries={entries}
          settings={settings}
          stats={stats}
          media={media}
          onAddPage={handleAddPage}
          onSaveEntry={handleSaveEntry}
          onDeleteEntry={handleDeleteEntry}
          onReorderEntries={handleReorderEntries}
          onSaveSettings={handleSaveSettings}
          onUploadMedia={handleUploadMedia}
          onDeleteMedia={handleDeleteMedia}
          onPreviewAsReader={() => setActiveView('preview')}
          onLockDiary={handleLockDiary}
        />
      )}

      {/* View 4: Editor Live Book Preview (Testing Mode) */}
      {activeView === 'preview' && (
        <BookReader
          entries={effectiveReaderEntries}
          settings={settings}
          onLockDiary={handleLockDiary}
          onUpdateSettings={handleSaveSettings}
          isEditorPreview={true}
          onClosePreview={() => setActiveView('editor')}
        />
      )}
    </div>
  );
}

export default App;
