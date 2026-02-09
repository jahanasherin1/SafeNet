import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function updateGuardianEmail() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'aidhin@gmail.com' });
    
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name || 'Unknown'}`);
    console.log(`📋 Current guardians: ${user.guardians.length}`);

    if (user.guardians.length === 0) {
      console.error('❌ User has no guardians');
      process.exit(1);
    }

    // Update the first guardian's email
    const guardian = user.guardians[0];
    console.log(`\n📝 Updating guardian:`);
    console.log(`  Name: ${guardian.name}`);
    console.log(`  Relationship: ${guardian.relationship}`);
    console.log(`  Old email: ${guardian.email || '(not set)'}`);
    console.log(`  New email: jahanasherin2311@gmail.com`);

    guardian.email = 'jahanasherin2311@gmail.com';
    
    await user.save();
    
    console.log(`\n✅ Guardian email updated successfully!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateGuardianEmail();
