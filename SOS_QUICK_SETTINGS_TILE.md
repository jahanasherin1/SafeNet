# SOS Quick Settings Tile Implementation

## Overview
The SOS (Save Our Soul) Quick Settings Tile is now integrated into the SafeNet app, allowing users to trigger emergency alerts directly from their Android device's quick settings panel without opening the app.

## What is a Quick Settings Tile?
Quick Settings Tiles are shortcuts that appear in the notification panel when you pull down the status bar on Android devices. Users can access these tiles by:
1. Pulling down the notification panel from the top of the screen
2. Looking for the "SOS" tile
3. Tapping it to trigger emergency alert

## How It Works

### Architecture Flow
```
User taps SOS Tile in Quick Settings
        ↓
SOSQuickSettingsTile.java (Android Service) receives click
        ↓
Broadcasts "com.safenet.SOS_TILE_PRESSED" intent
        ↓
MainActivity detects tile press and launches app with trigger_sos flag
        ↓
SOSTileReceiver.java (Broadcast Receiver) receives broadcast
        ↓
Sends event to React Native "SOS_TILE_PRESSED" via DeviceEventEmitter
        ↓
SOSTileService.ts (TypeScript) listens for event
        ↓
Automatically triggers the same SOS flow as the in-app button:
  - Requests location permission
  - Gets current GPS location
  - Calls /api/sos/trigger with location data
  - Notifies all guardians via email
  - Shows confirmation dialog
```

## Files Added/Modified

### 1. Android Native Files
**Created:**
- `android/app/src/main/java/com/safenet/app/SOSQuickSettingsTile.java`
  - Main service that handles Quick Settings tile lifecycle
  - Manages tile UI appearance
  - Forward clicks to broadcast system
  - Launches app when tile is tapped

- `android/app/src/main/java/com/safenet/app/SOSTileReceiver.java`
  - Broadcast receiver that listens for tile clicks
  - Communicates with React Native via DeviceEventEmitter
  - Sends "SOS_TILE_PRESSED" event to JavaScript side

**Modified:**
- `android/app/src/main/java/com/safenet/app/MainActivity.kt`
  - Added static instance() method for access by broadcast receiver
  - Registers SOSTileReceiver on app startup
  - Handles "trigger_sos" intent extra
  - Sends events to React Native when tile is pressed

- `android/app/src/main/AndroidManifest.xml`
  - Added EXPAND_STATUS_BAR permission
  - Registered SOSQuickSettingsTile service with proper intent filters
  - Registered SOSTileReceiver broadcast receiver

### 2. React Native/TypeScript Files
**Created:**
- `services/SOSTileService.ts`
  - Singleton service that manages SOS tile event listener
  - Sets up NativeEventEmitter listener for "SOS_TILE_PRESSED" events
  - Implements same SOS trigger logic as in-app button
  - Handles location retrieval and API calls
  - Automatically triggers SOS when tile is pressed

**Modified:**
- `app/_layout.tsx`
  - Initialize SOSTileService on app startup
  - Cleanup service on app shutdown

## User Experience

### Adding the SOS Tile
1. Open notification panel (pull down from top)
2. Look for an edit icon (usually three dots or pencil)
3. Find "SOS" in the list of tiles
4. Tap and hold to add it to quick settings

### Using the SOS Tile
1. Need to trigger SOS? No need to unlock phone or open app
2. Pull down notification panel
3. Tap "SOS" tile
4. Alert is immediately sent to all guardians with your location
5. App automatically opens to show confirmation

## Benefits

✅ **Faster Response Time**
- Trigger SOS without opening app
- Works even with locked phone (on some Android versions)
- No navigation required

✅ **Emergency Accessibility**
- One-tap access from notification panel
- Works in any situation
- Location captured automatically

✅ **Seamless Integration**
- Same backend SOS flow as in-app button
- All existing SOS features work (email, notifications, tracking)
- Guardians receive identical alerts

## Technical Details

### Permissions Required
- `android.permission.EXPAND_STATUS_BAR` - To interact with quick settings
- `BIND_QUICK_SETTINGS_TILE` - System permission to provide QS tile service

### API Endpoint
Calls the same `/api/sos/trigger` endpoint with:
```json
{
  "userEmail": "email@example.com",
  "userName": "User Name",
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

### Android Version Support
- **Minimum:** Android 7.0 (API 24)
- **Works on all modern Android versions**

## Troubleshooting

### SOS Tile Not Showing in Quick Settings
1. Ensure Android 7.0 or higher
2. Restart the app
3. Go to Settings → Display → Status Bar → Edit Quick Settings
4. Look for "SOS" tile to add it

### Tile Not Responding
1. Check if app is installed and up-to-date
2. Clear app cache: Settings → Apps → SafeNet → Storage → Clear Cache
3. Restart device
4. Reinstall app if issue persists

### Location Not Being Captured
1. Ensure location permission is granted to SafeNet
2. Check Settings → Apps → SafeNet → Permissions → Location
3. Try enabling GPS
4. If using high accuracy, ensure device has clear line of sight

## Future Enhancements

Potential improvements for future versions:
- [ ] Tile icon customization
- [ ] Custom tile label
- [ ] Tile state persistence
- [ ] Analytics tracking of tile usage
- [ ] Integration with device lock screen quick actions

## References

- [Android Quick Settings API Documentation](https://developer.android.com/develop/ui/views/notifications/quick-settings)
- [TileService Documentation](https://developer.android.com/reference/android/service/quicksettings/TileService)
- [SafeNet SOS System](../PUSH_NOTIFICATIONS.md)
