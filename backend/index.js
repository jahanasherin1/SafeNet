require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const sendEmail = require('./utils/sendEmail'); // Import Email Utility

const app = express();
const PORT = process.env.PORT || 5000; 

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
  });

// --- USER SCHEMA (UPDATED) ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  // Updated Guardian Schema to include Email and Access Code
  guardians: [
    {
      name: String,
      phone: String,
      email: String,       // Added
      relationship: String,
      accessCode: String   // Added (The OTP for them to login)
    }
  ]
});

const User = mongoose.model('User', UserSchema);

// --- API ROUTES ---

// 1. Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({ name, phone, email, password });
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

// 3. Add Guardian (UPDATED WITH EMAIL)
app.post('/api/guardians/add', async (req, res) => {
  try {
    const { userEmail, name, phone, relationship, guardianEmail } = req.body;

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate a random 6-digit Access Code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Add guardian to DB
    user.guardians.push({ 
        name, 
        phone, 
        relationship, 
        email: guardianEmail, 
        accessCode 
    });
    
    await user.save();

    // SEND EMAIL TO GUARDIAN
    if (guardianEmail) {
        const emailSubject = "You have been added as a SafeNet Guardian";
        const emailBody = `Hello ${name},\n\n${user.name} has trusted you to be their Safety Guardian on SafeNet.\n\nTo access the Guardian Dashboard, please use the following credentials:\n\nPhone: ${phone}\nVerification Code: ${accessCode}\n\nStay Safe,\nThe SafeNet Team`;
        
        await sendEmail(guardianEmail, emailSubject, emailBody);
    }

    console.log(`Guardian ${name} added. Email sent to ${guardianEmail}`);
    res.status(200).json({ message: 'Guardian added & Email sent', guardians: user.guardians });

  } catch (error) {
    console.error("Add Guardian Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 4. Guardian Login (UPDATED WITH LOGGING & TYPE SAFETY)
app.post('/api/auth/guardian-login', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    console.log(`\n--- Guardian Login Attempt ---`);
    console.log(`Input Phone: ${phone}`);
    console.log(`Input OTP: ${otp}`);

    // 1. Find a primary user who has this phone number in their guardian list
    const primaryUser = await User.findOne({ "guardians.phone": phone });

    if (!primaryUser) {
      console.log("❌ Error: Phone number not found in any user's guardian list.");
      return res.status(404).json({ message: 'Phone number not registered as guardian.' });
    }

    console.log(`✅ Found Primary User: ${primaryUser.name} (${primaryUser.email})`);

    // 2. Find the specific guardian details
    const guardianDetails = primaryUser.guardians.find(g => g.phone === phone);

    if (!guardianDetails) {
        console.log("❌ Error: Guardian object not found (Logic Error).");
        return res.status(404).json({ message: 'Guardian details not found.' });
    }

    console.log(`Stored Access Code in DB: ${guardianDetails.accessCode}`);

    // 3. Validate the OTP (Convert both to Strings to ensure match)
    // We allow '123456' as a master key for testing
    const inputOtp = String(otp).trim();
    const dbOtp = String(guardianDetails.accessCode).trim();

    if (inputOtp !== '123456' && inputOtp !== dbOtp) {
        console.log("❌ Error: OTP Mismatch.");
        return res.status(401).json({ message: 'Invalid verification code' });
    }

    console.log(`✅ Login Successful for Guardian: ${guardianDetails.name}`);

    res.status(200).json({
      message: 'Verified',
      role: 'guardian',
      guardianName: guardianDetails.name,
      protecting: primaryUser.name,
      protectingEmail: primaryUser.email
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});
// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});