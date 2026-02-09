# 📍 Location Service Troubleshooting Guide

**Status:** Improved error handling implemented  
**Date:** February 4, 2026  
**Issue:** Location unavailable errors

---

## Quick Fixes

### ✅ Check 1: Location Services Enabled
1. Open **Settings** on your device
2. Go to **Apps** → **SafeNet**
3. Tap **Permissions**
4. Toggle **Location** to **ON**
5. Select **Allow all the time** or **Allow only while using the app**

**For iOS:**
1. Settings → Privacy → Location Services
2. Toggle Location Services ON
3. Find SafeNet and set to "Always" or "While Using"

### ✅ Check 2: Device Location
- Ensure you're **outdoors** with clear sky view
- Indoors or near windows → GPS may be weak
- Underground or dense buildings → Location may fail

### ✅ Check 3: GPS Hardware
- Restart your phone completely
- Check if other maps apps (Google Maps) work
- If they don't work → Potential hardware issue

### ✅ Check 4: App Cache
Clear SafeNet cache and reinstall:
```bash
# Android
adb shell pm clear com.safenet

# iOS
Delete app → Reinstall from App Store
```

---

## Error Messages Explained

### "Location services are enabled"
✅ **This is good!** Means settings are correct.

### "Permission Denied"
- User rejected location permission
- **Fix:** Go to Settings → Permissions → Allow Location

### "Current location is unavailable"
- GPS couldn't get a position fix
- **Possible causes:**
  - Indoors without GPS access
  - Weak GPS signal
  - Too many obstacles (buildings, trees)
  - GPS takes time to warm up (first use)
- **Fix:** Go outdoors, wait 10-30 seconds, try again

### "Timeout occurred"
- GPS took too long to respond
- **Fix:** Try again after moving slightly or waiting

---

## Detailed Troubleshooting

### Step 1: Verify Permissions in App
The app now shows helpful messages:

**"Acquiring GPS..."**
- ✅ Permissions granted, waiting for signal
- Wait 10-20 seconds
- Move outdoors if possible

**"Location Unavailable"**
- ❌ Could not get location
- Check location services enabled
- Try refresh button

### Step 2: Test with Other Apps
1. Open **Google Maps**
2. Does it show your location?

**If Maps works:**
- SafeNet issue (try refreshing)
- Clear app cache and restart

**If Maps doesn't work:**
- Device location issue (hardware or settings)
- Try restarting phone

### Step 3: Check Network
Weather alerts need both:
- ✅ Location (GPS)
- ✅ Internet (WiFi or mobile data)

Both must be working for auto-alerts!

### Step 4: Restart Everything
```
1. Close SafeNet app completely
2. Restart phone
3. Turn on Location Services
4. Turn on WiFi/Mobile Data
5. Open SafeNet again
6. Try location
```

---

## Advanced Diagnostics

### Check App Logs
When location fails, app shows console logs:
```
Location Error: Current location is unavailable
```

### For Developers
Add this to test location service:

```typescript
import * as Location from 'expo-location';

// Test 1: Check permissions
const { status } = await Location.requestForegroundPermissionsAsync();
console.log('Permission status:', status);

// Test 2: Get last known location
const lastLocation = await Location.getLastKnownPositionAsync();
console.log('Last known:', lastLocation);

// Test 3: Get current position
try {
  const current = await Location.getCurrentPositionAsync({ 
    accuracy: Location.Accuracy.Balanced,
    timeoutMs: 10000 
  });
  console.log('Current location:', current.coords);
} catch (error) {
  console.error('Error details:', error);
}

// Test 4: Check background location
const backgroundLocation = await Location.hasStartedLocationUpdatesAsync('SAFENET_BACKGROUND_LOCATION');
console.log('Background tracking:', backgroundLocation);
```

---

## Timing Expectations

### First Time After Reboot
- Takes **30-60 seconds** for GPS to lock on
- First location may be inaccurate (±100m)
- Accuracy improves with time

### Outdoors (Clear Sky)
- Gets location in **5-15 seconds**
- Accuracy: ±5-10m (good)

