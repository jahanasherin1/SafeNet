import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, NativeModules, Platform } from 'react-native';
import { startActivityMonitoring } from './ActivityMonitoringService'; // Import this to keep sensor listeners alive
import api from './api';

export const LOCATION_TASK_NAME = 'SAFENET_BACKGROUND_LOCATION';
const LOCATION_SYNC_QUEUE = 'LOCATION_SYNC_QUEUE';
const TRACKING_STATE_KEY = 'TRACKING_STATE';
const LAST_LOCATION_TIME = 'LAST_LOCATION_TIME';
const TRACKING_ENABLED_KEY = 'TRACKING_ENABLED';
const VERBOSE_LOGGING = true; 

let appStateSubscription: any = null;
let lastSentTime = 0;
let lastLocationSent: { latitude: number; longitude: number; accuracy?: number } | null = null;
let heartbeatInterval: any = null;
let foregroundPollingInterval: any = null;
let backgroundWatcherSubscription: any = null;
let trackingStartTime = 0;
const LOG_THROTTLE_MS = 5000; 
const HEARTBEAT_INTERVAL = 30000; 
const FOREGROUND_POLLING_INTERVAL = 5000; 
const MIN_ACCURACY = 30; 
const MIN_UPDATE_INTERVAL = 100;

interface SyncQueueItem {
  location: { latitude: number; longitude: number };
  email: string;
  timestamp: number;
  retries: number;
}

// Queue management (kept same as original)
const getLocationQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const queue = await AsyncStorage.getItem(LOCATION_SYNC_QUEUE);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    return [];
  }
};

const saveLocationQueue = async (queue: SyncQueueItem[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCATION_SYNC_QUEUE, JSON.stringify(queue));
  } catch (error) {}
};

const addToQueue = async (item: SyncQueueItem): Promise<void> => {
  const queue = await getLocationQueue();
  queue.push(item);
  if (queue.length > 100) queue.shift();
  await saveLocationQueue(queue);
};

export const processLocationQueue = async (): Promise<void> => {
  try {
    const queue = await getLocationQueue();
    if (queue.length === 0) return;

    if (VERBOSE_LOGGING) console.log(`📤 Processing ${queue.length} queued locations...`);

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
      } catch (error) {
        item.retries++;
      }
    }

    const updatedQueue = queue.filter((_, index) => !processedItems.includes(index));
    await saveLocationQueue(updatedQueue);
  } catch (error) {
    if (VERBOSE_LOGGING) console.error('Error processing location queue:', error);
  }
};

