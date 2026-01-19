import express from 'express';
import multer from 'multer';
import { User } from '../models/schemas.js';

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/voices/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Allow audio files - be more lenient with mimetype checking
    const allowedExts = /\.(mp3|wav|m4a|ogg|aac|mp4|3gp|flac|wma)$/i;
    const filename = file.originalname.toLowerCase();
    
    // Check file extension
    if (allowedExts.test(filename)) {
      return cb(null, true);
    }
    
    // Also check mimetype if available
    if (file.mimetype && file.mimetype.startsWith('audio/')) {
      return cb(null, true);
    }
    
    // For React Native, sometimes mimetype is application/octet-stream
    // So we'll allow it if the extension is correct
    if (file.mimetype === 'application/octet-stream' && allowedExts.test(filename)) {
      return cb(null, true);
    }
    
    console.log('File rejected:', { filename: file.originalname, mimetype: file.mimetype });
    cb(new Error('Only audio files are allowed!'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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

// POST - Add new voice profile with audio upload
router.post('/add', upload.single('audioFile'), async (req, res) => {
  try {
    const { email, name, id, dateAdded } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create audio URI for the uploaded file
    const audioUri = `/uploads/voices/${req.file.filename}`;

    const newVoice = {
      id: id || Date.now().toString(),
      name,
      audioUri,
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

// DELETE - Remove voice profile
router.delete('/:email/:voiceId', async (req, res) => {
  try {
    const { email, voiceId } = req.params;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
