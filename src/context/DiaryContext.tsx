import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AuthSession,
  DashboardStats,
  DiaryChapter,
  DiaryEntry,
  DiarySettings,
  MediaItem,
  VaultSetupStatus,
} from '../types';
import { api, clearMemorySessionToken } from '../services/api';
import {
  resolveFirebaseUserRole,
  saveChapterToFirestore,
  saveEntryToFirestore,
  saveSettingsToFirestore,
  signInWithGoogle,
  signOutFirebase,
  subscribeToAllEntries,
  subscribeToDiaryChapters,
  subscribeToFirebaseAuth,
  subscribeToMedia,
  subscribeToPublishedEntries,
  subscribeToSettings,
  testConnection,
  deleteChapterFromFirestore,
  deleteEntryFromFirestore,
  reorderChaptersInFirestore,
  reorderEntriesInFirestore,
  addFirestoreMedia,
  deleteFirestoreMedia,
} from '../services/firebase';
import { soundService } from '../services/sound';
import { countWords } from '../utils/pagination';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';

const DEFAULT_SETTINGS: DiarySettings = {
  title: "Ash's Personal Diary",
  subtitle: 'Private Journal',
  coverText: "ASH'S PERSONAL DIARY",
  authorName: 'ASH-X8',
  paperColor: 'classic',
  typography: 'garamond',
  fontSize: 'normal',
  soundEnabled: true,
  twoPageMode: true,
  mobileSwipeEnabled: true,
  theme: 'dark',
  readingWidth: 'normal',
  pageAnimationSpeed: 'normal',
  autoPageTurn: false,
  reducedMotion: false,
  readerAccessEnabled: true,
  editorAccessEnabled: true,
  wordsPerPage: 100,
  lastUpdated: new Date().toISOString(),
};

interface DiaryContextValue {
  session: AuthSession;
  setupStatus: VaultSetupStatus | null;
  authLoading: boolean;
  dataLoading: boolean;
  entries: DiaryEntry[];
  chapters: DiaryChapter[];
  settings: DiarySettings;
  media: MediaItem[];
  stats: DashboardStats;
  unlockWithPin: (pin: string) => Promise<AuthSession>;
  setupVaultPins: (editorPin: string, readerPin?: string) => Promise<AuthSession>;
  signInWithGoogleAccount: () => Promise<AuthSession>;
  lockDiary: () => Promise<void>;
  refreshData: () => Promise<void>;
  createEntry: (data: Partial<DiaryEntry>) => Promise<DiaryEntry>;
  updateEntry: (id: string, data: Partial<DiaryEntry>) => Promise<DiaryEntry>;
  deleteEntry: (id: string) => Promise<void>;
  reorderEntries: (orderedIds: string[]) => Promise<void>;
  unlockSecretEntry: (id: string, key: string) => Promise<DiaryEntry>;
  createChapter: (data: Partial<DiaryChapter>) => Promise<DiaryChapter>;
  updateChapter: (id: string, data: Partial<DiaryChapter>) => Promise<DiaryChapter>;
  deleteChapter: (id: string) => Promise<void>;
  reorderChapters: (orderedIds: string[]) => Promise<void>;
  unlockSecretChapter: (id: string, key: string) => Promise<DiaryChapter>;
  updateSettings: (updates: Partial<DiarySettings>) => Promise<DiarySettings>;
  uploadMedia: (file: File) => Promise<MediaItem>;
  deleteMedia: (id: string) => Promise<void>;
}

