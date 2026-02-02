# Testing Real-Time Background Location Tracking

## Prerequisites
1. ✅ Permissions are already configured in AndroidManifest.xml
2. ✅ BackgroundLocationService is implemented
3. ✅ Foreground service is configured

## Testing Steps

### 1. Build and Install the App
```bash
# From the project root
cd android
./gradlew clean
cd ..
npx expo run:android
```

### 2. Grant Permissions
When the app starts and you enable tracking:
- **Location Permission**: Grant "Allow all the time" (not "Only while using the app")
- **Battery Optimization**: When prompted, disable battery optimization for SafeNet
- **Notifications**: Allow notifications (for the persistent tracking indicator)

### 3. Enable Tracking
1. Open the app
2. Go to **Home** screen
3. Tap **"Start Tracking"** button
4. Or go to **Profile** → Enable **"Allow Location Tracking"**

### 4. Verify Tracking is Active
You should see:
- ✅ A persistent notification saying "SafeNet Active - Real-time location tracking active"
- ✅ Console logs showing location updates every 2-3 seconds
- ✅ Location data being sent to backend `/api/user/update-location`

### 5. Test Background Tracking
**Test 1: App Minimized**
1. Press Home button to minimize the app
2. Wait 30 seconds
3. Open the app again
4. Check logs - you should see continuous location updates

**Test 2: Phone Locked**
1. With tracking enabled, lock your phone
2. Walk around for 1-2 minutes
3. Unlock and open the app
4. Check the backend - locations should have been recorded

**Test 3: App Completely Closed**
1. Enable tracking
2. Swipe away the app from recent apps
3. The foreground service notification should **still be visible**
4. Location updates continue

### 6. Monitor Location Updates

**Check App Logs:**
```bash
npx react-native log-android
```

Look for:
- `📍 Location update received`
- `✅ Location sent to backend`
- `🔍 Tracking verification: ACTIVE ✅`

**Check Backend:**
```bash
# In another terminal
cd backend
npm start
```

Watch for POST requests to `/api/user/update-location`

**Check Database:**
Query the user's location history to see real-time updates.

## Expected Behavior

### ✅ What Should Work:
- **App Minimized**: Location updates continue every 2-3 seconds
- **Phone Locked**: Location updates continue (may slow to every 5-10 seconds to save battery)
- **Network Issues**: Locations are queued and sent when connection returns
- **Low Battery**: Automatically switches to optimized mode (updates every 30-60 seconds)

### ⚠️ Common Issues:

**Issue 1: Tracking Stops When App is Killed**
- **Solution**: Make sure user grants "Allow all the time" for location permission
- Check that battery optimization is disabled for SafeNet

**Issue 2: Tracking Stops After 10 Minutes**
- **Solution**: Some manufacturers (Xiaomi, Huawei, Samsung) have aggressive battery savers
- Go to Settings → Apps → SafeNet → Battery → Select "No restrictions"

**Issue 3: No Location Updates**
- **Solution**: Check permissions in Settings → Apps → SafeNet → Permissions
- Ensure GPS is enabled on the device

**Issue 4: Inaccurate Locations**
- **Solution**: Make sure device has a clear view of the sky for GPS
- Indoor locations use WiFi/cell towers and are less accurate

## Debugging Commands

### Check if location task is running:
```javascript
import * as Location from 'expo-location';
import { LOCATION_TASK_NAME } from './services/BackgroundLocationService';

const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
console.log('Tracking active:', isRunning);
```

### Check tracking state:
```javascript
import { isBackgroundTrackingActive } from './services/BackgroundLocationService';

const active = await isBackgroundTrackingActive();
console.log('Background tracking:', active);
```

### Force a location update:
```javascript
import * as Location from 'expo-location';

const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.BestForNavigation,
});
console.log('Current location:', location.coords);
```

## Advanced: Real-Time Location Viewer

You can create a guardian view to see live location updates:

1. Guardian logs in
2. Guardian views protected user's profile
3. Map shows user's location updating in real-time (every 2-3 seconds)

This is already implemented - guardians can track their protected users' locations live on the map!

## Battery Optimization

The service automatically adjusts based on battery level:

- **100-20%**: High accuracy, updates every 2-3 seconds
- **20-15%**: Balanced accuracy, updates every 30 seconds
- **Below 15%**: Low power mode, updates every 60 seconds

## Notes

- Real-time tracking consumes ~5-10% battery per hour
- Foreground service prevents the OS from killing the tracking
- Location accuracy depends on device GPS quality and environment
- Indoor tracking uses WiFi/cell towers (less accurate)
