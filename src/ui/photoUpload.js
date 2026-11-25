/**
 * Photo Billboard upload pipeline (Stage 4 demo).
 *
 * processPhoto(file) validates a user-selected image, centre-crops it to a square (cover, never
 * stretched), resizes it to 512 x 512 and exports a small JPEG. It never throws and never logs
 * image data: it resolves to one of
 *   { ok: true,  dataUrl, width: 512, height: 512, approxBytes, sourceWidth, sourceHeight, quality }
 *   { ok: false, code, title, message }
 *
 * All copy is Canadian English.
 */

export const PHOTO_LIMITS = Object.freeze({
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileBytes: 5 * 1024 * 1024,   // 5 MB
  minSide: 128,
  maxSide: 10000,
  outputSize: 320,
  primaryQuality: 0.85,
  fallbackQuality: 0.6,
  maxOutputBytes: 100 * 1024       // ~100 KB
});

// Largest intermediate canvas used while stepping a huge photo down (stays inside mobile canvas limits).
const MAX_INTERMEDIATE = 2048;

function fail(code, title, message) {
  return { ok: false, code, title, message };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatPixels(n) {
  return Number(n).toLocaleString('en-CA');
}

/** Decoded size in bytes of a base64 data URL. */
function base64ByteLength(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const length = dataUrl.length - comma - 1;
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((length * 3) / 4) - padding);
}

