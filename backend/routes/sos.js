import express from 'express';
import { User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';
import { createAlert } from './alerts.js';

const router = express.Router();

// 9. Trigger SOS / Activity Alert
router.post('/trigger', async (req, res) => {
  try {
    const { userEmail, userName, location, reason, alertType, timestamp } = req.body;
    const { latitude, longitude } = location || { latitude: 0, longitude: 0 };

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.sosActive = true;
    user.lastSosTime = new Date();
    
    if (latitude && longitude) {
      user.currentLocation = {
          latitude,
          longitude,
          timestamp: new Date()
      };
    }

    await user.save();

    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const alertReason = reason || "SOS Button Triggered";
    const displayName = userName || user.name || 'User';
    
    // Customize email based on alert type
    let emailSubject, emailBody, alertTitle, alertIcon;
    
    if (alertType === 'ACTIVITY_MONITOR') {
      // Activity monitoring alerts (fall, running, sudden stop)
      if (reason.includes('FALL')) {
        alertIcon = '🆘';
        alertTitle = 'Fall Detected Alert';
        emailSubject = `🆘 URGENT: ${displayName} may have fallen!`;
        emailBody = `URGENT ALERT\n\n${displayName}'s safety app has detected a potential FALL.\n\nThis alert was triggered by unusual movement patterns detected by their phone's sensors.\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease check on them immediately!\n\nIf you cannot reach them, consider contacting emergency services.`;
      } else if (reason.includes('SUDDEN STOP')) {
        alertIcon = '⚠️';
        alertTitle = 'Sudden Stop Alert';
        emailSubject = `⚠️ Alert: ${displayName} stopped suddenly while running`;
        emailBody = `SAFETY ALERT\n\n${displayName}'s safety app detected a sudden stop while they were running.\n\nThis could indicate they:\n- Stopped to rest\n- Encountered an obstacle\n- May need assistance\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease check in with them to ensure they're okay.`;
      } else if (reason.includes('RUNNING') || reason.includes('PROLONGED')) {
        alertIcon = '🏃';
        alertTitle = 'Prolonged Running Alert';
        emailSubject = `🏃 Alert: ${displayName} has been running for an extended period`;
        emailBody = `ACTIVITY ALERT\n\n${displayName}'s safety app detected prolonged running activity.\n\nThis could indicate they:\n- Are exercising\n- May be fleeing from a situation\n- Need to be checked on\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease reach out to verify they are safe.`;
      } else {
        alertIcon = '📱';
        alertTitle = 'Activity Alert';
        emailSubject = `📱 Safety Alert: ${displayName} - ${alertReason}`;
        emailBody = `SAFETY ALERT\n\n${displayName}'s safety app detected unusual activity.\n\nAlert: ${alertReason}\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease check on them.`;
      }
    } else {
      // Standard SOS alert
      alertIcon = '🚨';
      alertTitle = 'SOS Emergency Alert';
      emailSubject = `🚨 EMERGENCY: ${displayName} needs help!`;
      emailBody = `URGENT: ${displayName} has triggered an emergency SOS alert.\n\nReason: ${alertReason}\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease respond immediately!`;
    }

    // Send email to all guardians
    let emailsSent = 0;
    for (const guardian of user.guardians) {
      if (guardian.email) {
        try {
          await sendEmail(guardian.email, emailSubject, emailBody);
          emailsSent++;
          console.log(`📧 Alert email sent to ${guardian.name} (${guardian.email})`);
        } catch (emailError) {
          console.error(`Failed to send email to ${guardian.email}:`, emailError.message);
        }
      }
    }

    // Send push notifications to guardians (removed - using local notifications in frontend)
    let pushNotificationsSent = 0;

    // Create alert notification for guardian dashboard
    await createAlert({
      userEmail: user.email,
      userName: displayName,
      type: alertType === 'ACTIVITY_MONITOR' ? 'activity' : 'sos',
      title: `${alertIcon} ${alertTitle}`,
      message: `${displayName}: ${alertReason}`,
      location: { latitude, longitude },
      metadata: {
        mapsLink,
        reason: alertReason,
        alertType: alertType || 'sos',
        guardianCount: user.guardians.length,
        emailsSent,
        pushNotificationsSent,
        timestamp: timestamp || new Date().toISOString()
      }
    });

    console.log(`🚨 ${alertType || 'SOS'} Alert for ${displayName} - Reason: ${alertReason} (${emailsSent} emails, ${pushNotificationsSent} push notifications sent)`);
    res.status(200).json({ 
      message: 'Alert sent successfully',
      emailsSent,
      pushNotificationsSent,
      guardianCount: user.guardians.length
    });

  } catch (error) {
    console.error('SOS/Alert trigger error:', error);
    res.status(500).json({ message: 'Failed to trigger alert' });
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
