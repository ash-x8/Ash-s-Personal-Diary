import type {
  AuthSession,
  DashboardStats,
  DiaryChapter,
  DiaryEntry,
  DiarySettings,
  MediaItem,
  VaultSetupStatus,
} from '../types';

const API_BASE = '/api';

// Session token held in memory only (no localStorage usage)
let memorySessionToken: string | null = null;

export function setMemorySessionToken(token: string | null): void {
  memorySessionToken = token;
}

export function clearMemorySessionToken(): void {
  memorySessionToken = null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (memorySessionToken) {
    headers['Authorization'] = `Bearer ${memorySessionToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // === Auth & Vault ===
  async getSetupStatus(): Promise<VaultSetupStatus> {
    return request<VaultSetupStatus>('/auth/setup-status');
  },

  async setupVault(
    editorPin: string,
    readerPin?: string
  ): Promise<AuthSession & { token?: string; setup?: VaultSetupStatus }> {
    const data = await request<AuthSession & { token?: string; setup?: VaultSetupStatus }>(
      '/auth/setup',
      {
        method: 'POST',
        body: JSON.stringify({ editorPin, readerPin }),
      }
    );
    if (data.token) setMemorySessionToken(data.token);
    return data;
  },

  async unlock(pin: string): Promise<AuthSession & { token?: string }> {
    const data = await request<AuthSession & { token?: string }>('/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    if (data.token) setMemorySessionToken(data.token);
    return data;
  },

  async getSession(): Promise<AuthSession> {
    return request<AuthSession>('/auth/session');
  },

  async lock(): Promise<void> {
    clearMemorySessionToken();
    await request('/auth/lock', { method: 'POST' });
  },

  async updatePins(editorPin?: string, readerPin?: string): Promise<{ ok: boolean; setup: VaultSetupStatus }> {
    return request('/auth/update-pins', {
      method: 'PUT',
      body: JSON.stringify({ editorPin, readerPin }),
    });
  },

  // === Chapters ===
  async getChapters(): Promise<DiaryChapter[]> {
    return request<DiaryChapter[]>('/chapters');
  },

  async createChapter(data: Partial<DiaryChapter>): Promise<DiaryChapter> {
    return request<DiaryChapter>('/chapters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateChapter(id: string, updates: Partial<DiaryChapter>): Promise<DiaryChapter> {
    return request<DiaryChapter>(`/chapters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteChapter(id: string): Promise<void> {
    await request(`/chapters/${id}`, { method: 'DELETE' });
  },

  async reorderChapters(orderedIds: string[]): Promise<DiaryChapter[]> {
    return request<DiaryChapter[]>('/chapters/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    });
  },

  async unlockChapter(id: string, key: string): Promise<DiaryChapter> {
    return request<DiaryChapter>(`/chapters/${id}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
  },

  // === Entries ===
  async getEntries(): Promise<DiaryEntry[]> {
    return request<DiaryEntry[]>('/entries');
  },

  async getEntry(id: string): Promise<DiaryEntry> {
    return request<DiaryEntry>(`/entries/${id}`);
  },

  async createEntry(data: Partial<DiaryEntry>): Promise<DiaryEntry> {
    return request<DiaryEntry>('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEntry(id: string, data: Partial<DiaryEntry>): Promise<DiaryEntry> {
    return request<DiaryEntry>(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteEntry(id: string): Promise<void> {
    await request(`/entries/${id}`, { method: 'DELETE' });
  },

  async reorderEntries(orderedIds: string[]): Promise<DiaryEntry[]> {
    return request<DiaryEntry[]>('/entries/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    });
  },

  async unlockEntry(id: string, key: string): Promise<DiaryEntry> {
    return request<DiaryEntry>(`/entries/${id}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
  },

  // === Settings & Stats ===
  async getSettings(): Promise<DiarySettings> {
    return request<DiarySettings>('/settings');
  },

  async updateSettings(updates: Partial<DiarySettings>): Promise<DiarySettings> {
    return request<DiarySettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/stats');
  },

  // === Media ===
  async getMedia(): Promise<MediaItem[]> {
    return request<MediaItem[]>('/media');
  },

  async uploadMedia(file: File): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('image', file);
    return request<MediaItem>('/media/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteMedia(id: string): Promise<void> {
    await request(`/media/${id}`, { method: 'DELETE' });
  },
};
