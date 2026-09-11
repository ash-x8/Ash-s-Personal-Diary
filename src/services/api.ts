import {
  AuthSession,
  DashboardStats,
  DiaryEntry,
  DiarySettings,
  MediaItem,
  UserRole
} from '../types/index';
import { localDb } from './localDb';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.token = localStorage.getItem('ash_diary_token');
      }
    } catch {}
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined' && window.localStorage) {
      this.token = localStorage.getItem('ash_diary_token');
    }
    return this.token;
  }

  public setToken(token: string | null) {
    this.token = token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (token) {
          localStorage.setItem('ash_diary_token', token);
        } else {
          localStorage.removeItem('ash_diary_token');
        }
      }
    } catch {}
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const currentToken = this.getToken();
    if (currentToken) {
      defaultHeaders['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers as Record<string, string>)
      },
      credentials: 'include'
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Server returned HTML (likely offline or static hosting)');
    }

    if (!response.ok) {
      let errorMsg = 'Invalid request.';
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
    try {
      const result = await this.request<{ success: boolean; role: UserRole; token: string }>('/auth/unlock', {
        method: 'POST',
        body: JSON.stringify({ code })
      });

      if (result && result.token) {
        this.setToken(result.token);
      }

      // Mirror to local storage as fallback
      try { localDb.unlock(code); } catch {}
      return result;
    } catch (err: any) {
      if (err.message === 'Invalid access code.') {
        throw err;
      }
      // If server returned 404, HTML, network error, or was on Vercel static deployment:
      const localRes = localDb.unlock(code);
      if (localRes.token) {
        this.setToken(localRes.token);
      }
      return localRes;
    }
  }

  public async getSession(): Promise<AuthSession> {
    try {
      const res = await this.request<AuthSession>('/auth/session');
      if (res && res.authenticated) {
        return res;
      }
      return localDb.getSession();
    } catch {
      return localDb.getSession();
    }
  }

  public async lock(): Promise<{ success: boolean }> {
    try {
      await this.request<{ success: boolean }>('/auth/lock', {
        method: 'POST'
      });
    } catch {}
    this.setToken(null);
    localDb.lock();
    return { success: true };
  }

  // Entries
  public async getEntries(): Promise<DiaryEntry[]> {
    try {
      const serverEntries = await this.request<DiaryEntry[]>('/entries');
      return serverEntries;
    } catch {
      return localDb.getEntries();
    }
  }

  public async getEntry(id: string): Promise<DiaryEntry> {
    try {
      return await this.request<DiaryEntry>(`/entries/${id}`);
    } catch {
      return localDb.getEntry(id);
    }
  }

  public async createEntry(data: Partial<DiaryEntry>): Promise<DiaryEntry> {
    try {
      return await this.request<DiaryEntry>('/entries', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      return localDb.createEntry(data);
    }
  }

  public async updateEntry(id: string, data: Partial<DiaryEntry>): Promise<DiaryEntry> {
    try {
      return await this.request<DiaryEntry>(`/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch {
      return localDb.updateEntry(id, data);
    }
  }

  public async deleteEntry(id: string): Promise<{ success: boolean }> {
    try {
      return await this.request<{ success: boolean }>(`/entries/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return localDb.deleteEntry(id);
    }
  }

  public async reorderEntries(order: { id: string; pageOrder: number }[]): Promise<{ success: boolean }> {
    try {
      return await this.request<{ success: boolean }>('/entries-order', {
        method: 'PUT',
        body: JSON.stringify({ order })
      });
    } catch {
      return localDb.reorderEntries(order);
    }
  }

  // Settings
  public async getSettings(): Promise<DiarySettings> {
    try {
      return await this.request<DiarySettings>('/settings');
    } catch {
      return localDb.getSettings();
    }
  }

  public async updateSettings(updates: Partial<DiarySettings>): Promise<DiarySettings> {
    try {
      return await this.request<DiarySettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    } catch {
      return localDb.updateSettings(updates);
    }
  }

  // Stats
  public async getStats(): Promise<DashboardStats> {
    try {
      return await this.request<DashboardStats>('/stats');
    } catch {
      return localDb.getStats();
    }
  }

  // Media
  public async getMedia(): Promise<MediaItem[]> {
    try {
      return await this.request<MediaItem[]>('/media');
    } catch {
      return localDb.getMedia();
    }
  }

  public async uploadMedia(file: File): Promise<MediaItem> {
    try {
      const formData = new FormData();
      formData.append('image', file);
      return await this.request<MediaItem>('/media/upload', {
        method: 'POST',
        body: formData
      });
    } catch {
      return await localDb.uploadMedia(file);
    }
  }

  public async deleteMedia(id: string): Promise<{ success: boolean }> {
    try {
      return await this.request<{ success: boolean }>(`/media/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return localDb.deleteMedia(id);
    }
  }
}

export const api = new ApiClient();
