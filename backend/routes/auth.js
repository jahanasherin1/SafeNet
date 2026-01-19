import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { GuardianOtp, PasswordReset, User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';

const router = express.Router();

// --- MULTER CONFIGURATION ---
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
    
    await sendEmail(email, emailSubject, emailBody);

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
router.post('/update-profile', upload.single('profileImage'), async (req, res) => {
  try {
    const { currentEmail, name, phone, password } = req.body;

    const updateData = { name, phone };
    if (password && password.trim() !== "") {
        updateData.password = password;
    }

    if (req.file) {
      // Store path and normalize slashes for cross-platform compatibility
      updateData.profileImage = req.file.path.replace(/\\/g, "/");
    }

    const user = await User.findOneAndUpdate(
      { email: currentEmail },
      { $set: updateData },
      { new: true } 
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Profile updated", user });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Server Error" });
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
    
    await sendEmail(guardianDetails.email, emailSubject, emailBody);

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