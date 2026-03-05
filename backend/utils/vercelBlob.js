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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ CRITICAL: BLOB_READ_WRITE_TOKEN is NOT set');
    console.error('Environment variables available:', Object.keys(process.env).filter(k => k.toUpperCase().includes('BLOB')));
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set. Cannot upload to Vercel Blob.');
  }

  console.log(`📤 uploadToBlob called: ${pathname} (${contentType}, ${buffer.length} bytes)`);
  console.log(`🔑 BLOB token exists: ${!!process.env.BLOB_READ_WRITE_TOKEN}`);
  console.log(`🔑 BLOB token preview: ${process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 20)}...`);

  try {
    const blobConfig = {
      access: 'private',  // Required by @vercel/blob API - use 'private' for this store
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    };
    
    console.log(`📤 Calling @vercel/blob put() with config:`, { access: 'private', contentType });
    
    const blob = await put(pathname, buffer, blobConfig);

    console.log(`✅ Vercel Blob upload successful`);
    console.log(`   URL: ${blob.url}`);
    console.log(`   Pathname: ${blob.pathname}`);
    
    return {
      url: blob.url,
      pathname: blob.pathname,
    };
  } catch (error) {
    console.error('❌ Vercel Blob upload failed:', {
      message: error.message,
      code: error.code,
      name: error.name,
      status: error.status,
      statusCode: error.statusCode,
      path: pathname,
      bufferSize: buffer.length,
      stack: error.stack?.split('\n')[0]
    });
    throw error;
  }
};

/**
 * Delete a file from Vercel Blob Storage by URL.
 * @param {string} url - The full Vercel Blob URL of the file to delete
 * @returns {Promise<void>}
 */
export const deleteFromBlob = async (url) => {
  if (!url) return;
  
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('⚠️ BLOB_READ_WRITE_TOKEN not set, skipping delete');
    return;
  }

  console.log(`🗑️ Deleting from Vercel Blob: ${url}`);
  try {
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    console.log(`✅ Vercel Blob delete successful`);
  } catch (error) {
    console.error('❌ Vercel Blob delete failed:', {
      message: error.message,
      code: error.code,
      url: url
    });
    // Non-fatal - continue anyway
  }
};
