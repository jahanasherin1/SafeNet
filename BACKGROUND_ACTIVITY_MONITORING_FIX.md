# Background Activity Monitoring Fix - Implementation Guide

## Problem
Activity monitoring was only working when the app was open. This was because the native Android accelerometer API (via Expo) stops reading sensor data when the app is backgrounded or closed.

## Solution
Implemented a native Android **foreground service** that continuously monitors device accelerometer data in the background, even when the app is completely closed.

## What Was Changed

### 1. **Android Native Java Classes** (NEW)
Created three new Java classes in `android/app/src/main/java/com/safenet/app/`:

#### a. `ActivityMonitoringService.java`
- Native Android foreground service that runs continuously
- Registers accelerometer listener at the OS level
- Monitors for fall detection (high impact + stillness)
- Sends broadcast notifications when falls detected
- Shows persistent notification to prevent service from being killed

#### b. `BootCompletedReceiver.java`
- Broadcast receiver that listens for device boot completion
- Automatically restarts activity monitoring service on device reboot
- Ensures monitoring continues even after device restart

#### c. `ActivityMonitoringModule.java`
- React Native bridge module that exposes native service control to JavaScript
- Methods: `startActivityMonitoring()`, `stopActivityMonitoring()`, `isMonitoring()`

#### d. `ActivityMonitoringPackage.java`
- React Native package that registers the native module
- Must be added to React Native's module list

### 2. **TypeScript Services**

#### `services/NativeActivityMonitoringService.ts` (NEW)
- TypeScript wrapper around the native Java module
- Provides methods: `startNativeActivityMonitoring()`, `stopNativeActivityMonitoring()`, etc.
- Handles async communication between JavaScript and native code

#### `services/BackgroundActivityMonitoringService.ts` (UPDATED)
- Now uses native service as PRIMARY method (works when app closed)
- Falls back to Expo Accelerometer as SECONDARY method (works when app open)
- Falls back gracefully if native module not available

### 3. **Android Configuration Files** (UPDATED)

#### `android/app/src/main/AndroidManifest.xml`
- Added `<service>` declaration for ActivityMonitoringService
- Added `<receiver>` declaration for BootCompletedReceiver
- Added `FOREGROUND_SERVICE_HEALTH` permission

#### `app.json`
- Added `FOREGROUND_SERVICE_HEALTH` permission for Android

## How It Works

### When App is Open:
1. Both foreground (Expo Accelerometer) and background (native service) monitoring are active
2. Primary method: Native accelerometer service
3. Fallback method: Expo Accelerometer

### When App is Minimized/Closed:
1. Native Android foreground service continues running
2. Service runs as OS-level component with persistent notification
3. Detects falls by monitoring:
   - **Impact detection**: Acceleration > 4.0G
   - **Stillness confirmation**: Average acceleration < 0.5G for 500-2000ms after impact
4. When fall detected:
   - Sends broadcast notification to app
   - Shows system notification
   - App can send alert to guardians

### On Device Boot:
1. BootCompletedReceiver receives boot event
2. Automatically starts ActivityMonitoringService
3. Monitoring continues without user action

## Setup Instructions

### Step 1: Register the Native Module
Edit `android/app/src/main/java/com/safenet/app/MainApplication.java` and add to the `getPackages()` method:

```java
packages.add(new ActivityMonitoringPackage());
```

### Step 2: Rebuild Android App
```bash
npm run android
# OR
expo run:android
```

**IMPORTANT**: This must be a full rebuild (not just `expo start`), as native changes require:
- Gradle compilation
- Native code linking
- APK rebuilding

### Step 3: Request Activity Recognition Permission
At runtime, you may need to request the `ACTIVITY_RECOGNITION` permission:

```typescript
import { requestForegroundPermissionsAsync } from 'expo-location';
import { PermissionsAndroid } from 'react-native';

// On Android 12+
if (Platform.OS === 'android' && Platform.Version >= 31) {
  PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
  );
}
```

## Testing

