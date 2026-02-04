# ✅ Background Activity Monitoring - Quick Test Checklist

## Pre-Test Setup
- [ ] Android device connected via USB
- [ ] SafeNet app installed and running
- [ ] Activity monitoring enabled in the app (Activity Guard screen)

---

## Test 1: Service Running ✓
**Goal:** Verify the native service is active

**Steps:**
1. Open SafeNet app
2. Go to "Activity Guard" screen
3. Enable monitoring if not already on
4. Pull down notification shade

**✅ PASS if you see:** 
- Persistent notification: "Monitoring your activity"
- Notification cannot be dismissed by swiping

**❌ FAIL if:**
- No notification appears
- App crashes when enabling monitoring

---

## Test 2: App Minimized ✓
**Goal:** Verify monitoring continues when app is in background

**Steps:**
1. With monitoring enabled, press HOME button
2. Wait 5-10 seconds
3. Shake phone sharply 3-4 times
4. Hold phone completely still for 2 seconds

**✅ PASS if:**
- System notification appears: "Fall Detected!"
- Phone vibrates
- No need to open the app

**❌ FAIL if:**
- Nothing happens
- Only works when you open the app again

---

## Test 3: Phone Locked ✓
**Goal:** Verify monitoring works with screen off

**Steps:**
1. With monitoring enabled, press POWER button to lock phone
2. Wait 10 seconds
3. Shake locked phone vigorously
4. Hold completely still for 2 seconds

**✅ PASS if:**
- Notification appears on lock screen
- Phone vibrates while locked
- Detection works without unlocking

**❌ FAIL if:**
- Must unlock phone for detection to work
- No notification appears

---

## Test 4: App Force Closed ✓
**Goal:** Verify service runs independently of app

**Steps:**
1. With monitoring enabled, go to Android Settings
2. Apps → SafeNet → Force Stop
3. Check notification shade (don't open app)

**✅ PASS if:**
- "Monitoring your activity" notification STILL visible
- Can still shake phone and get fall detection
- Service continues without app running

**❌ FAIL if:**
- Notification disappears after force stop
- Fall detection stops working

---

## Test 5: Device Reboot ✓
**Goal:** Verify service auto-restarts after reboot

**Steps:**
1. With monitoring enabled, reboot device
2. After boot completes, wait 30 seconds
3. Check notification shade WITHOUT opening app

**✅ PASS if:**
- "Monitoring your activity" notification automatically appears
- Fall detection works immediately after boot
- No need to open app

**❌ FAIL if:**
- Must open app to restart monitoring
- Service doesn't auto-start

---

## Test 6: Real-time Updates ✓
**Goal:** Verify UI updates when app is open

**Steps:**
1. Open SafeNet app
2. Go to Activity Guard screen
3. Walk around slowly
4. Run in place
5. Stop suddenly

**✅ PASS if:**
- Status changes: "Walking 🚶" → "Running 🏃‍♂️" → "Standing Still 🧍"
- Step count increases
- Updates appear in real-time

**❌ FAIL if:**
- Status stuck on one activity
- No updates when moving

---

## Test 7: Battery Optimization ✓
**Goal:** Ensure Android doesn't kill the service

**Steps:**
1. Go to Android Settings
2. Battery → Battery Optimization
3. Find "SafeNet" app

**✅ PASS if:**
- SafeNet is set to "Don't optimize" or "Not optimized"

**⚠️ ACTION REQUIRED if:**
- SafeNet is "Optimized" → Tap and select "Don't optimize"
- This prevents Android from killing the service

---

## Test 8: Long Duration Test ✓
**Goal:** Verify service runs for extended periods

**Steps:**
1. Enable monitoring
2. Minimize app
3. Use phone normally for 30 minutes
4. Check if notification is still visible

**✅ PASS if:**
- Notification still present after 30+ minutes
- Can still trigger fall detection
- No performance issues

**❌ FAIL if:**
- Notification disappears over time
- Service stops after a while

---

## Quick Diagnostic Commands

### Check if service is running:
```bash
adb shell dumpsys activity services | grep ActivityMonitoring
```

### View live logs:
```bash
adb logcat -s ActivityMonitoring:* -v time
```

### Check notification:
```bash
adb shell dumpsys notification | grep -i safenet
```

### Test fall detection manually:
```bash
# This command shakes the phone (requires root)
adb shell "am broadcast -a android.intent.action.SENSOR_EVENT"
```

---

## Troubleshooting Guide

### Issue: No notification appears
**Fix:**
1. Check app has notification permission
2. Rebuild app: `expo run:android --clean`
3. Check logs: `adb logcat -s ActivityMonitoring:*`

### Issue: Service stops when app closed
**Fix:**
1. Disable battery optimization (see Test 7)
2. Check if native module loaded: `adb logcat | grep "ActivityMonitoring: Service created"`
3. Verify AndroidManifest.xml has service declared

### Issue: Falls not detected
**Fix:**
1. Shake phone HARD (needs > 4.0G impact)
2. Hold completely still after shaking
3. Lower threshold for testing (edit ActivityMonitoringService.java)

### Issue: Works open but not closed
**Fix:**
1. Native service not starting - check logs
2. Rebuild with clean: `expo run:android --clean`
3. Verify native module registered in MainApplication.kt

---

## Success Criteria Summary

**Your background activity monitoring is working correctly if:**

✅ Persistent notification always visible  
✅ Works when app minimized  
✅ Works when phone locked  
✅ Works when app force-closed  
✅ Auto-starts after device reboot  
✅ Fall detection triggers without opening app  
✅ System notifications appear immediately  
✅ No crashes or errors  

**If all tests pass: Your system is fully operational! 🎉**

---

## Running the Automated Test

We've created a PowerShell script for quick testing:

```powershell
cd C:\Users\ADMIN\Documents\SafeNet
.\test-background-monitoring.ps1
```

This will:
- Check if service is running
- Minimize the app
- Start log monitoring
- Show real-time sensor data

---

## Next Steps After Testing

1. **If all tests pass:** Your app is ready for use!
2. **If some tests fail:** Check the troubleshooting guide above
3. **For custom thresholds:** Edit `ActivityMonitoringService.java`
4. **For extended features:** See implementation documentation

---

**Need help?** Check these files:
- [TEST_BACKGROUND_ACTIVITY_MONITORING.md](TEST_BACKGROUND_ACTIVITY_MONITORING.md) - Detailed test guide
- [ACTIVITY_MONITORING_COMPLETE_SUMMARY.md](ACTIVITY_MONITORING_COMPLETE_SUMMARY.md) - Implementation overview
- [ACTIVITY_MONITORING_IMPLEMENTATION.md](ACTIVITY_MONITORING_IMPLEMENTATION.md) - Full technical details
