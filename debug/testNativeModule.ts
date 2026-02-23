import { NativeModules, Platform } from 'react-native';

/**
 * Test if the SharedPreferencesModule native module is available and working
 */
export async function testSharedPreferencesModule() {
  try {
    console.log('🧪 Testing SharedPreferencesModule availability...');
    console.log('   Platform:', Platform.OS);

    const { SharedPreferencesModule } = NativeModules;

    if (!SharedPreferencesModule) {
      console.error('❌ SharedPreferencesModule is not available in NativeModules');
      console.log('   Available modules:', Object.keys(NativeModules));
      return false;
    }

    console.log('✅ SharedPreferencesModule found in NativeModules');

    // Test write
    console.log('📝 Testing setString method...');
    try {
      const writeResult = await SharedPreferencesModule.setString(
        'test_prefs',
        'test_key',
        'test_value'
      );
      console.log('✅ setString worked! Result:', writeResult);
    } catch (writeError) {
      console.error('❌ setString failed:', writeError);
      return false;
    }

    // Test read
    console.log('📖 Testing getString method...');
    try {
      const readResult = await SharedPreferencesModule.getString(
        'test_prefs',
        'test_key'
      );
      console.log('✅ getString worked! Result:', readResult);
      
      if (readResult === 'test_value') {
        console.log('✅ Write and read work correctly!');
        return true;
      } else {
        console.error('❌ Value mismatch: expected "test_value", got:', readResult);
        return false;
      }
    } catch (readError) {
      console.error('❌ getString failed:', readError);
      return false;
    }
  } catch (error) {
    console.error('❌ Unexpected error testing native module:', error);
    return false;
  }
}

export default testSharedPreferencesModule;
