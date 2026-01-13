// backend/index.js
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';

// Import Routes
import authRoutes from './routes/auth.js';
import guardianRoutes from './routes/guardians.js';
import sosRoutes from './routes/sos.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Allows your app to communicate with the frontend
app.use(express.json()); // Essential to parse JSON bodies in POST requests

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/users', userRoutes);

// Root Route for testing
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

// Start Server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});