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

export const DEFAULT_ENTRIES: DiaryEntry[] = [
  {
    id: "entry-01",
    title: "The Beginning",
    slug: "the-beginning",
    date: "2026-09-04",
    mood: "Reflective",
    location: "Studio 8, High Street",
    tags: ["Origins", "Memories", "Beginning"],
    coverImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80"
    ],
    status: "published",
    pageOrder: 1,
    customPageNumber: 1,
    createdAt: "2026-09-04T22:15:00Z",
    updatedAt: "2026-09-04T22:15:00Z",
    publishedAt: "2026-09-04T22:15:00Z",
    content: `<p>There is a peculiar quiet that descends upon the world past two in the morning. A silence so delicate that even the turning of a page feels like an intrusion.</p>
<p>I have started this diary not to capture grand milestones, but to preserve the subtle fissures—the quiet hours that usually dissolve before sunrise. For years, thoughts lingered without a home, drifting between notebooks left half-filled in bedside drawers.</p>
<blockquote>"Some memories are meant to stay between pages, sheltered from the velocity of the outside world."</blockquote>
<p>Here, the ink doesn't rush. The words are allowed to breathe. If you are reading this, you are holding the quietest parts of me.</p>`
  },
  {
    id: "entry-02",
    title: "A Strange Day",
    slug: "a-strange-day",
    date: "2026-09-06",
    mood: "Curious",
    location: "The Old Library Quarter",
    tags: ["Rain", "Wanderings", "Thoughts"],
    coverImage: "https://images.unsplash.com/photo-1507842229458-5776306235e2?auto=format&fit=crop&w=1200&q=80",
    gallery: [],
    status: "published",
    pageOrder: 2,
    customPageNumber: 2,
    createdAt: "2026-09-06T18:40:00Z",
    updatedAt: "2026-09-06T18:40:00Z",
    publishedAt: "2026-09-06T18:40:00Z",
    content: `<p>Rain arrived without ceremony this afternoon. The cobblestones took on a mirror sheen, reflecting the dark amber lamps of the antique bookstalls.</p>
<p>I found myself standing beneath the canvas awning of a corner shop, listening to the rhythm of water striking the stone. A stranger nodded as they passed, collar pulled up against the mist. It felt as if time had temporarily forgotten to move forward.</p>
<p>In that suspended minute, I realized how rarely we allow ourselves to simply stand still without reaching for a destination or an excuse.</p>`
  },
  {
    id: "entry-03",
    title: "Things I Never Said",
    slug: "things-i-never-said",
    date: "2026-09-08",
    mood: "Nostalgic",
    location: "Rooftop at Twilight",
    tags: ["Confessions", "Echoes", "Night"],
    coverImage: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=800&q=80"
    ],
    status: "published",
    pageOrder: 3,
    customPageNumber: 3,
    createdAt: "2026-09-08T20:05:00Z",
    updatedAt: "2026-09-08T20:05:00Z",
    publishedAt: "2026-09-08T20:05:00Z",
    content: `<p>We often carry conversations we never ended up speaking aloud. Sentences phrased with surgical precision in our minds, only to be discarded when the moment arrives.</p>
<p>Looking out across the city tonight, seeing the scattered constellations of windows glowing in high-rises, I wonder how many other untold stories are quietly sleeping behind drawn curtains.</p>
<p>Perhaps writing them down is not about seeking answers, but about freeing the mind from carrying them forever.</p>`
  },
  {
    id: "entry-04",
    title: "A Quiet Night",
    slug: "a-quiet-night",
    date: "2026-09-11",
    mood: "Calm",
    location: "Home, Candlelit Study",
    tags: ["Personal", "Night", "Silence"],
    coverImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80",
    gallery: [],
    status: "published",
    pageOrder: 4,
    customPageNumber: 4,
    createdAt: "2026-09-11T23:30:00Z",
    updatedAt: "2026-09-11T23:30:00Z",
    publishedAt: "2026-09-11T23:30:00Z",
    content: `<p>A cup of smoked lapsang souchong tea, still steaming faintly against the wooden desk. The room is dim save for a solitary lamp casting warm golden circles onto the paper.</p>
<p>Everything has settled into its natural cadence. The day's anxieties have shrunk into insignificance. There is profound peace in knowing that this moment belongs to no one else.</p>
<p>Tomorrow will bring its own demands, but for tonight, the book closes gently on a grateful heart.</p>`
  },
  {
    id: "entry-05",
    title: "Unfinished Thoughts on Autumn",
    slug: "unfinished-thoughts-on-autumn",
    date: "2026-09-12",
    mood: "Wistful",
    location: "North Garden",
    tags: ["Draft", "Autumn", "Seasons"],
    coverImage: "",
    gallery: [],
    status: "draft",
    pageOrder: 5,
    customPageNumber: 5,
    createdAt: "2026-09-11T10:00:00Z",
    updatedAt: "2026-09-11T10:00:00Z",
    content: `<p>Draft notes: The leaves along the courtyard are turning copper earlier than expected this season. Must flesh out the memory from three Octobers ago...</p>`
  }
];

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
    let entries: DiaryEntry[] = existing || [];

    if (!existing || existing.length === 0) {
      this.setStorage(STORAGE_KEYS.ENTRIES, DEFAULT_ENTRIES);
      entries = DEFAULT_ENTRIES;
    }

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
    const entries = this.getStorage<DiaryEntry[]>(STORAGE_KEYS.ENTRIES, DEFAULT_ENTRIES);
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
    const entries = this.getStorage<DiaryEntry[]>(STORAGE_KEYS.ENTRIES, DEFAULT_ENTRIES);
    const filtered = entries.filter((e) => e.id !== id);
    this.setStorage(STORAGE_KEYS.ENTRIES, filtered);
    return { success: true };
  }

  public reorderEntries(order: { id: string; pageOrder: number }[]): { success: boolean } {
    const entries = this.getStorage<DiaryEntry[]>(STORAGE_KEYS.ENTRIES, DEFAULT_ENTRIES);
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
    const entries = this.getStorage<DiaryEntry[]>(STORAGE_KEYS.ENTRIES, DEFAULT_ENTRIES);
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
