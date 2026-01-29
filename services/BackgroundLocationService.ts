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
const VERBOSE_LOGGING = true; // Set to true for debugging

let appStateSubscription: any = null;
let lastLoggedTime = 0;
let lastLocationSent: { latitude: number; longitude: number; accuracy?: number } | null = null; // Track last location to avoid duplicates
let heartbeatInterval: any = null;
let foregroundPollingInterval: any = null; // Fallback polling when background task isn't firing
let backgroundWatcherSubscription: any = null; // Persistent background location watcher
let trackingStartTime = 0; // Track when tracking was started to skip old buffered locations
const LOG_THROTTLE_MS = 5000; // Only log location every 5 seconds
const HEARTBEAT_INTERVAL = 30000; // Check tracking health every 30 seconds
const FOREGROUND_POLLING_INTERVAL = 5000; // Poll every 5 seconds as fallback
const BACKGROUND_WATCH_INTERVAL = 3000; // Watch position every 3 seconds in background
const MIN_ACCURACY = 30; // Reject locations with accuracy worse than 30m
const MIN_DISTANCE_TO_SEND = 0; // Send all updates in real-time (no movement threshold)

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

    if (VERBOSE_LOGGING) {
      console.log(`📤 Processing ${queue.length} queued locations...`);
    }

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
        if (VERBOSE_LOGGING) {
          console.log(`✅ Synced queued location for ${item.email}`);
        }
      } catch (error) {
        item.retries++;
      }
    }

    // Remove processed items
    const updatedQueue = queue.filter((_, index) => !processedItems.includes(index));
    await saveLocationQueue(updatedQueue);
  } catch (error) {
    if (VERBOSE_LOGGING) {
      console.error('Error processing location queue:', error);
    }
  }
};

// Track last sent location to prevent rapid duplicates
let lastSentTime = 0;
const MIN_UPDATE_INTERVAL = 100; // Minimum 100ms between updates to avoid server overload

// Define the background task - unregister first if exists to ensure clean state
const defineBackgroundTask = () => {
  const isAlreadyDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
  
  if (isAlreadyDefined) {
    console.log('🔄 Task already defined, will use existing definition');
    return; // Task already defined
  }

  console.log('📝 Defining background location task...');

  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    try {
      if (error) {
        console.error('❌ Background location error:', error);
        // Don't return - continue to next update
        return;
      }

      if (!data) {
        console.warn('⚠️ Background task called but no data received');
        // Don't return - wait for next update
        return;
      }

      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
      
        if (!locations || locations.length === 0) {
          console.warn('⚠️ Background task received empty locations array');
          // Don't return - wait for next update
          return;
        }

        console.log(`🔔 Background task received ${locations.length} location(s)`);

        // Process only the most recent location
        const location = locations[locations.length - 1];
      const now = Date.now();
      const coords = location.coords;
      const locationTimestamp = location.timestamp;
      
      // Skip locations that are older than when tracking started (cached/buffered locations)
      if (trackingStartTime > 0 && locationTimestamp < trackingStartTime) {
        if (VERBOSE_LOGGING) {
          const bufferAge = trackingStartTime - locationTimestamp;
          console.log(`⏭️ Skipping buffered location from before tracking started (${Math.round(bufferAge/1000)}s before start)`);
        }
        return; // Skip locations from before tracking started
      }
      
      // Skip locations that are too old (older than 30 seconds)
      const locationAge = now - locationTimestamp;
      if (locationAge > 30000) {
        if (VERBOSE_LOGGING) {
          console.log(`⏭️ Skipping stale location (age: ${locationAge}ms)`);
        }
        return; // Skip very stale buffered location
      }
      
      // Rate limit to avoid overwhelming the server
      const timeSinceLastSent = now - lastSentTime;
      if (lastSentTime > 0 && timeSinceLastSent < MIN_UPDATE_INTERVAL) {
        if (VERBOSE_LOGGING) {
          console.log(`⏭️ Throttled (only ${timeSinceLastSent}ms since last update, need ${MIN_UPDATE_INTERVAL}ms)`);
        }
        return; // Skip this update, send next batch
      }
      if (VERBOSE_LOGGING && lastSentTime > 0) {
        console.log(`⏱️ Time since last update: ${timeSinceLastSent}ms`);
      }
      
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      
      console.log(`📍 [${timestamp}] Location update:`, {
        lat: coords.latitude.toFixed(7),
        lng: coords.longitude.toFixed(7),
        accuracy: coords.accuracy?.toFixed(0) + 'm',
      });

      // Send to backend
      try {
        await sendLocationToBackend({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? undefined,
          altitude: coords.altitude ?? undefined,
        });
        
        // Update last sent time after successful send
        lastSentTime = now;
      } catch (err) {
        console.warn('⚠️ Failed to send, queuing...');
        await queueLocationForSync({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? undefined,
          altitude: coords.altitude ?? undefined,
        });
      }
      }
    } catch (taskError) {
      // Catch any errors to prevent task from crashing
      console.error('❌ Error in background task (will continue):', taskError);
      // Task will continue to receive updates despite error
    }
  });

  console.log('✅ Background location task registered');
};

