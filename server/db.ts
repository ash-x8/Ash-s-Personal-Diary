import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { DiaryEntry, DiarySettings, MediaItem, DashboardStats } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase configuration from provisioned applet
const firebaseConfigPath = path.resolve(__dirname, '../firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('Error reading firebase-applet-config.json:', err);
  }
}

const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const EDITOR_SECRET_KEY = 'ash-diary-secure-editor-session-2026';

/**
 * Strips undefined values to ensure compatibility with Cloud Firestore requirements
 */
function cleanFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanFirestoreData(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

const DEFAULT_SETTINGS: DiarySettings = {
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
};

class FirestoreDatabase {
  private cache: {
    entries: DiaryEntry[];
    settings: DiarySettings;
    media: MediaItem[];
    lastLoaded: number;
  } = {
    entries: [],
    settings: DEFAULT_SETTINGS,
    media: [],
    lastLoaded: 0
  };

  constructor() {
    this.refreshCache().catch((err) => {
      console.warn('Initial Firestore cache load warning:', err.message);
    });
  }

  public async refreshCache(): Promise<void> {
    try {
      // 1. Fetch entries from Firestore
      const entriesSnap = await getDocs(collection(firestore, 'diary_pages'));
      const loadedEntries: DiaryEntry[] = [];
      entriesSnap.forEach((d) => {
        const data = d.data();
        if (!['entry-01', 'entry-02', 'entry-03', 'entry-04', 'entry-05'].includes(d.id)) {
          loadedEntries.push({
            id: d.id,
            title: data.title || 'Untitled',
            slug: data.slug || d.id,
            content: data.content || '',
            date: data.date || '',
            mood: data.mood,
            location: data.location,
            tags: Array.isArray(data.tags) ? data.tags : [],
            coverImage: data.coverImage,
            gallery: Array.isArray(data.gallery) ? data.gallery : [],
            status: data.status === 'draft' ? 'draft' : 'published',
            pageOrder: Number(data.pageOrder) || 1,
            customPageNumber: data.customPageNumber ? Number(data.customPageNumber) : undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            publishedAt: data.publishedAt
          });
        }
      });

      this.cache.entries = loadedEntries.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));

      // 2. Fetch settings from Firestore
      const settingsSnap = await getDoc(doc(firestore, 'settings', 'general'));
      if (settingsSnap.exists()) {
        this.cache.settings = { ...DEFAULT_SETTINGS, ...(settingsSnap.data() as DiarySettings) };
      }

      // 3. Fetch media from Firestore
      const mediaSnap = await getDocs(collection(firestore, 'media'));
      const loadedMedia: MediaItem[] = [];
      mediaSnap.forEach((d) => {
        loadedMedia.push(d.data() as MediaItem);
      });
      this.cache.media = loadedMedia.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      this.cache.lastLoaded = Date.now();
    } catch (err) {
      console.error('Error refreshing Firestore cache:', err);
    }
  }

  // Entries
  public async getEntries(includeDrafts = false): Promise<DiaryEntry[]> {
    // If cache is older than 5 seconds, refresh asynchronously
    if (Date.now() - this.cache.lastLoaded > 5000) {
      await this.refreshCache();
    }
    return this.cache.entries
      .filter((e) => includeDrafts || e.status === 'published')
      .sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  }

  public async getEntry(id: string, includeDrafts = false): Promise<DiaryEntry | undefined> {
    if (Date.now() - this.cache.lastLoaded > 5000) {
      await this.refreshCache();
    }
    const entry = this.cache.entries.find((e) => e.id === id || e.slug === id);
    if (!entry) return undefined;
    if (!includeDrafts && entry.status !== 'published') return undefined;
    return entry;
  }

  public async createEntry(
    entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'slug'>
  ): Promise<DiaryEntry> {
    const id = `entry-${Date.now()}`;
    const slug =
      entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `entry-${id}`;

    const now = new Date().toISOString();
    const newEntry: DiaryEntry = {
      ...entry,
      id,
      slug,
      pageOrder: entry.pageOrder || this.cache.entries.length + 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: entry.status === 'published' ? now : undefined
    };

    // Save directly to Firestore (both diary_pages and entries collections for maximum backward and forward compatibility)
    const pageDocRef = doc(firestore, 'diary_pages', id);
    const legacyDocRef = doc(firestore, 'entries', id);
    const cleanedPayload = cleanFirestoreData({
      ...newEntry,
      _editorKey: EDITOR_SECRET_KEY
    });
    await Promise.allSettled([
      setDoc(pageDocRef, cleanedPayload),
      setDoc(legacyDocRef, cleanedPayload)
    ]);

    // Update settings lastUpdated in Firestore to trigger real-time notification
    await updateDoc(doc(firestore, 'settings', 'general'), {
      lastUpdated: now,
      _editorKey: EDITOR_SECRET_KEY
    }).catch(async () => {
      await setDoc(doc(firestore, 'settings', 'general'), cleanFirestoreData({
        ...this.cache.settings,
        lastUpdated: now,
        _editorKey: EDITOR_SECRET_KEY
      }));
    });

    // Update local cache
    this.cache.entries.push(newEntry);
    this.cache.entries.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
    this.cache.settings.lastUpdated = now;

    return newEntry;
  }

  public async updateEntry(id: string, updates: Partial<DiaryEntry>): Promise<DiaryEntry | undefined> {
    const existing = this.cache.entries.find((e) => e.id === id);
    const now = new Date().toISOString();

    let publishedAt = existing?.publishedAt;
    if (updates.status === 'published' && (!existing || existing.status !== 'published')) {
      publishedAt = now;
    }

    const updatedData: any = {
      ...(existing || {}),
      ...updates,
      id,
      updatedAt: now,
      publishedAt,
      _editorKey: EDITOR_SECRET_KEY
    };

    // Save directly to Firestore
    const pageDocRef = doc(firestore, 'diary_pages', id);
    const legacyDocRef = doc(firestore, 'entries', id);
    const cleanedPayload = cleanFirestoreData(updatedData);
    await Promise.allSettled([
      setDoc(pageDocRef, cleanedPayload, { merge: true }),
      setDoc(legacyDocRef, cleanedPayload, { merge: true })
    ]);

    // Update settings lastUpdated in Firestore for live ping
    await updateDoc(doc(firestore, 'settings', 'general'), {
      lastUpdated: now,
      _editorKey: EDITOR_SECRET_KEY
    }).catch(() => {});

    // Update cache
    const idx = this.cache.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.cache.entries[idx] = updatedData;
    } else {
      this.cache.entries.push(updatedData);
    }
    this.cache.entries.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
    this.cache.settings.lastUpdated = now;

    return updatedData;
  }

  public async deleteEntry(id: string): Promise<boolean> {
    try {
      await Promise.allSettled([
        deleteDoc(doc(firestore, 'diary_pages', id)),
        deleteDoc(doc(firestore, 'entries', id))
      ]);

      const now = new Date().toISOString();
      await updateDoc(doc(firestore, 'settings', 'general'), {
        lastUpdated: now,
        _editorKey: EDITOR_SECRET_KEY
      }).catch(() => {});

      this.cache.entries = this.cache.entries.filter((e) => e.id !== id);
      this.cache.settings.lastUpdated = now;
      return true;
    } catch (err) {
      console.error('Error deleting entry from Firestore:', err);
      return false;
    }
  }

  public async reorderEntries(orderMap: { id: string; pageOrder: number }[]): Promise<boolean> {
    try {
      const batch = writeBatch(firestore);
      const map = new Map(orderMap.map((o) => [o.id, o.pageOrder]));

      for (const item of orderMap) {
        batch.set(doc(firestore, 'diary_pages', item.id), {
          pageOrder: item.pageOrder,
          _editorKey: EDITOR_SECRET_KEY
        }, { merge: true });
        batch.set(doc(firestore, 'entries', item.id), {
          pageOrder: item.pageOrder,
          _editorKey: EDITOR_SECRET_KEY
        }, { merge: true });
      }
      await batch.commit();

      this.cache.entries.forEach((e) => {
        if (map.has(e.id)) {
          e.pageOrder = map.get(e.id)!;
        }
      });
      this.cache.entries.sort((a, b) => a.pageOrder - b.pageOrder);

      const now = new Date().toISOString();
      await updateDoc(doc(firestore, 'settings', 'general'), {
        lastUpdated: now,
        _editorKey: EDITOR_SECRET_KEY
      }).catch(() => {});

      return true;
    } catch (err) {
      console.error('Error reordering entries in Firestore:', err);
      return false;
    }
  }

  // Settings
  public async getSettings(): Promise<DiarySettings> {
    if (Date.now() - this.cache.lastLoaded > 5000) {
      await this.refreshCache();
    }
    return this.cache.settings;
  }

  public async updateSettings(updates: Partial<DiarySettings>): Promise<DiarySettings> {
    const now = new Date().toISOString();
    const updatedSettings: DiarySettings = {
      ...this.cache.settings,
      ...updates,
      lastUpdated: now
    };

    // Save directly to Firestore
    const docRef = doc(firestore, 'settings', 'general');
    await setDoc(docRef, cleanFirestoreData({
      ...updatedSettings,
      _editorKey: EDITOR_SECRET_KEY
    }), { merge: true });

    this.cache.settings = updatedSettings;
    return updatedSettings;
  }

  // Media
  public async getMedia(): Promise<MediaItem[]> {
    if (Date.now() - this.cache.lastLoaded > 5000) {
      await this.refreshCache();
    }
    return this.cache.media;
  }

  public async addMedia(item: MediaItem): Promise<MediaItem> {
    const docRef = doc(firestore, 'media', item.id);
    await setDoc(docRef, cleanFirestoreData({
      ...item,
      _editorKey: EDITOR_SECRET_KEY
    }));
    this.cache.media.unshift(item);
    return item;
  }

  public async deleteMedia(id: string): Promise<boolean> {
    try {
      const docRef = doc(firestore, 'media', id);
      await deleteDoc(docRef);
      this.cache.media = this.cache.media.filter((m) => m.id !== id);
      return true;
    } catch (err) {
      console.error('Error deleting media from Firestore:', err);
      return false;
    }
  }

  // Stats
  public async getStats(): Promise<DashboardStats> {
    await this.refreshCache();
    const totalEntries = this.cache.entries.length;
    const published = this.cache.entries.filter((e) => e.status === 'published').length;
    const drafts = this.cache.entries.filter((e) => e.status === 'draft').length;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = this.cache.entries.filter((e) => e.date.startsWith(currentMonth)).length;

    return {
      totalEntries,
      published,
      drafts,
      thisMonth,
      totalPages: published * 2 + 2,
      lastUpdated: this.cache.settings.lastUpdated
    };
  }
}

export const db = new FirestoreDatabase();
