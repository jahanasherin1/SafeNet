import mongoose from 'mongoose';

// --- GUARDIAN OTP SCHEMA ---
const GuardianOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } 
});

export const GuardianOtp = mongoose.model('GuardianOtp', GuardianOtpSchema);

// --- PASSWORD RESET SCHEMA ---
const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  resetCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 }
});

export const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);

// --- ALERT/NOTIFICATION SCHEMA ---
const AlertSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['sos', 'activity', 'journey_started', 'journey_delayed', 'journey_completed', 'location_shared', 'fake_call_activated']
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  location: {
    latitude: Number,
    longitude: Number
  },
  metadata: { type: mongoose.Schema.Types.Mixed }, // Additional data specific to alert type
  isRead: { type: Boolean, default: false },
  readAt: { type: Date }, // Timestamp when alert was marked as read
  createdAt: { type: Date, default: Date.now, index: true }
});

// Index for efficient queries
AlertSchema.index({ userEmail: 1, createdAt: -1 });
AlertSchema.index({ isRead: 1, readAt: 1 }); // For cleanup queries

export const Alert = mongoose.model('Alert', AlertSchema);

// --- USER SCHEMA ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  
  // Journey Object
  journey: {
    isActive: { type: Boolean, default: false },
    destination: { type: String, default: '' },
    eta: { type: Date, default: null },
    startTime: { type: Date, default: null }
  },
  
  profileImage: { type: String, default: '' },

  guardians: [
    {
      name: String,
      phone: String,
      email: String,
      relationship: String,
      accessCode: String
    }
  ],

  sosActive: { type: Boolean, default: false },
  lastSosTime: { type: Date, default: null },
  
  // Voice Profiles for Fake Call
  voiceProfiles: [
    {
      id: String,
      name: String,
      audioUri: String,
      audioName: String,
      dateAdded: { type: Date, default: Date.now }
    }
  ],
  
  currentLocation: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  }
});

export const User = mongoose.model('User', UserSchema);