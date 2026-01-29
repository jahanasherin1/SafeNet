import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

/**
 * Diagnostic service to check background location tracking status
 */

export const checkBackgroundLocationStatus = async () => {
  console.log('\n📊 === BACKGROUND LOCATION DIAGNOSTICS ===\n');

  try {
    // 1. Check platform
    console.log(`📱 Platform: ${Platform.OS} (${Platform.Version})`);

    // 2. Check permissions
    console.log('\n🔐 Permission Status:');
    try {
      const fgPerms = await Location.getForegroundPermissionsAsync();
      console.log(`  ├─ Foreground: ${fgPerms.granted ? '✅ GRANTED' : '❌ DENIED'} (${fgPerms.status})`);
    } catch (e) {
      console.log('  ├─ Foreground: ⚠️ Could not check');
    }

    try {
      const bgPerms = await Location.getBackgroundPermissionsAsync();
      console.log(`  └─ Background: ${bgPerms.granted ? '✅ GRANTED' : '❌ DENIED'} (${bgPerms.status})`);
      if (!bgPerms.granted) {
        console.log('     → User must select "Allow all the time" for background tracking to work');
      }
    } catch (e) {
      console.log('  └─ Background: ⚠️ Could not check');
    }

    // 3. Check task registration
    console.log('\n📋 Task Status:');
    const LOCATION_TASK_NAME = 'SAFENET_BACKGROUND_LOCATION';
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    console.log(`  ├─ Task defined: ${isTaskDefined ? '✅ YES' : '❌ NO'}`);

    // 4. Check if tracking is running
    console.log('\n🔄 Tracking Status:');
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log(`  ├─ Location updates running: ${isTracking ? '✅ YES' : '❌ NO'}`);
    } catch (e) {
      console.log(`  ├─ Location updates running: ⚠️ Could not check - ${e}`);
    }

    // 5. Check stored preferences
    console.log('\n💾 Stored Preferences:');
    try {
      const trackingEnabled = await AsyncStorage.getItem('TRACKING_ENABLED_KEY');
      console.log(`  ├─ Tracking enabled: ${trackingEnabled ? '✅ YES' : '❌ NO'}`);
    } catch (e) {
      console.log('  ├─ Tracking enabled: ⚠️ Could not check');
    }

    // 6. Check queue status
    console.log('\n📤 Queue Status:');
    try {
      const queue = await AsyncStorage.getItem('LOCATION_SYNC_QUEUE');
      const count = queue ? JSON.parse(queue).length : 0;
      console.log(`  └─ Queued locations: ${count} items`);
    } catch (e) {
      console.log('  └─ Queued locations: ⚠️ Could not check');
    }

    // 7. Check last location
    console.log('\n📍 Last Location:');
    try {
      const lastLocation = await Location.getLastKnownPositionAsync();
      if (lastLocation) {
        console.log(`  ├─ Latitude: ${lastLocation.coords.latitude.toFixed(6)}`);
        console.log(`  ├─ Longitude: ${lastLocation.coords.longitude.toFixed(6)}`);
        console.log(`  ├─ Accuracy: ${lastLocation.coords.accuracy?.toFixed(1)}m`);
        console.log(`  └─ Timestamp: ${new Date(lastLocation.timestamp).toLocaleString()}`);
      } else {
        console.log('  └─ No location available');
      }
    } catch (e) {
      console.log('  └─ Could not fetch last location');
    }

    console.log('\n📊 === END DIAGNOSTICS ===\n');
  } catch (error) {
    console.error('Diagnostics error:', error);
  }
};

/**
 * Check if system can support background location tracking
 */
export const canBackgroundTrack = async (): Promise<boolean> => {
  try {
    const bgPerms = await Location.getBackgroundPermissionsAsync();
    return bgPerms.granted;
  } catch {
    return false;
  }
};

/**
 * Get human-readable status
 */
export const getTrackingStatusMessage = async (): Promise<string> => {
  try {
    const bgPerms = await Location.getBackgroundPermissionsAsync();
    const LOCATION_TASK_NAME = 'SAFENET_BACKGROUND_LOCATION';
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (!bgPerms.granted) {
      return '❌ Background permission not granted. Tap to request "Allow all the time" permission.';
    }

    if (isTracking) {
      return '✅ Background location tracking is ACTIVE. App can be minimized.';
    }

    return '⚠️ Tracking not active. Tap to start background location tracking.';
  } catch (error) {
    return '⚠️ Unable to determine tracking status';
  }
};
