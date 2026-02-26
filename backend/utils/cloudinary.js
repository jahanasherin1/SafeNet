// backend/utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary with credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Profile Image Storage ───
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'safenet/profile-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
    public_id: (req, file) => `profile_${Date.now()}`,
  },
});

// ─── Voice / Audio Storage ───
// Cloudinary treats audio as resource_type 'video'
const voiceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'safenet/voice-profiles',
    resource_type: 'video',           // required for audio files
    allowed_formats: ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'mp4', '3gp', 'flac', 'wma'],
    public_id: (req, file) => `voice_${Date.now()}`,
  },
});

export const upload = multer({ storage: imageStorage });
export const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
export { cloudinary };

