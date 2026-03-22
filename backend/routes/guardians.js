import express from 'express';
import { User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';
import sendSMS from '../utils/sendSMS.js';

const router = express.Router();

/**
 * 1. Add Guardian
 */
router.post('/add', async (req, res) => {
  try {
    const { userEmail, name, phone, relationship, guardianEmail } = req.body;

    // Validate required fields
    if (!userEmail || !name || !phone || !guardianEmail) {
      return res.status(400).json({ message: 'Email is required for all guardians. Please provide guardian email address.' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.guardians.push({ 
        name, phone, relationship, email: guardianEmail, accessCode 
    });
    
    await user.save();

    if (guardianEmail) {
        const emailSubject = "You have been added as a SafeNet Guardian";
        const emailBody = `Hello ${name},\n\n${user.name} has trusted you to be their Safety Guardian.\n\nPhone: ${phone}\nCode: ${accessCode}\n\nStay Safe.`;
        const smsMessage = `You are added as a Guardian in SafeNet by ${user.name}. Access Code: ${accessCode}`;
        
        try {
            await sendEmail(guardianEmail, emailSubject, emailBody);
            console.log(`✅ Guardian invitation email sent to ${guardianEmail}`);
        } catch (emailError) {
            console.error(`❌ Failed to send guardian invitation email: ${emailError.message}`);
        }
        
        // Send SMS to guardian's phone if available
        if (phone) {
            try {
                const smsResult = await sendSMS(phone, smsMessage);
                if (smsResult.success) {
                    console.log(`✅ Guardian invitation SMS sent to ${phone}`);
                } else {
                    console.warn(`⚠️ Failed to send SMS to ${phone}: ${smsResult.error}`);
                }
            } catch (smsError) {
                console.error(`❌ Error sending guardian invitation SMS: ${smsError.message}`);
            }
        }
    }

    console.log(`Guardian ${name} added.`);
    res.status(200).json({ message: 'Guardian added', guardians: user.guardians });

  } catch (error) {
    console.error("Add Guardian Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 2. Get All Guardians for a specific User
 */
router.post('/all', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ guardians: user.guardians });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 3. Update Guardian Details
 */
router.put('/update', async (req, res) => {
  try {
    const { userEmail, guardianId, name, phone, relationship, email } = req.body;
    
    // Validate that email is not being cleared
    if (!email || email.trim() === '') {
      return res.status(400).json({ message: 'Guardian email cannot be empty. Email is required.' });
    }

    const result = await User.updateOne(
      { email: userEmail, "guardians._id": guardianId },
      { 
        $set: {
          "guardians.$.name": name,
          "guardians.$.phone": phone,
          "guardians.$.email": email,
          "guardians.$.relationship": relationship
        }
      }
    );
    if (result.modifiedCount === 0) return res.status(404).json({ message: 'Not found' });
    res.status(200).json({ message: 'Updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 4. Delete a Guardian
 */
router.delete('/delete', async (req, res) => {
  try {
    const { userEmail, guardianId } = req.body;
    await User.updateOne(
      { email: userEmail },
      { $pull: { guardians: { _id: guardianId } } }
    );
    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 5. Get All Users a specific Guardian is protecting
 */
router.post('/all-users', async (req, res) => {
  try {
    const { guardianEmail } = req.body;
    if (!guardianEmail) return res.status(400).json({ message: 'Guardian email is required.' });

    const users = await User.find({ "guardians.email": guardianEmail });
    const usersData = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      sosActive: user.sosActive,
      lastSosTime: user.lastSosTime,
      currentLocation: user.currentLocation,
      // Fixed: Added Optional Chaining (?.) to prevent crashes if currentLocation is null
      lastUpdated: user.currentLocation?.timestamp || user.lastSosTime || user.createdAt
    }));

    res.status(200).json({ users: usersData });
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 6. Get Guardian's Current Profile (Real-time Sync)
 * Returns the guardian's current name as stored by the user
 * 
 * Returns 404 if guardian hasn't been added by any user yet
 * This is expected for first-time guardians during setup
 */
router.post('/profile', async (req, res) => {
  try {
    const { guardianEmail } = req.body;
    if (!guardianEmail) return res.status(400).json({ message: 'Guardian email is required.' });

    // Find the user that has this person as a guardian
    const user = await User.findOne({ "guardians.email": guardianEmail });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Guardian profile not found. Guardian must be added by a user first.',
        code: 'GUARDIAN_NOT_ADDED_YET',
        suggestion: 'Have a SafeNet user add you as a guardian to use this feature.'
      });
    }

    // Get the guardian details from the user's guardians array
    const guardian = user.guardians.find(g => g.email === guardianEmail);
    
    if (!guardian) {
      return res.status(404).json({ 
        message: 'Guardian details not found in user record.',
        code: 'GUARDIAN_DATA_INCONSISTENT'
      });
    }

    res.status(200).json({
      name: guardian.name,
      phone: guardian.phone,
      email: guardian.email,
      relationship: guardian.relationship,
      protecting: user.name,
      protectingEmail: user.email
    });

  } catch (error) {
    console.error("Get Guardian Profile Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 7. SOS Status and Live Location (Polled by Guardian)
 * Updated to return 'lastSosTime' explicitly for the Red Card
 */
router.post('/sos-status', async (req, res) => {
    try {
      const { protectingEmail } = req.body;
      if (!protectingEmail) return res.status(400).json({ message: 'Email required' });

      const user = await User.findOne({ email: protectingEmail });
      
      if (!user) return res.status(404).json({ message: 'User not found' });
  
      // Calculate a safe "Last Updated" time for the general UI
      const safeTimestamp = user.currentLocation?.timestamp || user.lastSosTime || user.createdAt || new Date();

      res.status(200).json({ 
          isSosActive: user.sosActive,
          
          // CRITICAL: This is the specific time the SOS button was pressed
          lastSosTime: user.lastSosTime, 
          
          location: user.currentLocation || { latitude: 0, longitude: 0 }, 
          
          // This is the time the location changed (for the list view)
          lastUpdated: safeTimestamp,
          
          profileImage: user.profileImage,
          journey: user.journey || { isActive: false } 
      });
    } catch (error) {
      console.error("SOS Status Fetch Error:", error);
      res.status(500).json({ message: 'Server Error' });
    }
});

export default router;