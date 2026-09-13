/**
 * High-performance browser image compressor to ensure photos and rich text
 * never exceed Firestore's strict 1,048,576 bytes (1 MB) per document limit.
 */

export interface CompressionResult {
  dataUrl: string;
  size: number;
  width: number;
  height: number;
}

/**
 * Compresses an image File, Blob, or base64 Data URL to fit well under Firestore limits.
 * Targets ~60KB - 140KB per image with crisp visual clarity.
 */
export async function compressImage(
  source: File | Blob | string,
  options: {
    maxDimension?: number;
    quality?: number;
    maxSizeBytes?: number;
  } = {}
): Promise<CompressionResult> {
  const maxDimension = options.maxDimension || 1200;
  const initialQuality = options.quality ?? 0.78;
  const maxSizeBytes = options.maxSizeBytes || 160 * 1024; // 160 KB target ceiling

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrlToRevoke: string | null = null;

    img.onload = () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        return reject(new Error('Image has zero dimensions.'));
      }

      // Calculate bounded dimensions
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas context could not be acquired.'));
      }

      // High-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Paint with white background (in case of transparent PNG being converted to JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Attempt iterative compression if file is large
      let currentQuality = initialQuality;
      let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
      let approxSize = Math.round((dataUrl.length * 3) / 4);

      // If still exceeding target max size, reduce quality or scale down canvas
      let attempts = 0;
      while (approxSize > maxSizeBytes && attempts < 3 && currentQuality > 0.45) {
        attempts++;
        currentQuality -= 0.12;
        dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        approxSize = Math.round((dataUrl.length * 3) / 4);
      }

      // If still over 250KB, scale down dimensions
      if (approxSize > 250 * 1024) {
        const halfCanvas = document.createElement('canvas');
        halfCanvas.width = Math.round(width * 0.75);
        halfCanvas.height = Math.round(height * 0.75);
        const halfCtx = halfCanvas.getContext('2d');
        if (halfCtx) {
          halfCtx.fillStyle = '#ffffff';
          halfCtx.fillRect(0, 0, halfCanvas.width, halfCanvas.height);
          halfCtx.drawImage(canvas, 0, 0, halfCanvas.width, halfCanvas.height);
          dataUrl = halfCanvas.toDataURL('image/jpeg', 0.68);
          approxSize = Math.round((dataUrl.length * 3) / 4);
          width = halfCanvas.width;
          height = halfCanvas.height;
        }
      }

      resolve({
        dataUrl,
        size: approxSize,
        width,
        height
      });
    };

    img.onerror = () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      reject(new Error('Failed to load image for compression.'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrlToRevoke = URL.createObjectURL(source);
      img.src = objectUrlToRevoke;
    }
  });
}

/**
 * Scans an HTML string for embedded base64 image tags and compresses any that
 * are larger than 80 KB so the document remains well within Firestore's 1MB limit.
 */
export async function compressHtmlImages(html: string): Promise<string> {
  if (!html || !html.includes('data:image/')) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));

    let changed = false;

    for (const imgEl of images) {
      const src = imgEl.getAttribute('src');
      if (src && src.startsWith('data:image/') && src.length > 80 * 1024) {
        try {
          const compressed = await compressImage(src, {
            maxDimension: 1100,
            quality: 0.75,
            maxSizeBytes: 120 * 1024
          });
          imgEl.setAttribute('src', compressed.dataUrl);
          changed = true;
        } catch (e) {
          console.warn('Could not compress embedded HTML image:', e);
        }
      }
    }

    return changed ? doc.body.innerHTML : html;
  } catch (err) {
    console.warn('HTML image compression parsing failed:', err);
    return html;
  }
}

/**
 * Prepares and sanitizes any DiaryEntry object before writing to Firestore,
 * ensuring content, coverImage, and gallery photos never exceed the 1MB document limit.
 */
export async function sanitizeEntryForFirestore<T extends Record<string, any>>(entry: T): Promise<T> {
  const sanitized: any = { ...entry };

  // 1. Compress rich text HTML content images if present
  if (typeof sanitized.content === 'string' && sanitized.content.includes('data:image/')) {
    sanitized.content = await compressHtmlImages(sanitized.content);
  }

  // 2. Compress coverImage if it's a huge base64 string
  if (typeof sanitized.coverImage === 'string' && sanitized.coverImage.startsWith('data:image/')) {
    if (sanitized.coverImage.length > 80 * 1024) {
      try {
        const compressed = await compressImage(sanitized.coverImage, {
          maxDimension: 1200,
          quality: 0.78,
          maxSizeBytes: 140 * 1024
        });
        sanitized.coverImage = compressed.dataUrl;
      } catch (e) {
        console.warn('Could not compress cover image:', e);
      }
    }
  }

  // 3. Compress gallery photos if they are huge base64 strings
  if (Array.isArray(sanitized.gallery) && sanitized.gallery.length > 0) {
    const compressedGallery: string[] = [];
    for (const photo of sanitized.gallery) {
      if (typeof photo === 'string' && photo.startsWith('data:image/') && photo.length > 80 * 1024) {
        try {
          const res = await compressImage(photo, {
            maxDimension: 1000,
            quality: 0.75,
            maxSizeBytes: 100 * 1024
          });
          compressedGallery.push(res.dataUrl);
        } catch {
          compressedGallery.push(photo);
        }
      } else {
        compressedGallery.push(photo);
      }
    }
    sanitized.gallery = compressedGallery;
  }

  return sanitized as T;
}
