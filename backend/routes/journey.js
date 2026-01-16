import express from 'express';
import { User } from '../models/schemas.js';

const router = express.Router();

// 1. START JOURNEY (Updated to accept specific Date/Time)
router.post('/start', async (req, res) => {
  try {
    const { email, destination, eta } = req.body; // 'eta' is now a full ISO Date string

    const user = await User.findOneAndUpdate(
      { email },
      { 
        journey: {
          isActive: true,
          destination,
          eta: new Date(eta), // Convert string to Date object
          startTime: new Date()
        }
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.status(200).json({ success: true, journey: user.journey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. END JOURNEY (Keep as is)
router.post('/end', async (req, res) => {
  try {
    const { email } = req.body;
    await User.findOneAndUpdate(
      { email },
      { 'journey.isActive': false }
    );
    res.status(200).json({ success: true, message: "Journey ended" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET STATUS (Keep as is)
router.post('/status', async (req, res) => {
    try {
      const { userEmail } = req.body;
      const user = await User.findOne({ email: userEmail });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.status(200).json({ 
          journey: user.journey || { isActive: false },
          userName: user.name 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

export default router;