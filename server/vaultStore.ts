import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { UserRole, VaultSetupStatus } from '../src/types/index.ts';

interface StoredHash {
  salt: string;
  hash: string;
}

interface VaultData {
  editor?: StoredHash;
  reader?: StoredHash;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const VAULT_FILE = path.join(DATA_DIR, 'vault.json');

let memoryVault: VaultData = { updatedAt: new Date(0).toISOString() };
let diskLoaded = false;

function loadVaultFromDisk(): VaultData {
  if (diskLoaded) return memoryVault;
  diskLoaded = true;
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as VaultData;
      if (parsed && typeof parsed === 'object') {
        memoryVault = parsed;
      }
    }
  } catch {
    // Ephemeral / read-only environment: keep in-memory store
  }
  return memoryVault;
}

function saveVaultToDisk(data: VaultData): void {
  memoryVault = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ephemeral / read-only host: state stays in memory for process lifetime
  }
}

export function hashPin(pin: string): StoredHash {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPinHash(pin: string, stored: StoredHash): boolean {
  if (!pin || !stored?.salt || !stored?.hash) return false;
  try {
    const derived = crypto.scryptSync(pin, stored.salt, 64);
    const expected = Buffer.from(stored.hash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function timingSafeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    // Maintain constant-time comparison even on length mismatch
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getEnvEditorCode(): string {
  return (process.env.EDITOR_ACCESS_CODE || '').trim();
}

export function getEnvReaderCode(): string {
  return (process.env.READER_ACCESS_CODE || '').trim();
}

export function getVaultSetupStatus(): VaultSetupStatus {
  const envEditor = getEnvEditorCode();
  const envReader = getEnvReaderCode();
  const vault = loadVaultFromDisk();

  const editorConfigured = Boolean(envEditor || vault.editor);
  const readerConfigured = Boolean(envReader || vault.reader);

  return {
    needsSetup: !editorConfigured,
    hasEnvSecrets: Boolean(envEditor),
    readerConfigured,
  };
}

export function claimInitialVault(editorPin: string, readerPin?: string): { ok: boolean; error?: string } {
  const status = getVaultSetupStatus();
  if (!status.needsSetup) {
    return { ok: false, error: 'Vault access codes are already configured.' };
  }

  const trimmedEditor = (editorPin || '').trim();
  const trimmedReader = (readerPin || '').trim();

  if (trimmedEditor.length < 4 || trimmedEditor.length > 64) {
    return { ok: false, error: 'Editor PIN must be between 4 and 64 characters.' };
  }

  if (trimmedReader && (trimmedReader.length < 4 || trimmedReader.length > 64)) {
    return { ok: false, error: 'Reader PIN must be between 4 and 64 characters.' };
  }

  if (trimmedReader && trimmedReader === trimmedEditor) {
    return { ok: false, error: 'Reader PIN must be distinct from the Editor PIN.' };
  }

  const nextVault: VaultData = {
    editor: hashPin(trimmedEditor),
    reader: trimmedReader ? hashPin(trimmedReader) : undefined,
    updatedAt: new Date().toISOString(),
  };
  saveVaultToDisk(nextVault);
  return { ok: true };
}

export function updateVaultPins(editorPin?: string, readerPin?: string): { ok: boolean; error?: string } {
  const vault = { ...loadVaultFromDisk() };

  if (editorPin !== undefined && editorPin.trim() !== '') {
    const clean = editorPin.trim();
    if (clean.length < 4 || clean.length > 64) {
      return { ok: false, error: 'Editor PIN must be between 4 and 64 characters.' };
    }
    vault.editor = hashPin(clean);
  }

  if (readerPin !== undefined) {
    const clean = readerPin.trim();
    if (clean === '') {
      delete vault.reader;
    } else if (clean.length < 4 || clean.length > 64) {
      return { ok: false, error: 'Reader PIN must be between 4 and 64 characters.' };
    } else {
      vault.reader = hashPin(clean);
    }
  }

  vault.updatedAt = new Date().toISOString();
  saveVaultToDisk(vault);
  return { ok: true };
}

export function verifyAccessPin(pin: string): UserRole | null {
  const candidate = (pin || '').trim();
  if (!candidate) return null;

  const envEditor = getEnvEditorCode();
  const envReader = getEnvReaderCode();
  const vault = loadVaultFromDisk();

  // Check environment overrides first, then stored scrypt vault hashes
  if (envEditor && timingSafeEqualText(candidate, envEditor)) {
    return 'EDITOR';
  }
  if (vault.editor && verifyPinHash(candidate, vault.editor)) {
    return 'EDITOR';
  }

  if (envReader && timingSafeEqualText(candidate, envReader)) {
    return 'READER';
  }
  if (vault.reader && verifyPinHash(candidate, vault.reader)) {
    return 'READER';
  }

  return null;
}

export function resetVaultForTesting(): void {
  memoryVault = { updatedAt: new Date(0).toISOString() };
  diskLoaded = true;
}
