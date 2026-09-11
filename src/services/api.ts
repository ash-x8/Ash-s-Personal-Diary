import {
  AuthSession,
  DashboardStats,
  DiaryEntry,
  DiarySettings,
  MediaItem,
  UserRole
} from '../types/index';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers as Record<string, string>)
      },
      credentials: 'include'
    });

    if (!response.ok) {
      let errorMsg = 'An unexpected error occurred.';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        errorMsg = response.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // Auth
  public async unlock(code: string): Promise<{ success: boolean; role: UserRole; token: string }> {
    return this.request<{ success: boolean; role: UserRole; token: string }>('/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  public async getSession(): Promise<AuthSession> {
    try {
      return await this.request<AuthSession>('/auth/session');
    } catch {
      return { authenticated: false };
    }
  }

  public async lock(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/lock', {
      method: 'POST'
    });
  }

  // Entries
  public async getEntries(): Promise<DiaryEntry[]> {
    return this.request<DiaryEntry[]>('/entries');
  }

  public async getEntry(id: string): Promise<DiaryEntry> {
    return this.request<DiaryEntry>(`/entries/${id}`);
  }

  public async createEntry(data: Partial<DiaryEntry>): Promise<DiaryEntry> {
    return this.request<DiaryEntry>('/entries', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async updateEntry(id: string, data: Partial<DiaryEntry>): Promise<DiaryEntry> {
    return this.request<DiaryEntry>(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  public async deleteEntry(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/entries/${id}`, {
      method: 'DELETE'
    });
  }

  public async reorderEntries(order: { id: string; pageOrder: number }[]): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/entries-order', {
      method: 'PUT',
      body: JSON.stringify({ order })
    });
  }

  // Settings
  public async getSettings(): Promise<DiarySettings> {
    return this.request<DiarySettings>('/settings');
  }

  public async updateSettings(updates: Partial<DiarySettings>): Promise<DiarySettings> {
    return this.request<DiarySettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Stats
  public async getStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/stats');
  }

  // Media
  public async getMedia(): Promise<MediaItem[]> {
    return this.request<MediaItem[]>('/media');
  }

  public async uploadMedia(file: File): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('image', file);
    return this.request<MediaItem>('/media/upload', {
      method: 'POST',
      body: formData
    });
  }

  public async deleteMedia(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/media/${id}`, {
      method: 'DELETE'
    });
  }
}

export const api = new ApiClient();
