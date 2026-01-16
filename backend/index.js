// backend/index.js
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';

// Import Routes
import authRoutes from './routes/auth.js';
import guardianRoutes from './routes/guardians.js';
import sosRoutes from './routes/sos.js';
import userRoutes from './routes/users.js';
import journeyRoutes from './routes/journey.js'; // <--- ADDED THIS

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
  });
});