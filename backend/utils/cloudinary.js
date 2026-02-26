// backend/utils/cloudinary.js
// Upload to Cloudinary API via HTTP (no SDK to avoid ESM/CJS conflicts)
import axios from 'axios';
import crypto from 'crypto';
import multer from 'multer';

// Use memory storage — we stream the buffer directly to Cloudinary
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
 * Upload a buffer to Cloudinary via HTTP API (authenticated).
 * @param {Buffer} buffer  - File buffer from multer memoryStorage
 * @param {object} options - Upload options (folder, public_id, resource_type, transformation, etc.)
 * @returns {Promise<{url: string, public_id: string, transformedUrl?: string}>}
 */
export const uploadToCloudinary = async (buffer, options = {}) => {
  // CRITICAL: Extract transformation BEFORE creating FormData to prevent it from being serialized
  // This MUST happen first - do NOT append transformation to FormData under any circumstances
  const transformation = options.transformation;
  
  // Create FormData with ONLY safe parameters (explicitly list what to append - never transformation)
  const formData = new FormData();
  const blob = new Blob([buffer]);
  
  formData.append('file', blob);
  console.log('✓ Appended file');
  
  formData.append('api_key', process.env.CLOUDINARY_API_KEY);
  console.log('✓ Appended api_key');
  
  // ONLY append these specific fields - nothing from transformation
  const folder = options.folder;
  const public_id = options.public_id;
  const resource_type = options.resource_type;
  
  console.log('📤 Appending safe fields:', { folder, public_id, resource_type, hasTransformation: !!transformation });
  
  if (folder) {
    formData.append('folder', folder);
    console.log('✓ Appended folder');
  }
  if (public_id) {
    formData.append('public_id', public_id);
    console.log('✓ Appended public_id');
  }
  if (resource_type) {
    formData.append('resource_type', resource_type);
    console.log('✓ Appended resource_type');
  }
  
  // Use authenticated upload with signature (always, for both images and audio)
  // This works without needing special unsigned presets
  const timestamp = Math.floor(Date.now() / 1000);
  formData.append('timestamp', timestamp.toString());
  console.log('✓ Appended timestamp');

  // Build params for signature - DO NOT include api_key in the signature!
  // Signature is only for: folder, public_id, resource_type, timestamp
  const paramsToSign = {
    timestamp: timestamp.toString(),
  };
  if (folder) paramsToSign.folder = folder;
  if (public_id) paramsToSign.public_id = public_id;
  if (resource_type) paramsToSign.resource_type = resource_type;

  // Create signature string: sort keys, join with &, then append API_SECRET
  const paramsString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&');

  console.log('🔑 Signature string:', paramsString);
  const signature = crypto
    .createHash('sha1')
    .update(paramsString + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  formData.append('signature', signature);
  console.log('✓ Appended signature');

  // NEVER append transformation to FormData - Cloudinary upload endpoint doesn't accept it
  // We will apply transformation to the URL instead after upload completes

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  try {
    console.log('📤 Sending request to Cloudinary...');
    const response = await axios.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    let secureUrl = response.data.secure_url;
    
    // Apply transformation to URL ONLY (URL-based transformation, not upload parameter)
    if (transformation) {
      console.log('📐 Applying transformation to uploaded URL');
      secureUrl = applyCloudinaryTransformationToUrl(secureUrl, transformation);
    }
    
    console.log(`✅ Upload successful: ${response.data.public_id}`);
    return {
      url: secureUrl,
      public_id: response.data.public_id,
    };
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Apply Cloudinary transformations to a URL
 * @param {string} url - Original Cloudinary URL
 * @param {object|array} transformation - Transformation object or array
 * @returns {string} - URL with transformation applied
 */
export const applyCloudinaryTransformationToUrl = (url, transformation) => {
  if (!transformation) return url;
  
  // Handle array of transformations
  const transforms = Array.isArray(transformation) ? transformation : [transformation];
  
  // Build transformation string
  let transformString = '';
  transforms.forEach((t, index) => {
    const transformParts = [];
    
    if (t.width) transformParts.push(`w_${t.width}`);
    if (t.height) transformParts.push(`h_${t.height}`);
    if (t.crop) transformParts.push(`c_${t.crop}`);
    if (t.quality) transformParts.push(`q_${t.quality}`);
    if (t.gravity) transformParts.push(`g_${t.gravity}`);
    if (t.format) transformParts.push(`f_${t.format}`);
    
    if (transformParts.length > 0) {
      transformString += transformParts.join(',');
      if (index < transforms.length - 1) transformString += '/';
    }
  });
  
  if (!transformString) return url;
  
  // Insert transformation into URL (after /upload/)
  return url.replace(/\/upload\//, `/upload/${transformString}/`);
};

/**
 * Delete a file from Cloudinary via HTTP API.
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<void>}
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    public_id: publicId,
    resource_type: resourceType,
    timestamp,
  };

  // Build signature for authenticated delete
  const signatureString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&') + apiSecret;

  const crypto = await import('crypto');
  const signature = crypto.default.createHash('sha1').update(signatureString).digest('hex');

  const formData = new URLSearchParams(params);
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;
  await axios.post(url, formData);
};

