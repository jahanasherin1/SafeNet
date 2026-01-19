import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, NativeModules, Platform } from 'react-native';
import api from './api';

export const LOCATION_TASK_NAME = 'SAFENET_BACKGROUND_LOCATION';
const LOCATION_SYNC_QUEUE = 'LOCATION_SYNC_QUEUE';
const TRACKING_STATE_KEY = 'TRACKING_STATE';
const LAST_LOCATION_TIME = 'LAST_LOCATION_TIME';
const TRACKING_ENABLED_KEY = 'TRACKING_ENABLED';

let appStateSubscription: any = null;

interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: number;
  email: string;
  accuracy?: number;
  altitude?: number;
}

interface SyncQueueItem {
  location: { latitude: number; longitude: number };
  email: string;
  timestamp: number;
  retries: number;
}

// Queue management for offline support
const getLocationQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const queue = await AsyncStorage.getItem(LOCATION_SYNC_QUEUE);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error reading location queue:', error);
    return [];
  }
};

const saveLocationQueue = async (queue: SyncQueueItem[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCATION_SYNC_QUEUE, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving location queue:', error);
  }
};

const addToQueue = async (item: SyncQueueItem): Promise<void> => {
  const queue = await getLocationQueue();
  queue.push(item);
  // Keep only last 100 locations to prevent storage bloat
  if (queue.length > 100) {
    queue.shift();
  }
  await saveLocationQueue(queue);
};

// Process queued locations periodically
export const processLocationQueue = async (): Promise<void> => {
  try {
    const queue = await getLocationQueue();
    if (queue.length === 0) return;

    console.log(`📤 Processing ${queue.length} queued locations...`);

    const processedItems: number[] = [];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.retries > 5) {
        processedItems.push(i);
        continue;
      }

      try {
        await api.post('/user/update-location', {
          latitude: item.location.latitude,
          longitude: item.location.longitude,
          email: item.email,
          timestamp: item.timestamp,
          isBackgroundUpdate: true,
          isQueuedUpdate: true,
        });

        processedItems.push(i);
        console.log(`✅ Synced queued location for ${item.email}`);
      } catch (error) {
        item.retries++;
      }
    }

    // Remove processed items
    const updatedQueue = queue.filter((_, index) => !processedItems.includes(index));
    await saveLocationQueue(updatedQueue);
  } catch (error) {
    console.error('Error processing location queue:', error);
  }
};

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('❌ Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[locations.length - 1];
      console.log('📍 Background location update:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });

      // Send to backend
      try {
        await sendLocationToBackend({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,
          altitude: location.coords.altitude ?? undefined,
        });
      } catch (err) {
        console.warn('⚠️ Failed to send background location to backend, queuing for retry:', err);
        // Queue the location for later sync
        await queueLocationForSync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,
          altitude: location.coords.altitude ?? undefined,
        });
      }
    }
  }
});

// Queue location for later sync if offline
const queueLocationForSync = async (location: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}): Promise<void> => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      console.warn('No user found for queuing location');
      return;
    }

    const user = JSON.parse(userData);
    const item: SyncQueueItem = {
      location,
      email: user.email,
      timestamp: Date.now(),
      retries: 0,
    };

    await addToQueue(item);
    console.log(`📦 Location queued for sync (queue size: ${(await getLocationQueue()).length})`);
  } catch (error) {
    console.error('Error queuing location:', error);
  }
};

// Send location to backend with retry logic
const sendLocationToBackend = async (
  location: { latitude: number; longitude: number; accuracy?: number; altitude?: number },
  email?: string
) => {
  try {
    let userEmail = email;
    if (!userEmail) {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        userEmail = parsed.email;
      }
    }

    if (!userEmail) {
      console.warn('No email available for background location update');
      return;
    }

    const response = await api.post('/user/update-location', {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: location.altitude,
      email: userEmail,
      isBackgroundUpdate: true,
      timestamp: Date.now(),
    });

    console.log('✅ Background location sent to backend');
    
    // Process any queued items after successful sync
    setTimeout(() => processLocationQueue(), 5000);

    return response.data;
  } catch (error) {
    console.error('Error sending background location:', error);
    throw error;
  }
};

