import { describe, expect, test } from 'bun:test';
import { createSessionToken, verifySessionToken, validateAccessCode } from './auth';

describe('Auth Security Verification', () => {
  test('validates access codes correctly', () => {
    expect(validateAccessCode('0704')).toBe('EDITOR');
    expect(validateAccessCode('0422')).toBe('READER');
    expect(validateAccessCode('wrong_code')).toBeNull();
    expect(validateAccessCode('')).toBeNull();
  });

  test('creates and verifies valid session token', () => {
    const token = createSessionToken('EDITOR');
    expect(token).toContain('.');
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.role).toBe('EDITOR');
  });

  test('rejects tampered session token payload', () => {
    const token = createSessionToken('READER');
    const [payloadB64, signature] = token.split('.');

    // Tamper with payload
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    decoded.role = 'EDITOR';
    const tamperedB64 = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const tamperedToken = `${tamperedB64}.${signature}`;

    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  test('rejects invalid or mismatched signature lengths safely', () => {
    const token = createSessionToken('EDITOR');
    const [payloadB64] = token.split('.');

    expect(verifySessionToken(`${payloadB64}.invalid_sig`)).toBeNull();
    expect(verifySessionToken(`${payloadB64}.short`)).toBeNull();
    expect(verifySessionToken('malformed_token_string')).toBeNull();
  });
});
