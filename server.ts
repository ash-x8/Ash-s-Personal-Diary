import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { db } from './server/db.ts';
import {
  authMiddleware,
  createSessionToken,
  requireAuth,
  requireEditor,
  validateAccessCode
} from './server/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

// Ensure upload directory exists
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Static uploads & public assets
app.use('/uploads', express.static(UPLOAD_DIR));
const PUBLIC_DIR = path.resolve(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ==========================================================================
   AUTHENTICATION ROUTES
   ========================================================================== */

app.post('/api/auth/unlock', (req, res) => {
  const { code } = req.body;
  const role = validateAccessCode(code);

  if (!role) {
    // Strictly generic error per specification
    res.status(401).json({ error: 'Invalid access code.' });
    return;
  }

  const token = createSessionToken(role);

  // Set HTTP-only secure cookie compatible with cross-site preview iframes
  res.cookie('diary_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    role,
    token
  });
});

app.get('/api/auth/session', (req, res) => {
  if (req.user) {
    res.json({
      authenticated: true,
      role: req.user.role
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

app.post('/api/auth/lock', (_req, res) => {
  res.clearCookie('diary_token', {
    httpOnly: true,
    sameSite: 'none',
    secure: true
  });
  res.json({ success: true });
});

/* ==========================================================================
   DIARY ENTRIES ROUTES
   ========================================================================== */

// Get entries (filtered by role)
app.get('/api/entries', requireAuth, async (req, res) => {
  const isEditor = req.user?.role === 'EDITOR';
  const entries = await db.getEntries(isEditor);
  res.json(entries);
});

// Get single entry
app.get('/api/entries/:id', requireAuth, async (req, res) => {
  const isEditor = req.user?.role === 'EDITOR';
  const entry = await db.getEntry(req.params.id, isEditor);

  if (!entry) {
    res.status(404).json({ error: 'This page could not be opened.' });
    return;
  }

  res.json(entry);
});

// Create entry (Editor only)
app.post('/api/entries', requireEditor, async (req, res) => {
  try {
    const { title, content, date, mood, location, tags, coverImage, gallery, status, pageOrder, customPageNumber } = req.body;

    if (!title || !content || !date) {
      res.status(400).json({ error: 'Title, content, and date are required.' });
      return;
    }

    const newEntry = await db.createEntry({
      title,
      content,
      date,
      mood: mood || undefined,
      location: location || undefined,
      tags: Array.isArray(tags) ? tags : [],
      coverImage: coverImage || undefined,
      gallery: Array.isArray(gallery) ? gallery : [],
      status: status === 'published' ? 'published' : 'draft',
      pageOrder: Number(pageOrder) || 0,
      customPageNumber: customPageNumber ? Number(customPageNumber) : undefined
    });

    res.status(201).json(newEntry);
  } catch (err: any) {
    console.error('Error creating entry:', err);
    res.status(500).json({ error: 'Something went wrong while saving your entry.' });
  }
});

// Update entry (Editor only)
app.put('/api/entries/:id', requireEditor, async (req, res) => {
  try {
    const updated = await db.updateEntry(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating entry:', err);
    res.status(500).json({ error: 'Something went wrong while saving your entry.' });
  }
});

// Delete entry (Editor only)
app.delete('/api/entries/:id', requireEditor, async (req, res) => {
  const deleted = await db.deleteEntry(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Entry not found.' });
    return;
  }
  res.json({ success: true });
});

// Reorder entries (Editor only)
app.put('/api/entries-order', requireEditor, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    res.status(400).json({ error: 'Invalid order array.' });
    return;
  }
  await db.reorderEntries(order);
  res.json({ success: true });
});

/* ==========================================================================
   SETTINGS & STATS ROUTES
   ========================================================================== */

app.get('/api/settings', async (_req, res) => {
  const settings = await db.getSettings();
  res.json(settings);
});

app.put('/api/settings', requireEditor, async (req, res) => {
  const updated = await db.updateSettings(req.body);
  res.json(updated);
});

app.get('/api/stats', requireEditor, async (_req, res) => {
  const stats = await db.getStats();
  res.json(stats);
});

/* ==========================================================================
   MEDIA LIBRARY ROUTES
   ========================================================================== */

app.get('/api/media', requireEditor, async (_req, res) => {
  const media = await db.getMedia();
  res.json(media);
});

app.post('/api/media/upload', requireEditor, upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image uploaded.' });
    return;
  }

  const mediaItem = await db.addMedia({
    id: `media-${Date.now()}`,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    uploadedAt: new Date().toISOString()
  });

  res.status(201).json(mediaItem);
});

app.delete('/api/media/:id', requireEditor, async (req, res) => {
  const mediaList = await db.getMedia();
  const target = mediaList.find(m => m.id === req.params.id);
  if (target) {
    const filePath = path.resolve(UPLOAD_DIR, target.filename);
    // Path traversal safety check to ensure deletion remains strictly within UPLOAD_DIR
    if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Error removing file:', e);
      }
    }
  }
  await db.deleteMedia(req.params.id);
  res.json({ success: true });
});

/* ==========================================================================
   CLIENT SERVING (Vite Dev & Production)
   ========================================================================== */

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ash's Personal Diary running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