// Initialize task definition
defineBackgroundTask();

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
    // Filter 1: Reject locations with poor accuracy (worse than 30m)
    const accuracy = location.accuracy || 999;
    if (accuracy > MIN_ACCURACY) {
      console.log(`⏭️ Skipping location with poor accuracy (${accuracy.toFixed(0)}m, threshold: ${MIN_ACCURACY}m)`);
      return;
    }

    // For real-time tracking, send all updates regardless of movement
    // We'll track the distance moved for informational purposes only
    if (lastLocationSent && VERBOSE_LOGGING) {
      const latDiff = Math.abs(location.latitude - lastLocationSent.latitude);
      const lonDiff = Math.abs(location.longitude - lastLocationSent.longitude);
      const distanceMoved = Math.sqrt(latDiff ** 2 + lonDiff ** 2) * 111000; // Convert to meters
      console.log(`⏭️ Location unchanged (moved only ${distanceMoved.toFixed(0)}m)`);
    }

    let userEmail = email;
    if (!userEmail) {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        userEmail = parsed.email;
      }
    }

    if (!userEmail) {
      if (VERBOSE_LOGGING) {
        console.warn('No email available for background location update');
      }
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

    // Update last sent location
    lastLocationSent = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy
    };

    // Log successful send with timestamp
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    console.log(`✅ [${timestamp}] Location sent to backend (accuracy: ${accuracy.toFixed(0)}m)`);
    
    // Process any queued items immediately after successful sync
    setTimeout(() => processLocationQueue(), 1000);

    return response.data;
  } catch (error) {
    if (VERBOSE_LOGGING) {
      console.error('Error sending background location:', error);
    }
    throw error;
  }
};

