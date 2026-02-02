# Fall Detection Testing & Verification Guide

## Quick Start

### Prerequisites
- Android device with SafeNet app installed
- Location permission granted
- Notification permission granted (Android 13+)
- Activity monitoring enabled in the app

### Enable Activity Monitoring
1. Open SafeNet app
2. Go to Dashboard → Profile
3. Toggle "Activity Monitoring" ON
4. Confirm it shows as active

---

## Test Scenarios

### Test 1: Foreground Detection
**App State:** Open and visible on screen

**Steps:**
1. Launch app and navigate to Home
2. Ensure activity monitoring is enabled
3. Watch the activity status (should show "Monitoring Activity..." or current state)
4. Simulate a fall by dropping the phone gently on a soft surface (bed, pillow)
5. The impact should be ~4-5G for detection

**Expected Result:**
- ✅ Alert modal appears with "FALL DETECTED" message
- ✅ Countdown timer starts (30 seconds)
- ✅ System notification appears
- ✅ Device vibrates and plays sound
- ✅ Log shows: "🔴 FALL CONFIRMED" and "📱 Notification sent"

**Verification:**
```
Check logs for:
LOG 🔴 FALL CONFIRMED: Impact X.XG followed by stillness
LOG 🚨 Activity Alert Triggered: FALL DETECTED
LOG ✅ Alert notification sent
```

---

### Test 2: Background Detection (App Minimized)
**App State:** Running but minimized to background

**Steps:**
1. Open app and enable activity monitoring
2. Check that activity monitoring shows as active
3. Press HOME button to minimize app (keep it running)
4. Wait 2-3 seconds
5. Simulate a fall by dropping phone on soft surface
6. Check device for notification

**Expected Result:**
- ✅ NO modal appears (app is in background)
- ✅ System notification appears on device screen
- ✅ Notification title: "🚨 FALL DETECTED!"
- ✅ Device vibrates (500ms + 200ms pause + 500ms pattern)
- ✅ Sound plays
- ✅ Notification persists until dismissed
- ✅ Tapping notification opens app with alert

**Verification:**
```
Check device:
1. Notification visible with title "🚨 FALL DETECTED!"
2. Message shows "Impact: X.XG - Notifying guardians..."
3. Can hear alarm sound
4. Can feel vibration pattern

Tap notification:
- App launches
- Alert modal appears
- Shows the fall alert
```

---

### Test 3: Closed App Detection
**App State:** Force closed (not running)

**Steps:**
1. Open app and enable activity monitoring
2. Verify activity monitoring shows as active
3. Go to device Settings → Apps → SafeNet
4. Tap "Force Stop" to completely close the app
5. Verify app is not running (check recents)
6. Wait 2-3 seconds
7. Simulate a fall
8. Check device for notification

**Expected Result:**
- ✅ App doesn't appear in recents
- ✅ System notification still appears
- ✅ Same high-priority notification as background test
- ✅ Device vibrates and plays sound
- ✅ Tapping notification launches app fresh

**Verification:**
```
Before test:
Settings → Apps → SafeNet → Force Stop

After fall:
- Notification appears despite app being closed
- This proves native service is still running
- Receiver is handling broadcasts at system level

After tapping:
- App launches fresh
- Receives fall detection in Intent extras
- Shows alert modal
```

---

### Test 4: Lock Screen Detection
**App State:** Device is locked

**Steps:**
1. Open app and enable activity monitoring
2. Press power button to lock device screen
3. Wait 2-3 seconds
4. Device is now locked with screen off
5. Simulate a fall
6. Device should wake up with notification

**Expected Result:**
- ✅ Screen lights up with notification
- ✅ High-priority notification visible on lock screen
- ✅ Sound plays (respecting volume level)
- ✅ Device vibrates
- ✅ Can be dismissed from lock screen
- ✅ Or tapped to open app

**Verification:**
```
Check lock screen:
- Notification appears immediately
- Title visible: "🚨 FALL DETECTED!"
- Can tap to unlock and open app

Audio check:
- Alarm sound plays (check device volume)
- Should be at system alarm volume level

Swipe to dismiss:
- Notification can be swiped away
- Or tapped to open app
```

---

## Expected Log Output

### Successful Fall Detection
```
⚡ High impact: 5.2G - monitoring for fall...
🔴 FALL CONFIRMED: Impact 5.2G followed by stillness (var: 0.15)
🚨 Activity Alert Triggered: FALL DETECTED
✅ Alert notification sent - waiting for user action
🔔 Notification received (foreground): 🚨 FALL DETECTED
🎬 handleAlertTriggered called with reason: FALL DETECTED
⏱️ Starting countdown for alert: FALL DETECTED
```

### Background Broadcast
```
⚡ High impact: 5.2G - monitoring for fall...
🔴 FALL DETECTED in background! Impact: 5.2G, Stillness: 0.8G
✅ Fall detected broadcast sent (local + system)
FallDetectionReceiver: 🔴 FALL DETECTED (from native service)! Magnitude: 5.2
✅ Fall detection notification sent
```

---

## Troubleshooting

### Notification Not Appearing

**Check 1: Notification Permissions**
```
Settings → Apps → SafeNet → Permissions → Notifications
Should be: ALLOWED
```

