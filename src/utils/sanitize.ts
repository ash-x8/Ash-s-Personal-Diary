import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'b',
  'i',
  'u',
  's',
  'em',
  'strong',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'ul',
  'ol',
  'li',
  'span',
  'div',
  'img',
  'a',
  'hr',
  'figure',
  'figcaption',
];

const ALLOWED_ATTR = [
  'class',
  'style',
  'dir',
  'src',
  'alt',
  'title',
  'href',
  'target',
  'rel',
  'width',
  'height',
];

/**
 * Sanitizes diary rich-text HTML against XSS payloads before rendering
 * with dangerouslySetInnerHTML or embedding in print iframes.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto):|\/[^/]|data:image\/(?:png|jpeg|jpg|webp|gif);base64,)/i,
  });
}

/**
 * Validates image / media URLs so javascript:, vbscript:, or arbitrary data URLs cannot be injected.
 */
export function sanitizeMediaUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

/**
 * Escapes plain strings before interpolation into HTML print templates.
 */
export function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
