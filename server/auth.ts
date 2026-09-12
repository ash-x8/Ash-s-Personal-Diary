import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../src/types/index.ts';

// Access codes configured securely server-side
const EDITOR_CODE = process.env.EDITOR_ACCESS_CODE || '0704';
const READER_CODE = process.env.READER_ACCESS_CODE || '0422';
const SESSION_SECRET = process.env.SESSION_SECRET || 'ash_diary_secure_hmac_secret_2026_x8';

export interface TokenPayload {
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        role: UserRole;
      };
    }
  }
}

/**
 * Creates an HMAC-SHA256 signed session token.
 */
export function createSessionToken(role: UserRole): string {
  const payload: TokenPayload = {
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the token and returns the payload or null.
 */
export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadB64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    // Timing-safe comparison requiring equal buffer lengths to prevent exceptions
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates the user code and assigns role.
 */
export function validateAccessCode(code: string): UserRole | null {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (trimmed === EDITOR_CODE) return 'EDITOR';
  if (trimmed === READER_CODE) return 'READER';
  return null;
}

/**
 * Express middleware to authenticate session.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.diary_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      req.user = { role: verified.role };
    }
  }
  next();
}

/**
 * Middleware ensuring at least Reader or Editor access.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please unlock the diary.' });
    return;
  }
  next();
}

/**
 * Middleware ensuring strictly Editor access.
 */
export function requireEditor(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'EDITOR') {
    res.status(403).json({ error: 'Forbidden: Editor access required.' });
    return;
  }
  next();
}
