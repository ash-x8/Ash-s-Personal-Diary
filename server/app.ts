import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  verifyPin,
  createAuthToken,
  verifyAuthTokenPayload,
  extractTokenFromRequest,
  requireAuth,
  requireEditor,
  verifyMutationOrigin,
  buildCookieOptions,
  getUnlockedIdsForSession,
  grantUnlockedIdForSession,
  clearUnlockedSession,
  AUTH_COOKIE_NAME,
} from './auth.ts';
import type { AuthRequest } from './auth.ts';
import { dbService, sanitizeChapterForRole, sanitizeEntryForRole } from './db.ts';
import {
  getVaultSetupStatus,
  claimInitialVault,
  updateVaultPins,
} from './vaultStore.ts';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function ensureUploadsDir(): boolean {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(verifyMutationOrigin);

  // Serve static uploaded images when present on disk
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // AUTH & VAULT SETUP ROUTES
  // ==========================================
  app.get('/api/auth/setup-status', (_req, res) => {
    res.json(getVaultSetupStatus());
  });

  app.post('/api/auth/setup', (req, res) => {
    const { editorPin, readerPin } = req.body || {};
    const result = claimInitialVault(String(editorPin || ''), readerPin ? String(readerPin) : undefined);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    const token = createAuthToken('EDITOR');
    res.cookie(AUTH_COOKIE_NAME, token, buildCookieOptions(req, 7 * 24 * 60 * 60 * 1000));
    res.status(201).json({
      authenticated: true,
      role: 'EDITOR',
      token,
      setup: getVaultSetupStatus(),
    });
  });

  app.post('/api/auth/unlock', (req, res) => {
    const setupStatus = getVaultSetupStatus();
    if (setupStatus.needsSetup) {
      res.status(409).json({
        error: 'Vault access codes have not been configured yet. Complete initial setup first.',
        needsSetup: true,
      });
      return;
    }

    const { pin } = req.body || {};
    if (!pin || typeof pin !== 'string') {
      res.status(400).json({ error: 'Access code is required' });
      return;
    }

    const role = verifyPin(pin);
    if (!role) {
      res.status(401).json({ error: 'Invalid access code' });
      return;
    }

    const settings = dbService.getSettings();
    if (role === 'READER' && !settings.readerAccessEnabled) {
      res.status(403).json({ error: 'Reader access is currently sealed by the owner' });
      return;
    }

    const token = createAuthToken(role);
    res.cookie(AUTH_COOKIE_NAME, token, buildCookieOptions(req, 7 * 24 * 60 * 60 * 1000));

    res.json({
      authenticated: true,
      role,
      token,
    });
  });

  app.get('/api/auth/session', (req, res) => {
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.json({ authenticated: false });
      return;
    }

    const payload = verifyAuthTokenPayload(token);
    if (!payload) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      role: payload.role,
      authMethod: 'pin',
    });
  });

  app.post('/api/auth/lock', (req, res) => {
    const token = extractTokenFromRequest(req);
    const payload = token ? verifyAuthTokenPayload(token) : null;
    if (payload?.jti) {
      clearUnlockedSession(payload.jti);
    }
    res.clearCookie(AUTH_COOKIE_NAME, buildCookieOptions(req));
    res.json({ authenticated: false });
  });

  app.put('/api/auth/update-pins', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const { editorPin, readerPin } = req.body || {};
    const result = updateVaultPins(
      editorPin !== undefined ? String(editorPin) : undefined,
      readerPin !== undefined ? String(readerPin) : undefined
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, setup: getVaultSetupStatus() });
  });

  // ==========================================
  // CHAPTER ROUTES
  // ==========================================
  app.get('/api/chapters', requireAuth, (req: AuthRequest, res) => {
    const isEditor = req.userRole === 'EDITOR';
    const unlockedIds = getUnlockedIdsForSession(req.sessionJti);
    const chapters = dbService.getChapters(isEditor, req.userRole || 'READER', unlockedIds);
    res.json(chapters);
  });

  app.post('/api/chapters', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const { chapterTitle } = req.body || {};
    if (!chapterTitle || typeof chapterTitle !== 'string') {
      res.status(400).json({ error: 'Chapter title is required' });
      return;
    }
    const created = dbService.createChapter(req.body);
    res.status(201).json(created);
  });

  app.put('/api/chapters/reorder', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds array is required' });
      return;
    }
    const updated = dbService.reorderChapters(orderedIds.map(String));
    res.json(updated);
  });

  app.put('/api/chapters/:id', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const updated = dbService.updateChapter(String(req.params.id), req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/chapters/:id', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const deleted = dbService.deleteChapter(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }
    res.json({ success: true });
  });

  app.post('/api/chapters/:id/unlock', requireAuth, (req: AuthRequest, res) => {
    const id = String(req.params.id);
    const key = String(req.body?.key || '');
    if (!key.trim()) {
      res.status(400).json({ error: 'Passkey is required' });
      return;
    }

    const chapter = dbService.verifyChapterSecretKey(id, key);
    if (!chapter) {
      res.status(403).json({ error: 'Incorrect secret passkey' });
      return;
    }

    grantUnlockedIdForSession(req.sessionJti, id);
    const unlockedIds = getUnlockedIdsForSession(req.sessionJti);
    res.json(sanitizeChapterForRole(chapter, req.userRole || 'READER', unlockedIds));
  });

  // ==========================================
  // ENTRY ROUTES
  // ==========================================
  app.get('/api/entries', requireAuth, (req: AuthRequest, res) => {
    const isEditor = req.userRole === 'EDITOR';
    const unlockedIds = getUnlockedIdsForSession(req.sessionJti);
    const entries = dbService.getEntries(isEditor, req.userRole || 'READER', unlockedIds);
    res.json(entries);
  });

  app.get('/api/entries/:id', requireAuth, (req: AuthRequest, res) => {
    const unlockedIds = getUnlockedIdsForSession(req.sessionJti);
    const entry = dbService.getEntryById(
      String(req.params.id),
      req.userRole || 'READER',
      unlockedIds
    );
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  });

  app.post('/api/entries', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const { title, content, date } = req.body || {};
    if (!title || content === undefined || !date) {
      res.status(400).json({ error: 'Title, content, and date are required' });
      return;
    }

    const newEntry = dbService.createEntry({
      title: String(title),
      content: String(content),
      date: String(date),
      mood: req.body.mood || '',
      location: req.body.location || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : [],
      coverImage: req.body.coverImage || '',
      gallery: Array.isArray(req.body.gallery) ? req.body.gallery.map(String) : [],
      status: req.body.status === 'published' ? 'published' : 'draft',
      pageOrder: typeof req.body.pageOrder === 'number' ? req.body.pageOrder : 999,
      customPageNumber:
        typeof req.body.customPageNumber === 'number' ? req.body.customPageNumber : undefined,
      isSecret: Boolean(req.body.isSecret),
      securityKey: req.body.securityKey ? String(req.body.securityKey) : '',
      securityHint: req.body.securityHint ? String(req.body.securityHint) : '',
      chapterId: req.body.chapterId ? String(req.body.chapterId) : undefined,
    });

    res.status(201).json(newEntry);
  });

  app.put('/api/entries/reorder', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds array is required' });
      return;
    }
    const updated = dbService.reorderEntries(orderedIds.map(String));
    res.json(updated);
  });

  app.put('/api/entries/:id', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const updated = dbService.updateEntry(String(req.params.id), req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/entries/:id', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const deleted = dbService.deleteEntry(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ success: true });
  });

  app.post('/api/entries/:id/unlock', requireAuth, (req: AuthRequest, res) => {
    const id = String(req.params.id);
    const key = String(req.body?.key || '');
    if (!key.trim()) {
      res.status(400).json({ error: 'Passkey is required' });
      return;
    }

    const entry = dbService.verifyEntrySecretKey(id, key);
    if (!entry) {
      res.status(403).json({ error: 'Incorrect secret passkey' });
      return;
    }

    grantUnlockedIdForSession(req.sessionJti, id);
    const unlockedIds = getUnlockedIdsForSession(req.sessionJti);
    res.json(sanitizeEntryForRole(entry, req.userRole || 'READER', unlockedIds));
  });

  // ==========================================
  // SETTINGS & STATS ROUTES
  // ==========================================
  app.get('/api/settings', requireAuth, (_req: AuthRequest, res) => {
    res.json(dbService.getSettings());
  });

  app.put('/api/settings', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const updated = dbService.updateSettings(req.body || {});
    res.json(updated);
  });

  app.get('/api/stats', requireAuth, requireEditor, (_req: AuthRequest, res) => {
    res.json(dbService.getStats());
  });

  // ==========================================
  // MEDIA UPLOAD & MANAGEMENT ROUTES
  // ==========================================
  app.get('/api/media', requireAuth, requireEditor, (_req: AuthRequest, res) => {
    res.json(dbService.getMedia());
  });

  app.post(
    '/api/media/upload',
    requireAuth,
    requireEditor,
    upload.single('image'),
    (req: AuthRequest, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
      };
      const safeExt = extMap[req.file.mimetype] || '.png';
      const safeFilename = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;

      let url = '';
      if (ensureUploadsDir()) {
        try {
          const targetPath = path.resolve(UPLOADS_DIR, safeFilename);
          const rootPrefix = path.resolve(UPLOADS_DIR) + path.sep;
          if (!targetPath.startsWith(rootPrefix)) {
            res.status(400).json({ error: 'Invalid upload path' });
            return;
          }
          fs.writeFileSync(targetPath, req.file.buffer);
          url = `/uploads/${safeFilename}`;
        } catch {
          // Fallback to base64 data URI if host filesystem is read-only
          url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
      } else {
        url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      const item = dbService.addMedia({
        filename: safeFilename,
        url,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      res.status(201).json(item);
    }
  );

  app.delete('/api/media/:id', requireAuth, requireEditor, (req: AuthRequest, res) => {
    const deleted = dbService.deleteMedia(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Media item not found' });
      return;
    }

    if (deleted.filename && deleted.url.startsWith('/uploads/')) {
      const targetPath = path.resolve(UPLOADS_DIR, path.basename(deleted.filename));
      const rootPrefix = path.resolve(UPLOADS_DIR) + path.sep;
      if (targetPath.startsWith(rootPrefix) && fs.existsSync(targetPath)) {
        try {
          fs.unlinkSync(targetPath);
        } catch {
          // Ignore cleanup errors on ephemeral FS
        }
      }
    }

    res.json({ success: true });
  });

  // Error handler for Multer / JSON parsing
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    res.status(400).json({ error: message });
  });

  return app;
}

const app = createApp();
export default app;
