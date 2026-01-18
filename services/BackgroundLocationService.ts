import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import api from './api';

const LOCATION_TASK_NAME = 'SAFENET_BACKGROUND_LOCATION';

interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: number;
  email: string;
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[locations.length - 1];
      console.log('📍 Background location update:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Send to backend
      try {
        await sendLocationToBackend({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (err) {
        console.warn('Failed to send background location to backend:', err);
      }
    }
  }
});

// Send location to backend
const sendLocationToBackend = async (
  location: { latitude: number; longitude: number },
  email?: string
) => {
  try {
    // Get email from AsyncStorage if not provided
    let userEmail = email;
    if (!userEmail) {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
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
      email: userEmail,
      isBackgroundUpdate: true,
    });

    console.log('✅ Background location sent to backend');
    return response.data;
  } catch (error) {
    console.error('Error sending background location:', error);
    throw error;
  }
};

// Start background location tracking
export const startBackgroundLocationTracking = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Foreground location permission not granted');
      return false;
    }

    // Also request background permissions
    const bgStatus = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus.status !== 'granted') {
      console.warn('Background location permission not granted');
      return false;
    }

    // Check if task is already running
    const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
      console.warn('Location task is not defined');
      return false;
    }

    // Start location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // Update every 30 seconds
      distanceInterval: 50, // Or when moved 50 meters
      foregroundService: {
        notificationTitle: 'SafeNet Location Tracking',
        notificationBody: 'Your location is being shared with your guardians',
        notificationColor: '#6A5ACD',
      },
    });

    console.log('✅ Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background location tracking:', error);
    return false;
  }
};

// Stop background location tracking
export const stopBackgroundLocationTracking = async () => {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('✅ Background location tracking stopped');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
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

// Send location immediately (for foreground)
export const sendLocationImmediately = sendLocationToBackend;
