# Background Activity Monitoring Test Guide

## ✅ System Status Check

Your activity monitoring system is **fully configured** for background operation:

### Installed Components:
1. ✅ **Native Android Foreground Service** - [ActivityMonitoringService.java](android/app/src/main/java/com/safenet/app/ActivityMonitoringService.java)
2. ✅ **React Native Bridge** - [ActivityMonitoringModule.java](android/app/src/main/java/com/safenet/app/ActivityMonitoringModule.java)
3. ✅ **Boot Persistence** - [BootCompletedReceiver.java](android/app/src/main/java/com/safenet/app/BootCompletedReceiver.java)
4. ✅ **AndroidManifest.xml** - Properly configured with all permissions

### Permissions Granted:
- ✅ `FOREGROUND_SERVICE`
- ✅ `FOREGROUND_SERVICE_HEALTH`
- ✅ `RECEIVE_BOOT_COMPLETED`
- ✅ `WAKE_LOCK`
- ✅ `VIBRATE`
- ✅ `POST_NOTIFICATIONS`

---

## 🧪 Test Procedures

### Test 1: Verify Service is Running

**Steps:**
1. Open the SafeNet app
2. Start activity monitoring
3. Pull down notification shade
4. **Expected:** You should see a persistent notification: "Monitoring your activity"

**If notification is visible:** ✅ Service is running in background

---

### Test 2: App Minimized Test

**Steps:**
1. Start activity monitoring in the app
2. Press the Home button to minimize the app
3. Wait 5 seconds
4. Shake/drop your phone sharply (simulate 4.0G impact)
5. Hold phone still for 1-2 seconds

**Expected Results:**
- ✅ System notification appears: "Fall Detected"
- ✅ Vibration alert triggers
- ✅ Works WITHOUT opening the app

**Check Logs (optional):**
```bash
adb logcat -s ActivityMonitoring:* *:E
```

---

### Test 3: Phone Locked Test

**Steps:**
1. Start activity monitoring
2. Lock your phone (power button)
3. Wait 10 seconds
4. Shake phone vigorously while locked
5. Stop moving immediately

**Expected Results:**
- ✅ Phone vibrates
- ✅ Notification appears on lock screen
- ✅ Detection works while screen is off

---

### Test 4: App Force Closed Test

**Steps:**
1. Start activity monitoring
2. Open Android Settings → Apps → SafeNet
3. Tap "Force Stop"
4. **Check notification shade**

**Expected Results:**
- ✅ "Monitoring your activity" notification STILL VISIBLE
- ✅ Service continues running independently
- ✅ Can still detect falls even after force stop

**To verify:**
```bash
adb shell dumpsys activity services | grep ActivityMonitoring
```
Should show the service as active.

---

### Test 5: Device Reboot Test

**Steps:**
1. Start activity monitoring
2. Reboot your phone
3. After boot completes, check notification shade

**Expected Results:**
- ✅ Service automatically restarts
- ✅ Notification reappears without opening app
- ✅ Fall detection works immediately

---

### Test 6: Real-time Monitoring (App Open)

**Steps:**
1. Open the app with activity monitoring ON
2. Watch the activity status on screen
3. Walk around, run, then stop suddenly

**Expected Results:**
- ✅ Shows "Walking 🚶" when moving
- ✅ Shows "Running 🏃‍♂️" when running
- ✅ Shows "Standing Still 🧍" when stopped
- ✅ Updates in real-time

---

## 🐛 Troubleshooting

### Issue: No notification appears
**Solution:**
1. Check notification permissions:
   ```bash
   adb shell cmd notification allowed_listeners
   ```
2. Manually grant notification permission in Android Settings

### Issue: Service stops when app is closed
**Solution:**
1. Disable battery optimization:
   - Settings → Battery → Battery Optimization
   - Find SafeNet → Select "Don't optimize"

2. Check if service type is correct:
   ```bash
   adb shell dumpsys activity services com.safenet.app
   ```
   Should show `foregroundServiceType: health`

### Issue: Falls not detected in background
**Solution:**
1. Verify accelerometer is working:
   ```bash
   adb logcat -s ActivityMonitoring:D
   ```
   Should show sensor readings

2. Check threshold settings in [ActivityMonitoringService.java](android/app/src/main/java/com/safenet/app/ActivityMonitoringService.java):
   - `FALL_IMPACT_THRESHOLD = 4.0f` (needs strong shake)
   - Lower to `2.5f` for easier testing

---

## 📊 Live Monitoring Commands

### View real-time logs:
```bash
adb logcat -s ActivityMonitoring:* -v time
```

### Check service status:
```bash
adb shell dumpsys activity services | grep -A 10 ActivityMonitoring
```

### Monitor battery impact:
```bash
adb shell dumpsys batterystats --charged com.safenet.app
```

### View all notifications:
```bash
adb shell dumpsys notification
```

---

## 🎯 Success Criteria

Your background activity monitoring is working correctly if:

- ✅ Service runs when app is minimized
- ✅ Service runs when app is force-closed
- ✅ Service runs when phone is locked
- ✅ Service auto-starts after reboot
- ✅ Notifications appear without opening app
- ✅ Fall detection triggers correctly
- ✅ Persistent notification always visible

---

## 🔧 Quick Test Script

Run this to start monitoring and test immediately:

```bash
# 1. Start app and monitoring
adb shell am start -n com.safenet.app/.MainActivity

# 2. Wait for app to load (5 seconds)
sleep 5

# 3. Minimize app
adb shell input keyevent KEYCODE_HOME

# 4. Check if service is running
adb shell dumpsys activity services | grep ActivityMonitoring

# 5. View live sensor data
adb logcat -s ActivityMonitoring:D
```

---

## 📱 Expected Behavior Summary

| Scenario | Fall Detection | Real-time Updates | Notifications |
|----------|----------------|-------------------|---------------|
| App Open | ✅ | ✅ | ✅ |
| App Minimized | ✅ | ❌ | ✅ |
| Phone Locked | ✅ | ❌ | ✅ |
| App Force Closed | ✅ | ❌ | ✅ |
| After Reboot | ✅ | ❌ | ✅ |

**Note:** Real-time UI updates only work when app is visible. Background service always works.

---

## 💡 Additional Notes

### Battery Optimization
The service is designed to be battery efficient:
- Uses `SENSOR_DELAY_GAME` (~20ms updates)
- Only processes significant motion changes
- Foreground service prevents Android from killing it

### Data Storage
Fall events are logged to:
- Android system logs (accessible via adb logcat)
- Local notifications
- Can be extended to save to AsyncStorage or backend

### Customization
To adjust sensitivity, edit [ActivityMonitoringService.java](android/app/src/main/java/com/safenet/app/ActivityMonitoringService.java):
```java
FALL_IMPACT_THRESHOLD = 4.0f;  // Lower = more sensitive
FALL_COOLDOWN = 10000;         // Time between detections (ms)
```

---

## ✅ Test Checklist

- [ ] Persistent notification appears when monitoring starts
- [ ] Service continues when app minimized (Home button)
- [ ] Service continues when phone locked (Power button)
- [ ] Service continues when app force-stopped
- [ ] Service restarts automatically after device reboot
- [ ] Fall detection triggers without opening app
- [ ] System notification appears on fall detection
- [ ] Real-time activity updates work when app is open
- [ ] No crashes or errors in logs

**All checked?** Your background activity monitoring is fully operational! 🎉
