// backend/utils/vercelBlob.js
// Upload/delete files using Vercel Blob Storage (@vercel/blob)
import { del, put } from '@vercel/blob';
import multer from 'multer';

// Use memory storage — we stream the buffer directly to Vercel Blob
const memoryStorage = multer.memoryStorage();

// Multer instance for profile images (5 MB limit)
export const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

// Multer instance for voice/audio files (10 MB limit)
export const uploadVoice = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(mp3|wav|m4a|ogg|aac|mp4|3gp|flac|wma)$/i;
    if (
      allowedExts.test(file.originalname) ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/octet-stream'
    ) {
      return cb(null, true);
    }
    cb(new Error('Only audio files are allowed'));
  },
});

/**
 * Upload a buffer to Vercel Blob Storage.
 * @param {Buffer} buffer  - File buffer from multer memoryStorage
 * @param {object} options - { folder, filename, contentType }
 * @returns {Promise<{url: string, pathname: string}>}
 */
export const uploadToBlob = async (buffer, options = {}) => {
  const folder = options.folder || 'uploads';
  const filename = options.filename || `file_${Date.now()}`;
  const contentType = options.contentType || 'application/octet-stream';

  const pathname = `${folder}/${filename}`;

  console.log(`📤 Uploading to Vercel Blob: ${pathname} (${contentType})`);

  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  console.log(`✅ Vercel Blob upload successful: ${blob.url}`);
  return {
    url: blob.url,
    pathname: blob.pathname,
  };
};

/**
 * Delete a file from Vercel Blob Storage by URL.
 * @param {string} url - The full Vercel Blob URL of the file to delete
 * @returns {Promise<void>}
 */
export const deleteFromBlob = async (url) => {
  if (!url) return;
  console.log(`🗑️ Deleting from Vercel Blob: ${url}`);
  await del(url, {
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  console.log(`✅ Vercel Blob delete successful`);
};
