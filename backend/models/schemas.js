import mongoose from 'mongoose';

// --- GUARDIAN OTP SCHEMA ---
const GuardianOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // OTP expires in 10 minutes
});

export const GuardianOtp = mongoose.model('GuardianOtp', GuardianOtpSchema);

// --- PASSWORD RESET SCHEMA ---
const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  resetCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 } // Reset code expires in 15 minutes
});

export const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);

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

export const User = mongoose.model('User', UserSchema);
