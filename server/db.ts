import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DiaryEntry, DiarySettings, MediaItem, DashboardStats } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.resolve(DATA_DIR, 'diary_database.json');

export interface DatabaseSchema {
  entries: DiaryEntry[];
  settings: DiarySettings;
  media: MediaItem[];
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

const INITIAL_ENTRIES: DiaryEntry[] = [
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

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    this.ensureDir();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          entries: parsed.entries || INITIAL_ENTRIES,
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          media: parsed.media || []
        };
      } catch (err) {
        console.error("Error reading database file, using fallback:", err);
      }
    }

    // Seed default
    const initial: DatabaseSchema = {
      entries: INITIAL_ENTRIES,
      settings: DEFAULT_SETTINGS,
      media: []
    };
    this.save(initial);
    return initial;
  }

  private save(data: DatabaseSchema) {
    this.ensureDir();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  // Entries
  public getEntries(includeDrafts = false): DiaryEntry[] {
    const list = this.data.entries.filter(e => includeDrafts || e.status === 'published');
    return list.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  }

  public getEntry(id: string, includeDrafts = false): DiaryEntry | undefined {
    const entry = this.data.entries.find(e => e.id === id || e.slug === id);
    if (!entry) return undefined;
    if (!includeDrafts && entry.status !== 'published') return undefined;
    return entry;
  }

  public createEntry(entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'slug'>): DiaryEntry {
    const id = `entry-${Date.now()}`;
    const slug = entry.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `entry-${id}`;
    
    const now = new Date().toISOString();
    const newEntry: DiaryEntry = {
      ...entry,
      id,
      slug,
      pageOrder: entry.pageOrder || this.data.entries.length + 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: entry.status === 'published' ? now : undefined
    };

    this.data.entries.push(newEntry);
    this.data.settings.lastUpdated = now;
    this.save(this.data);
    return newEntry;
  }

  public updateEntry(id: string, updates: Partial<DiaryEntry>): DiaryEntry | undefined {
    const idx = this.data.entries.findIndex(e => e.id === id);
    if (idx === -1) return undefined;

    const existing = this.data.entries[idx];
    const now = new Date().toISOString();
    
    let publishedAt = existing.publishedAt;
    if (updates.status === 'published' && existing.status !== 'published') {
      publishedAt = now;
    }

    const updated: DiaryEntry = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: now,
      publishedAt
    };

    this.data.entries[idx] = updated;
    this.data.settings.lastUpdated = now;
    this.save(this.data);
    return updated;
  }

  public deleteEntry(id: string): boolean {
    const initLen = this.data.entries.length;
    this.data.entries = this.data.entries.filter(e => e.id !== id);
    if (this.data.entries.length !== initLen) {
      this.data.settings.lastUpdated = new Date().toISOString();
      this.save(this.data);
      return true;
    }
    return false;
  }

  public reorderEntries(orderMap: { id: string; pageOrder: number }[]): boolean {
    const map = new Map(orderMap.map(o => [o.id, o.pageOrder]));
    this.data.entries.forEach(e => {
      if (map.has(e.id)) {
        e.pageOrder = map.get(e.id)!;
      }
    });
    this.data.entries.sort((a, b) => a.pageOrder - b.pageOrder);
    this.save(this.data);
    return true;
  }

  // Settings
  public getSettings(): DiarySettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<DiarySettings>): DiarySettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.save(this.data);
    return this.data.settings;
  }

  // Media
  public getMedia(): MediaItem[] {
    return this.data.media || [];
  }

  public addMedia(item: MediaItem): MediaItem {
    if (!this.data.media) this.data.media = [];
    this.data.media.unshift(item);
    this.save(this.data);
    return item;
  }

  public deleteMedia(id: string): boolean {
    if (!this.data.media) return false;
    const prevLen = this.data.media.length;
    this.data.media = this.data.media.filter(m => m.id !== id);
    if (this.data.media.length !== prevLen) {
      this.save(this.data);
      return true;
    }
    return false;
  }

  // Stats
  public getStats(): DashboardStats {
    const totalEntries = this.data.entries.length;
    const published = this.data.entries.filter(e => e.status === 'published').length;
    const drafts = this.data.entries.filter(e => e.status === 'draft').length;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = this.data.entries.filter(e => e.date.startsWith(currentMonth)).length;

    return {
      totalEntries,
      published,
      drafts,
      thisMonth,
      totalPages: published * 2 + 2, // Cover + TOC + pages
      lastUpdated: this.data.settings.lastUpdated
    };
  }
}

export const db = new Database();
