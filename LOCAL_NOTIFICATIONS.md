# Alert & Notification System Update

## Overview

SafeNet now uses **local system notifications** instead of push notifications. This means:

- ✅ Alerts appear **outside the app** (system-level notifications)
- ✅ Alerts work even when the **app is minimized or closed**
- ✅ **No Firebase/FCM setup required**
- ✅ **No internet required** for local notifications
- ✅ Alerts show on device lock screen and notification panel

## How It Works

### 1. Fall Detection Alert
When a fall is detected:
1. **System notification appears** with title "🚨 FALL DETECTED"
2. Device vibrates with emergency pattern (high intensity)
3. Alert sounds with system notification sound
4. Badge appears on app icon
5. Guardian gets in-app alert (if app is active)
6. Alert sent to backend to notify guardians

### 2. Sudden Stop Alert
When sudden stop is detected:
1. **System notification appears** with title "⚠️ SUDDEN STOP DETECTED"
2. Device vibrates with alert pattern
3. Alert sounds
4. Guardian gets alert through backend

### 3. Notification Channels (Android)

Three notification channels are created:

| Channel | Priority | Behavior | Use Case |
|---------|----------|----------|----------|
| Emergency | MAX | High vibration, bypass DND | Fall detected |
| Activity | HIGH | Medium vibration | Sudden stop, activities |
| Default | DEFAULT | Normal sound | General notifications |

## Features

### System-Level Alerts
- **Visible on lock screen** - User sees alert even with phone locked
- **Notification panel** - Persistent in notification drawer
- **Status bar** - Quick notification indicator
- **Badge on app icon** - Shows unread alerts

### Smart Notification Behavior
- **Immediate delivery** - No delay for emergency alerts
- **Sound + Vibration** - Multiple alerts to get user attention
- **Persistent** - Stays until user dismisses
- **Tap to open app** - Opens relevant screen when tapped

### Customizable Alerts
The `LocalNotificationService` allows custom notifications:

```typescript
// Send custom alert
await sendActivityAlertNotification(
  'Custom Alert',
  'This is a custom alert message',
  'high' // 'low' | 'medium' | 'high'
);
```

## Testing

### Test Fall Detection Notification
1. Enable activity monitoring in Profile
2. Simulate fall (device acceleration > 4G followed by stillness)
3. System notification appears: "🚨 FALL DETECTED"
4. Tap notification to open app (if closed)

### Test Sudden Stop Notification
1. Enable activity monitoring
2. Be active (walking/running) then suddenly stop moving
3. After 5+ minutes of no movement, notification appears: "⚠️ SUDDEN STOP DETECTED"
4. Notification appears in system tray

### Manual Notification Test
```typescript
import { sendFallDetectedNotification } from './services/LocalNotificationService';

// In any component
await sendFallDetectedNotification('Test fall notification');
```

## Implementation Details

### New Files
- **`services/LocalNotificationService.ts`** - All notification logic

### Modified Files
- **`services/SessionContext.tsx`** - Removed push notification code
- **`services/ActivityMonitoringService.ts`** - Now sends local notifications
- **`services/PushNotificationService.ts`** - Deprecated (can be removed)

### Removed
- ❌ All Firebase/FCM push notification code
- ❌ `registerForPushNotifications()` function
- ❌ `savePushTokenToBackend()` function
- ❌ Push notification configuration

## API Reference

### Send Fall Detected Notification
```typescript
import { sendFallDetectedNotification } from './services/LocalNotificationService';

await sendFallDetectedNotification('Custom fall message');
```

### Send Sudden Stop Notification
```typescript
import { sendSuddenStopNotification } from './services/LocalNotificationService';

await sendSuddenStopNotification('Custom sudden stop message');
```

### Send Custom Alert
```typescript
import { sendActivityAlertNotification } from './services/LocalNotificationService';

await sendActivityAlertNotification(
  'Title',
  'Body message',
  'high' // severity: 'low' | 'medium' | 'high'
);
```

### Initialize Notifications
```typescript
import { initializeLocalNotifications } from './services/LocalNotificationService';

await initializeLocalNotifications();
```

### Setup Notification Listeners
```typescript
import { setupNotificationListeners } from './services/LocalNotificationService';

const cleanup = setupNotificationListeners();
// Later, cleanup
cleanup();
```

## User Experience

### Before (In-App Only)
1. User locks phone
2. Falls
3. App still running in background
4. In-app modal appears but **not visible** (phone locked)
5. User might not see alert for 30+ seconds

### After (System Notifications)
1. User locks phone
2. Falls
3. **System notification immediately appears on lock screen**
4. **User sees alert immediately** regardless of app state
5. Device vibrates and sounds
6. User can tap to open app or dismiss

## Permissions Required

- **Notification Permission** - Automatically requested on app startup
- **Android Only** - Creates notification channels for different alert types

## No Configuration Needed

Unlike push notifications, local notifications require **zero backend setup**:
- ✅ No Firebase
- ✅ No FCM credentials
- ✅ No API keys
- ✅ No configuration files

Just works out of the box!

## Customization

To customize notification behavior, edit `LocalNotificationService.ts`:

```typescript
// Change vibration pattern
vibrationPattern: [0, 500, 250, 500], // ms: off, vibrate, off, vibrate

// Change notification sound
sound: 'default', // or custom sound file

// Change notification color (Android)
lightColor: '#FF0000',

// Change sound priority
bypassDnd: true, // Bypass Do Not Disturb
```

## Future Enhancements

- [ ] Sound file selection (different sounds for different alerts)
- [ ] Custom vibration patterns per alert type
- [ ] Notification scheduling
- [ ] Smart notifications (suppress duplicates within 1 minute)
- [ ] Notification action buttons (Acknowledge, Emergency)
- [ ] Rich notifications with images
- [ ] Notification history/logging

## Troubleshooting

### Notifications not appearing
**Check:**
1. App has notification permission granted
2. Android notification channel is enabled in system settings
3. Notification sound is not muted on device
4. Device is not in Do Not Disturb mode
5. App is not in foreground (notifications show in notification panel when app is active)

### Silent notifications
**Cause:** Device volume too low or notification channel muted
**Fix:** Check device volume and notification settings for SafeNet app

### Missing vibration
**Cause:** Device vibration disabled
**Fix:** Enable vibration in device settings and notification settings

### Badge not showing
**Cause:** Android manufacturer customization or notification channel settings
**Fix:** Check Android settings for app notification badges
