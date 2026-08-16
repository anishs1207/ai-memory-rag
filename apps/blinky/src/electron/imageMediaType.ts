export type ClaudeImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/** Infer the media type from base64 file signatures so the API header matches the bytes. */
export function detectImageMediaType(base64Image: string): ClaudeImageMediaType {
  if (base64Image.startsWith('iVBOR')) return 'image/png';
  if (base64Image.startsWith('/9j/')) return 'image/jpeg';
  if (base64Image.startsWith('R0lG')) return 'image/gif';
  if (base64Image.startsWith('UklGR')) return 'image/webp';
  throw new Error('Unsupported screenshot format. Expected PNG, JPEG, GIF, or WebP.');
}
