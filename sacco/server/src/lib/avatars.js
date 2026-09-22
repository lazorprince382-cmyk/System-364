import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
export const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function ensureUploadDirs() {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

/**
 * Save a data-URL / base64 image for a user. Returns public path /uploads/avatars/...
 */
export function saveAvatarFromDataUrl(userId, dataUrl) {
  ensureUploadDirs();
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Upload a JPG, PNG, WEBP, or GIF image');
  const mime = match[1].toLowerCase();
  const ext = ALLOWED[mime];
  if (!ext) throw new Error('Use JPG, PNG, WEBP, or GIF only');
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 2.5 * 1024 * 1024) throw new Error('Image must be under 2.5 MB');
  // remove previous extensions for this user
  for (const old of fs.readdirSync(AVATARS_DIR)) {
    if (old.startsWith(`${userId}.`)) {
      try {
        fs.unlinkSync(path.join(AVATARS_DIR, old));
      } catch {
        /* ignore */
      }
    }
  }
  const filename = `${userId}.${ext}`;
  fs.writeFileSync(path.join(AVATARS_DIR, filename), buf);
  return `/uploads/avatars/${filename}`;
}
