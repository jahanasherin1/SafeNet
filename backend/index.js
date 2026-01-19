// backend/index.js
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import { Alert } from './models/schemas.js';

// Import Routes
import alertRoutes from './routes/alerts.js';
import authRoutes from './routes/auth.js';
import guardianRoutes from './routes/guardians.js';
import journeyRoutes from './routes/journey.js'; // <--- ADDED THIS
import sosRoutes from './routes/sos.js';
import userRoutes from './routes/users.js';
import voiceProfileRoutes from './routes/voiceProfiles.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// --- ROUTES MOUNTING ---
app.use('/api/auth', authRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/user', userRoutes);
app.use('/api/journey', journeyRoutes); // <--- ADDED THIS (Fixes 404)
app.use('/api/voiceProfiles', voiceProfileRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/', (req, res) => {
  res.send('SafeNet API is running...');
});

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Connection error: ${error.message}`);
    process.exit(1); 
  }
};

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // Start automatic cleanup job - runs every 6 hours
    setInterval(async () => {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await Alert.deleteMany({
          isRead: true,
          readAt: { $exists: true, $lt: oneDayAgo }
        });
        if (result.deletedCount > 0) {
          console.log(`🧹 Auto-cleanup: Deleted ${result.deletedCount} read alerts older than 1 day`);
        }
      } catch (error) {
        console.error('Error in auto-cleanup:', error);
      }
    }, 6 * 60 * 60 * 1000); // Run every 6 hours
  });
});