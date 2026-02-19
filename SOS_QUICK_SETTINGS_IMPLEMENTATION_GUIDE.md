# SOS Quick Settings Tile - Implementation Guide

## Summary of Changes

The SafeNet app now supports triggering SOS alerts from an Android Quick Settings tile, allowing users to send emergency alerts without opening the app.

## What Was Implemented

### 1. Android Native Components (Java/Kotlin)

#### SOSQuickSettingsTile.java
- **Purpose:** Main service that represents the Quick Settings tile
- **Key Features:**
  - Listens for tile taps
  - Updates tile UI (label, icon, state)
  - Launches app when tapped with SOS trigger intent
  - Broadcasts intent to notify app of tile press

#### SOSTileReceiver.java  
- **Purpose:** Broadcast receiver that intercepts SOS tile press events
- **Key Features:**
  - Listens for "com.safenet.SOS_TILE_PRESSED" broadcasts
  - Sends events to React Native layer via DeviceEventEmitter
  - Handles communication between native and JavaScript code

#### MainActivity.kt (Modified)
**Added:**
- Static instance getter to allow broadcast receiver access to React context
- SOSTileReceiver registration and unregistration in onCreate/onDestroy
- Intent handling for "trigger_sos" extra parameter
- Event sending to React Native

### 2. React Native/TypeScript Components

#### SOSTileService.ts
- **Purpose:** TypeScript service that bridges native events to app logic
- **Key Features:**
  - Singleton pattern for single instance
  - Listens for "SOS_TILE_PRESSED" native events
  - Automatically triggers SOS flow when event is received
  - Retrieves user email and location
  - Makes API call to /api/sos/trigger
  - Supports cleanup on app destruction

#### app/_layout.tsx (Modified)
**Added:**
- Initialize SOSTileService on app startup
- Cleanup service on app shutdown

### 3. Configuration Files

#### AndroidManifest.xml (Modified)
**Added:**
- `android.permission.EXPAND_STATUS_BAR` permission
- SOSQuickSettingsTile service declaration with:
  - `android.service.quicksettings.action.QS_TILE` intent filter
  - Proper permissions and metadata
- SOSTileReceiver broadcast receiver declaration

## How to Build & Test

### Step 1: Review Changed Files
Verify all files were created/modified:
```
✓ android/app/src/main/java/com/safenet/app/SOSQuickSettingsTile.java
✓ android/app/src/main/java/com/safenet/app/SOSTileReceiver.java
✓ android/app/src/main/java/com/safenet/app/MainActivity.kt
✓ android/app/src/main/AndroidManifest.xml
✓ services/SOSTileService.ts
✓ app/_layout.tsx
```

### Step 2: Build Android App
```bash
cd c:\Users\ADMIN\Documents\SafeNet
npm run android
```

Or use Expo:
```bash
expo run:android
```

### Step 3: Add SOS Tile to Quick Settings
1. On your Android device (or emulator), pull down the notification panel
2. Look for an edit icon (three dots or pencil icon)
3. Find "SOS" in the list of available tiles
4. Long-press and drag it to your quick settings
5. The SOS tile should now appear in your quick settings panel

### Step 4: Test the Tile
1. Pull down the quick settings panel
2. Look for the "SOS" tile (should have emergency/alert icon)
3. Tap the SOS tile
4. Your location should be captured and alert sent to guardians
5. App should open automatically showing the SOS confirmation

### Step 5: Verify Backend Integration
Check your backend logs:
```
✓ Alert received at /api/sos/trigger
✓ User location captured
✓ Email notifications sent to guardians
✓ Alert record created in database
```

Check guardian dashboard:
```
✓ New SOS alert appears in alerts list
✓ Location is displayed on map
✓ Timestamp is recorded
```

## Testing Scenarios

### Scenario 1: SOS from Locked Device
**Expected Behavior:**
- User can pull down notification panel even on locked screen (Android 7+)
- Tap SOS tile
- Alert is sent immediately
- App opens when unlocked