const DiaryContext = createContext<DiaryContextValue | null>(null);

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const { setTheme, setReducedMotion } = useTheme();
  const { showToast } = useToast();

  const [session, setSession] = useState<AuthSession>({ authenticated: false });
  const [setupStatus, setSetupStatus] = useState<VaultSetupStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [chapters, setChapters] = useState<DiaryChapter[]>([]);
  const [settings, setSettings] = useState<DiarySettings>(DEFAULT_SETTINGS);
  const [media, setMedia] = useState<MediaItem[]>([]);

  // Apply theme, sound, and reduced motion whenever settings update
  useEffect(() => {
    soundService.setEnabled(settings.soundEnabled);
    setTheme(settings.theme || 'dark');
    setReducedMotion(Boolean(settings.reducedMotion));
  }, [settings.soundEnabled, settings.theme, settings.reducedMotion, setTheme, setReducedMotion]);

  // Initial startup probe + session check
  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [statusRes, sessRes] = await Promise.all([
          api.getSetupStatus().catch(() => ({
            needsSetup: false,
            hasEnvSecrets: false,
            readerConfigured: false,
          })),
          api.getSession().catch(() => ({ authenticated: false } as AuthSession)),
        ]);

        if (!active) return;
        setSetupStatus(statusRes);

        if (sessRes.authenticated) {
          setSession(sessRes);
        }
      } finally {
        if (active) setAuthLoading(false);
      }

      // Probe Firestore connection silently on boot
      testConnection().catch(() => {});
    }

    bootstrap();

    const unsubFirebase = subscribeToFirebaseAuth(async (user) => {
      if (!active) return;
      if (user) {
        const role = await resolveFirebaseUserRole(user);
        setSession({
          authenticated: true,
          role,
          authMethod: 'firebase',
          userEmail: user.email,
          userName: user.displayName,
        });
        setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      unsubFirebase();
    };
  }, []);

  // Load entries, chapters, settings & media whenever authenticated
  const refreshData = useCallback(async () => {
    if (!session.authenticated) return;
    setDataLoading(true);
    try {
      const [loadedEntries, loadedChapters, loadedSettings] = await Promise.all([
        api.getEntries().catch(() => [] as DiaryEntry[]),
        api.getChapters().catch(() => [] as DiaryChapter[]),
        api.getSettings().catch(() => DEFAULT_SETTINGS),
      ]);
      setEntries(loadedEntries);
      setChapters(loadedChapters);
      setSettings((prev) => ({ ...prev, ...loadedSettings }));

      if (session.role === 'EDITOR') {
        const loadedMedia = await api.getMedia().catch(() => [] as MediaItem[]);
        setMedia(loadedMedia);
      }
    } finally {
      setDataLoading(false);
    }
  }, [session.authenticated, session.role]);

  useEffect(() => {
    if (!session.authenticated) {
      setEntries([]);
      setChapters([]);
      setMedia([]);
      return;
    }

    // If Firebase Auth session, attach live Firestore listeners (with graceful API fallback)
    if (session.authMethod === 'firebase') {
      const isEditor = session.role === 'EDITOR';
      setDataLoading(true);

      const unsubEntries = isEditor
        ? subscribeToAllEntries(
            (items) => {
              setEntries(items);
              setDataLoading(false);
            },
            () => setDataLoading(false)
          )
        : subscribeToPublishedEntries(
            (items) => {
              // Redact secret content cleanly if Firestore returns locked items to reader
              setEntries(
                items.map((item) =>
                  item.isSecret || item.securityKey || item.secretPasscode
                    ? {
                        ...item,
                        content: '',
                        coverImage: '',
                        gallery: [],
                        isLocked: true,
                        securityKey: undefined,
                        secretPasscode: undefined,
                      }
                    : item
                )
              );
              setDataLoading(false);
            },
            () => setDataLoading(false)
          );

      const unsubChapters = subscribeToDiaryChapters((items) => {
        setChapters(
          isEditor
            ? items
            : items.map((c) =>
                c.isSecret || c.securityKey || c.secretPasscode
                  ? {
                      ...c,
                      rawContent: '',
                      coverImage: '',
                      gallery: [],
                      isLocked: true,
                      securityKey: undefined,
                      secretPasscode: undefined,
                    }
                  : c
              )
        );
      }, !isEditor);

      const unsubSettings = subscribeToSettings((s) => {
        setSettings((prev) => ({ ...prev, ...s }));
      });

      const unsubMedia = isEditor ? subscribeToMedia((m) => setMedia(m)) : () => {};

      return () => {
        unsubEntries();
        unsubChapters();
        unsubSettings();
        unsubMedia();
      };
    } else {
      refreshData();
    }
  }, [session.authenticated, session.authMethod, session.role, refreshData]);

  const unlockWithPin = useCallback(async (pin: string) => {
    const res = await api.unlock(pin);
    const next: AuthSession = {
      authenticated: true,
      role: res.role,
      authMethod: 'pin',
    };
    setSession(next);
    soundService.playUnlock();
    return next;
  }, []);

  const setupVaultPins = useCallback(async (editorPin: string, readerPin?: string) => {
    const res = await api.setupVault(editorPin, readerPin);
    if (res.setup) setSetupStatus(res.setup);
    const next: AuthSession = {
      authenticated: true,
      role: res.role || 'EDITOR',
      authMethod: 'pin',
    };
    setSession(next);
    soundService.playUnlock();
    return next;
  }, []);

  const signInWithGoogleAccount = useCallback(async () => {
    const { user, role } = await signInWithGoogle();
    const next: AuthSession = {
      authenticated: true,
      role,
      authMethod: 'firebase',
      userEmail: user.email,
      userName: user.displayName,
    };
    setSession(next);
    soundService.playUnlock();
    return next;
  }, []);

  const lockDiary = useCallback(async () => {
    clearMemorySessionToken();
    await api.lock().catch(() => {});
    await signOutFirebase().catch(() => {});
    setSession({ authenticated: false });
    setEntries([]);
    setChapters([]);
    setMedia([]);
  }, []);

  // === Entry Mutations ===
  const createEntry = useCallback(
    async (data: Partial<DiaryEntry>) => {
      if (session.authMethod === 'firebase') {
        const created = await saveEntryToFirestore(data);
        return created;
      }
      const created = await api.createEntry(data);
      setEntries((prev) => [...prev, created].sort((a, b) => a.pageOrder - b.pageOrder));
      return created;
    },
    [session.authMethod]
  );

  const updateEntry = useCallback(
    async (id: string, data: Partial<DiaryEntry>) => {
      if (session.authMethod === 'firebase') {
        const updated = await saveEntryToFirestore(data, id);
        return updated;
      }
      const updated = await api.updateEntry(id, data);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    },
    [session.authMethod]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (session.authMethod === 'firebase') {
        await deleteEntryFromFirestore(id);
        return;
      }
      await api.deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [session.authMethod]
  );

  const reorderEntries = useCallback(
    async (orderedIds: string[]) => {
      if (session.authMethod === 'firebase') {
        await reorderEntriesInFirestore(
          orderedIds.map((id, i) => ({ id, pageOrder: i + 1 }))
        );
        return;
      }
      const updated = await api.reorderEntries(orderedIds);
      setEntries(updated);
    },
    [session.authMethod]
  );

  const unlockSecretEntry = useCallback(async (id: string, key: string) => {
    const unlocked = await api.unlockEntry(id, key);
    setEntries((prev) => prev.map((e) => (e.id === id ? unlocked : e)));
    soundService.playUnlock();
    return unlocked;
  }, []);

  // === Chapter Mutations ===
  const createChapter = useCallback(
    async (data: Partial<DiaryChapter>) => {
      if (session.authMethod === 'firebase') {
        return saveChapterToFirestore(data);
      }
      const created = await api.createChapter(data);
      setChapters((prev) => [...prev, created].sort((a, b) => (a.order || 0) - (b.order || 0)));
      return created;
    },
    [session.authMethod]
  );

  const updateChapter = useCallback(
    async (id: string, data: Partial<DiaryChapter>) => {
      if (session.authMethod === 'firebase') {
        return saveChapterToFirestore(data, id);
      }
      const updated = await api.updateChapter(id, data);
      setChapters((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [session.authMethod]
  );

  const deleteChapter = useCallback(
    async (id: string) => {
      if (session.authMethod === 'firebase') {
        await deleteChapterFromFirestore(id);
        return;
      }
      await api.deleteChapter(id);
      setChapters((prev) => prev.filter((c) => c.id !== id));
    },
    [session.authMethod]
  );

  const reorderChapters = useCallback(
    async (orderedIds: string[]) => {
      if (session.authMethod === 'firebase') {
        await reorderChaptersInFirestore(
          orderedIds.map((id, i) => ({ id, order: i + 1 }))
        );
        return;
      }
      const updated = await api.reorderChapters(orderedIds);
      setChapters(updated);
    },
    [session.authMethod]
  );

  const unlockSecretChapter = useCallback(async (id: string, key: string) => {
    const unlocked = await api.unlockChapter(id, key);
    setChapters((prev) => prev.map((c) => (c.id === id ? unlocked : c)));
    soundService.playUnlock();
    return unlocked;
  }, []);

  // === Settings & Media ===
  const updateSettings = useCallback(
    async (updates: Partial<DiarySettings>) => {
      if (session.authMethod === 'firebase') {
        await saveSettingsToFirestore(updates);
        const merged = { ...settings, ...updates, lastUpdated: new Date().toISOString() };
        setSettings(merged);
        showToast('Diary preferences saved to cloud.', 'success');
        return merged;
      }
      const updated = await api.updateSettings(updates);
      setSettings((prev) => ({ ...prev, ...updated }));
      showToast('Diary preferences updated.', 'success');
      return updated;
    },
    [session.authMethod, settings, showToast]
  );

  const uploadMedia = useCallback(
    async (file: File) => {
      if (session.authMethod === 'firebase') {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read image file.'));
          reader.readAsDataURL(file);
        });
        const item: MediaItem = {
          id: `media-${Date.now()}`,
          filename: file.name,
          url: dataUrl,
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
        };
        await addFirestoreMedia(item);
        return item;
      }
      const item = await api.uploadMedia(file);
      setMedia((prev) => [item, ...prev]);
      return item;
    },
    [session.authMethod]
  );

  const deleteMedia = useCallback(
    async (id: string) => {
      if (session.authMethod === 'firebase') {
        await deleteFirestoreMedia(id);
        return;
      }
      await api.deleteMedia(id);
      setMedia((prev) => prev.filter((m) => m.id !== id));
    },
    [session.authMethod]
  );

  const stats: DashboardStats = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const published = entries.filter((e) => e.status === 'published');
    const drafts = entries.filter((e) => e.status === 'draft');
    const thisMonth = entries.filter((e) => (e.date || e.createdAt || '').startsWith(monthPrefix));
    const secretCount =
      entries.filter((e) => e.isSecret || e.securityKey || e.secretPasscode).length +
      chapters.filter((c) => c.isSecret || c.securityKey || c.secretPasscode).length;
    const totalWords =
      entries.reduce((sum, e) => sum + countWords(e.content), 0) +
      chapters.reduce((sum, c) => sum + countWords(c.rawContent), 0);

    return {
      totalEntries: entries.length,
      published: published.length,
      drafts: drafts.length,
      secretCount,
      chaptersCount: chapters.length,
      thisMonth: thisMonth.length,
      totalPages: Math.max(published.length, chapters.length),
      totalWords,
      lastUpdated: settings.lastUpdated || now.toISOString(),
    };
  }, [entries, chapters, settings.lastUpdated]);

  return (
    <DiaryContext.Provider
      value={{
        session,
        setupStatus,
        authLoading,
        dataLoading,
        entries,
        chapters,
        settings,
        media,
        stats,
        unlockWithPin,
        setupVaultPins,
        signInWithGoogleAccount,
        lockDiary,
        refreshData,
        createEntry,
        updateEntry,
        deleteEntry,
        reorderEntries,
        unlockSecretEntry,
        createChapter,
        updateChapter,
        deleteChapter,
        reorderChapters,
        unlockSecretChapter,
        updateSettings,
        uploadMedia,
        deleteMedia,
      }}
    >
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) {
    throw new Error('useDiary must be used inside DiaryProvider');
  }
  return ctx;
}
