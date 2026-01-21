import express from 'express';
import { User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';
import { createAlert } from './alerts.js';

const router = express.Router();

// 9. Trigger SOS
router.post('/trigger', async (req, res) => {
  try {
    const { userEmail, location, reason } = req.body;
    const { latitude, longitude } = location;

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.sosActive = true;
    user.lastSosTime = new Date();
    
    user.currentLocation = {
        latitude,
        longitude,
        timestamp: new Date()
    };

    await user.save();

    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const alertReason = reason || "SOS Button Triggered"; // Default if not provided
    const emailSubject = `🚨 EMERGENCY: ${alertReason}!`;
    const emailBody = `URGENT: ${user.name} requires help.\n\nReason: ${alertReason}\n\nLocation: ${mapsLink}`;

    user.guardians.forEach(g => {
      if (g.email) sendEmail(g.email, emailSubject, emailBody);
    });

    // Create alert notification
    await createAlert({
      userEmail: user.email,
      userName: user.name,
      type: 'sos',
      title: '🚨 SOS Alert',
      message: `${user.name} triggered an emergency alert: ${alertReason}!`,
      location: { latitude, longitude },
      metadata: {
        mapsLink,
        reason: alertReason,
        guardianCount: user.guardians.length
      }
    });

    console.log(`SOS Triggered for ${user.name} - Reason: ${alertReason}`);
    res.status(200).json({ message: 'SOS Active' });

  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger SOS' });
  }
});

// 10. Resolve SOS
router.post('/resolve', async (req, res) => {
  try {
    const { userEmail } = req.body;
    await User.updateOne({ email: userEmail }, { sosActive: false });
    res.status(200).json({ message: 'SOS Resolved' });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

// 11. Check Status
router.post('/status', async (req, res) => {
  try {
    const { protectingEmail } = req.body;
    const user = await User.findOne({ email: protectingEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ 
        isSosActive: user.sosActive,
        lastSosTime: user.lastSosTime,
        location: user.currentLocation,
        profileImage: user.profileImage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