**Check 2: Device Settings**
```
Settings → Notifications → SafeNet
- Importance: Should be HIGH or CRITICAL
- Alerts: Should allow pop-ups or sound
```

**Check 3: Do Not Disturb**
```
Is device in Do Not Disturb/Silent mode?
Try toggling DND off and test again
```

**Check 4: Activity Monitoring**
```
In app: Should show "Activity Monitoring: ON"
Check console: Should see activity events
```

### Sound Not Playing

**Check:**
```
1. Device volume: Check physical volume button
2. Ringer mode: Ensure device is not silent
3. Do Not Disturb: Disable if active
4. App notification sound: Settings → Apps → SafeNet → Sound
```

### Vibration Not Working

**Check:**
```
1. Device vibration: Settings → Sound & vibration → Vibration ON
2. App vibration: Settings → Apps → SafeNet → Vibration allowed
3. Haptics: Some devices have separate haptics setting
```

### App Not Launching from Notification

**Check:**
```
1. Confirm app is installed: adb shell pm list packages | grep safenet
2. Check notification has intent: Review FallDetectionReceiver code
3. Try restarting app completely
4. Rebuild and reinstall app
```

---

## Performance Verification

### Expected Response Times

| Stage | Time | Description |
|-------|------|-------------|
| Impact | 0ms | User falls |
| Detection | ~100ms | Sensor triggers |
| Broadcast | ~100ms | Intent sent |
| Notification | ~200ms | Receiver gets it |
| Display | ~500ms | User sees it |
| **TOTAL** | **~500ms** | User alerted |

Test by dropping phone with timer app visible before impact.

---

## Backend Verification

After fall detection, verify:

1. **Guardian Receives Notification**
   - Check guardian's device
   - Should receive push notification
   - Should show location of the user

2. **Check Backend Logs**
   ```
   POST /sos/alert
   {
     "userEmail": "user@example.com",
     "alertType": "FALL_DETECTED",
     "severity": "high",
     "timestamp": "2026-01-29T14:03:20Z"
   }
   ```

3. **Check Dashboard**
   - Guardian dashboard should show alert
   - Location should be visible
   - Alert should appear in alerts list

---

## Automated Testing (if needed)

### ADB Commands

**Simulate wake lock:**
```bash
adb shell dumpsys power | grep "Wake Locks"
```

**Check notification channel:**
```bash
adb shell dumpsys notification | grep -A 5 "fall_detection"
```

**Check service status:**
```bash
adb shell dumpsys activity services | grep ActivityMonitoring
```

**Check registered receivers:**
```bash
adb shell dumpsys package receivers | grep FallDetection
```

---

## Test Report Template

Use this template to document your testing:

```
═════════════════════════════════════════════════════
FALL DETECTION TEST REPORT
═════════════════════════════════════════════════════

Date: [Date]
Device: [Model, Android Version]
App Version: [Version]

TEST 1: FOREGROUND DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: [ ] PASS [ ] FAIL
Alert Modal: [ ] YES [ ] NO
Notification: [ ] YES [ ] NO
Sound: [ ] YES [ ] NO
Vibration: [ ] YES [ ] NO
Guardian Alert: [ ] YES [ ] NO
Notes: ___________________________________

TEST 2: BACKGROUND DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: [ ] PASS [ ] FAIL
App Still Running: [ ] YES [ ] NO
Notification: [ ] YES [ ] NO
Sound: [ ] YES [ ] NO
Vibration: [ ] YES [ ] NO
Opens App on Tap: [ ] YES [ ] NO
Guardian Alert: [ ] YES [ ] NO
Notes: ___________________________________

TEST 3: CLOSED APP DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: [ ] PASS [ ] FAIL
App Truly Closed: [ ] YES [ ] NO
Notification: [ ] YES [ ] NO
Sound: [ ] YES [ ] NO
Vibration: [ ] YES [ ] NO
Launches App: [ ] YES [ ] NO
Guardian Alert: [ ] YES [ ] NO
Notes: ___________________________________

TEST 4: LOCK SCREEN DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: [ ] PASS [ ] FAIL
Screen Wakes: [ ] YES [ ] NO
Notification Visible: [ ] YES [ ] NO
Sound Plays: [ ] YES [ ] NO
Vibration: [ ] YES [ ] NO
Can Tap to Open: [ ] YES [ ] NO
Notes: ___________________________________

OVERALL RESULT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[X] ALL TESTS PASSED ✅
[ ] SOME ISSUES FOUND
[ ] MAJOR ISSUES

Issues Found:
1. ________________________________
2. ________________________________
3. ________________________________

Tester: ____________________
Signature: __________________
```

---

## Next Steps

After successful testing:

1. **Build & Deploy**
   ```bash
   npm run android
   ```

2. **Real Device Testing**
   - Test with actual guardian accounts
   - Verify backend receives alerts
   - Check guardian notifications

3. **Production Deployment**
   - Monitor app logs for issues
   - Verify with test users
   - Deploy to production when ready

---

## Support

If you encounter issues:
1. Check logs: `adb logcat | grep -i fall`
2. Review manifest registration
3. Verify permissions are granted
4. Restart device if needed
5. Rebuild app if issues persist
