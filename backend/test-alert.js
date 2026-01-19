// Quick script to test alert creation
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Alert } from './models/schemas.js';

dotenv.config();

const createTestAlert = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const testAlert = new Alert({
      userEmail: 'jahanasherin2311@gmail.com', // Replace with your real email
      userName: 'Test User',
      type: 'sos',
      title: '🚨 TEST SOS Alert',
      message: 'This is a test alert to verify the system is working!',
      location: {
        latitude: 37.7749,
        longitude: -122.4194
      },
      metadata: {
        mapsLink: 'https://www.google.com/maps?q=37.7749,-122.4194',
        test: true
      }
    });

    await testAlert.save();
    console.log('Test alert created successfully!');
    console.log('Alert ID:', testAlert._id);
    console.log('User Email:', testAlert.userEmail);

    // List all alerts for this user
    const allAlerts = await Alert.find({ userEmail: testAlert.userEmail });
    console.log(`\nTotal alerts for ${testAlert.userEmail}:`, allAlerts.length);

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createTestAlert();
