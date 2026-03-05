import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from './models/schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const diagnose = async () => {
  console.log('\n=== SMS DIAGNOSIS ===\n');
  
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Check all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users\n`);
    
    for (const user of users) {
      console.log(`👤 User: ${user.name} (${user.email})`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Guardians: ${user.guardians.length}`);
      
      for (let i = 0; i < user.guardians.length; i++) {
        const guardian = user.guardians[i];
        console.log(`\n   Guardian ${i + 1}: ${guardian.name}`);
        console.log(`     Email: ${guardian.email || '❌ NOT SET'}`);
        console.log(`     Phone: ${guardian.phone || '❌ NOT SET'}`);
        console.log(`     Relationship: ${guardian.relationship}`);
        
        if (!guardian.phone) {
          console.log(`     ⚠️  NO PHONE NUMBER - SMS CANNOT BE SENT!`);
        }
      }
      console.log('\n' + '='.repeat(50));
    }
    
    console.log('\n📌 ANALYSIS:');
    const totalGuardians = users.reduce((sum, u) => sum + u.guardians.length, 0);
    const guardiansWithPhone = users.reduce((sum, u) => 
      sum + u.guardians.filter(g => g.phone).length, 0
    );
    
    console.log(`Total Guardians: ${totalGuardians}`);
    console.log(`Guardians with Phone: ${guardiansWithPhone}`);
    console.log(`Guardians without Phone: ${totalGuardians - guardiansWithPhone}`);
    
    if (guardiansWithPhone === 0) {
      console.log('\n❌ NO GUARDIANS HAVE PHONE NUMBERS!');
      console.log('   This is why SMS is not being sent.');
      console.log('   Action: Add phone numbers to guardians in the app/database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

diagnose();
