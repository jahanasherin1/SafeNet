# Activity Monitoring Architecture - Updated

## Overview
Activity monitoring has been refactored to move detection logic to a background service, with control managed through SessionContext. The Activity Guard screen is now display-only.

---

## Components

### 1. **ActivityMonitoringService** (`services/ActivityMonitoringService.ts`)
- **Purpose**: Handles all activity detection logic (falls, running, sudden stops) independently
- **Key Functions**:
  - `startActivityMonitoring()` - Starts sensor subscriptions and monitoring
  - `stopActivityMonitoring()` - Stops sensors and cleans up
  - `isActivityMonitoringActive()` - Checks current status from AsyncStorage
  - `setActivityUpdateCallback()` - Registers UI update callback
  - `setAlertCallback()` - Registers alert trigger callback

- **How It Works**:
  - Runs independently in background
  - Communicates with UI via callbacks
  - Handles all detection logic (no UI dependencies)
  - Automatically sends alerts to backend when patterns detected

### 2. **SessionContext** (`services/SessionContext.tsx`)
- **Updates**:
  - Added `isActivityMonitoringActive` state
  - Added `toggleActivityMonitoring(enabled: boolean)` function
  - Auto-restarts activity monitoring on app initialization if it was previously enabled
  - Stops activity monitoring on logout

- **Usage**:
  ```tsx
  const { isActivityMonitoringActive, toggleActivityMonitoring } = useSession();
  ```

### 3. **Activity Guard Screen** (`app/dashboard/monitor.tsx`)
- **Changes**:
  - Now display-only (shows monitoring status)
  - No toggle button in this screen
  - Registers callbacks to receive activity updates from service
  - Shows real-time activity status when monitoring is active
  - Displays alerts when patterns are detected

- **Features**:
  - Shows current activity (Running, Walking, Still, etc.)
  - Shows step count
  - Displays alerts when patterns detected
  - No manual start/stop - controlled from dashboard

### 4. **Dashboard Home** (`app/dashboard/home.tsx`)
- **New Toggle Switch**:
  - Added activity monitoring toggle next to location tracking
  - Switch to enable/disable monitoring (persisted in AsyncStorage)
  - Status indicator showing "Active" or "Inactive"
  - View button to navigate to Activity Guard screen

---

## User Flow

### Activating Monitoring
1. User goes to Dashboard Home
2. User toggles "Activity Monitoring" switch to ON
3. SessionContext calls `toggleActivityMonitoring(true)`
4. ActivityMonitoringService starts sensor subscriptions
5. Status saved to AsyncStorage
6. User can view live status in Activity Guard screen

### During Activity Detection
1. Accelerometer/Pedometer detect activity patterns
2. ActivityMonitoringService analyzes motion
3. When pattern is confirmed (fall/running/sudden stop):
   - Service vibrates device
   - Service sends alert to backend
   - Backend notifies all guardians
   - Alert callback triggers UI modal

### Deactivating Monitoring
1. User goes to Dashboard Home
2. User toggles "Activity Monitoring" switch to OFF
3. SessionContext calls `toggleActivityMonitoring(false)`
4. ActivityMonitoringService stops all subscriptions
5. Status updated in AsyncStorage

---

## Persistence

Activity monitoring status is saved in AsyncStorage with key `activityMonitoringEnabled`:
- Set to `'true'` when monitoring starts
- Set to `'false'` when monitoring stops
- Auto-restored on app launch

---

## Detection Triggers

Monitoring continuously watches for:

| Detection | Trigger | Response |
|-----------|---------|----------|
| **Fall** | Impact >4G + stillness <0.3 variance within 2s | Alert guardians + log |
| **Prolonged Running** | High variance >0.8 for 30+ seconds | Alert guardians + log |
| **Sudden Stop** | Variance drops >0.6 from running activity | Alert guardians + log |

---

## Key Architecture Benefits

✅ **Persistent**: Monitoring continues even if app crashes/restarts
✅ **Background**: Detached from UI lifecycle  
✅ **Efficient**: Centralized state management via SessionContext
✅ **User Friendly**: Simple toggle switch (no confusing screen buttons)
✅ **Transparent**: Activity Guard shows real-time status but doesn't control it
✅ **Reliable**: Service continues running independently
