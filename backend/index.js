require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const sendEmail = require('./utils/sendEmail'); 
const multer = require('multer'); 
const path = require('path');
const fs = require('fs'); 

const app = express();
const PORT = process.env.PORT || 5000; 

// Middleware
app.use(cors());
app.use(bodyParser.json());

// 3. Serve Uploads Statically (Critical for Images)
app.use('/uploads', express.static('uploads'));

// 4. Auto-Create Uploads Folder
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
    console.log(`Created directory: ${uploadDir}`);
}

// 5. Configure Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
  });

// --- GUARDIAN OTP SCHEMA ---
const GuardianOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // OTP expires in 10 minutes
});

const GuardianOtp = mongoose.model('GuardianOtp', GuardianOtpSchema);

// --- PASSWORD RESET SCHEMA ---
const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  resetCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 } // Reset code expires in 15 minutes
});

const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);

// --- USER SCHEMA ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  
  // Profile Image Path
  profileImage: { type: String, default: '' },

  // Guardian List
  guardians: [
    {
      name: String,
      phone: String,
      email: String,
      relationship: String,
      accessCode: String
    }
  ],

  // SOS State
  sosActive: { type: Boolean, default: false },
  lastSosTime: { type: Date, default: null },
  
  // Location Data
  currentLocation: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  }
});

const User = mongoose.model('User', UserSchema);

// --- AUTH ROUTES ---

// 1. Signup
app.post('/api/auth/signup', async (req, res) => {
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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 2B. Forgot Password - Request Reset Code
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save reset code to database (expires in 15 minutes)
    await PasswordReset.findOneAndUpdate(
      { email },
      { email, resetCode },
      { upsert: true, new: true }
    );

    // Send reset code via email
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

// 2C. Forgot Password - Verify Code and Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ message: 'Email, reset code, and new password are required.' });
    }

    // Verify reset code
    const resetRecord = await PasswordReset.findOne({ email });
    
    if (!resetRecord || resetRecord.resetCode !== resetCode.trim()) {
      return res.status(401).json({ message: 'Invalid or expired reset code.' });
    }

    // Update user password
    const user = await User.findOneAndUpdate(
      { email },
      { password: newPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Delete the reset code after successful reset
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

// 3. Update Profile
app.post('/api/auth/update-profile', upload.single('profileImage'), async (req, res) => {
  try {
    const { currentEmail, name, phone, password } = req.body;

    const updateData = { name, phone };
    if (password) updateData.password = password; 
    
    if (req.file) {
      updateData.profileImage = `uploads/${req.file.filename}`;
    }

    const user = await User.findOneAndUpdate(
      { email: currentEmail },
      updateData,
      { new: true } 
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Profile updated", user });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- GUARDIAN MANAGEMENT ROUTES ---

// 4. Add Guardian
app.post('/api/guardians/add', async (req, res) => {
  try {
    const { userEmail, name, phone, relationship, guardianEmail } = req.body;

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
        await sendEmail(guardianEmail, emailSubject, emailBody);
    }

    console.log(`Guardian ${name} added.`);
    res.status(200).json({ message: 'Guardian added', guardians: user.guardians });

  } catch (error) {
    console.error("Add Guardian Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 5. Request Guardian Login OTP
app.post('/api/auth/guardian-request-otp', async (req, res) => {
  try {
    const { phone, email } = req.body;

    // Check if this phone is registered as a guardian for at least one user
    const primaryUser = await User.findOne({ "guardians.phone": phone });

    if (!primaryUser) {
      return res.status(404).json({ message: 'Phone number not registered as a guardian.' });
    }

    const guardianDetails = primaryUser.guardians.find(g => g.phone === phone);
    
    if (!guardianDetails || !guardianDetails.email) {
      return res.status(400).json({ message: 'Guardian email not found.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to database (will expire in 10 minutes)
    await GuardianOtp.findOneAndUpdate(
      { phone },
      { phone, email: guardianDetails.email, otp },
      { upsert: true, new: true }
    );

    // Send OTP to guardian's email
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
app.post('/api/auth/guardian-verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Check if this phone is registered as a guardian for at least one user
    const primaryUser = await User.findOne({ "guardians.phone": phone });

    if (!primaryUser) {
      return res.status(404).json({ message: 'Phone number not registered.' });
    }

    const guardianDetails = primaryUser.guardians.find(g => g.phone === phone);

    // Verify OTP from database
    const otpRecord = await GuardianOtp.findOne({ phone });

    if (!otpRecord || otpRecord.otp !== otp.trim()) {
      return res.status(401).json({ message: 'Invalid or expired OTP.' });
    }

    // OTP verified successfully - remove it from database
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

// 6. Get All Guardians
app.post('/api/guardians/all', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ guardians: user.guardians });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 7. Update Guardian
app.put('/api/guardians/update', async (req, res) => {
  try {
    const { userEmail, guardianId, name, phone, relationship, email } = req.body;
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

// 8. Delete Guardian
app.delete('/api/guardians/delete', async (req, res) => {
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

// --- SOS ROUTES ---

// 9. Trigger SOS
app.post('/api/sos/trigger', async (req, res) => {
  try {
    const { userEmail, location } = req.body;
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
    const emailSubject = "🚨 SOS ALERT! Help Needed!";
    const emailBody = `URGENT: ${user.name} triggered an SOS.\nLocation: ${mapsLink}`;

    user.guardians.forEach(g => {
      if (g.email) sendEmail(g.email, emailSubject, emailBody);
    });

    console.log(`SOS Triggered for ${user.name}`);
    res.status(200).json({ message: 'SOS Active' });

  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger SOS' });
  }
});

// 10. Resolve SOS
app.post('/api/sos/resolve', async (req, res) => {
  try {
    const { userEmail } = req.body;
    await User.updateOne({ email: userEmail }, { sosActive: false });
    res.status(200).json({ message: 'SOS Resolved' });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

// 11. Check Status (UPDATED to return profileImage)
app.post('/api/guardian/sos-status', async (req, res) => {
  try {
    const { protectingEmail } = req.body;
    const user = await User.findOne({ email: protectingEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ 
        isSosActive: user.sosActive,
        lastSosTime: user.lastSosTime,
        location: user.currentLocation,
        profileImage: user.profileImage // <--- ADDED THIS FIELD
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 12. Get All Users for Guardian (by guardian email)
app.post('/api/guardian/all-users', async (req, res) => {
  try {
    const { guardianEmail } = req.body;

    if (!guardianEmail) {
      return res.status(400).json({ message: 'Guardian email is required.' });
    }

    // Find all users who have this email registered as a guardian
    const users = await User.find({ "guardians.email": guardianEmail });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found for this guardian.' });
    }

    // Map users to return only relevant information
    const usersData = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      sosActive: user.sosActive,
      lastSosTime: user.lastSosTime,
      currentLocation: user.currentLocation
    }));

    res.status(200).json({ 
      message: 'Users retrieved successfully',
      users: usersData,
      totalUsers: usersData.length
    });

  } catch (error) {
    console.error("Get Guardian Users Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 13. Update User Location (Regular location tracking - called periodically by user app)
app.post('/api/user/update-location', async (req, res) => {
  try {
    const { userEmail, location } = req.body;
    const { latitude, longitude } = location;

    if (!userEmail || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Missing required fields: userEmail, location' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update current location
    user.currentLocation = {
      latitude,
      longitude,
      timestamp: new Date()
    };

    await user.save();

    res.status(200).json({ 
      message: 'Location updated successfully',
      currentLocation: user.currentLocation
    });

  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({ message: 'Failed to update location' });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});