// Start background location tracking with aggressive settings
export const startBackgroundLocationTracking = async () => {
  try {
    console.log('🚀 Starting background location tracking...');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('❌ Foreground location permission not granted');
      return false;
    }

    // Request background permissions (requires explicit user consent on Android 11+)
    const bgStatus = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus.status !== 'granted') {
      console.warn('❌ Background location permission not granted');
      return false;
    }

    // On Android 12+, request FOREGROUND_SERVICE permission
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        const androidStatus = await Location.requestForegroundPermissionsAsync();
        if (androidStatus.status !== 'granted') {
          console.warn('⚠️ Android foreground service permission not fully granted');
        }
      } catch (error) {
        console.warn('⚠️ Could not request additional Android permissions:', error);
      }
    }

    // Check if task is already running
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
      console.warn('❌ Location task is not defined');
      return false;
    }

    // Request to ignore battery optimization (Doze mode)
    if (Platform.OS === 'android') {
      try {
        const ignoreBatteryOpt = NativeModules.LocationModule?.requestIgnoreBatteryOptimizations;
        if (ignoreBatteryOpt) {
          await ignoreBatteryOpt();
          console.log('✅ Battery optimization request sent');
        }
      } catch (error) {
        console.warn('⚠️ Could not request battery optimization exception:', error);
      }
    }

    // Start location updates with aggressive settings for reliable tracking
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High, // High accuracy for real-time on Android
      timeInterval: 10000, // Update every 10 seconds for real-time tracking
      distanceInterval: 10, // Or when moved 10 meters
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'SafeNet Location Tracking',
        notificationBody: 'Your location is being shared with your guardians for safety',
        notificationColor: '#6A5ACD',
      },
    });

    // Save tracking state
    await AsyncStorage.setItem(TRACKING_STATE_KEY, 'active');
    await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'true');

    // Setup app state listener to restart tracking if app resumes
    setupAppStateListener();

    // Process any queued locations after starting
    setTimeout(() => processLocationQueue(), 10000);

    console.log('✅ Background location tracking started (aggressive mode)');
    return true;
  } catch (error) {
    console.error('❌ Error starting background location tracking:', error);
    await AsyncStorage.setItem(TRACKING_STATE_KEY, 'failed');
    return false;
  }
};

// Stop background location tracking
export const stopBackgroundLocationTracking = async () => {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await AsyncStorage.setItem(TRACKING_STATE_KEY, 'inactive');
      console.log('✅ Background location tracking stopped');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error stopping background location tracking:', error);
    return false;
  }
};

// Check if background tracking is active
export const isBackgroundTrackingActive = async (): Promise<boolean> => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (error) {
    console.error('Error checking tracking status:', error);
    return false;
  }
};

// Get tracking state
export const getTrackingState = async (): Promise<string> => {
  try {
    const state = await AsyncStorage.getItem(TRACKING_STATE_KEY);
    return state || 'inactive';
  } catch (error) {
    return 'unknown';
  }
};

// Get tracking enabled state
export const isTrackingEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(TRACKING_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};

// Send location immediately (for foreground)
export const sendLocationImmediately = sendLocationToBackend;

// Setup app state listener to monitor foreground/background transitions
const setupAppStateListener = () => {
  if (appStateSubscription) return; // Already set up

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  console.log('📱 App state listener configured');
};

// Handle app state changes to restore tracking if needed
const handleAppStateChange = async (state: string) => {
  if (state === 'active') {
    // App came to foreground - verify tracking is still running
    console.log('📱 App came to foreground, verifying tracking...');
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    const shouldBeTracking = await isTrackingEnabled();

    if (shouldBeTracking && !isTracking) {
      console.warn('⚠️ Tracking was lost, restarting...');
      await startBackgroundLocationTracking();
    }
  }
};

// Cleanup function
export const cleanupAppStateListener = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
    console.log('📱 App state listener removed');
  }
};

// Get location sync queue status
export const getQueueStatus = async (): Promise<{ count: number; oldestTimestamp?: number }> => {
  const queue = await getLocationQueue();
  if (queue.length === 0) {
    return { count: 0 };
  }
  return {
    count: queue.length,
    oldestTimestamp: queue[0].timestamp,
  };
};