### Scenario 2: SOS from App Backgrounded
**Expected Behavior:**
- App is not currently running/visible
- User taps SOS tile
- Tile launches the app with trigger_sos flag
- App processes SOS and shows confirmation

### Scenario 3: SOS from Active App
**Expected Behavior:**
- User has app open and visible
- User pulls down quick settings
- Tap SOS tile
- App receives event via DeviceEventEmitter
- SOS is triggered without closing the app

### Scenario 4: Multiple SOS Taps
**Expected Behavior:**
- User taps SOS tile multiple times
- Each tap sends separate alert
- Multiple emails sent to guardians
- All alerts appear in guardian dashboard

## Troubleshooting

### Issue: SOS Tile Not Showing in Quick Settings
**Solution:**
1. Ensure app is installed
2. Rebuild with `npm run android`
3. Restart device
4. Go to quick settings editor and look for "SOS"
5. Android 7+ is required

### Issue: Tile Tap Not Triggering Alert
**Solution:**
1. Check logcat for errors: `adb logcat | grep -i sos`
2. Verify location permission is granted
3. Check backend logs for API calls
4. Ensure user is logged in (email stored in AsyncStorage)
5. Try restarting app

### Issue: Location Not Captured
**Solution:**
1. Go to Settings → Apps → SafeNet → Permissions
2. Enable "Location" permission
3. Select "Allow all the time" for background location
4. Toggle GPS on
5. Try again

### Issue: Guardians Not Receiving Email
**Solution:**
1. Check backend email configuration
2. Verify guardians have valid email addresses
3. Check /api/sos/trigger response in network logs
4. Review backend logs for email errors
5. Check spam/junk email folders

## File Structure Reference

```
SafeNet/
├── android/
│   └── app/src/main/
│       ├── java/com/safenet/app/
│       │   ├── SOSQuickSettingsTile.java (NEW)
│       │   ├── SOSTileReceiver.java (NEW)
│       │   └── MainActivity.kt (MODIFIED)
│       └── AndroidManifest.xml (MODIFIED)
├── services/
│   └── SOSTileService.ts (NEW)
├── app/
│   └── _layout.tsx (MODIFIED)
└── SOS_QUICK_SETTINGS_TILE.md (DOCUMENTATION)
```

## API Integration

The SOS tile uses the same `/api/sos/trigger` endpoint as the in-app button.

**Request Body:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "reason": "SOS triggered from Quick Settings tile",
  "alertType": "TILE_SOS",
  "sendPushNotification": true,
  "timestamp": "2026-02-18T10:30:00.000Z"
}
```

**Response:**
```json
{
  "message": "Alert sent successfully",
  "emailsSent": 3,
  "guardianCount": 3
}
```

## Performance Considerations

- **Memory Usage:** Minimal - only listens for broadcast events
- **Battery Usage:** No continuous background service
- **Network Usage:** Single API call per SOS trigger
- **App Performance:** No impact when tile not active

## Security Considerations

✅ **Permissions Required:**
- `android.permission.EXPAND_STATUS_BAR` - Expand notification panel
- Location (user must grant)
- Internet (user must grant)

✅ **Data Safety:**
- SOS tile only works when app is installed
- Requires authenticated user (email validation)
- Location only sent to guardians
- Same security as in-app SOS button

✅ **Privacy:**
- Broadcast is internal to app package
- No data sent to third parties
- User has full control

## Next Steps

1. Build and test the feature
2. Verify with multiple test devices
3. Test on different Android versions
4. Monitor backend logs for success rates
5. Gather user feedback
6. Consider analytics tracking of tile usage

## Additional Resources

- [See documentation](./SOS_QUICK_SETTINGS_TILE.md)
- [Android Quick Settings API Docs](https://developer.android.com/develop/ui/views/notifications/quick-settings)
- [SafeNet SOS System](./PUSH_NOTIFICATIONS.md)

---

**Implementation Date:** February 18, 2026  
**Status:** ✅ Ready for Testing  
**Version:** 1.0.0
