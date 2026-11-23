import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../src/types/index.ts';
import { verifyAccessPin } from './vaultStore.ts';

export type { UserRole };

export interface AuthRequest extends Request {
  userRole?: UserRole;
  sessionJti?: string;
}

export const AUTH_COOKIE_NAME = 'ash_diary_session';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = (process.env.SESSION_SECRET || '').trim();
  return configured || EPHEMERAL_FALLBACK_SECRET;
}

interface TokenPayload {
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

// Per-session unlocked secret page tracking in server memory (never exposed to client storage)
const sessionUnlockedIds = new Map<string, Set<string>>();

export function getUnlockedIdsForSession(jti?: string): Set<string> {
  if (!jti) return new Set();
  return sessionUnlockedIds.get(jti) || new Set();
}

export function grantUnlockedIdForSession(jti: string | undefined, targetId: string): void {
  if (!jti || !targetId) return;
  let set = sessionUnlockedIds.get(jti);
  if (!set) {
    set = new Set<string>();
    sessionUnlockedIds.set(jti, set);
  }
  set.add(targetId);
}

export function clearUnlockedSession(jti?: string): void {
  if (jti) {
    sessionUnlockedIds.delete(jti);
  }
}

export function verifyPin(pin: string): UserRole | null {
  return verifyAccessPin(pin);
}

export function createAuthToken(role: UserRole): string {
  const payload: TokenPayload = {
    role,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyAuthTokenPayload(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payloadB64)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf-8');

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as TokenPayload;
    if (!decoded || typeof decoded !== 'object') return null;
    if (!decoded.exp || Date.now() > decoded.exp) return null;
    if (decoded.role !== 'EDITOR' && decoded.role !== 'READER') return null;
    if (!decoded.jti) return null;

    return decoded;
  } catch {
    return null;
  }
}

export function verifyAuthToken(token: string): UserRole | null {
  const payload = verifyAuthTokenPayload(token);
  return payload ? payload.role : null;
}

export function extractTokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export function buildCookieOptions(req: Request, maxAgeMs?: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  partitioned?: boolean;
  maxAge?: number;
} {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = req.secure || forwardedProto.includes('https') || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: Boolean(isHttps),
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
    ...(isHttps ? { partitioned: true } : {}),
    ...(typeof maxAgeMs === 'number' ? { maxAge: maxAgeMs } : {}),
  };
}

/**
 * CSRF protection for cookie-authenticated state-changing requests.
 */
export function verifyMutationOrigin(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host && !origin.startsWith('http://localhost') && !origin.startsWith('https://')) {
        res.status(403).json({ error: 'Cross-origin request rejected.' });
        return;
      }
      // Strict match when same-host expected
      const allowedHostMatch = originHost === host;
      if (!allowedHostMatch) {
        res.status(403).json({ error: 'Origin mismatch.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid origin header.' });
      return;
    }
  }

  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = verifyAuthTokenPayload(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.userRole = payload.role;
  req.sessionJti = payload.jti;
  next();
}

export function requireEditor(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'EDITOR') {
    res.status(403).json({ error: 'Editor permissions required' });
    return;
  }
  next();
}