// --- DEFINE TASK ---
const defineBackgroundTask = () => {
  const isAlreadyDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
  
  if (isAlreadyDefined) {
    console.log('🔄 Task already defined, will use existing definition');
    return;
  }

  console.log('📝 Defining background location task...');

  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('❌ Background location error:', error);
      return;
    }

    if (data) {
      // 1. REINFORCE ACTIVITY MONITORING
      // This is the critical fix. The Location Foreground Service keeps the JS context alive.
      // We check if activity monitoring should be enabled, and ensures listeners are active.
      try {
        const shouldMonitor = await AsyncStorage.getItem('activityMonitoringEnabled');
        if (shouldMonitor === 'true') {
           // This is idempotent in ActivityMonitoringService
           // It ensures the Accelerometer listeners are attached to this active thread
           startActivityMonitoring();
        }
      } catch (e) {
        // Silent fail
      }

      // 2. PROCESS LOCATION
      const { locations } = data as { locations: Location.LocationObject[] };
      
      if (!locations || locations.length === 0) return;

      const location = locations[locations.length - 1];
      const now = Date.now();
      const coords = location.coords;
      const locationTimestamp = location.timestamp;
      
      if (trackingStartTime > 0 && locationTimestamp < trackingStartTime) return;
      if ((now - locationTimestamp) > 30000) return;
      if (lastSentTime > 0 && (now - lastSentTime) < MIN_UPDATE_INTERVAL) return;
      
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
      
      console.log(`📍 [${timestamp}] BG Update: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);

      try {
        await sendLocationToBackend({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? undefined,
          altitude: coords.altitude ?? undefined,
        });
        lastSentTime = now;
      } catch (err) {
        await queueLocationForSync({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? undefined,
          altitude: coords.altitude ?? undefined,
        });
      }
    }
  });

  console.log('✅ Background location task registered');
};

defineBackgroundTask();

const queueLocationForSync = async (location: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}): Promise<void> => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) return;

    const user = JSON.parse(userData);
    const item: SyncQueueItem = {
      location,
      email: user.email,
      timestamp: Date.now(),
      retries: 0,
    };

    await addToQueue(item);
  } catch (error) {
    console.error('Error queuing location:', error);
  }
};

const sendLocationToBackend = async (
  location: { latitude: number; longitude: number; accuracy?: number; altitude?: number },
  email?: string
) => {
  try {
    const accuracy = location.accuracy || 999;
    if (accuracy > MIN_ACCURACY) return;

    let userEmail = email;
    if (!userEmail) {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        userEmail = parsed.email;
      }
    }

    if (!userEmail) return;

    const response = await api.post('/user/update-location', {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: location.altitude,
      email: userEmail,
      isBackgroundUpdate: true,
      timestamp: Date.now(),
    });

    lastLocationSent = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy
    };
    
    setTimeout(() => processLocationQueue(), 1000);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const startBackgroundLocationTracking = async () => {
  try {
    console.log('🚀 Starting background location tracking...');
    trackingStartTime = Date.now();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return false;

    const bgStatus = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus.status !== 'granted') {
      console.warn('❌ Background location permission not granted');
      // We can continue, but it might stop when minimized
    }

    // Stop existing tracking if running
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Ensure task is defined
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) defineBackgroundTask();

    if (Platform.OS === 'android') {
        try {
            const ignoreBatteryOpt = NativeModules.LocationModule?.requestIgnoreBatteryOptimizations;
            if (ignoreBatteryOpt) await ignoreBatteryOpt();
        } catch (e) {}
    }

    const locationOptions: any = {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000, 
      distanceInterval: 1, 
      deferredUpdatesInterval: 0, 
      deferredUpdatesDistance: 0, 
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      mayShowUserSettingsDialog: true, 
      foregroundService: {
        notificationTitle: 'SafeNet Active',
        notificationBody: 'Safety monitoring active',
        notificationColor: '#6A5ACD',
      },
    };

    if (Platform.OS === 'android') {
      locationOptions.foregroundService.killServiceOnDestroy = false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, locationOptions);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify
    const verifyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!verifyTracking) return false;

    // Reset limiter
    lastSentTime = 0;

    await AsyncStorage.setItem(TRACKING_STATE_KEY, 'active');
    await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'true');

    setupAppStateListener();
    setupTrackingHeartbeat();
    await startBackgroundWatcher();
    startForegroundPolling();

    return true;
  } catch (error) {
    console.error('❌ Error starting background location tracking:', error);
    await AsyncStorage.setItem(TRACKING_STATE_KEY, 'failed');
    return false;
  }
};

export const stopBackgroundLocationTracking = async () => {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await AsyncStorage.setItem(TRACKING_STATE_KEY, 'inactive');
      await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'false');
      
      lastSentTime = 0;
      stopBackgroundWatcher();
      stopForegroundPolling();
      
      console.log('✅ Background location tracking stopped');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error stopping background location tracking:', error);
    return false;
  }
};

export const isBackgroundTrackingActive = async (): Promise<boolean> => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (error) {
    return false;
  }
};

export const isTrackingEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(TRACKING_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};

export const sendLocationImmediately = sendLocationToBackend;

const setupAppStateListener = () => {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
};

const handleAppStateChange = async (state: string) => {
  if (state === 'active') {
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      const shouldBeTracking = await isTrackingEnabled();

      if (shouldBeTracking && !isTracking) {
        setTimeout(async () => {
          await startBackgroundLocationTracking();
        }, 500);
      }
    } catch (error) {}
  }
};

const setupTrackingHeartbeat = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(async () => {
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      const shouldBeTracking = await isTrackingEnabled();
      
      if (shouldBeTracking && !isTracking) {
        const appState = AppState.currentState;
        if (appState === 'active') {
          await startBackgroundLocationTracking();
        }
      } else if (isTracking) {
        await AsyncStorage.setItem(LAST_LOCATION_TIME, Date.now().toString());
      }
    } catch (error) {}
  }, HEARTBEAT_INTERVAL);
};

export const cleanupAppStateListener = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  stopBackgroundWatcher();
  stopForegroundPolling();
};

const startBackgroundWatcher = async () => {
  try {
    if (backgroundWatcherSubscription) {
      backgroundWatcherSubscription.remove();
      backgroundWatcherSubscription = null;
    }

    backgroundWatcherSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 2000,
        distanceInterval: 0,
        mayShowUserSettingsDialog: false,
      },
      async (location) => {
        try {
          const coords = location.coords;
          const now = Date.now();
          const timeSinceLastSent = now - lastSentTime;
          if (timeSinceLastSent < 3000) return;

          try {
            await sendLocationToBackend({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy ?? undefined,
              altitude: coords.altitude ?? undefined,
            });
            lastSentTime = now;
          } catch (sendError) {
            await queueLocationForSync({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy ?? undefined,
              altitude: coords.altitude ?? undefined,
            });
          }
        } catch (error) {}
      }
    );
  } catch (error) {}
};

const stopBackgroundWatcher = () => {
  if (backgroundWatcherSubscription) {
    backgroundWatcherSubscription.remove();
    backgroundWatcherSubscription = null;
  }
};

const startForegroundPolling = () => {
  if (foregroundPollingInterval) clearInterval(foregroundPollingInterval);
  
  let pollCount = 0;
  pollLocation(++pollCount);
  
  foregroundPollingInterval = setInterval(async () => {
    pollLocation(++pollCount);
  }, FOREGROUND_POLLING_INTERVAL);
};

const pollLocation = async (pollCount: number) => {
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: false,
        timeInterval: 1000,
      }),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Location timeout')), 8000)
      )
    ]) as Location.LocationObject | null;

    if (!position) return;

    const now = Date.now();
    const timeSinceLastSent = now - lastSentTime;
    
    if (timeSinceLastSent > 4000 || pollCount === 1) {
      await sendLocationToBackend({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
        altitude: position.coords.altitude ?? undefined,
      });
      lastSentTime = now;
    }
  } catch (error: any) {
    // Silent fail for polling
  }
};

const stopForegroundPolling = () => {
  if (foregroundPollingInterval) {
    clearInterval(foregroundPollingInterval);
    foregroundPollingInterval = null;
  }
};

export const getQueueStatus = async (): Promise<{ count: number; oldestTimestamp?: number }> => {
  const queue = await getLocationQueue();
  if (queue.length === 0) return { count: 0 };
  return {
    count: queue.length,
    oldestTimestamp: queue[0].timestamp,
  };
};

// Background activity monitoring functions (integrated with ActivityMonitoringService)
export const startBackgroundActivityMonitoring = async (): Promise<boolean> => {
  try {
    console.log('✅ Background activity monitoring enabled');
    return true;
  } catch (error) {
    console.error('Error starting background activity monitoring:', error);
    return false;
  }
};

export const stopBackgroundActivityMonitoring = async (): Promise<boolean> => {
  try {
    console.log('✅ Background activity monitoring disabled');
    return true;
  } catch (error) {
    console.error('Error stopping background activity monitoring:', error);
    return false;
  }
};