import fs from 'fs';
import path from 'path';
import type {
  DiaryEntry,
  DiaryChapter,
  DiarySettings,
  MediaItem,
  DashboardStats,
  UserRole,
} from '../src/types/index.ts';
import { timingSafeEqualText } from './vaultStore.ts';

export interface DatabaseSchema {
  chapters: DiaryChapter[];
  entries: DiaryEntry[];
  settings: DiarySettings;
  media: MediaItem[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'diary_database.json');

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

let memoryDb: DatabaseSchema | null = null;

function ensureInitialized(): DatabaseSchema {
  if (memoryDb) return memoryDb;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
      memoryDb = {
        chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        media: Array.isArray(parsed.media) ? parsed.media : [],
      };
      return memoryDb;
    }
  } catch {
    // Fallback to empty schema if file cannot be read
  }

  memoryDb = {
    chapters: [],
    entries: [],
    settings: { ...DEFAULT_SETTINGS },
    media: [],
  };
  return memoryDb;
}

function readDb(): DatabaseSchema {
  return ensureInitialized();
}

function writeDb(data: DatabaseSchema): void {
  memoryDb = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Read-only / ephemeral host: keep updated data in memory
  }
}

function countWordsSimple(htmlOrText: string): number {
  if (!htmlOrText) return 0;
  const clean = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function sanitizeEntryForRole(
  entry: DiaryEntry,
  role: UserRole | undefined,
  unlockedIds: Set<string> = new Set()
): DiaryEntry {
  if (role === 'EDITOR') {
    return {
      ...entry,
      isLocked: false,
    };
  }

  const secretKeyValue = (entry.securityKey || entry.secretPasscode || '').trim();
  const isSecret = Boolean(entry.isSecret || secretKeyValue);
  const isUnlocked = unlockedIds.has(entry.id);

  // Strip raw secret key/passcode from READER responses unconditionally
  const { securityKey: _sk, secretPasscode: _sp, ...safeBase } = entry;

  if (isSecret && !isUnlocked) {
    return {
      ...safeBase,
      content: '',
      coverImage: '',
      gallery: [],
      isSecret: true,
      isLocked: true,
      securityHint: entry.securityHint || entry.secretHint,
    };
  }

  return {
    ...safeBase,
    isSecret,
    isLocked: false,
    securityHint: entry.securityHint || entry.secretHint,
  };
}

export function sanitizeChapterForRole(
  chapter: DiaryChapter,
  role: UserRole | undefined,
  unlockedIds: Set<string> = new Set()
): DiaryChapter {
  if (role === 'EDITOR') {
    return {
      ...chapter,
      isLocked: false,
    };
  }

  const secretKeyValue = (chapter.securityKey || chapter.secretPasscode || '').trim();
  const isSecret = Boolean(chapter.isSecret || secretKeyValue);
  const isUnlocked = unlockedIds.has(chapter.id);

  const { securityKey: _sk, secretPasscode: _sp, ...safeBase } = chapter;

  if (isSecret && !isUnlocked) {
    return {
      ...safeBase,
      rawContent: '',
      coverImage: '',
      gallery: [],
      isSecret: true,
      isLocked: true,
      securityHint: chapter.securityHint || chapter.secretHint,
    };
  }

  return {
    ...safeBase,
    isSecret,
    isLocked: false,
    securityHint: chapter.securityHint || chapter.secretHint,
  };
}

export const dbService = {
  // === Chapters ===
  getChapters(
    includeDrafts = false,
    role: UserRole = 'READER',
    unlockedIds: Set<string> = new Set()
  ): DiaryChapter[] {
    const db = readDb();
    let list = [...db.chapters];
    if (!includeDrafts) {
      list = list.filter((c) => (c.status || 'published') === 'published');
    }
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return list.map((c) => sanitizeChapterForRole(c, role, unlockedIds));
  },

  getRawChapterById(id: string): DiaryChapter | undefined {
    const db = readDb();
    return db.chapters.find((c) => c.id === id);
  },

  createChapter(
    data: Partial<DiaryChapter> & { chapterTitle: string }
  ): DiaryChapter {
    const db = readDb();
    const now = new Date().toISOString();
    const maxOrder = db.chapters.reduce((max, c) => Math.max(max, c.order || 0), 0);

    const newChapter: DiaryChapter = {
      id: data.id || `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chapterTitle: data.chapterTitle || 'Untitled Chapter',
      description: data.description || '',
      rawContent: data.rawContent || '',
      date: data.date || now.split('T')[0],
      mood: data.mood || '',
      location: data.location || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      coverImage: data.coverImage || '',
      gallery: Array.isArray(data.gallery) ? data.gallery : [],
      status: data.status || 'draft',
      order: typeof data.order === 'number' ? data.order : maxOrder + 1,
      isSecret: Boolean(data.isSecret),
      securityKey: data.securityKey || data.secretPasscode || '',
      securityHint: data.securityHint || data.secretHint || '',
      createdAt: now,
      updatedAt: now,
    };

    db.chapters.push(newChapter);
    writeDb(db);
    return newChapter;
  },

  updateChapter(id: string, updates: Partial<DiaryChapter>): DiaryChapter | null {
    const db = readDb();
    const idx = db.chapters.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const existing = db.chapters[idx];
    const updated: DiaryChapter = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    db.chapters[idx] = updated;
    writeDb(db);
    return updated;
  },

  deleteChapter(id: string): boolean {
    const db = readDb();
    const next = db.chapters.filter((c) => c.id !== id);
    if (next.length === db.chapters.length) return false;
    db.chapters = next;
    // Unassign entries from deleted chapter without deleting the entries themselves
    db.entries = db.entries.map((e) => (e.chapterId === id ? { ...e, chapterId: undefined } : e));
    writeDb(db);
    return true;
  },

  reorderChapters(orderedIds: string[]): DiaryChapter[] {
    const db = readDb();
    const idMap = new Map<string, number>();
    orderedIds.forEach((cid, i) => idMap.set(cid, i + 1));

    db.chapters = db.chapters.map((c) => {
      const order = idMap.get(c.id);
      return order !== undefined ? { ...c, order, updatedAt: new Date().toISOString() } : c;
    });
    db.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    writeDb(db);
    return db.chapters;
  },

  verifyChapterSecretKey(id: string, candidateKey: string): DiaryChapter | null {
    const chapter = this.getRawChapterById(id);
    if (!chapter) return null;
    const expected = (chapter.securityKey || chapter.secretPasscode || '').trim();
    if (!expected) return chapter;
    if (!timingSafeEqualText(candidateKey.trim(), expected)) {
      return null;
    }
    return chapter;
  },

  // === Entries ===
  getEntries(
    includeDrafts = false,
    role: UserRole = 'READER',
    unlockedIds: Set<string> = new Set()
  ): DiaryEntry[] {
    const db = readDb();
    let entries = [...db.entries];
    if (!includeDrafts) {
      entries = entries.filter((e) => e.status === 'published');
    }
    entries.sort((a, b) => a.pageOrder - b.pageOrder);
    return entries.map((e) => sanitizeEntryForRole(e, role, unlockedIds));
  },

  getRawEntryById(id: string): DiaryEntry | undefined {
    const db = readDb();
    return db.entries.find((e) => e.id === id);
  },

  getEntryById(
    id: string,
    role: UserRole = 'READER',
    unlockedIds: Set<string> = new Set()
  ): DiaryEntry | undefined {
    const entry = this.getRawEntryById(id);
    if (!entry) return undefined;
    if (role !== 'EDITOR' && entry.status !== 'published') return undefined;
    return sanitizeEntryForRole(entry, role, unlockedIds);
  },

  createEntry(
    entryData: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { id?: string }
  ): DiaryEntry {
    const db = readDb();
    const now = new Date().toISOString();
    const slugBase = (entryData.title || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'entry';
    const maxOrder = db.entries.reduce((max, e) => Math.max(max, e.pageOrder || 0), 0);

    const newEntry: DiaryEntry = {
      ...entryData,
      id: entryData.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      slug: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
      pageOrder: entryData.pageOrder ?? maxOrder + 1,
      gallery: Array.isArray(entryData.gallery) ? entryData.gallery : [],
      tags: Array.isArray(entryData.tags) ? entryData.tags : [],
      createdAt: now,
      updatedAt: now,
      publishedAt: entryData.status === 'published' ? now : undefined,
    };

    db.entries.push(newEntry);
    writeDb(db);
    return newEntry;
  },

  updateEntry(id: string, updates: Partial<DiaryEntry>): DiaryEntry | null {
    const db = readDb();
    const index = db.entries.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const existing = db.entries[index];
    const now = new Date().toISOString();

    const updated: DiaryEntry = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: now,
      publishedAt:
        updates.status === 'published' && !existing.publishedAt ? now : existing.publishedAt,
    };

    db.entries[index] = updated;
    writeDb(db);
    return updated;
  },

  deleteEntry(id: string): boolean {
    const db = readDb();
    const initialLen = db.entries.length;
    db.entries = db.entries.filter((e) => e.id !== id);
    if (db.entries.length !== initialLen) {
      writeDb(db);
      return true;
    }
    return false;
  },

  reorderEntries(orderedIds: string[]): DiaryEntry[] {
    const db = readDb();
    const orderMap = new Map<string, number>();
    orderedIds.forEach((eid, idx) => orderMap.set(eid, idx + 1));

    db.entries = db.entries.map((entry) => {
      const newOrder = orderMap.get(entry.id);
      if (newOrder !== undefined) {
        return { ...entry, pageOrder: newOrder, updatedAt: new Date().toISOString() };
      }
      return entry;
    });

    db.entries.sort((a, b) => a.pageOrder - b.pageOrder);
    writeDb(db);
    return db.entries;
  },

  verifyEntrySecretKey(id: string, candidateKey: string): DiaryEntry | null {
    const entry = this.getRawEntryById(id);
    if (!entry) return null;
    const expected = (entry.securityKey || entry.secretPasscode || '').trim();
    if (!expected) return entry;
    if (!timingSafeEqualText(candidateKey.trim(), expected)) {
      return null;
    }
    return entry;
  },

  // === Settings ===
  getSettings(): DiarySettings {
    const db = readDb();
    return { ...DEFAULT_SETTINGS, ...db.settings };
  },

  updateSettings(updates: Partial<DiarySettings>): DiarySettings {
    const db = readDb();
    const updated: DiarySettings = {
      ...DEFAULT_SETTINGS,
      ...db.settings,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    db.settings = updated;
    writeDb(db);
    return updated;
  },

  // === Media ===
  getMedia(): MediaItem[] {
    const db = readDb();
    return [...db.media].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  },

  addMedia(media: Omit<MediaItem, 'id' | 'uploadedAt'>): MediaItem {
    const db = readDb();
    const item: MediaItem = {
      ...media,
      id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      uploadedAt: new Date().toISOString(),
    };
    db.media.push(item);
    writeDb(db);
    return item;
  },

  deleteMedia(id: string): MediaItem | null {
    const db = readDb();
    const index = db.media.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const deleted = db.media[index];
    db.media.splice(index, 1);
    writeDb(db);
    return deleted;
  },

  // === Stats ===
  getStats(): DashboardStats {
    const db = readDb();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const publishedEntries = db.entries.filter((e) => e.status === 'published');
    const draftEntries = db.entries.filter((e) => e.status === 'draft');
    const thisMonthEntries = db.entries.filter(
      (e) => (e.date || e.createdAt || '').startsWith(currentMonth)
    );
    const secretCount =
      db.entries.filter((e) => e.isSecret || e.securityKey || e.secretPasscode).length +
      db.chapters.filter((c) => c.isSecret || c.securityKey || c.secretPasscode).length;

    const totalWords =
      db.entries.reduce((sum, e) => sum + countWordsSimple(e.content), 0) +
      db.chapters.reduce((sum, c) => sum + countWordsSimple(c.rawContent), 0);

    return {
      totalEntries: db.entries.length,
      published: publishedEntries.length,
      drafts: draftEntries.length,
      secretCount,
      chaptersCount: db.chapters.length,
      thisMonth: thisMonthEntries.length,
      totalPages: Math.max(publishedEntries.length, db.chapters.length),
      totalWords,
      lastUpdated: db.settings.lastUpdated || now.toISOString(),
    };
  },
};
