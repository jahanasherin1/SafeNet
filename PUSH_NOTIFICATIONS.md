# Push Notifications for Fall/Sudden Stop Alerts

## Implementation Complete ✅

This document explains how push notifications work when fall or sudden stop events occur.

## Architecture Overview

```
User Device
    ↓
ActivityMonitoringService detects fall/sudden stop
    ↓
GlobalAlertModal triggered (30-second countdown)
    ↓
Backend /api/sos/trigger endpoint
    ↓
Send email + Push Notification to Guardians
    ↓
Guardians receive notification (even app closed)
```

## Frontend Implementation

### 1. **PushNotificationService.ts** (New)
- `registerForPushNotifications()`: Registers device with Expo and gets push token
- `savePushTokenToBackend()`: Saves token to backend for alert delivery
- `setupPushNotificationListeners()`: Listens for notifications in foreground/background

### 2. **SessionContext.tsx** (Updated)
- Registers for push notifications on app startup
- Saves push token to backend
- Sets up notification listeners when user is logged in

### 3. How It Works:
```
1. User logs in → SessionContext initializes
2. registerForPushNotifications() requests permissions
3. Gets Expo push token (ExponentPushToken[...])
4. Sends token to backend via /users/save-push-token
5. Token stored in user.pushToken field
6. Ready to receive notifications!
```

## Backend Implementation

### 1. **User Schema** (Updated)
```javascript
pushToken: { type: String, default: '' }
```

### 2. **users.js** - New Route (Updated)
```
POST /api/users/save-push-token
Body: { userEmail, pushToken }
Saves push token to user document
```

### 3. **pushNotifications.js** (New Utility)
```javascript
sendPushNotification(token, title, message, data)
sendBulkPushNotifications(tokens, title, message, data)
```
- Sends notifications via Expo Push API
- Handles multiple devices
- Includes custom data (location, alert type, etc.)

### 4. **sos.js** (Updated)
When fall/sudden stop alert triggered:
```
1. Send email to guardians
2. Get each guardian's push token from database
3. Send push notification with:
   - Alert title: "🆘 URGENT: User may have fallen!"
   - Alert body: Detailed message
   - Data: Location, maps link, alert type
4. Create alert record for dashboard
```

## Notification Flow for Fall Alert

```
1. Device detects fall (acceleration >4.0G + stillness)
2. ActivityMonitoringService triggers callback
3. GlobalAlertModal shows 30-second countdown
4. After 30 seconds (or user doesn't cancel):
   - API call to /api/sos/trigger
   
5. Backend receives alert:
   ✅ Email sent to guardians
   ✅ Push notification sent to guardian devices
   ✅ Alert record created in database
   
6. Guardians receive notification:
   - On their device (even if app closed)
   - Can tap to open app and view location
   - Maps link available in email
```

## Testing Push Notifications

### 1. Register Push Token
```bash
# Automatically happens on login
# Check logs for: "Expo Push Token: ExponentPushToken[...]"
```

### 2. Verify Token Saved
```bash
# Check MongoDB user document
db.users.findOne({ email: "user@example.com" }, { pushToken: 1 })
# Should show: pushToken: "ExponentPushToken[...]"
```

### 3. Test Notification
```bash
# Trigger fall detection
# Wait 30 seconds in GlobalAlertModal
# Check device notification area
```

### 4. Monitor Backend Logs
```
📤 Sending push notification to: ExponentPushToken[...]
✅ Push notification sent successfully
```

## Notification Content Examples

### Fall Detection
- **Title**: 🆘 URGENT: User may have fallen!
- **Body**: Fall was detected by sensors
- **Data**: Location, time, maps link

### Sudden Stop
- **Title**: ⚠️ Alert: User stopped suddenly while running
- **Body**: User stopped during running activity
- **Data**: Location, time, maps link

### Prolonged Running
- **Title**: 🏃 Alert: User has been running for extended period
- **Body**: Extended running activity detected
- **Data**: Location, time, maps link

## Key Files

| File | Purpose |
|------|---------|
| `services/PushNotificationService.ts` | Push notification registration & handling |
| `services/SessionContext.tsx` | Initializes push notifications on login |
| `backend/utils/pushNotifications.js` | Sends push notifications via Expo API |
| `backend/routes/users.js` | Saves push token to database |
| `backend/routes/sos.js` | Sends notifications when alert triggered |
| `backend/models/schemas.js` | User schema with pushToken field |

## Security Notes

- Push tokens are device-specific (change if app reinstalled)
- Tokens sent only after user authentication
- Expo API validates tokens before sending
- Notifications include location data (shared only with guardians)

## Troubleshooting

### Push notifications not received?
1. ✅ Check permissions granted in app
2. ✅ Verify token in MongoDB: `db.users.findOne(...).pushToken`
3. ✅ Check backend logs for "Push notification sent"
4. ✅ Ensure app has notification permissions

### Token not saving?
1. Check network connectivity
2. Verify backend is running
3. Check `/users/save-push-token` endpoint logs
4. Ensure user email is correct

### Notifications showing after delay?
- Expo push service may queue notifications
- Check internet connection on guardian's device
- Ensure device is not in deep sleep

## Production Setup

To use in production, you need:
1. Create Expo account: https://expo.dev
2. Update project ID in PushNotificationService.ts
3. Configure push notification credentials
4. Set up notification channels for Android

For full setup: https://docs.expo.dev/push-notifications/setup/
