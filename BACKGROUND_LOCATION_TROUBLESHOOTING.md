# Background Location Tracking Troubleshooting Guide

## Issue: Location tracking stops when app is minimized or phone is locked

### Root Causes & Solutions

#### 1. **Permission Not Granted: "Allow all the time"**
The most common issue. Android requires explicit "Allow all the time" permission for background tracking.

**Check:**
```typescript
import { checkBackgroundLocationStatus } from './services/DiagnosticsService';
await checkBackgroundLocationStatus();
```

**Solution:**
- Open app settings
- Navigate to Permissions > Location
- Make sure it's set to "Allow all the time" (not just "Allow while using the app")
- If using Expo Go, settings are at Settings > Apps > Expo Go > Permissions > Location

#### 2. **Battery Optimization (Doze Mode) Enabled**
Android's power-saving features can kill background processes.

**Solution:**
- Go to Settings > Battery > Battery Saver or Battery Optimization
- Add SafeNet to the "unrestricted" or "whitelist" apps
- Or: Settings > Apps > Permissions > Manage all permissions and disable battery optimization

#### 3. **Task Not Registered**
The background task might not be registered properly.

**Solution:**
- Check logs when app starts for: `📝 Defining background location task...`
- Look for: `✅ Background location task registered`
- If not seen, the task definition failed

#### 4. **Location Updates Never Started**
Task is registered but location updates never began.

**Check logs for:**
- `✅ Location task confirmed defined`
- `🚀 Starting location updates with task`
- `🔍 Tracking verification: ACTIVE ✅`

**If missing:** Location.startLocationUpdatesAsync() failed

#### 5. **Foreground Service Not Running (Android 12+)**
Android requires a foreground service for background location.

**Solution:**
- App should show a persistent notification "SafeNet Active" when tracking
- If notification doesn't appear, foreground service failed to start
- Check app.json has proper configuration

### Step-by-Step Troubleshooting

#### Step 1: Verify Permissions
```
🔐 In-App Check:
- Go to Home screen
- Toggle tracking ON
- Check console for permission logs

Expected logs:
✅ Foreground permission granted
✅ Background permission granted
```

#### Step 2: Verify Task Started
```
📋 In-App Check:
- After toggling ON, wait 3 seconds
- Check console for:
  ✅ Location task confirmed defined
  🚀 Starting location updates with task
  🔍 Tracking verification: ACTIVE ✅
```

#### Step 3: Verify Foreground Service
```
📱 Android Visual Check:
- When tracking is ON, look for persistent notification
- Should say "SafeNet Active - Real-time location tracking active"
- If missing: Foreground service failed

iOS Check:
- Should show blue bar at top
```

#### Step 4: Minimize App & Check Logs
```
🧪 Test:
1. Start tracking (toggle ON)
2. Wait for verification logs
3. Lock phone / minimize app
4. Wait 10 seconds
5. Unlock phone / open app
6. Check console for location updates

Expected: Location updates should still appear every 1-5 seconds
```

#### Step 5: Verify with Diagnostics
```typescript
import { checkBackgroundLocationStatus } from './services/DiagnosticsService';

// Call during app usage
await checkBackgroundLocationStatus();

// Check output for all ✅ marks
```

### Common Error Messages & Fixes

#### ❌ "Background location permission not granted"
- User must grant "Allow all the time" permission
- Request appears only once; user must go to Settings to change

#### ❌ "Location task is not defined"
- Task registration failed
- Check app.json for TaskManager plugin configuration
- Restart Expo

#### ⚠️ "Tracking lost, restarting..."
- Tracking stopped unexpectedly
- Usually due to battery optimization or low memory
- App should auto-restart it

#### ⚠️ "Could not send location" / "Network Error"
- Backend server is down
- Check that `npm run backend` is running
- Verify backend IP in services/api.ts matches your machine

### Required Configuration

#### app.json
✅ Must have these Android permissions:
```json
"permissions": [
  "ACCESS_FINE_LOCATION",
  "ACCESS_BACKGROUND_LOCATION",
  "FOREGROUND_SERVICE",
  "FOREGROUND_SERVICE_LOCATION",
  "WAKE_LOCK"
]
```

✅ Must have iOS background modes:
```json
"UIBackgroundModes": ["location", "fetch"]
```

#### package.json
✅ Must have dependencies:
```
expo-location
expo-task-manager
react-native
expo
```

### Advanced Debugging

#### Enable Verbose Logging
In BackgroundLocationService.ts, change:
```typescript
const VERBOSE_LOGGING = true;
```

This will log every location update.

#### Test with Expo Go
Background location tracking works better with physical device or Android emulator.
- Expo Go on iOS has limitations
- Physical device recommended for testing

#### Check Native Logs
```bash
# Android via adb
adb logcat | grep -i location

# See all app logs
adb logcat | grep SafeNet
```

### Performance Tips

1. **Reduce update frequency** if battery drain is high:
   - Change `timeInterval: 1000` to `5000` (milliseconds)
   - Change `distanceInterval: 1` to `10` (meters)

2. **Check data usage**:
   - Each location is ~100 bytes
   - 1 update/sec = 360KB/hour
   - Adjust intervals for your use case

3. **Monitor battery**:
   - High frequency + high accuracy = high battery drain
   - Use `BestForNavigation` only if needed
   - Switch to `Balanced` or `ReducedAccuracy` for less drain

### Support Checklist

Before reporting issues, verify:
- [ ] App has "Allow all the time" location permission
- [ ] Battery optimization is disabled for SafeNet
- [ ] Backend server is running (`npm run backend`)
- [ ] Phone isn't in extreme power saving mode
- [ ] App has network access (WiFi or data)
- [ ] Task appears in logs when app starts
- [ ] Foreground service notification appears when tracking ON
- [ ] Logs show location updates arriving (check every 1-5 seconds)
