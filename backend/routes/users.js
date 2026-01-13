import express from 'express';
import { User } from '../models/schemas.js';

const router = express.Router();

// Update User Location
router.post('/update-location', async (req, res) => {
  try {
    const { userEmail, location } = req.body;
    const { latitude, longitude } = location;

    if (!userEmail || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Missing required fields: userEmail, location' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.currentLocation = {
      latitude,
      longitude,
      timestamp: new Date()
    };

    await user.save();

    res.status(200).json({ 
      message: 'Location updated successfully',
      currentLocation: user.currentLocation
    });

  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({ message: 'Failed to update location' });
  }
});

export default router;
