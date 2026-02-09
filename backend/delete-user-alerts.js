import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const alertSchema = new mongoose.Schema({}, { strict: false });
const Alert = mongoose.model('Alert', alertSchema, 'alerts');

async function deleteUserAlerts() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const userEmail = 'aidhin@gmail.com';
    
    console.log(`\n🗑️  Deleting all alerts for user: ${userEmail}`);
    
    const result = await Alert.deleteMany({ userEmail: userEmail });
    
    console.log(`\n✅ Deletion completed!`);
    console.log(`   Alerts deleted: ${result.deletedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteUserAlerts();