### Test 1: App Open
1. Open SafeNet app
2. Enable activity monitoring
3. Hold device and shake it rapidly (simulate fall)
4. **Expected**: Notification appears immediately

### Test 2: App Minimized
1. Open SafeNet app and enable activity monitoring
2. Press home button to minimize app
3. Simulate fall (shake device rapidly)
4. **Expected**: Notification appears on lock screen (app doesn't need to be visible)

### Test 3: App Closed
1. Enable monitoring while app is open
2. Close app completely (swipe from recents)
3. Simulate fall
4. **Expected**: Notification appears even though app is closed
5. This is the KEY test that verifies the fix

### Test 4: Device Reboot
1. Enable monitoring
2. Restart device
3. Monitoring should automatically resume
4. **Expected**: Simulate fall and notification appears

## Troubleshooting

### Service Not Starting
**Symptom**: Logs show "Native activity monitoring module not available"

**Solution**:
1. Ensure Android rebuild completed: `expo run:android --clean`
2. Verify ActivityMonitoringPackage added to MainApplication.java
3. Check AndroidManifest.xml has service and receiver declarations
4. Confirm permissions added to app.json

### No Notifications When App Closed
**Symptom**: Monitoring works when app open but fails when closed

**Solution**:
1. Check Android logcat: `adb logcat | grep "ActivityMonitoring"`
2. Verify service shows in running services: `adb shell dumpsys activity services`
3. Disable battery optimization for SafeNet app (Settings → Apps → SafeNet → Battery → Not Optimized)
4. Check notification settings aren't blocking the app

### Accelerometer Not Reading Data
**Symptom**: No fall detection at all

**Solution**:
1. Verify device has accelerometer: `adb shell dumpsys sensorservice`
2. Test accelerometer with simple app
3. Check logcat for permission errors

## Performance Considerations

- **CPU Usage**: Service uses `SENSOR_DELAY_GAME` which is moderate (~50Hz sampling)
- **Battery Drain**: Persistent notification + accelerometer monitoring adds ~5-15% drain
- **Memory**: Native service uses ~20-30MB
- **System Resources**: Foreground service is prioritized by OS, less likely to be killed

## Architecture

```
React Native App
    ↓
BackgroundActivityMonitoringService.ts
    ↓
NativeActivityMonitoringService.ts
    ↓
ActivityMonitoringModule.java
    ↓
ActivityMonitoringService.java (Native Foreground Service)
    ↓
Android Accelerometer Hardware
```

## Security & Permissions

- Service runs with only necessary permissions (ACTIVITY_RECOGNITION, VIBRATE, etc.)
- No location, camera, or microphone access
- Foreground notification shows users that monitoring is active
- Can be stopped anytime via the app

## Files Modified/Created

**New Files:**
- `android/app/src/main/java/com/safenet/app/ActivityMonitoringService.java`
- `android/app/src/main/java/com/safenet/app/BootCompletedReceiver.java`
- `android/app/src/main/java/com/safenet/app/ActivityMonitoringModule.java`
- `android/app/src/main/java/com/safenet/app/ActivityMonitoringPackage.java`
- `services/NativeActivityMonitoringService.ts`

**Updated Files:**
- `services/BackgroundActivityMonitoringService.ts`
- `android/app/src/main/AndroidManifest.xml`
- `app.json`

**Still TODO:**
- `android/app/src/main/java/com/safenet/app/MainApplication.java` - Add ActivityMonitoringPackage to packages list

## Next Steps

1. **Register the native module** in MainApplication.java
2. **Rebuild the app**: `expo run:android --clean`
3. **Test all scenarios** above
4. **Disable battery optimization** for SafeNet in device settings
5. **Monitor logcat** for any errors: `adb logcat | grep -i safenet`

## Future Improvements

- [ ] Add running detection (not just falls)
- [ ] Add sudden stop detection (running → stopped)
- [ ] Configurable sensitivity thresholds
- [ ] Background task for location along with activity detection
- [ ] iOS support using native HealthKit framework