// Start background location tracking with aggressive settings
export const startBackgroundLocationTracking = async () => {
  try {
    console.log('🚀 Starting background location tracking...');
    
    // Set tracking start time to skip old buffered locations
    trackingStartTime = Date.now();
    console.log(`⏱️ Tracking start time set: ${new Date(trackingStartTime).toLocaleTimeString()}`);

    // Allow starting in any app state for real-time tracking
    const appState = AppState.currentState;
    console.log(`ℹ️ Starting tracking in ${appState} state...`);

    console.log('📍 Requesting location permissions...');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('❌ Foreground location permission not granted');
      console.log('   User needs to grant permission in Settings > Apps > SafeNet > Permissions > Location');
      return false;
    }
    console.log('✅ Foreground permission granted');

    console.log('📍 Requesting background location permissions...');
    const bgStatus = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus.status !== 'granted') {
      console.warn('❌ Background location permission not granted');
      console.log('   User needs to select "Allow all the time" when prompted');
      return false;
    }
    console.log('✅ Background permission granted');

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

    // Stop existing tracking if running to ensure clean restart
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTracking) {
      console.log('🔄 Stopping existing location tracking...');
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms only
    }

    // Check if task is defined
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
      console.warn('❌ Location task is not defined, defining now...');
      defineBackgroundTask();
      // Wait a moment for task to register
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Double check task is now defined
    const isNowDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isNowDefined) {
      console.error('❌ Failed to define location task');
      return false;
    }

    console.log('✅ Location task confirmed defined');

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

    // Start location updates with aggressive settings for true real-time tracking
    const locationOptions: any = {
      accuracy: Location.Accuracy.BestForNavigation, // Best possible accuracy for real-time tracking
      timeInterval: 1000, // Update every 1 second for true real-time
      distanceInterval: 1, // Update even for 1 meter movement
      deferredUpdatesInterval: 0, // Process updates IMMEDIATELY - no batching
      deferredUpdatesDistance: 0, // Process updates IMMEDIATELY - no batching
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false, // Never pause
      mayShowUserSettingsDialog: true, // Show dialog if location is disabled
      foregroundService: {
        notificationTitle: 'SafeNet Active',
        notificationBody: 'Real-time location tracking active',
        notificationColor: '#6A5ACD',
      },
    };

    // iOS-specific settings
    if (Platform.OS === 'ios') {
      locationOptions.activityType = Location.ActivityType.Other;
      locationOptions.showsBackgroundLocationIndicator = true;
    }

    // Android-specific settings for real-time updates
    if (Platform.OS === 'android') {
      locationOptions.foregroundService.killServiceOnDestroy = false;
      // Enable high-frequency updates on Android
      locationOptions.timeInterval = 1000; // 1 second
      locationOptions.fastestInterval = 500; // Accept updates every 500ms if available
      locationOptions.deferredUpdatesInterval = 0; // No batching
    }

    console.log('🚀 Starting location updates with task:', LOCATION_TASK_NAME);
    console.log('📋 Options:', JSON.stringify(locationOptions, null, 2));

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, locationOptions);

    // Small delay to let the system register the updates
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify tracking started successfully
    const verifyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('🔍 Tracking verification:', verifyTracking ? 'ACTIVE ✅' : 'FAILED ❌');

    if (!verifyTracking) {
      console.error('❌ Location updates failed to start');
      return false;
    }

    // Get current location options to verify what was set
    try {
      console.log('🔍 Verifying location service is generating updates...');
      // Start a foreground watcher to verify the background task is being called
      setTimeout(async () => {
        const stillTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('🔍 [5s check] Tracking still active:', stillTracking ? 'YES ✅' : 'NO ❌');
        if (!stillTracking) {
          console.error('❌ Tracking stopped unexpectedly after 5 seconds!');
        }
      }, 5000);

      setTimeout(async () => {
        const stillTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('🔍 [15s check] Tracking still active:', stillTracking ? 'YES ✅' : 'NO ❌');
      }, 15000);
    } catch (verifyError) {
      console.warn('⚠️ Could not verify location service:', verifyError);
    }

    // Try to get last known location (instant, no GPS wait)
    console.log('🧪 Fetching last known location...');
    try {
      const lastKnownLocation = await Location.getLastKnownPositionAsync();
      if (lastKnownLocation) {
        console.log('✅ Using cached location:', {
          lat: lastKnownLocation.coords.latitude.toFixed(6),
          lng: lastKnownLocation.coords.longitude.toFixed(6),
        });
        
        // Send cached location immediately (non-blocking)
        sendLocationToBackend({
          latitude: lastKnownLocation.coords.latitude,
          longitude: lastKnownLocation.coords.longitude,
          accuracy: lastKnownLocation.coords.accuracy ?? undefined,
          altitude: lastKnownLocation.coords.altitude ?? undefined,
        }).catch(err => console.warn('⚠️ Could not send cached location'));
      } else {
        console.log('ℹ️ No cached location, waiting for GPS...');
      }
    } catch (testError) {
      console.warn('⚠️ Could not get cached location:', testError);
    }

    // Reset rate limiter for fresh start to allow immediate first update
    lastSentTime = 0;

    console.log('✅ Location tracking active (TRUE REAL-TIME MODE)');
    console.log('ℹ️  Updates every 1 second OR when moving 1+ meter');
    console.log('📱 Platform:', Platform.OS);
    console.log('⚡ Real-time tracking enabled - no rate limiting');
    console.log('⏰ Waiting for background location updates...');

    // Save tracking state
    await AsyncStorage.setItem(TRACKING_STATE_KEY, 'active');
    await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'true');

    // Setup app state listener to restart tracking if app resumes
    setupAppStateListener();

    // Setup heartbeat to monitor tracking health
    setupTrackingHeartbeat();

    // Start background watcher for continuous tracking (works when app is minimized)
    await startBackgroundWatcher();

    // Start foreground polling as fallback (for when background task doesn't fire)
    startForegroundPolling();

    // Process any queued locations after starting
    setTimeout(() => processLocationQueue(), 5000);

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
      await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'false');
      
      // Reset rate limiter
      lastSentTime = 0;
      
      // Stop background watcher
      stopBackgroundWatcher();
      
      // Stop foreground polling
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
    
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      const shouldBeTracking = await isTrackingEnabled();

      if (shouldBeTracking && !isTracking) {
        console.warn('⚠️ Tracking was lost, restarting...');
        
        // Add a small delay to ensure app is fully in foreground
        setTimeout(async () => {
          try {
            await startBackgroundLocationTracking();
            console.log('✅ Tracking restarted successfully');
          } catch (error) {
            console.error('❌ Failed to restart tracking:', error);
          }
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error verifying tracking state:', error);
    }
  }
};

