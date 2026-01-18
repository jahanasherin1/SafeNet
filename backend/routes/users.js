// --- backend/routes/users.js ---

import express from 'express';
import { User } from '../models/schemas.js';

const router = express.Router();

// Update User Location
router.post('/update-location', async (req, res) => {
  try {
    const { email, latitude, longitude, isBackgroundUpdate } = req.body;

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
          timestamp: new Date(),
          isBackgroundUpdate: isBackgroundUpdate || false
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log background updates differently
    if (isBackgroundUpdate) {
      console.log(`📍 Background location update for ${email}: (${latitude}, ${longitude})`);
    } else {
      console.log(`📍 Manual location update for ${email}: (${latitude}, ${longitude})`);
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

// Get User's Current Live Location (for guardians)
router.get('/location/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.currentLocation) {
      return res.status(200).json({ 
        message: 'No location available',
        location: null 
      });
    }

    res.status(200).json({ 
      message: 'Live location retrieved',
      email: user.email,
      name: user.name,
      location: {
        latitude: user.currentLocation.latitude,
        longitude: user.currentLocation.longitude,
        timestamp: user.currentLocation.timestamp,
        isBackgroundUpdate: user.currentLocation.isBackgroundUpdate
      }
    });

  } catch (error) {
    console.error("Get Location Error:", error);
    res.status(500).json({ message: 'Failed to get location' });
  }
});

export default router;