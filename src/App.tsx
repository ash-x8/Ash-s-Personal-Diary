import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { soundService } from './services/sound';
import { ClosedBookAccess } from './components/ClosedBookAccess';
import { BookReader } from './components/BookReader';
import { EditorDashboard } from './components/EditorDashboard';
import {
  AuthSession,
  DashboardStats,
  DiaryEntry,
  DiarySettings,
  MediaItem,
  UserRole
} from './types';
import { BookOpen } from 'lucide-react';

export function App() {
  const [session, setSession] = useState<AuthSession>({ authenticated: false });
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeView, setActiveView] = useState<'closed-book' | 'reader' | 'editor' | 'preview'>('closed-book');
  
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
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
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Initialize session and book data
  useEffect(() => {
    const initApp = async () => {
      try {
        // Check active session
        const currentSession = await api.getSession();
        setSession(currentSession);

        // Fetch settings
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

  // Cross-device synchronization: Listen for focus, visibility change, and periodic polling
  useEffect(() => {
    const syncData = async () => {
      try {
        const curSession = await api.getSession();
        if (curSession.authenticated && curSession.role) {
          await loadDataForRole(curSession.role);
        }
      } catch (e) {
        console.warn('Sync check skipped:', e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncData();
      }
    };

    const handleFocus = () => {
      syncData();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Poll every 10 seconds when tab is visible to sync cross-device updates automatically
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncData();
      }
    }, 10000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollInterval);
    };
  }, [session.authenticated, session.role]);

  const loadDataForRole = async (role: UserRole) => {
    try {
      const entryList = await api.getEntries();
      setEntries(entryList);

      if (role === 'EDITOR') {
        const [dashboardStats, mediaList] = await Promise.all([
          api.getStats(),
          api.getMedia()
        ]);
        setStats(dashboardStats);
        setMedia(mediaList);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error loading diary records.');
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
    } catch {
      // Continue cleanup
    }
    setSession({ authenticated: false });
    setActiveView('closed-book');
  };

  // CRUD actions for Editor
  const handleSaveEntry = async (entryData: Partial<DiaryEntry>, _publish: boolean, existingId?: string): Promise<DiaryEntry> => {
    let saved: DiaryEntry;
    if (existingId) {
      saved = await api.updateEntry(existingId, entryData);
    } else {
      saved = await api.createEntry(entryData);
    }
    if (session.role) {
      await loadDataForRole(session.role);
    }
    return saved;
  };

  const handleDeleteEntry = async (id: string) => {
    await api.deleteEntry(id);
    if (session.role) {
      await loadDataForRole(session.role);
    }
  };

  const handleReorderEntries = async (order: { id: string; pageOrder: number }[]) => {
    await api.reorderEntries(order);
    if (session.role) {
      await loadDataForRole(session.role);
    }
  };

  const handleSaveSettings = async (updates: Partial<DiarySettings>) => {
    const updated = await api.updateSettings(updates);
    setSettings(updated);
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

  // Loading Screen (Requirement 29)
  if (isInitializing) {
    return (
      <div 
        id="app-loading-screen"
        className="min-h-screen w-full flex flex-col items-center justify-center bg-[#07070a] text-[#f4eedf] p-4 select-none"
      >
        <div className="w-12 h-12 rounded-full border border-[#d4af37]/40 flex items-center justify-center mb-5 animate-pulse">
          <BookOpen className="w-6 h-6 text-[#d4af37]" />
        </div>
        <h2 className="font-cinzel text-lg tracking-[0.25em] uppercase text-[#e8c872]">
          Opening your diary…
        </h2>
        <p className="font-serif-book italic text-xs text-[#8c8577] mt-1.5">
          Retrieving private pages
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
          entries={entries}
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
          entries={entries}
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
