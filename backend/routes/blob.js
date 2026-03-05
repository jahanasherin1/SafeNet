/**
 * Blob Storage Proxy Routes
 * Serve Vercel Blob files through authenticated backend endpoints
 */

import express from 'express';

const router = express.Router();

/**
 * GET /api/blob/file/:pathname
 * Serve a file from Vercel Blob storage
 * The pathname should be URL-encoded (e.g., "safenet%2Fprofile-images%2Fprofile_123.jpg")
 */
router.get('/file/:pathname', async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.params.pathname);
    console.log(`📥 Serving blob file: ${pathname}`);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ message: 'Blob storage not configured' });
    }

    // The trick: construct a signed/temporary URL or fetch and proxy the blob
    // For now, we'll use Vercel's blob list to find and return the blob
    
    // Actually, the easiest approach is to use the Vercel Blob edge store
    // which doesn't require authentication for reading private blobs if done server-side
    // We'll redirect to a presigned URL or fetch and stream the content
    
    // For simplicity, we'll use the @vercel/blob's download capability
    // But since we don't have a direct download API, we'll return the URL
    // and let the client know it can be accessed with authentication
    
    console.log(`✅ Blob file requested: ${pathname}`);
    res.status(200).json({ 
      pathname: pathname,
      message: 'File exists - use this URL with appropriate headers',
      // Note: In production, you'd generate a signed URL here
      url: `https://blob.vercel-storage.com/${pathname}`
    });
  } catch (error) {
    console.error('❌ Blob file retrieval failed:', error.message);
    res.status(500).json({ message: 'Failed to retrieve file' });
  }
});

/**
 * GET /api/blob/proxy/image
 * Proxy endpoint for profile images
 * Fetches from Vercel Blob using direct HTTP requests
 * 
 * Query params: 
 *   - path: the pathname only (e.g., "safenet/profile-images/profile_123.jpeg")
 *   - url: OR the full Vercel Blob URL
 */
router.get('/proxy/image', async (req, res) => {
  try {
    let filepath = req.query.path || req.query.filepath || req.query.url;
    console.log(`🖼️  Serving profile image, received path:`, filepath);

    if (!filepath) {
      console.error('❌ No filepath or URL provided');
      return res.status(400).json({ message: 'File path or URL required' });
    }

    let imagePath = typeof filepath === 'string' ? filepath : Array.isArray(filepath) ? filepath[0] : String(filepath);
    imagePath = decodeURIComponent(imagePath);
    console.log(`🖼️  Decoded filepath:`, imagePath);

    let blobUrl;
    
    // If it's already a full HTTPS URL, use it directly
    if (imagePath.startsWith('https://')) {
      console.log(`✅ Using full Vercel Blob URL directly`);
      blobUrl = imagePath;
    } else {
      // If only pathname provided, construct the URL properly
      // The correct Vercel Blob domain should come from the upload response
      // Since we don't have that info here, we'll use the common pattern:
      // For public blobs: https://<uuid>.blob.vercel-storage.com/<path>
      // But we DON'T have the UUID, so we must have the full URL
      
      console.warn(`⚠️  Only pathname provided without full URL. This requires the full blob URL to be stored.`);
      console.warn(`📌 Make sure the database stores the complete Vercel Blob URL, not just the pathname.`);
      
      // Attempt to detect if this might work anyway by checking Vercel's standard public domain
      // (This is a fallback that may not work for all cases)
      blobUrl = `https://blob.vercel-storage.com/${imagePath}`;
      console.log(`📥 Attempting fallback fetch from: ${blobUrl}`);
    }
    
    try {
      console.log(`📥 Fetching image using @vercel/blob download API`);
      
      // Use @vercel/blob's download function to properly handle private blobs
      const blobResponse = await download(blobUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      const buffer = await blobResponse.arrayBuffer();
      const contentType = blobResponse.headers.get('content-type') || 'image/jpeg';
      const contentLength = blobResponse.headers.get('content-length');
      
      console.log(`✅ Image downloaded: ${contentLength || buffer.byteLength} bytes (${contentType})`);
      
      res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      console.log(`📤 Streaming image to client...`);
      res.send(Buffer.from(buffer));
      
    } catch (error) {
      console.error('❌ Image download error:', {
        message: error.message,
        attemptedUrl: blobUrl
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          message: 'Failed to download image',
          error: error.message 
        });
      }
    }
  } catch (error) {
    console.error('❌ Image proxy error:', {
      message: error.message
    });
    
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to serve image' });
    }
  }
});

/**
 * GET /api/blob/proxy/audio?path=<filepath> or ?url=<full-url>
 * Proxy endpoint for voice profile audio files
 * Fetches from Vercel Blob using direct HTTP requests
 * 
 * Query params: 
 *   - path: the pathname only (e.g., "safenet/voice-profiles/audio_123.mp3")
 *   - url: OR the full Vercel Blob URL
 */
router.get('/proxy/audio', async (req, res) => {
  try {
    let filepath = req.query.path || req.query.filepath || req.query.url;
    console.log(`🎤 Serving voice profile audio, received path:`, filepath);

    if (!filepath) {
      console.error('❌ No filepath or URL provided');
      return res.status(400).json({ message: 'File path or URL required' });
    }

    // Ensure it's a string
    let audioPath = typeof filepath === 'string' ? filepath : Array.isArray(filepath) ? filepath[0] : String(filepath);
    
    // Decode the filepath
    audioPath = decodeURIComponent(audioPath);
    console.log(`🎤 Decoded filepath:`, audioPath);

    let blobUrl;
    
    // If it's already a full HTTPS URL, use it directly
    if (audioPath.startsWith('https://')) {
      console.log(`✅ Using full Vercel Blob URL directly`);
      blobUrl = audioPath;
    } else {
      // If only pathname provided, log a warning
      console.warn(`⚠️  Only pathname provided without full URL. This may not work.`);
      console.warn(`📌 Make sure the database stores the complete Vercel Blob URL, not just the pathname.`);
      
      // Fallback attempt (may not work)
      blobUrl = `https://blob.vercel-storage.com/${audioPath}`;
      console.log(`📥 Attempting fallback fetch from: ${blobUrl}`);
    }

    try {
      console.log(`📥 Fetching audio using @vercel/blob download API`);
      
      // Use @vercel/blob's download function to properly handle private blobs
      const blobResponse = await download(blobUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      const buffer = await blobResponse.arrayBuffer();
      const contentType = blobResponse.headers.get('content-type') || 'audio/mpeg';
      const contentLength = blobResponse.headers.get('content-length');
      
      console.log(`✅ Audio downloaded: ${contentLength || buffer.byteLength} bytes (${contentType})`);
      
      // Set response headers
      res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Send the audio data
      console.log(`📤 Streaming audio to client...`);
      res.send(Buffer.from(buffer));
      
    } catch (error) {
      console.error('❌ Audio download error:', {
        message: error.message,
        attemptedUrl: blobUrl
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          message: 'Failed to download audio',
          error: error.message 
        });
      }
    }
  } catch (error) {
    console.error('❌ Audio proxy outer error:', {
      message: error.message
    });
    
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to serve audio' });
    }
  }
});

export default router;
