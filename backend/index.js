// backend/index.js
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import { Alert } from './models/schemas.js';

// Import Routes
import alertRoutes from './routes/alerts.js';
import authRoutes from './routes/auth.js';
import crimeChanceRoutes from './routes/crimeChance.js';
import crimeZoneRoutes from './routes/crimeZone.js';
import guardianRoutes from './routes/guardians.js';
import journeyRoutes from './routes/journey.js'; // <--- ADDED THIS
import proximityAlertsRoutes from './routes/proximityAlerts.js';
import sosRoutes from './routes/sos.js';
import userRoutes from './routes/users.js';
import voiceProfileRoutes from './routes/voiceProfiles.js';
import weatherAlertsRoutes from './routes/weatherAlerts.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
// NOTE: Local /uploads static serving removed — files are now stored on Vercel Blob

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method !== 'GET') {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// ─── Serverless-safe MongoDB connection (caches the connection across invocations) ───
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
      isConnected = false;
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected.');
      isConnected = false;
    });
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });
  } catch (error) {
    console.error(`❌ Connection error: ${error.message}`);
    throw error;
  }
};

// Middleware: ensure DB is connected before handling any request (serverless-safe)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ message: 'Database connection failed', error: err.message });
  }
});

// --- ROUTES MOUNTING ---
app.use('/api/auth', authRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/user', userRoutes);
app.use('/api/journey', journeyRoutes); // <--- ADDED THIS (Fixes 404)
app.use('/api/voiceProfiles', voiceProfileRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/crime-zone', crimeZoneRoutes);
app.use('/api/crime-chance', crimeChanceRoutes);
app.use('/api/proximity-alerts', proximityAlertsRoutes);
app.use('/api/weather-alerts', weatherAlertsRoutes);

// Health check endpoint for client apps
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'SafeNet API is healthy' });
});

app.get('/', (req, res) => {
  res.send('SafeNet API is running...');
});

// ─── Start traditional server only when NOT running on Vercel ───
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // Hourly cleanup job (only in long-running server mode)
      setInterval(async () => {
        try {
          if (mongoose.connection.readyState !== 1) return;
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const result = await Alert.deleteMany({
            isRead: true,
            readAt: { $exists: true, $lt: oneDayAgo }
          }).maxTimeMS(10000);
          if (result.deletedCount > 0) {
            console.log(`🧹 Auto-cleanup: Deleted ${result.deletedCount} old alerts`);
          }
        } catch (error) {
          console.error('Error in auto-cleanup:', error.message);
        }
      }, 60 * 60 * 1000);
    });
  }).catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

// ─── Export app for Vercel serverless handler ───
export default app;