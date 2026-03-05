import express from 'express';
import { User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';
import sendSMS from '../utils/sendSMS.js';
import { createAlert } from './alerts.js';

const router = express.Router();

// 9. Trigger SOS / Activity Alert
router.post('/trigger', async (req, res) => {
  try {
    console.log('🔔 SOS TRIGGER - Request received');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    
    const { userEmail, userName, location, reason, alertType, timestamp } = req.body;
    const { latitude, longitude } = location || { latitude: 0, longitude: 0 };

    console.log('📝 Parsed data - Email:', userEmail, 'Name:', userName, 'Type:', alertType);
    console.log('📍 Location:', latitude, longitude);

    const user = await User.findOne({ email: userEmail });
    console.log('🔍 User lookup result:', user ? `Found: ${user.name}` : 'NOT FOUND');
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
    console.log('✅ User SOS status updated');

    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const alertReason = reason || "SOS Button Triggered";
    const displayName = userName || user.name || 'User';
    
    // Customize email based on alert type
    let emailSubject, emailBody, alertTitle, alertIcon;
    
    if (alertType === 'HIGH_RISK_AREA') {
      // High risk area alert
      alertIcon = (reason && reason.includes('CRITICAL')) ? '🚨' : '⚠️';
      alertTitle = 'High Risk Area Alert';
      emailSubject = `${alertIcon} ALERT: ${displayName} entered a high-risk crime area`;
      emailBody = `SAFETY ALERT\n\n${displayName} has entered a high-risk crime area based on recent crime statistics.\n\nAlert Details:\n${reason}\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nThis is an automatic alert based on crime data analysis. Please check in with them to ensure they're aware of the area's risk level.\n\nThey can view detailed crime statistics in their SafeNet app.`;
    } else if (alertType === 'ACTIVITY_MONITOR') {
      // Activity monitoring alerts (fall, running, sudden stop)
      if (reason && reason.includes('FALL')) {
        alertIcon = '🆘';
        alertTitle = 'Fall Detected Alert';
        emailSubject = `🆘 URGENT: ${displayName} may have fallen!`;
        emailBody = `URGENT ALERT\n\n${displayName}'s safety app has detected a potential FALL.\n\nThis alert was triggered by unusual movement patterns detected by their phone's sensors.\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease check on them immediately!\n\nIf you cannot reach them, consider contacting emergency services.`;
      } else if (reason && reason.includes('SUDDEN STOP')) {
        alertIcon = '⚠️';
        alertTitle = 'Sudden Stop Alert';
        emailSubject = `⚠️ Alert: ${displayName} stopped suddenly while running`;
        emailBody = `SAFETY ALERT\n\n${displayName}'s safety app detected a sudden stop while they were running.\n\nThis could indicate they:\n- Stopped to rest\n- Encountered an obstacle\n- May need assistance\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease check in with them to ensure they're okay.`;
      } else if (reason && (reason.includes('RUNNING') || reason.includes('PROLONGED'))) {
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
    } else if (alertType === 'TILE_SOS') {
      // Quick Settings Tile SOS alert
      alertIcon = '🚨';
      alertTitle = 'Quick Settings Tile SOS Alert';
      emailSubject = `🚨 EMERGENCY: ${displayName} triggered SOS from Quick Settings!`;
      emailBody = `URGENT: ${displayName} has triggered an emergency SOS alert from their device's Quick Settings.\n\nThis indicates they need immediate assistance.\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease respond immediately and check on them!`;
    } else {
      // Standard SOS alert
      alertIcon = '🚨';
      alertTitle = 'SOS Emergency Alert';
      emailSubject = `🚨 EMERGENCY: ${displayName} needs help!`;
      emailBody = `URGENT: ${displayName} has triggered an emergency SOS alert.\n\nReason: ${alertReason}\n\nTime: ${new Date().toLocaleString()}\nLocation: ${mapsLink}\n\nPlease respond immediately!`;
    }

    // Send email to all guardians
    let emailsSent = 0;
    let smsSent = 0;
    console.log(`📋 User has ${user.guardians.length} guardians`);
    for (const guardian of user.guardians) {
      if (guardian.email) {
        try {
          console.log(`📨 Attempting to send email to ${guardian.name} (${guardian.email})`);
          await sendEmail(guardian.email, emailSubject, emailBody);
          emailsSent++;
          console.log(`✅ Alert email sent successfully to ${guardian.name} (${guardian.email})`);
        } catch (emailError) {
          console.error(`❌ Failed to send email to ${guardian.email}:`, emailError.message);
          console.error(`📧 Email error details:`, emailError);
        }
      } else {
        console.warn(`⚠️ Guardian ${guardian.name} has no email address`);
      }

      // Send SMS to guardians with phone numbers
      if (guardian.phone) {
        try {
          console.log(`📱 Attempting to send SMS to ${guardian.name} (${guardian.phone})`);
          
          // Craft SMS message (shorter for SMS format)
          let smsMessage = '';
          if (alertType === 'HIGH_RISK_AREA') {
            smsMessage = `🚨 ALERT: ${displayName} entered a high-risk area. Location: ${mapsLink}`;
          } else if (alertType === 'ACTIVITY_MONITOR' && reason && reason.includes('FALL')) {
            smsMessage = `🆘 URGENT: ${displayName} may have fallen! Location: ${mapsLink}`;
          } else if (alertType === 'ACTIVITY_MONITOR' && reason && reason.includes('SUDDEN STOP')) {
            smsMessage = `⚠️ ALERT: ${displayName} stopped suddenly while running. Location: ${mapsLink}`;
          } else if (alertType === 'ACTIVITY_MONITOR' && reason) {
            smsMessage = `📱 Activity Alert: ${displayName} - ${reason}. Location: ${mapsLink}`;
          } else if (alertType === 'TILE_SOS') {
            smsMessage = `🚨 EMERGENCY: ${displayName} triggered SOS from Quick Settings! Location: ${mapsLink}`;
          } else {
            smsMessage = `🚨 SOS: ${displayName} needs help! Reason: ${alertReason}. Location: ${mapsLink}`;
          }
          
          console.log(`📤 SMS Message for ${guardian.name}: "${smsMessage}"`);
          const smsResult = await sendSMS(guardian.phone, smsMessage);
          if (smsResult.success) {
            smsSent++;
            console.log(`✅ Alert SMS sent successfully to ${guardian.name} (${guardian.phone})`);
          } else {
            console.warn(`⚠️ Failed to send SMS to ${guardian.phone}: ${smsResult.error}`);
          }
        } catch (smsError) {
          console.error(`❌ Error sending SMS to ${guardian.phone}:`, smsError.message);
        }
      } else {
        console.warn(`⚠️ Guardian ${guardian.name} has no phone number`);
      }
    }
    console.log(`📊 Notification summary: ${emailsSent}/${user.guardians.length} emails, ${smsSent}/${user.guardians.length} SMS sent`);

    // Create alert notification for guardian dashboard
    console.log('📝 Creating alert in database...');
    const createdAlert = await createAlert({
      userEmail: user.email,
      userName: displayName,
      type: alertType === 'HIGH_RISK_AREA' ? 'location' : alertType === 'ACTIVITY_MONITOR' ? 'activity' : 'sos',
      title: `${alertIcon} ${alertTitle}`,
      message: `${displayName}: ${alertReason}`,
      location: { latitude, longitude },
      metadata: {
        mapsLink,
        reason: alertReason,
        alertType: alertType || 'sos',
        guardianCount: user.guardians.length,
        emailsSent,
        timestamp: timestamp || new Date().toISOString()
      }
    });

    if (createdAlert) {
      console.log(`✅ Alert created in database with ID: ${createdAlert._id}`);
    } else {
      console.warn('⚠️ Alert was not created in database');
    }

    console.log(`🚨 ${alertType || 'SOS'} Alert for ${displayName} - Reason: ${alertReason} (${emailsSent} emails, ${smsSent} SMS sent)`);
    res.status(200).json({ 
      message: 'Alert sent successfully',
      emailsSent,
      smsSent,
      guardianCount: user.guardians.length,
      alertCreated: !!createdAlert,
      alertId: createdAlert?._id
    });

  } catch (error) {
    console.error('❌ SOS/Alert trigger error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to trigger alert',
      error: error.message,
      details: error.stack
    });
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

// Cancel False Alarm - notify guardians that alert was accidental
router.post('/cancel-false-alarm', async (req, res) => {
  try {
    console.log('📥 Cancel false alarm request received');
    console.log('📧 Request body:', req.body);
    
    const { userEmail } = req.body;
    
    if (!userEmail) {
      console.error('❌ No user email provided');
      return res.status(400).json({ message: 'User email is required' });
    }
    
    console.log('🔍 Looking up user:', userEmail);
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error('❌ User not found:', userEmail);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.name);
    
    // Deactivate SOS
    user.sosActive = false;
    await user.save();
    console.log('✅ SOS deactivated');

    const displayName = user.name || 'User';
    const emailSubject = `✅ False Alarm: ${displayName} is Safe`;
    const emailBody = `SAFETY UPDATE\n\n${displayName} has confirmed they are safe and the previous alert was a false alarm.\n\nTime: ${new Date().toLocaleString()}\n\nNo further action is needed. This was likely triggered accidentally or the situation has been resolved.\n\nStay safe!`;
    const smsMessage = `✅ False Alarm: ${displayName} is safe and the alert was accidental. No action needed.`;

    // Send email and SMS to all guardians
    let emailsSent = 0;
    let smsSent = 0;
    console.log(`📧 Sending notifications to ${user.guardians.length} guardian(s)...`);
    for (const guardian of user.guardians) {
      if (guardian.email) {
        try {
          await sendEmail(guardian.email, emailSubject, emailBody);
          emailsSent++;
          console.log(`📧 False alarm email sent to ${guardian.name} (${guardian.email})`);
        } catch (emailError) {
          console.error(`Failed to send email to ${guardian.email}:`, emailError.message);
        }
      }

      if (guardian.phone) {
        try {
          console.log(`📱 Attempting to send false alarm SMS to ${guardian.name} (${guardian.phone})`);
          const smsResult = await sendSMS(guardian.phone, smsMessage);
          if (smsResult.success) {
            smsSent++;
            console.log(`📱 False alarm SMS sent to ${guardian.name} (${guardian.phone})`);
          } else {
            console.warn(`⚠️ Failed to send SMS to ${guardian.phone}: ${smsResult.error}`);
          }
        } catch (smsError) {
          console.error(`Error sending SMS to ${guardian.phone}:`, smsError.message);
        }
      }
    }

    // Create alert notification for guardian dashboard
    console.log('📝 Creating alert for guardian dashboard...');
    const location = user.currentLocation || { latitude: 0, longitude: 0 };
    await createAlert({
      userEmail: user.email,
      userName: displayName,
      type: 'false_alarm',
      title: `✅ False Alarm Cancelled`,
      message: `${displayName} confirmed they are safe - Previous alert was accidental`,
      location: { latitude: location.latitude, longitude: location.longitude },
      metadata: {
        reason: 'False alarm cancelled by user',
        alertType: 'false_alarm',
        guardianCount: user.guardians.length,
        emailsSent,
        smsSent,
        timestamp: new Date().toISOString(),
        cancelledAt: new Date().toLocaleString()
      }
    });
    console.log('✅ False alarm alert created for guardian dashboard');

    console.log(`✅ False alarm cancelled for ${displayName} (${emailsSent} emails, ${smsSent} SMS sent)`);
    res.status(200).json({ 
      message: 'False alarm cancelled successfully',
      emailsSent,
      smsSent,
      guardianCount: user.guardians.length,
      alertCreated: true
    });

  } catch (error) {
    console.error('❌ False alarm cancellation error:', error);
    res.status(500).json({ message: 'Failed to cancel false alarm', error: error.message });
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
