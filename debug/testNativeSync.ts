/**
 * Debug script to verify that SharedPreferences native module is working
 * Run this from your app to test if the tile can access user data
 */

import NativeStorageService from './services/NativeStorageService';

export const testNativeDataSync = async () => {
  console.log('\n═══════════════════════════════════════════');
  console.log('🧪 TESTING NATIVE DATA SYNC');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Test 1: Get data from ReactNative AsyncStorage
    console.log('1️⃣  Checking ReactNative AsyncStorage...');
    const reactNativeData = await NativeStorageService.getUserDataFromReactNative();
    if (reactNativeData) {
      console.log('   ✅ Found user data:');
      console.log('      Email:', reactNativeData.email);
      console.log('      Name:', reactNativeData.name);
    } else {
      console.log('   ⚠️  No user data found in AsyncStorage');
    }

    // Test 2: Get data from Native SharedPreferences
    console.log('\n2️⃣  Checking Android SharedPreferences...');
    const nativeEmail = await NativeStorageService.getUserEmailFromNative();
    const nativeName = await NativeStorageService.getUserNameFromNative();
    
    if (nativeEmail) {
      console.log('   ✅ Found native data:');
      console.log('      Email:', nativeEmail);
      console.log('      Name:', nativeName);
    } else {
      console.log('   ⚠️  No user data found in SharedPreferences');
    }

    // Test 3: Verify sync status
    console.log('\n3️⃣  Verifying sync status...');
    const isSynced = await NativeStorageService.verifySync();
    if (isSynced) {
      console.log('   ✅ Data is properly synced!');
      console.log('   🎉 The Quick Settings tile can access user data!');
    } else {
      console.log('   ❌ Data is NOT synced');
      console.log('   ℹ️  Did you log in? Data syncs after login.');
    }

    // Test 4: Manual sync test (if not synced)
    if (!isSynced && reactNativeData) {
      console.log('\n4️⃣  Attempting manual sync...');
      await NativeStorageService.syncUserDataToNative(reactNativeData);
      
      // Verify again
      const isNowSynced = await NativeStorageService.verifySync();
      if (isNowSynced) {
        console.log('   ✅ Manual sync successful!');
      } else {
        console.log('   ❌ Manual sync failed');
      }
    }

    console.log('\n═══════════════════════════════════════════');
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    console.log('═══════════════════════════════════════════\n');
  }
};

// Export for use in React components
export default testNativeDataSync;