// Setup heartbeat to monitor tracking health
const setupTrackingHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(async () => {
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      const shouldBeTracking = await isTrackingEnabled();
      
      if (shouldBeTracking && !isTracking) {
        console.warn('💔 Heartbeat: Tracking lost, attempting restart...');
        const appState = AppState.currentState;
        if (appState === 'active') {
          await startBackgroundLocationTracking();
        }
      } else if (isTracking) {
        // Update last location time
        await AsyncStorage.setItem(LAST_LOCATION_TIME, Date.now().toString());
      }
    } catch (error) {
      console.error('❌ Heartbeat check failed:', error);
    }
  }, HEARTBEAT_INTERVAL);
};

// Cleanup function
export const cleanupAppStateListener = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
    console.log('📱 App state listener removed');
  }
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('💔 Heartbeat stopped');
  }
  
  stopBackgroundWatcher();
  stopForegroundPolling();
};

// Background location watcher - works even when app is minimized
const startBackgroundWatcher = async () => {
  try {
    // Stop existing watcher if any
    if (backgroundWatcherSubscription) {
      backgroundWatcherSubscription.remove();
      backgroundWatcherSubscription = null;
    }

    console.log('👁️ Starting continuous location watcher (keeps app alive in background)...');

    // Use watchPositionAsync - this is the only reliable way to keep tracking when minimized
    backgroundWatcherSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 2000, // Check every 2 seconds
        distanceInterval: 0, // Update on any movement
        mayShowUserSettingsDialog: false,
      },
      async (location) => {
        try {
          const coords = location.coords;
          const now = Date.now();
          
          // Only send if enough time has passed
          const timeSinceLastSent = now - lastSentTime;
          if (timeSinceLastSent < 3000) {
            return; // Skip if sent too recently
          }

          // Log background location
          const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: true,
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          console.log(`📍 [${timestamp}] Location (background): ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${coords.accuracy?.toFixed(0)}m)`);

          // Send to backend
          try {
            await sendLocationToBackend({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy ?? undefined,
              altitude: coords.altitude ?? undefined,
            });
            lastSentTime = now;
          } catch (sendError) {
            // Queue if offline
            await queueLocationForSync({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy ?? undefined,
              altitude: coords.altitude ?? undefined,
            });
          }
        } catch (error) {
          console.error('❌ Background watcher callback error:', error);
        }
      },
      (error) => {
        console.error('❌ Background watcher error:', error);
      }
    );

    console.log('✅ Continuous location watcher started - will track even when minimized');
  } catch (error) {
    console.error('❌ Failed to start background watcher:', error);
  }
};

