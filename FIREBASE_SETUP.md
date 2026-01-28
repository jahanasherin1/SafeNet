# Firebase/FCM Setup Guide for SafeNet

## Current Status
✅ **Push notifications are now optional** - The app works with or without Firebase/FCM configured.

When Firebase is not initialized:
- Local notifications still work
- The app logs a warning but continues functioning
- Guardians will NOT receive remote push notifications (they would get local notifications only)

## Setup Firebase for Remote Push Notifications

If you want remote push notifications to work, follow these steps:

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable Cloud Messaging
4. Create Android app in Firebase project

### Step 2: Download google-services.json
1. In Firebase Console, go to Project Settings
2. Click "Android" 
3. Download `google-services.json`
4. Place it in `android/app/` directory

### Step 3: Configure Android Gradle
Edit `android/build.gradle`:
```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

Edit `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
  implementation 'com.google.firebase:firebase-messaging:23.2.1'
}
```

### Step 4: Update app.json
Ensure your app.json has the correct project ID:
```json
{
  "expo": {
    "projectId": "12c6fa68-9e00-4a75-92b9-29dd976db3b9"
  }
}
```

### Step 5: Rebuild Android
```bash
npm run android
```

## Testing Push Notifications

### Local Notifications (No Firebase needed)
```typescript
import * as Notifications from 'expo-notifications';

// Send test notification
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Test Alert',
    body: 'This is a test notification',
    sound: 'default',
  },
  trigger: { seconds: 2 },
});
```

### Remote Notifications (Requires Firebase)
Send from backend:
```javascript
const admin = require('firebase-admin');

await admin.messaging().send({
  notification: {
    title: 'SafeNet Alert',
    body: 'User has detected unusual activity'
  },
  android: {
    priority: 'high',
    ttl: 86400
  },
  token: pushToken
});
```

## If You Don't Want Push Notifications

Leave Firebase unconfigured and the app will:
- ✅ Continue to work
- ✅ Detect activity and send alerts
- ✅ Store alerts locally
- ⚠️ Not send remote push notifications (but local alerts still work)

This is fine for development and testing purposes.

## Troubleshooting

### "FirebaseApp is not initialized"
**Cause**: Google services not properly configured
**Solution**: 
1. Verify `google-services.json` is in `android/app/`
2. Run `npm run android` again
3. Check `android/app/build.gradle` has the plugin applied

### Push token is "expo-local-notifications"
**Cause**: Firebase not available (normal for dev without setup)
**Solution**: Either set up Firebase or continue with local notifications

### Notifications not appearing
**Cause**: Could be various reasons
**Steps**:
1. Check notification permissions granted
2. Verify notification channels created
3. Check app is in background or locked
4. Check device battery saver isn't blocking notifications

## Current Implementation

The SafeNet app currently:
- ✅ Gracefully handles missing Firebase
- ✅ Logs warnings instead of crashing
- ✅ Falls back to local notifications
- ✅ Works in development without full FCM setup

For production, you should properly configure Firebase for remote push notifications.
