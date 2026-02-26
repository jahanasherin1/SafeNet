import express from 'express';
import { User } from '../models/schemas.js';
import { deleteFromCloudinary, uploadToCloudinary, uploadVoice } from '../utils/cloudinary.js';

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

    // Upload buffer to Cloudinary (audio must use resource_type 'video')
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'safenet/voice-profiles',
      resource_type: 'video',
      public_id: `voice_${Date.now()}`,
    });

    const newVoice = {
      id: id || Date.now().toString(),
      name,
      audioUri: result.url,           // Cloudinary HTTPS URL
      audioPublicId: result.public_id, // Cloudinary public_id (for deletion)
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

    // Find the voice to get its Cloudinary public_id before removing
    const voiceToDelete = user.voiceProfiles.find(v => v.id === voiceId);
    if (voiceToDelete?.audioPublicId) {
      try {
        await deleteFromCloudinary(voiceToDelete.audioPublicId, 'video');
        console.log(`🗑️ Deleted voice from Cloudinary: ${voiceToDelete.audioPublicId}`);
      } catch (cloudErr) {
        console.warn('⚠️ Could not delete voice from Cloudinary:', cloudErr.message);
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
