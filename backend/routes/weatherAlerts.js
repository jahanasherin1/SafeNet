import express from 'express';
import { Alert, User } from '../models/schemas.js';
import { createAlert } from './alerts.js';

const router = express.Router();

/**
 * Weather alert endpoint
 * Stores alert in database for user's alert history
 * Guardians will NOT see these alerts (user-only)
 */
router.post('/send', async (req, res) => {
  try {
    const { userEmail, userName, safetyLevel, weatherCondition, primaryHazard, hazards, recommendations } = req.body;

    console.log('🌤️ Weather alert received');
    console.log('   User:', userEmail);
    console.log('   Level:', safetyLevel);

    if (!userEmail || !safetyLevel) {
      return res.status(400).json({ message: 'Missing required fields', success: false });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error('❌ User not found:', userEmail);
      return res.status(404).json({ message: 'User not found', success: false });
    }

    const displayName = userName || user.name || 'User';

    // Check for duplicate weather alert in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentAlert = await Alert.findOne({
      userEmail: user.email,
      type: 'weather',
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (recentAlert && recentAlert.metadata?.safetyLevel === safetyLevel && 
        recentAlert.metadata?.weatherCondition === weatherCondition) {
      console.log('⏳ Similar weather alert already sent recently, skipping duplicate');
      return res.status(200).json({
        message: 'Weather alert already sent recently (duplicate prevented)',
        success: true,
        alertCreated: false,
        isDuplicate: true
      });
    }

    // Create alert for user's weather alert history
    console.log('📝 Creating weather alert in database...');
    const createdAlert = await createAlert({
      userEmail: user.email,
      userName: displayName,
      type: 'weather',
      title: `🌤️ Weather Alert - ${safetyLevel.toUpperCase()}`,
      message: `${displayName}: ${weatherCondition} - ${primaryHazard || 'Hazardous conditions'}`,
      location: user.currentLocation || { latitude: 0, longitude: 0 },
      metadata: {
        safetyLevel: safetyLevel,
        weatherCondition: weatherCondition,
        primaryHazard: primaryHazard,
        hazards: hazards || [],
        recommendations: recommendations || [],
        timestamp: new Date().toISOString()
      }
    });

    if (createdAlert) {
      console.log(`✅ Weather alert created with ID: ${createdAlert._id}`);
    } else {
      console.warn('⚠️ Weather alert was not created in database');
    }
    
    res.status(200).json({
      message: 'Weather alert processed',
      success: true,
      alertCreated: !!createdAlert,
      alertId: createdAlert?._id
    });

  } catch (error) {
    console.error('❌ Weather alert error:', error.message);
    res.status(500).json({ message: 'Failed to process weather alert', error: error.message, success: false });
  }
});

export default router;
