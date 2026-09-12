export type UserRole = 'EDITOR' | 'READER';

export type EntryStatus = 'draft' | 'published';

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
  secretPasscode?: string;
  secretHint?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
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