// Stop background watcher
const stopBackgroundWatcher = () => {
  if (backgroundWatcherSubscription) {
    backgroundWatcherSubscription.remove();
    backgroundWatcherSubscription = null;
    console.log('🛑 Background location watcher stopped');
  }
};

// Foreground polling as fallback when background task isn't firing
const startForegroundPolling = () => {
  if (foregroundPollingInterval) {
    clearInterval(foregroundPollingInterval);
  }

  console.log('🔄 Starting foreground polling fallback (every 5s)...');
  
  let pollCount = 0;
  
  // Poll immediately on start
  pollLocation(++pollCount);
  
  foregroundPollingInterval = setInterval(async () => {
    pollLocation(++pollCount);
  }, FOREGROUND_POLLING_INTERVAL);
  
  console.log('✅ Foreground polling started - will update every 5 seconds');
};

const pollLocation = async (pollCount: number) => {
  try {
    // Get current position with timeout
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Use Balanced instead of BestForNavigation for faster response
        mayShowUserSettingsDialog: false,
        timeInterval: 1000,
      }),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Location timeout')), 8000)
      )
    ]) as Location.LocationObject | null;

    if (!position) {
      console.warn(`⚠️ [POLL #${pollCount}] Location request timed out`);
      return;
    }

    const now = Date.now();
    const timeSinceLastSent = now - lastSentTime;
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    console.log(`📍 [POLL #${pollCount}] [${timestamp}] Location:`, {
      lat: position.coords.latitude.toFixed(7),
      lng: position.coords.longitude.toFixed(7),
      accuracy: position.coords.accuracy?.toFixed(0) + 'm',
      timeSinceLastSent: timeSinceLastSent + 'ms'
    });

    // Send if it's been more than 4 seconds OR first poll
    if (timeSinceLastSent > 4000 || pollCount === 1) {
      await sendLocationToBackend({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
        altitude: position.coords.altitude ?? undefined,
      });
      
      lastSentTime = now;
      console.log(`✅ [POLL #${pollCount}] Location sent to backend`);
    } else {
      console.log(`⏭️ [POLL #${pollCount}] Skipped (sent ${timeSinceLastSent}ms ago)`);
    }
  } catch (error: any) {
    // GPS timeout is expected - fallback to cached location silently
    const isTimeout = error?.message?.includes('timeout');
    
    // Try to get last known position as fallback
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const timestamp = new Date().toLocaleTimeString('en-US', { 
          hour12: true,
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        
        console.log(`📍 [POLL #${pollCount}] [${timestamp}] Using cached location:`, {
          lat: lastKnown.coords.latitude.toFixed(7),
          lng: lastKnown.coords.longitude.toFixed(7),
          accuracy: lastKnown.coords.accuracy?.toFixed(0) + 'm',
        });
        
        await sendLocationToBackend({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy ?? undefined,
          altitude: lastKnown.coords.altitude ?? undefined,
        });
        
        lastSentTime = Date.now();
      }
    } catch (fallbackError) {
      // Only log if it's NOT a timeout (timeout is expected and handled)
      if (!isTimeout) {
        console.warn(`⚠️ [POLL #${pollCount}] GPS error, using cached location`);
      }
    }
  }
};

const stopForegroundPolling = () => {
  if (foregroundPollingInterval) {
    clearInterval(foregroundPollingInterval);
    foregroundPollingInterval = null;
    console.log('🔄 Foreground polling stopped');
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
