import {
  AuthSession,
  DashboardStats,
  DiaryEntry,
  DiarySettings,
  MediaItem,
  UserRole
} from '../types';

const STORAGE_KEYS = {
  SESSION: 'ash_diary_session',
  SETTINGS: 'ash_diary_settings',
  ENTRIES: 'ash_diary_entries',
  MEDIA: 'ash_diary_media'
};

export const DEFAULT_SETTINGS: DiarySettings = {
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

export const DEFAULT_ENTRIES: DiaryEntry[] = [];

class LocalDatabase {
  private getStorage<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  private setStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  }

  // Auth
  public unlock(code: string): { success: boolean; role: UserRole; token: string } {
    const trimmed = code.trim();
    if (trimmed === '0704') {
      const session = { authenticated: true, role: 'EDITOR' as UserRole };
      this.setStorage(STORAGE_KEYS.SESSION, session);
      return { success: true, role: 'EDITOR', token: 'local_editor_session_token' };
    }
    if (trimmed === '0422') {
      const session = { authenticated: true, role: 'READER' as UserRole };
      this.setStorage(STORAGE_KEYS.SESSION, session);
      return { success: true, role: 'READER', token: 'local_reader_session_token' };
    }
    throw new Error('Invalid access code.');
  }

  public getSession(): AuthSession {
    return this.getStorage<AuthSession>(STORAGE_KEYS.SESSION, { authenticated: false });
  }

  public lock(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    } catch {}
  }

  // Settings
  public getSettings(): DiarySettings {
    const existing = this.getStorage<DiarySettings | null>(STORAGE_KEYS.SETTINGS, null);
    if (!existing) {
      this.setStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...existing };
  }

  public updateSettings(updates: Partial<DiarySettings>): DiarySettings {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.setStorage(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  // Entries
  public getEntries(): DiaryEntry[] {
    const existing = this.getStorage<DiaryEntry[] | null>(STORAGE_KEYS.ENTRIES, null);
    const session = this.getSession();
    // Filter out any legacy mock entries (e.g. from previous app seeds)
    const entries: DiaryEntry[] = (existing || []).filter(
      (e) => !['entry-01', 'entry-02', 'entry-03', 'entry-04', 'entry-05'].includes(e.id)
    );

    if (session.role === 'READER') {
      return entries
        .filter((e) => e.status === 'published')
        .sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
    }

    return entries.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  }

  public getEntry(id: string): DiaryEntry {
    const entries = this.getEntries();
    const found = entries.find((e) => e.id === id || e.slug === id);
    if (!found) throw new Error('Entry not found');
    return found;
  }

  public createEntry(data: Partial<DiaryEntry>): DiaryEntry {
    const entries = this.getEntries();
    const newOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.pageOrder || 0)) + 1 : 1;
    const now = new Date().toISOString();

    const newEntry: DiaryEntry = {
      id: `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: data.title?.trim() || 'Untitled Page',
      slug: (data.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      date: data.date || now.split('T')[0],
      mood: data.mood || '',
      location: data.location || '',
      tags: data.tags || [],
      coverImage: data.coverImage || '',
      gallery: data.gallery || [],
      status: data.status || 'published',
      pageOrder: typeof data.pageOrder === 'number' ? data.pageOrder : newOrder,
      customPageNumber: typeof data.customPageNumber === 'number' ? data.customPageNumber : newOrder,
      createdAt: now,
      updatedAt: now,
      publishedAt: data.status === 'published' ? now : undefined,
      content: data.content || ''
    };

    const updated = [...entries, newEntry];
    this.setStorage(STORAGE_KEYS.ENTRIES, updated);
    return newEntry;
  }

  public updateEntry(id: string, data: Partial<DiaryEntry>): DiaryEntry {
    const entries = this.getStorage<DiaryEntry[]>(STORAGE_KEYS.ENTRIES, DEFAULT_ENTRIES);
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('Entry not found');

    const current = entries[index];
    const now = new Date().toISOString();

    const updatedEntry: DiaryEntry = {
      ...current,
      ...data,
      updatedAt: now,
      publishedAt:
        data.status === 'published' && current.status !== 'published'
          ? now
          : current.publishedAt
    };

    entries[index] = updatedEntry;
    this.setStorage(STORAGE_KEYS.ENTRIES, entries);
    return updatedEntry;
  }

  public deleteEntry(id: string): { success: boolean } {
    const entries = this.getEntries();
    const filtered = entries.filter((e) => e.id !== id && e.slug !== id);
    this.setStorage(STORAGE_KEYS.ENTRIES, filtered);
    return { success: true };
  }

  public reorderEntries(order: { id: string; pageOrder: number }[]): { success: boolean } {
    const entries = this.getEntries();
    const orderMap = new Map(order.map((o) => [o.id, o.pageOrder]));
    entries.forEach((e) => {
      if (orderMap.has(e.id)) {
        e.pageOrder = orderMap.get(e.id)!;
        e.customPageNumber = e.pageOrder;
      }
    });
    this.setStorage(STORAGE_KEYS.ENTRIES, entries);
    return { success: true };
  }

  public getStats(): DashboardStats {
    const entries = this.getEntries();
    const published = entries.filter((e) => e.status === 'published').length;
    const drafts = entries.filter((e) => e.status === 'draft').length;
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = entries.filter((e) => (e.date || '').startsWith(currentMonthPrefix)).length;

    return {
      totalEntries: entries.length,
      published,
      drafts,
      thisMonth,
      totalPages: published * 2 + 2,
      lastUpdated: new Date().toISOString()
    };
  }

  public getMedia(): MediaItem[] {
    return this.getStorage<MediaItem[]>(STORAGE_KEYS.MEDIA, []);
  }

  public async uploadMedia(file: File): Promise<MediaItem> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const mediaList = this.getMedia();
        const newItem: MediaItem = {
          id: `media-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          url: dataUrl,
          filename: file.name,
          originalName: file.name,
          size: file.size,
          mimeType: file.type || 'image/jpeg',
          uploadedAt: new Date().toISOString()
        };
        this.setStorage(STORAGE_KEYS.MEDIA, [newItem, ...mediaList]);
        resolve(newItem);
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  public deleteMedia(id: string): { success: boolean } {
    const list = this.getMedia().filter((m) => m.id !== id);
    this.setStorage(STORAGE_KEYS.MEDIA, list);
    return { success: true };
  }
}

export const localDb = new LocalDatabase();
