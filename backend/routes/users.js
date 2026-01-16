// --- backend/routes/users.js ---

import express from 'express';
import { User } from '../models/schemas.js';

const router = express.Router();

// Update User Location
router.post('/update-location', async (req, res) => {
  try {
    const { email, latitude, longitude } = req.body;

    if (!email || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Missing required fields: email, latitude, longitude' });
    }

    // Find and update user location
    const user = await User.findOneAndUpdate(
      { email },
      {
        currentLocation: {
          latitude,
          longitude,
          timestamp: new Date()
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ 
      message: 'Location updated successfully',
      timestamp: user.currentLocation.timestamp
    });

  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({ message: 'Failed to update location' });
  }
});

export default router;