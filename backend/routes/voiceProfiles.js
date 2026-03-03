import express from 'express';
import { User } from '../models/schemas.js';
import { deleteFromBlob, uploadToBlob, uploadVoice } from '../utils/vercelBlob.js';

const router = express.Router();

// GET all voice profiles for a user
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ voiceProfiles: user.voiceProfiles || [] });
  } catch (error) {
    console.error('Error fetching voice profiles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST - Add new voice profile with audio upload to Cloudinary
router.post('/add', uploadVoice.single('audioFile'), async (req, res) => {
  try {
    const { email, name, id, dateAdded } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Upload buffer to Vercel Blob
    const ext = req.file.originalname.split('.').pop() || 'mp3';
    const result = await uploadToBlob(req.file.buffer, {
      folder: 'safenet/voice-profiles',
      filename: `voice_${Date.now()}.${ext}`,
      contentType: req.file.mimetype || 'audio/mpeg',
    });

    const newVoice = {
      id: id || Date.now().toString(),
      name,
      audioUri: result.url,      // Vercel Blob HTTPS URL
      audioPublicId: result.url, // Store URL here too for deletion
      audioName: req.file.originalname,
      dateAdded: dateAdded || new Date()
    };

    user.voiceProfiles.push(newVoice);
    await user.save();

    res.status(200).json({
      message: 'Voice profile added successfully',
      voiceProfile: newVoice
    });
  } catch (error) {
    console.error('Error adding voice profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE - Remove voice profile and delete audio from Cloudinary
router.delete('/:email/:voiceId', async (req, res) => {
  try {
    const { email, voiceId } = req.params;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the voice to get its Vercel Blob URL before removing
    const voiceToDelete = user.voiceProfiles.find(v => v.id === voiceId);
    const blobUrlToDelete = voiceToDelete?.audioUri || voiceToDelete?.audioPublicId;
    if (blobUrlToDelete && blobUrlToDelete.startsWith('https://')) {
      try {
        await deleteFromBlob(blobUrlToDelete);
        console.log(`🗑️ Deleted voice from Vercel Blob: ${blobUrlToDelete}`);
      } catch (blobErr) {
        console.warn('⚠️ Could not delete voice from Vercel Blob:', blobErr.message);
      }
    }

    user.voiceProfiles = user.voiceProfiles.filter(v => v.id !== voiceId);
    await user.save();

    res.status(200).json({ message: 'Voice profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting voice profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
