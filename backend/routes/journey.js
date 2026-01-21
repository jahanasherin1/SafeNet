import express from 'express';
import { User } from '../models/schemas.js';
import { createAlert } from './alerts.js';

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
    
    // Create alert notification for guardians
    await createAlert({
      userEmail: user.email,
      userName: user.name,
      type: 'journey_started',
      title: '🚶 Journey Started',
      message: `${user.name} started a journey to ${destination}. Expected arrival: ${new Date(eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      location: user.location,
      metadata: {
        destination,
        eta: new Date(eta),
        startTime: new Date()
      }
    });
    
    res.status(200).json({ success: true, journey: user.journey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. END JOURNEY (Keep as is)
router.post('/end', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOneAndUpdate(
      { email },
      { 'journey.isActive': false },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Create alert notification for guardians
    await createAlert({
      userEmail: user.email,
      userName: user.name,
      type: 'journey_completed',
      title: '✅ Journey Completed',
      message: `${user.name} has safely completed their journey.`,
      location: user.location,
      metadata: {
        endTime: new Date()
      }
    });
    
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
      
      // Check if journey is delayed
      if (user.journey?.isActive && user.journey?.eta) {
        const now = new Date();
        const eta = new Date(user.journey.eta);
        const isDelayed = now > eta;
        
        // If delayed and we haven't sent a delay alert yet (check metadata or last alert)
        if (isDelayed) {
          // Check if we already sent a delayed alert for this journey
          const { Alert } = await import('../models/schemas.js');
          const existingDelayAlert = await Alert.findOne({
            userEmail: user.email,
            type: 'journey_delayed',
            'metadata.journeyStartTime': user.journey.startTime,
            createdAt: { $gte: user.journey.startTime }
          });
          
          // Only create delay alert if we haven't already sent one for this journey
          if (!existingDelayAlert) {
            const delayMinutes = Math.floor((now - eta) / 60000);
            await createAlert({
              userEmail: user.email,
              userName: user.name,
              type: 'journey_delayed',
              title: '⏰ Journey Delayed',
              message: `${user.name}'s journey is running late by ${delayMinutes} minutes. Last known location shared.`,
              location: user.location,
              metadata: {
                delayMinutes,
                expectedETA: eta,
                journeyStartTime: user.journey.startTime
              }
            });
          }
        }
      }
      
      res.status(200).json({ 
          journey: user.journey || { isActive: false },
          userName: user.name,
          currentLocation: user.location
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

export default router;