export type UserRole = 'EDITOR' | 'READER';

export type EntryStatus = 'draft' | 'published';

/**
 * Chapter Model stored in Firestore collection: "diary_chapters"
 * Continuous writing content is stored unified as `rawContent`.
 */
export interface DiaryChapter {
  id: string;
  chapterTitle: string;
  rawContent: string;
  createdAt: any;
  updatedAt: any;
  // Companion metadata
  date?: string;
  mood?: string;
  location?: string;
  tags?: string[];
  coverImage?: string;
  gallery?: string[];
  status?: EntryStatus;
  order?: number;
  isSecret?: boolean;
  securityKey?: string;
  securityHint?: string;
  // Legacy alias compatibility
  secretPasscode?: string;
}

/**
 * Client-side calculated dynamic page derived from DiaryChapter
 */
export interface PaginatedPage {
  id: string;
  chapterId: string;
  chapterTitle: string;
  pageIndex: number;
  chapterPageNumber: number;
  totalChapterPages: number;
  globalPageNumber: number;
  content: string;
  wordCount: number;
  date: string;
  mood?: string;
  location?: string;
  tags?: string[];
  coverImage?: string;
  gallery?: string[];
  status: EntryStatus;
  isSecret?: boolean;
  securityKey?: string;
  securityHint?: string;
}

export interface DiaryEntry {
  id: string;
  title: string;
  slug: string;
  content: string;
  date: string;
  mood?: string;
  location?: string;
  tags: string[];
  coverImage?: string;
  gallery: string[];
  status: EntryStatus;
  pageOrder: number;
  customPageNumber?: number;
  isSecret?: boolean;
  securityKey?: string;
  securityHint?: string;
  // Legacy backwards-compatibility
  secretPasscode?: string;
  secretHint?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  // Chapter reference if converted
  chapterId?: string;
}

export interface DiarySettings {
  title: string;
  subtitle: string;
  coverText: string;
  authorName: string;
  coverImage?: string;
  paperColor: 'classic' | 'clean' | 'dark';
  typography: 'garamond' | 'cinzel' | 'classic';
  soundEnabled: boolean;
  twoPageMode: boolean;
  mobileSwipeEnabled: boolean;
  theme: 'dark' | 'light' | 'sepia';
  readingWidth: 'normal' | 'wide' | 'compact';
  pageAnimationSpeed: 'normal' | 'relaxed' | 'gentle';
  autoPageTurn: boolean;
  readerAccessEnabled: boolean;
  editorAccessEnabled: boolean;
  wordsPerPage: number; // Configurable word limit per page (default: 100)
  lastUpdated: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface DashboardStats {
  totalEntries: number;
  published: number;
  drafts: number;
  thisMonth: number;
  totalPages: number;
  lastUpdated: string;
}

export interface AuthSession {
  authenticated: boolean;
  role?: UserRole;
}
