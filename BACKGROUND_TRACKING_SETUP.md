# Background Location Tracking Setup

## Overview
SafeNet now supports real-time background location tracking for guardians to monitor the user's location even when the app is not actively in use.

## Features Implemented

### 1. **Background Location Service** (`services/BackgroundLocationService.ts`)
- Runs location updates in the background using Expo's TaskManager
- Updates location every 30 seconds or when moved 50+ meters
- Automatically sends location to backend
- Foreground service notification showing tracking status

### 2. **Location Screen UI Toggle** (`app/dashboard/location.tsx`)
- Live tracking banner showing current tracking status
- ON/OFF toggle button
- Real-time status indicator (red indicator when tracking)
- Shows "Sharing location" or "Not sharing location" subtitle

### 3. **Backend Location Tracking** (`backend/routes/users.js`)
- Updated to distinguish between manual and background updates
- Logs all location updates with timestamps
- Stores whether each update is from background tracking

## How It Works

### Starting Background Tracking
1. User taps the tracking toggle ON
2. App requests background location permissions
3. Location service starts monitoring location every 30 seconds
4. Each location update is automatically sent to backend
5. Guardians can see real-time location in guardian dashboard

### Stopping Background Tracking
1. User taps the tracking toggle OFF
2. Background location service stops
3. Location updates are no longer sent
4. App shows a notification confirming the stop

## Permissions Required

The app needs the following permissions:
- **Foreground Location** - Always required
- **Background Location** - For background tracking (iOS & Android)

Add to `app.json` if not already present:
```json
"android": {
  "permissions": [
    "ACCESS_FINE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION"
  ]
}
```

## Configuration

### Update Frequency
- **Time Interval**: 30 seconds (configurable in `BackgroundLocationService.ts` line ~73)
- **Distance Interval**: 50 meters (only update if moved this far)

To adjust:
```typescript
await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  timeInterval: 30000,      // Change this (in milliseconds)
  distanceInterval: 50,     // Change this (in meters)
  // ...
});
```

### Notification Settings
The foreground service notification is configured as:
```
Title: SafeNet Location Tracking
Body: Your location is being shared with your guardians
Color: #6A5ACD
```

## Testing

### 1. Test on Device/Emulator
```bash
npm run android
# or
npm run ios
```

### 2. Enable Tracking
- Open Live Location screen
- Tap the tracking toggle to turn ON
- Should see "Sharing location" status

### 3. Verify Backend Updates
- Check backend logs for location updates
- Should see pattern like:
  ```
  📍 Background location update for user@email.com: (9.9816, 76.2856)
  ```

### 4. Test With App in Background
- Start tracking
- Press home button to minimize app
- Wait 30+ seconds
- Check backend logs - updates should continue

## Integration with Guardian Dashboard

Guardian dashboard can fetch user's location:
```javascript
// GET /api/user/:email/location
// Returns: { latitude, longitude, timestamp, isBackgroundUpdate }
```

To implement guardian location viewing, use the existing location data structure.

## Troubleshooting

### Tracking Not Starting
- ✅ Check if location permissions are granted
- ✅ Verify `expo-location` and `expo-task-manager` are installed
- ✅ Check app logs for error messages

### Background Updates Not Received
- ✅ Ensure app has background location permission
- ✅ Check if location services are enabled on device
- ✅ Verify backend is running and accessible

### High Battery Usage
- ✅ Increase `timeInterval` in `BackgroundLocationService.ts`
- ✅ Increase `distanceInterval` to reduce unnecessary updates
- ✅ User can disable tracking when not needed

## Security Considerations

⚠️ **Important**: 
- Only users can enable/disable their own tracking
- Guardians see location only if user has tracking enabled
- Backend validates email before storing location
- Add user permission checks if needed

## Files Modified

1. **Created**: `services/BackgroundLocationService.ts` - Background tracking service
2. **Updated**: `app/dashboard/location.tsx` - Added tracking toggle UI
3. **Updated**: `backend/routes/users.js` - Enhanced location logging

## Future Enhancements

- Add tracking history/breadcrumb trail
- Set custom update intervals per guardian
- Geofence alerts
- Location sharing schedule
- Emergency SOS location instant send
