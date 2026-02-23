import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const { SharedPreferencesModule } = NativeModules;

/**
 * Service to sync React Native AsyncStorage with Android SharedPreferences
 * This allows native components (like the SOS Quick Settings Tile) to access user data
 */
export class NativeStorageService {
  private static readonly PREF_NAME = 'user_prefs';
  private static readonly KEY_EMAIL = 'userEmail';
  private static readonly KEY_NAME = 'userName';

  /**
   * Check if native module is available
   */
  private static isNativeModuleAvailable(): boolean {
    return Platform.OS === 'android' && SharedPreferencesModule !== undefined;
  }

  /**
   * Sync user data to SharedPreferences for native components
   * Call this after user login to make user info available to the Quick Settings tile
   */
  static async syncUserDataToNative(userData: {
    email: string;
    name: string;
  }): Promise<void> {
    try {
      console.log('🔄 Syncing user data to native SharedPreferences...');
      console.log('   Platform:', Platform.OS);
      console.log('   Module check - SharedPreferencesModule:', typeof SharedPreferencesModule);
      console.log('   Available modules:', Object.keys(NativeModules));

      if (!this.isNativeModuleAvailable()) {
        console.warn('⚠️ SharedPreferencesModule not available on this platform');
        return;
      }

      if (!SharedPreferencesModule) {
        console.error('❌ SharedPreferencesModule is undefined!');
        console.log('   NativeModules contents:', Object.keys(NativeModules).join(', '));
        return;
      }

      // Try the notifyUserLogin method (most reliable)
      console.log('📢 Calling notifyUserLogin method...');
      console.log('   Email:', userData.email);
      console.log('   Name:', userData.name);
      
      try {
        if (typeof SharedPreferencesModule.notifyUserLogin !== 'function') {
          console.error('❌ notifyUserLogin is not a function!');
          console.log('   Available methods:', Object.keys(SharedPreferencesModule).join(', '));
          throw new Error('notifyUserLogin method not found');
        }

        const result = await SharedPreferencesModule.notifyUserLogin(userData.email, userData.name);
        console.log('✅ notifyUserLogin succeeded! Result:', result);
      } catch (notifyError) {
        console.error('⚠️ notifyUserLogin failed:', notifyError);
        console.log('   Error message:', notifyError instanceof Error ? notifyError.message : String(notifyError));
        
        // Fallback: Try the dedicated simpler methods
        console.log('📝 Fallback: Calling setUserEmail method...');
        try {
          if (typeof SharedPreferencesModule.setUserEmail !== 'function') {
            throw new Error('setUserEmail method not found');
          }
          const emailResult = await SharedPreferencesModule.setUserEmail(userData.email);
          console.log('✅ Email set via setUserEmail:', emailResult);
        } catch (emailError) {
          console.warn('⚠️ setUserEmail failed:', emailError);
          console.log('   Trying setString fallback...');
          const emailResult = await SharedPreferencesModule.setString(
            this.PREF_NAME,
            this.KEY_EMAIL,
            userData.email
          );
          console.log('✅ Email set via setString:', emailResult);
        }

        console.log('📝 Fallback: Calling setUserName method...');
        try {
          if (typeof SharedPreferencesModule.setUserName !== 'function') {
            throw new Error('setUserName method not found');
          }
          const nameResult = await SharedPreferencesModule.setUserName(userData.name);
          console.log('✅ Name set via setUserName:', nameResult);
        } catch (nameError) {
          console.warn('⚠️ setUserName failed:', nameError);
          console.log('   Trying setString fallback...');
          const nameResult = await SharedPreferencesModule.setString(
            this.PREF_NAME,
            this.KEY_NAME,
            userData.name
          );
          console.log('✅ Name set via setString:', nameResult);
        }
      }

      console.log('✅ User data sync process completed');
    } catch (error) {
      console.error('❌ Critical error in syncUserDataToNative:', error);
      if (error instanceof Error) {
        console.error('   Error message:', error.message);
        console.error('   Stack:', error.stack);
      }
    }
  }

  /**
   * Clear user data from SharedPreferences on logout
   */
  static async clearNativeUserData(): Promise<void> {
    try {
      if (!this.isNativeModuleAvailable()) {
        console.warn('⚠️ SharedPreferencesModule not available on this platform');
        return;
      }

      console.log('🔄 Clearing user data from SharedPreferences...');

      // Remove email
      await SharedPreferencesModule.remove(this.PREF_NAME, this.KEY_EMAIL);

      // Remove name
      await SharedPreferencesModule.remove(this.PREF_NAME, this.KEY_NAME);

      console.log('✅ User data cleared from SharedPreferences successfully');
    } catch (error) {
      console.error('❌ Error clearing native user data:', error);
      // Don't throw - allow logout to continue
    }
  }

  /**
   * Get user email from SharedPreferences (for debugging/testing)
   */
  static async getUserEmailFromNative(): Promise<string | null> {
    try {
      if (!this.isNativeModuleAvailable()) {
        return null;
      }

      const email = await SharedPreferencesModule.getString(
        this.PREF_NAME,
        this.KEY_EMAIL
      );
      return email;
    } catch (error) {
      console.error('Error retrieving email from native:', error);
      return null;
    }
  }

  /**
   * Get user name from SharedPreferences (for debugging/testing)
   */
  static async getUserNameFromNative(): Promise<string | null> {
    try {
      if (!this.isNativeModuleAvailable()) {
        return null;
      }

      const name = await SharedPreferencesModule.getString(
        this.PREF_NAME,
        this.KEY_NAME
      );
      return name;
    } catch (error) {
      console.error('Error retrieving name from native:', error);
      return null;
    }
  }

  /**
   * Get user data from AsyncStorage (React Native side)
   */
  static async getUserDataFromReactNative(): Promise<{
    email: string;
    name: string;
  } | null> {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        return {
          email: parsed.email,
          name: parsed.name || 'User',
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user data from AsyncStorage:', error);
      return null;
    }
  }

  /**
   * Verify data is synced correctly (for debugging)
   */
  static async verifySync(): Promise<boolean> {
    try {
      const reactNativeData = await this.getUserDataFromReactNative();
      const nativeEmail = await this.getUserEmailFromNative();
      const nativeName = await this.getUserNameFromNative();

      if (!reactNativeData) {
        console.warn('⚠️ No user data in ReactNative storage');
        return false;
      }

      const isSynced =
        reactNativeData.email === nativeEmail &&
        reactNativeData.name === nativeName;

      if (isSynced) {
        console.log('✅ Data is synced correctly');
      } else {
        console.warn('⚠️ Data mismatch detected:');
        console.warn('   ReactNative:', reactNativeData);
        console.warn('   Native:', { email: nativeEmail, name: nativeName });
      }

      return isSynced;
    } catch (error) {
      console.error('Error verifying sync:', error);
      return false;
    }
  }
}

export default NativeStorageService;