### Indoors
- May never get GPS
- Can use last known location
- Accuracy: ±100-500m (poor)

### After Traveling
- Takes **10-30 seconds** to update
- First update after movement may be slow

---

## Background Location Status

The app auto-saves location every 5 seconds when:
- ✅ User is logged in
- ✅ App is running (foreground or background)
- ✅ Location tracking is enabled
- ✅ Location services enabled on device

**Check if background tracking is working:**
- Look for console logs: `✅ Location sent to backend`
- Should appear every 5 seconds (while app is active)

**If not appearing:**
- Location permission set to "While Using App" only
- Background task was killed
- Device in battery saver mode

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **"Waiting..."** for 2+ min | No GPS signal | Go outdoors, wait |
| **"Location Unavailable"** | Weak/no signal | Change location, try again |
| **Always says "Acquiring"** | App bug or permission | Refresh button or restart |
| **Maps work, SafeNet doesn't** | App-specific issue | Restart app or clear cache |
| **Location jumps around** | Weak signal accuracy | Improve signal strength |
| **Weather alerts not working** | Missing location | Get location first |

---

## Device-Specific Tips

### Android
- Go to **Settings** → **Location** → **Mode**
- Select **High Accuracy** (uses GPS + WiFi + Network)
- Some devices: Enable **Improve Location Accuracy**
- Some devices: Disable battery saver mode

### iOS
- Settings → Privacy → Location Services → **ON**
- Settings → Privacy → Location Services → SafeNet → **Always**
- Make sure WiFi is enabled (helps GPS lock faster)
- Disable any VPN that might interfere

---

## Weather Alerts & Location

Auto weather alerts depend on location being available:

```
Weather Alert Cycle:
1. Every 30 minutes
2. Read location from AsyncStorage
3. If no location: Skip this check
4. Fetch weather for location
5. If unsafe: Send alert
```

**If weather alerts not working:**
1. Make sure location is available
2. Check: Tap refresh button on location screen
3. Wait for "📍 Active" status
4. Wait up to 30 minutes for auto weather check

---

## Getting Help

**Provide this information when reporting issues:**

```
Device: [iPhone 15 / Samsung S24 / etc]
OS Version: [iOS 17.2 / Android 14 / etc]
SafeNet Version: [version number]
Location Status: [Active / Unavailable / Waiting]
Background Tracking: [Yes / No]
Last Location Update: [timestamp]
Error Message: [exact error text]
Steps Taken: [what you already tried]
```

---

## Testing Location Manually

### Test with Mock Location (Android)
1. Developer Settings → Select mock location app
2. Use any map app to set mock location
3. SafeNet should use that location

### Test with Simulator
- **Android Emulator:** GPS can be set in emulator settings
- **iOS Simulator:** Set location in Debug menu

---

## Performance Tips

1. **First launch takes longer** - GPS hardware warming up
2. **Indoors = slower** - WiFi may help but not as good as GPS
3. **Moving = slower** - GPS needs to verify movement
4. **Static = faster** - Already locked, just updates

---

## Prevention

✅ **Do this to avoid issues:**
- Always enable location services before opening app
- Grant **"Allow while using"** or **"Always"** permission
- Keep WiFi enabled (helps GPS)
- Move to open area for better signal
- Don't disable location between app uses
- Restart phone if issues persist

❌ **Avoid these:**
- Disabling location services between uses
- Restricting to "Ask every time"
- Using without internet (weather needs it)
- Indoors with no WiFi
- Battery saver mode (can disable GPS)

---

## Summary

✅ **Improved error messages now show:**
- What's happening (Acquiring GPS vs Unavailable)
- What to check (Location services enabled?)
- How to fix it (Tap refresh button)

✅ **Better user experience:**
- No more silent failures
- Clear next steps provided
- Helpful hints in UI
- Retry options available

✅ **For weather alerts:**
- Requires active location
- Depends on background tracking
- Checks every 30 minutes
- Automatically handles missing location

---

**Status:** Enhanced error handling deployed ✅  
**User Impact:** Clear, actionable error messages  
**Testing:** Verified with location permission flows  
