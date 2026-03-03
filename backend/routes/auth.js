import express from 'express';
import { GuardianOtp, PasswordReset, User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';
import sendSMS from '../utils/sendSMS.js';
import { upload, uploadToBlob } from '../utils/vercelBlob.js';

const router = express.Router();

// Check if email exists
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await User.findOne({ email });
    
    res.status(200).json({ 
      exists: !!existingUser,
      message: existingUser ? 'Email already registered' : 'Email available'
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 1. Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, phone, email, password, location } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({ 
      name, 
      phone, 
      email, 
      password,
      currentLocation: location && location.latitude ? {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date()
      } : {
        latitude: 0,
        longitude: 0,
        timestamp: new Date()
      }
    });
    await newUser.save();
    
    res.status(201).json({ message: 'User created', user: newUser });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 2. Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

    res.status(200).json({ 
      message: 'Login successful', 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage
      },
      token 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 2B. Forgot Password - Request Reset Code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await PasswordReset.findOneAndUpdate(
      { email },
      { email, resetCode },
      { upsert: true, new: true }
    );

    const emailSubject = "SafeNet Password Reset Code";
    const emailBody = `Hello ${user.name},\n\nYour password reset code is: ${resetCode}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nStay Safe.`;
    const smsMessage = `SafeNet Password Reset Code: ${resetCode} (Expires in 15 minutes)`;
    
    try {
        await sendEmail(email, emailSubject, emailBody);
        console.log(`✅ Password reset email sent to ${email}`);
    } catch (emailError) {
        console.error(`❌ Failed to send password reset email: ${emailError.message}`);
    }

    // Send SMS to user's phone for password reset
    if (user.phone) {
        try {
            const smsResult = await sendSMS(user.phone, smsMessage);
            if (smsResult.success) {
                console.log(`✅ Password reset SMS sent to ${user.phone}`);
            } else {
                console.warn(`⚠️ Failed to send password reset SMS to ${user.phone}: ${smsResult.error}`);
            }
        } catch (smsError) {
            console.error(`❌ Error sending password reset SMS: ${smsError.message}`);
        }
    }

    res.status(200).json({ 
      message: 'Reset code sent to your email',
      email: email
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 2C. Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ message: 'Email, reset code, and new password are required.' });
    }

    const resetRecord = await PasswordReset.findOne({ email });
    
    if (!resetRecord || resetRecord.resetCode !== resetCode.trim()) {
      return res.status(401).json({ message: 'Invalid or expired reset code.' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { password: newPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await PasswordReset.deleteOne({ email });

    res.status(200).json({ 
      message: 'Password reset successful',
      user: { email: user.email, name: user.name }
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 3. Update Profile (Updated to handle File Uploads)
// Multer error handler wrapper
const handleUpload = (req, res, next) => {
  upload.single('profileImage')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      // Don't fail — just continue without file
      req.file = undefined;
      return next();
    }
    next();
  });
};

router.post('/update-profile', handleUpload, async (req, res) => {
  try {
    const { currentEmail, name, phone, password } = req.body;

    console.log('📝 Update profile request:', { currentEmail, name, phone, hasFile: !!req.file });

    if (!currentEmail) {
      console.error('❌ currentEmail is missing from request body');
      return res.status(400).json({ message: 'currentEmail is required' });
    }

    if (!name || !phone) {
      console.error('❌ name or phone is missing:', { name, phone });
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    const updateData = { name, phone };
    if (password && password.trim() !== "") {
        updateData.password = password;
    }

    if (req.file) {
      try {
        console.log('📤 Processing file upload:', { 
          filename: req.file.originalname, 
          mimetype: req.file.mimetype, 
          size: req.file.size 
        });
        const imgExt = req.file.mimetype.split('/')[1] || 'jpg';
        const result = await uploadToBlob(req.file.buffer, {
          folder: 'safenet/profile-images',
          filename: `profile_${Date.now()}.${imgExt}`,
          contentType: req.file.mimetype,
        });
        updateData.profileImage = result.url;
        console.log('✅ Profile image uploaded to Vercel Blob:', result.url);
      } catch (blobError) {
        // Non-fatal: log and continue without updating image
        console.error('⚠️ Vercel Blob upload failed (continuing with profile update):', {
          message: blobError.message,
          stack: blobError.stack,
          code: blobError.code
        });
      }
    }

    console.log('🔄 Attempting to update user in database:', { email: currentEmail, updateData: Object.keys(updateData) });
    
    // Verify user exists first
    const existingUser = await User.findOne({ email: currentEmail });
    console.log('🔍 User lookup result:', { found: !!existingUser, email: currentEmail });
    
    if (!existingUser) {
      console.error('❌ User not found for email:', currentEmail);
      return res.status(404).json({ message: "User not found" });
    }

    const user = await User.findOneAndUpdate(
      { email: currentEmail },
      { $set: updateData },
      { new: true } 
    );

    if (!user) {
      console.error('❌ Update failed for email:', currentEmail);
      return res.status(500).json({ message: "Profile update failed" });
    }

    console.log('✅ Profile updated successfully for:', currentEmail);
    res.status(200).json({ message: "Profile updated", user });
  } catch (error) {
    console.error("❌ Update Error - Full Details:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
      body: req.body
    });
    res.status(500).json({ message: "Server Error", detail: error.message });
  }
});

// 5. Request Guardian Login OTP
router.post('/guardian-request-otp', async (req, res) => {
  try {
    const { phone, email } = req.body;

    const primaryUser = await User.findOne({ "guardians.phone": phone });

    if (!primaryUser) {
      return res.status(404).json({ message: 'Phone number not registered as a guardian.' });
    }

    const guardianDetails = primaryUser.guardians.find(g => g.phone === phone);
    
    if (!guardianDetails || !guardianDetails.email) {
      return res.status(400).json({ message: 'Guardian email not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await GuardianOtp.findOneAndUpdate(
      { phone },
      { phone, email: guardianDetails.email, otp },
      { upsert: true, new: true }
    );

    const emailSubject = "SafeNet Guardian Login OTP";
    const emailBody = `Hello ${guardianDetails.name},\n\nYour SafeNet Guardian Login OTP is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\nStay Safe.`;
    const smsMessage = `SafeNet Guardian Login OTP: ${otp} (Expires in 10 minutes)`;
    
    try {
        await sendEmail(guardianDetails.email, emailSubject, emailBody);
        console.log(`✅ Guardian login OTP email sent to ${guardianDetails.email}`);
    } catch (emailError) {
        console.error(`❌ Failed to send guardian login OTP email: ${emailError.message}`);
    }

    // Send SMS to guardian's phone for OTP
    if (guardianDetails.phone) {
        try {
            const smsResult = await sendSMS(guardianDetails.phone, smsMessage);
            if (smsResult.success) {
                console.log(`✅ Guardian login OTP SMS sent to ${guardianDetails.phone}`);
            } else {
                console.warn(`⚠️ Failed to send guardian login OTP SMS to ${guardianDetails.phone}: ${smsResult.error}`);
            }
        } catch (smsError) {
            console.error(`❌ Error sending guardian login OTP SMS: ${smsError.message}`);
        }
    }

    res.status(200).json({ 
      message: 'OTP sent to email',
      email: guardianDetails.email,
      guardianName: guardianDetails.name,
      protecting: primaryUser.name
    });

  } catch (error) {
    console.error("Guardian Request OTP Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 5b. Verify Guardian Login OTP
router.post('/guardian-verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const primaryUser = await User.findOne({ "guardians.phone": phone });

    if (!primaryUser) {
      return res.status(404).json({ message: 'Phone number not registered.' });
    }

    const guardianDetails = primaryUser.guardians.find(g => g.phone === phone);

    const otpRecord = await GuardianOtp.findOne({ phone });

    if (!otpRecord || otpRecord.otp !== otp.trim()) {
      return res.status(401).json({ message: 'Invalid or expired OTP.' });
    }

    await GuardianOtp.deleteOne({ phone });

    res.status(200).json({
      message: 'Verified',
      role: 'guardian',
      guardianName: guardianDetails.name,
      guardianEmail: guardianDetails.email,
      protecting: primaryUser.name,
      protectingEmail: primaryUser.email
    });

  } catch (error) {
    console.error("Guardian Verify OTP Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;