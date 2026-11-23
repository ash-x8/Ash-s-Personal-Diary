import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPin,
  createAuthToken,
  verifyAuthToken,
  verifyAuthTokenPayload,
} from './auth.ts';
import {
  claimInitialVault,
  resetVaultForTesting,
  getVaultSetupStatus,
  updateVaultPins,
} from './vaultStore.ts';
import { sanitizeEntryForRole, sanitizeChapterForRole } from './db.ts';
import type { DiaryEntry, DiaryChapter } from '../src/types/index.ts';

describe('Vault Setup & PIN Authentication', () => {
  beforeEach(() => {
    delete process.env.EDITOR_ACCESS_CODE;
    delete process.env.READER_ACCESS_CODE;
    resetVaultForTesting();
  });

  it('requires initial setup when no env codes or vault hashes exist', () => {
    const status = getVaultSetupStatus();
    assert.equal(status.needsSetup, true);
    assert.equal(verifyPin('0704'), null);
    assert.equal(verifyPin('0422'), null);
  });

  it('claims initial vault with scrypt hashes and authenticates EDITOR and READER', () => {
    const claim = claimInitialVault('MySecretEditor99', 'ReaderKey88');
    assert.equal(claim.ok, true);
    assert.equal(getVaultSetupStatus().needsSetup, false);
    assert.equal(verifyPin('MySecretEditor99'), 'EDITOR');
    assert.equal(verifyPin('ReaderKey88'), 'READER');
    assert.equal(verifyPin('wrong'), null);
  });

  it('prevents claiming vault twice', () => {
    assert.equal(claimInitialVault('FirstEditor11').ok, true);
    const second = claimInitialVault('AttackerEditor22');
    assert.equal(second.ok, false);
    assert.equal(verifyPin('AttackerEditor22'), null);
  });

  it('validates environment overrides when configured', () => {
    process.env.EDITOR_ACCESS_CODE = 'EnvEditorSecret';
    process.env.READER_ACCESS_CODE = 'EnvReaderSecret';
    assert.equal(getVaultSetupStatus().needsSetup, false);
    assert.equal(verifyPin('EnvEditorSecret'), 'EDITOR');
    assert.equal(verifyPin('EnvReaderSecret'), 'READER');
  });

  it('allows updated vault hashes to supersede stale env secrets', () => {
    process.env.EDITOR_ACCESS_CODE = 'StaleEditor';
    process.env.READER_ACCESS_CODE = 'NewAdminCode';
    updateVaultPins('NewAdminCode', 'NewReaderCode');
    assert.equal(verifyPin('NewAdminCode'), 'EDITOR');
    assert.equal(verifyPin('NewReaderCode'), 'READER');
    assert.equal(verifyPin('StaleEditor'), null);
  });
});

describe('HMAC Session Tokens', () => {
  it('creates and verifies EDITOR and READER session tokens', () => {
    const editorToken = createAuthToken('EDITOR');
    const readerToken = createAuthToken('READER');

    assert.equal(verifyAuthToken(editorToken), 'EDITOR');
    assert.equal(verifyAuthToken(readerToken), 'READER');
    assert.ok(verifyAuthTokenPayload(editorToken)?.jti);
  });

  it('rejects malformed or tampered tokens', () => {
    const editorToken = createAuthToken('EDITOR');
    const tampered = `${editorToken.slice(0, -4)}zzzz`;

    assert.equal(verifyAuthToken(''), null);
    assert.equal(verifyAuthToken('not.a.valid.token'), null);
    assert.equal(verifyAuthToken(tampered), null);
  });
});

describe('Secret Page Redaction for Readers', () => {
  const sampleEntry: DiaryEntry = {
    id: 'secret-entry-1',
    title: 'Locked Letter',
    slug: 'locked-letter',
    content: '<p>Top secret diary text</p>',
    date: '2026-10-01',
    tags: [],
    gallery: ['/uploads/private.png'],
    coverImage: '/uploads/cover.png',
    status: 'published',
    pageOrder: 1,
    isSecret: true,
    securityKey: 'private-pass-77',
    securityHint: 'Favorite moon phase',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  it('strips secret content and securityKey from unauthorized readers', () => {
    const sanitized = sanitizeEntryForRole(sampleEntry, 'READER', new Set());
    assert.equal(sanitized.isLocked, true);
    assert.equal(sanitized.content, '');
    assert.equal(sanitized.coverImage, '');
    assert.deepEqual(sanitized.gallery, []);
    assert.equal(sanitized.securityKey, undefined);
    assert.equal(sanitized.securityHint, 'Favorite moon phase');
  });

  it('reveals content once unlocked for session while keeping securityKey stripped', () => {
    const sanitized = sanitizeEntryForRole(sampleEntry, 'READER', new Set(['secret-entry-1']));
    assert.equal(sanitized.isLocked, false);
    assert.equal(sanitized.content, '<p>Top secret diary text</p>');
    assert.equal(sanitized.securityKey, undefined);
  });

  it('redacts secret chapters for unauthorized readers', () => {
    const chapter: DiaryChapter = {
      id: 'secret-chap-1',
      chapterTitle: 'Vault Chapter',
      rawContent: '<p>Confidential chapter words</p>',
      createdAt: null,
      updatedAt: null,
      isSecret: true,
      securityKey: 'secret123',
      securityHint: 'Year',
    };
    const sanitized = sanitizeChapterForRole(chapter, 'READER', new Set());
    assert.equal(sanitized.isLocked, true);
    assert.equal(sanitized.rawContent, '');
    assert.equal(sanitized.securityKey, undefined);
  });
});
