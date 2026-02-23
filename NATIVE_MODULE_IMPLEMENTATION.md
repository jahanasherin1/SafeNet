# Native Module Implementation for SharedPreferences

## Overview

This implementation creates a bridge between React Native's AsyncStorage and Android's SharedPreferences, allowing the SOS Quick Settings tile to access user credentials directly from the Android system.

## Files Created

### 1. **SharedPreferencesModule.java**
- **Location**: `android/app/src/main/java/com/safenet/app/`
- **Purpose**: Native Android module that provides methods to read/write SharedPreferences
- **Key Methods**:
  - `setString(preferenceName, key, value)` - Store a value
  - `getString(preferenceName, key)` - Retrieve a value
  - `remove(preferenceName, key)` - Delete a value
  - `clear(preferenceName)` - Clear all values

### 2. **SharedPreferencesPackage.java**
- **Location**: `android/app/src/main/java/com/safenet/app/`
- **Purpose**: React package that registers the native module with the app
- **Implements**: ReactPackage interface

### 3. **NativeStorageService.ts**
- **Location**: `services/`
- **Purpose**: TypeScript service that bridges React Native and native module
- **Key Methods**:
  - `syncUserDataToNative()` - Called after login to sync user data
  - `clearNativeUserData()` - Called on logout to clear sensitive data
  - `verifySync()` - Debug method to check if data is synchronized
  - `getUserDataFromReactNative()` - Get user data from AsyncStorage
  - `getUserEmailFromNative()` - Get email from SharedPreferences
  - `getUserNameFromNative()` - Get name from SharedPreferences

### 4. **withSharedPreferencesModule.js**
- **Location**: `plugins/`
- **Purpose**: Expo config plugin that auto-registers the native module
- **Function**: Injects the SharedPreferencesModule into the Expo build process

### 5. **Updated Files**
- **SessionContext.tsx** - Now calls `NativeStorageService` on login/logout
- **app.json** - Added plugin to plugins array

## How It Works

### Flow Diagram
```
User Login
    ↓
SessionContext.login()
    ↓
NativeStorageService.syncUserDataToNative()
    ↓
SharedPreferencesModule.setString() [Native Android]
    ↓
Data stored in Android SharedPreferences
    ↓
SOS Quick Settings Tile can access via SharedPreferences
    ↓
Tile reads email/name and sends alert to guardians
```

### Data Synchronization

1. **On Login**:
   - User data stored in AsyncStorage (React Native)
   - SessionContext calls `NativeStorageService.syncUserDataToNative()`
   - NativeStorageService bridges to SharedPreferencesModule
   - User email and name stored in Android SharedPreferences
   - SOS Tile now has access to this data

2. **On Logout**:
   - SessionContext calls `NativeStorageService.clearNativeUserData()`
   - SharedPreferencesModule removes user data
   - Sensitive information cleared from device

3. **In SOS Tile**:
   - Tile reads from SharedPreferences: `getSharedPreferences("user_prefs", MODE_PRIVATE)`
   - Gets email: `prefs.getString("userEmail", "")`
   - Gets name: `prefs.getString("userName", "User")`
   - Sends alert with user credentials to backend

## Testing the Implementation

### Debug Test Script
Use the provided test script to verify everything is working:

```typescript
import testNativeDataSync from './debug/testNativeSync';

// In your component or during app initialization:
testNativeDataSync().then(() => {
  console.log('✅ Native sync test complete');
});
```

This will:
1. Check ReactNative AsyncStorage for user data
2. Check Android SharedPreferences for user data
3. Verify sync status
4. Report any discrepancies

### Manual Verification

```typescript
import NativeStorageService from './services/NativeStorageService';

// Check if data is synced
const isSynced = await NativeStorageService.verifySync();
console.log('Data synced:', isSynced);

// Get email from native storage
const email = await NativeStorageService.getUserEmailFromNative();
console.log('Tile can see email:', email);
```

## Architecture Benefits

### 1. **Security**
- User credentials not exposed to quick settings
- Data cleared on logout
- Proper SharedPreferences isolation

### 2. **Performance**
- Native module reads from SharedPreferences in milliseconds
- No network latency when tile checks credentials
- Immediate SOS alert sending

### 3. **Reliability**
- SOS tile works even if app process killed
- Platform-level data access
- Automatic cleanup on logout

### 4. **Scalability**
- Easily add more shared data to SharedPreferences
- Can extend for other native features
- Plugin-based integration with Expo

## Troubleshooting

### Issue: "SharedPreferencesModule not available"
**Solution**: 
- Ensure app.json includes the plugin
- Run `npx expo prebuild --clean` to rebuild native code
- Rebuild app with `npx expo run:android`

### Issue: Tile can't access user data
**Solution**:
- Verify you've logged in (data syncs on login)
- Check logs for sync errors
- Run `testNativeDataSync()` to diagnose
- Clear app data and login again

### Issue: Data persists after logout
**Solution**:
- `clearNativeUserData()` should be called on logout
- Check SessionContext logout method is being triggered
- Manually clear SharedPreferences in emergency

## Files Modified by Plugin

The `withSharedPreferencesModule.js` plugin automatically:
1. Adds import for `SharedPreferencesPackage` to MainApplication
2. Registers the package in `getPackages()` method
3. Logs successful registration

No manual Android file editing needed!

## Security Considerations

### ✅ What's Protected
- User email stored only during active session
- Data cleared on logout
- SharedPreferences uses private app context
- Tile only runs with app permissions

### ⚠️ What to Monitor
- Don't store passwords in SharedPreferences
- Don't store sensitive tokens
- Monitor access patterns in logs
- Clear on every logout

## Future Enhancements

1. **Encrypted SharedPreferences**
   ```java
   EncryptedSharedPreferences.create()
   ```

2. **Biometric Access Control**
   ```java
   BiometricPrompt.authenticate()
   ```

3. **Sync with Multiple Data Types**
   - Add more keys (phone, location, etc.)
   - Batch sync operations

4. **Background Refresh**
   - Periodic sync of critical data
   - Background job scheduling

## Summary

This native module implementation provides:
- ✅ Secure bridge between React Native and Android
- ✅ SOS tile can access user credentials
- ✅ Automatic data sync on login/logout
- ✅ No manual Android coding required (plugin handles it)
- ✅ Debug tools for testing
- ✅ Production-ready architecture

The SOS Quick Settings tile now has all the information needed to send proper SOS alerts to guardians without opening the app!
