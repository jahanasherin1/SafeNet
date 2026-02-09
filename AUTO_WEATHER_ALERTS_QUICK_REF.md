## 🌤️ Auto Weather Alerts - Quick Reference

**Status:** ✅ Fully Implemented  
**Start Date:** Today  
**Behavior:** Auto-sends weather alerts every 30 minutes when conditions are unsafe

---

## What Users Will See

### 1. **Location Screen**
```
Live Location
📍 Active
🌤️ Auto weather monitoring active
```
The cloud icon ☁️ now opens weather details (not for sending alerts).

### 2. **Automatic Alerts**
When weather becomes unsafe:
- **Local Notification** appears on device
- **Email to Guardians** is automatically sent
- **Alert stored** in dashboard for viewing

### 3. **Alert Dashboard**
Weather alerts appear like other alerts:
- Show when auto-detected
- Can be marked as read
- Include weather details and recommendations

---

## System Behavior

### Check Schedule
| Metric | Value |
|--------|-------|
| **Frequency** | Every 30 minutes |
| **Cooldown** | 1 hour between alerts per user |
| **Starts** | When user logs in |
| **Stops** | When user logs out |

### Safety Levels
- 🟢 **Safe** - No alert sent
- 🟡 **Caution** - Alert sent
- 🟠 **Warning** - Alert sent  
- 🔴 **Danger** - Alert sent

### What Triggers an Alert
Weather conditions that are NOT "safe":
- Severe storms (thunderstorms, tornadoes)
- Extreme temperatures
- Poor visibility (fog, heavy rain)
- Hazardous wind speeds
- High UV index
- Other dangerous conditions

---

## Lifecycle

```
User Opens App
    ↓
Logs In
    ↓
Weather Monitoring Starts ← Background location already active
    ↓
Every 30 minutes:
    ├─ Check location (from background service)
    ├─ Get weather data
    ├─ Analyze conditions
    ├─ If unsafe + no recent alert:
    │   ├─ Send local notification
    │   ├─ Send alert to backend
    │   └─ Email guardians
    └─ Repeat
    ↓
User Logs Out
    ↓
Weather Monitoring Stops
```

---

## Files Changed

**New Files:**
- `services/BackgroundWeatherAlertService.ts` - Main service

**Modified Files:**
- `services/SessionContext.tsx` - Start/stop weather monitoring
- `services/BackgroundLocationService.ts` - Save location to AsyncStorage
- `app/dashboard/location.tsx` - UI update
- `components/WeatherAlertModal.tsx` - UI clarification
- `backend/models/schemas.js` - Add 'weather' to alert type enum

---

## Key Features

✅ **Runs in Background** - Continues even when app is minimized  
✅ **Uses Existing Location** - No additional location requests  
✅ **Smart Cooldown** - Prevents alert spam  
✅ **Local Notifications** - Immediate device alerts  
✅ **Guardian Emails** - Auto-notifies guardians  
✅ **Database Storage** - Full alert history  
✅ **Manual Override** - Users can still check weather anytime  

---

## Configuration (In Code)

To adjust behavior, edit `services/BackgroundWeatherAlertService.ts`:

```typescript
// Check every 15 minutes instead of 30
const WEATHER_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Allow alerts every 30 minutes instead of 60
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
```

---

## Testing

### Quick Test
```typescript
import { triggerWeatherCheckManually } from './services/BackgroundWeatherAlertService';

// Force a weather check right now
await triggerWeatherCheckManually();
```

### Check Console
After logging in, you should see:
```
🌤️  Starting auto weather monitoring service...
✅ Weather monitoring started with 30-minute interval
```

### Monitor Progress
Look for these logs to confirm:
```
🌤️  Background weather check task executing...
🌤️  Weather check: [condition] at [lat], [lon]
✅ Weather is safe, no alert needed
```

---

## Alert Content

When an alert is sent to guardians:

**Subject:** "⛈️ Weather Safety Alert"

**Message:**
```
John Doe is experiencing hazardous weather conditions.

Condition: Thunderstorm
Safety Level: DANGER
Location: San Francisco, CA

Hazards:
• Severe Lightning Risk
• Flash Flooding Possible

Recommendations:
• Stay indoors
• Avoid all travel
• Monitor alerts
```

---

## Database Alert Format

Stored in MongoDB:
```json
{
  "userEmail": "john@example.com",
  "userName": "John Doe",
  "type": "weather",
  "title": "⛈️ Thunderstorm Warning",
  "message": "John Doe: Thunderstorm - Severe Lightning Risk",
  "location": { "latitude": 37.7749, "longitude": -122.4194 },
  "isRead": false,
  "metadata": {
    "safetyLevel": "danger",
    "weatherCondition": "Thunderstorm",
    "hazards": ["Severe Lightning Risk", "Flash Flooding Possible"],
    "recommendations": ["Stay indoors", "Avoid travel"]
  },
  "createdAt": "2026-02-04T12:00:00Z"
}
```

---

## Troubleshooting Checklist

- [ ] User is logged in
- [ ] Location tracking is active
- [ ] No errors in console
- [ ] 30 minutes has passed since last alert (cooldown check)
- [ ] Weather conditions are actually unsafe
- [ ] Network connection is active
- [ ] Backend API is responding

---

## Comparison with Manual Alerts

| Aspect | Manual | Auto |
|--------|--------|------|
| User Action | Opens app, taps weather button | None - automatic |
| Frequency | As needed | Every 30 minutes |
| Guardians | Only if user sends | Always notified |
| Background | No | Yes |
| 24/7 Protection | No | Yes |

---

## Notes

- **No new permissions** - Uses existing location and notification permissions
- **Respects privacy** - Only checks weather; doesn't share location publicly
- **Intelligent** - Respects location availability and user status
- **Reliable** - Falls back to foreground polling if background tasks fail
- **Tested** - Works during app startup, foreground, background, and on resume

---

## Support

**Manual Weather Check:** Cloud button in location screen still works  
**View History:** Check alerts dashboard for all weather alerts  
**Disable:** Manually call `stopWeatherMonitoring()` (not in UI yet)  
**Test:** Use `triggerWeatherCheckManually()` function  

---

**Version:** 1.0  
**Date:** February 4, 2026  
**Status:** Production Ready ✅