function ascii(bytes, from, to) {
  let out = '';
  for (let i = from; i < to; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

/** Reads the first bytes of the file and returns its real type, or null if it is not JPEG/PNG/WebP. */
async function sniffImageType(blob) {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) return 'image/png';
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function defaultDecode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release() { if (typeof bitmap.close === 'function') bitmap.close(); }
      };
    } catch (err) {
      // Fall through to the <img> path (older browsers, or a bitmap that is too large).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = function () { reject(new Error('decode')); };
      img.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release() { URL.revokeObjectURL(url); }
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function defaultCreateCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * 1:1 centred cover-crop, then resize to outputSize. Very large photos are stepped down in
 * halves so the result is not aliased, without ever allocating a canvas above MAX_INTERMEDIATE.
 */
function renderCoverCrop(source, sourceWidth, sourceHeight, createCanvas) {
  const out = PHOTO_LIMITS.outputSize;
  const side = Math.min(sourceWidth, sourceHeight);
  let sx = Math.floor((sourceWidth - side) / 2);
  let sy = Math.floor((sourceHeight - side) / 2);
  let current = source;
  let size = side;
  const temps = [];

  function stepDown(to) {
    const canvas = createCanvas(to, to);
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(current, sx, sy, size, size, 0, 0, to, to);
    temps.push(canvas);
    current = canvas;
    sx = 0;
    sy = 0;
    size = to;
  }

  if (size > MAX_INTERMEDIATE) stepDown(MAX_INTERMEDIATE);
  while (size > out * 2) stepDown(Math.ceil(size / 2));

  const canvas = createCanvas(out, out);
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff'; // JPEG has no alpha: transparent PNG/WebP areas become white
  g.fillRect(0, 0, out, out);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(current, sx, sy, size, size, 0, 0, out, out);

  temps.forEach(function (c) { c.width = 0; c.height = 0; });
  return canvas;
}

function exportJpeg(canvas, quality) {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return typeof dataUrl === 'string' && dataUrl.indexOf('data:image/jpeg') === 0 ? dataUrl : null;
}

/**
 * @param {File} file
 * @param {object} [deps]  test seams: { decode(file), createCanvas(w, h), sniff(file) }
 */
export async function processPhoto(file, deps) {
  const d = deps || {};
  const decode = d.decode || defaultDecode;
  const createCanvas = d.createCanvas || defaultCreateCanvas;
  const sniff = d.sniff || sniffImageType;
  const L = PHOTO_LIMITS;

  let decoded = null;
  let canvas = null;
  try {
    if (!file || typeof file !== 'object' || typeof file.size !== 'number') {
      return fail('no-file', 'No Photo Selected', 'Please choose a JPEG, PNG or WebP photo to continue.');
    }
    if (L.allowedTypes.indexOf(file.type) === -1) {
      return fail(
        'unsupported-type',
        'Unsupported File Type',
        'Please choose a JPEG, PNG or WebP photo. Other file types can\u2019t be used.'
      );
    }
    if (file.size === 0) {
      return fail('empty-file', 'That File Is Empty', 'The file you chose has no data. Please choose a different photo.');
    }
    if (file.size > L.maxFileBytes) {
      return fail(
        'file-too-large',
        'Photo Is Too Large',
        'Photos must be 5 MB or smaller. Yours is ' + formatBytes(file.size) + '.'
      );
    }

    const realType = await sniff(file);
    if (!realType || L.allowedTypes.indexOf(realType) === -1) {
      return fail(
        'unreadable',
        'We Couldn\u2019t Read That Photo',
        'This file doesn\u2019t look like a valid JPEG, PNG or WebP image. Please try a different photo.'
      );
    }

    try {
      decoded = await decode(file);
    } catch (err) {
      return fail(
        'decode-failed',
        'We Couldn\u2019t Read That Photo',
        'The image may be damaged or too large for this browser. Please try a different photo.'
      );
    }

    const width = decoded.width;
    const height = decoded.height;
    if (!(width > 0 && height > 0)) {
      return fail(
        'decode-failed',
        'We Couldn\u2019t Read That Photo',
        'The image may be damaged. Please try a different photo.'
      );
    }
    if (width < L.minSide || height < L.minSide) {
      return fail(
        'dimensions-too-small',
        'Photo Is Too Small',
        'Photos must be at least ' + L.minSide + ' \u00d7 ' + L.minSide + ' pixels. Yours is ' +
          formatPixels(width) + ' \u00d7 ' + formatPixels(height) + ' pixels.'
      );
    }
    if (width > L.maxSide || height > L.maxSide) {
      return fail(
        'dimensions-too-large',
        'Photo Dimensions Are Too Large',
        'Photos can be at most ' + formatPixels(L.maxSide) + ' \u00d7 ' + formatPixels(L.maxSide) +
          ' pixels. Yours is ' + formatPixels(width) + ' \u00d7 ' + formatPixels(height) + ' pixels.'
      );
    }

    try {
      canvas = renderCoverCrop(decoded.source, width, height, createCanvas);
    } catch (err) {
      return fail(
        'render-failed',
        'We Couldn\u2019t Prepare That Photo',
        'Your browser couldn\u2019t resize the photo. Please try a smaller image.'
      );
    }

    let quality = L.primaryQuality;
    let dataUrl = exportJpeg(canvas, quality);
    if (!dataUrl) {
      return fail(
        'export-failed',
        'We Couldn\u2019t Prepare That Photo',
        'Your browser couldn\u2019t save the photo as a JPEG. Please try a different browser.'
      );
    }
    let approxBytes = base64ByteLength(dataUrl);

    if (approxBytes > L.maxOutputBytes) {
      // One retry at lower quality; never loop.
      quality = L.fallbackQuality;
      dataUrl = exportJpeg(canvas, quality);
      if (!dataUrl) {
        return fail(
          'export-failed',
          'We Couldn\u2019t Prepare That Photo',
          'Your browser couldn\u2019t save the photo as a JPEG. Please try a different browser.'
        );
      }
      approxBytes = base64ByteLength(dataUrl);
    }
    if (approxBytes > L.maxOutputBytes) {
      return fail(
        'output-too-large',
        'Photo Is Too Detailed',
        'Even after compression this photo is larger than ' + Math.round(L.maxOutputBytes / 1024) +
          ' KB. Please try a simpler or less detailed photo.'
      );
    }

    return {
      ok: true,
      dataUrl,
      width: L.outputSize,
      height: L.outputSize,
      approxBytes,
      sourceWidth: width,
      sourceHeight: height,
      quality
    };
  } catch (err) {
    return fail(
      'processing-failed',
      'Something Went Wrong',
      'We couldn\u2019t process that photo. Please try again or choose a different photo.'
    );
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    if (decoded && typeof decoded.release === 'function') {
      try { decoded.release(); } catch (err) { /* nothing to do */ }
    }
  }
}
