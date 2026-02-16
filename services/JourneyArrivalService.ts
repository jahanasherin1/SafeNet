// services/JourneyArrivalService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import api from './api';
import { sendActivityAlertNotification } from './LocalNotificationService';

const JOURNEY_CHECK_INTERVAL = 10000; // Check every 10 seconds
const DESTINATION_RADIUS_METERS = 500; // Alert when within 500m of destination
let journeyCheckInterval: any = null;
let journeyAlertSent = false; // Prevent multiple alerts for same journey

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Check if user has reached journey destination
 */
async function checkJourneyArrival(): Promise<void> {
  try {
    // Get user data
    const userData = await AsyncStorage.getItem('user');
    if (!userData) return;

    const { email } = JSON.parse(userData);

    // Fetch current journey status
    const journeyRes = await api.post('/journey/status', { userEmail: email });
    const { journey } = journeyRes.data;

    // If no active journey, stop checking
    if (!journey?.isActive) {
      journeyAlertSent = false;
      return;
    }

    // Get user's current location
    try {
      const location = await Location.getLastKnownPositionAsync();
      if (!location) return;

      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      // Get destination coordinates (for now we'll work with the data we have)
      // In a real scenario, the destination coordinates should be stored in the journey
      
      // Check ETA time
      const etaTime = new Date(journey.eta).getTime();
      const currentTime = Date.now();
      const timeUntilETA = etaTime - currentTime;

      // If alert already sent, prevent duplicate
      if (journeyAlertSent) {
        return;
      }

      // Condition 1: ETA time reached or passed
      if (timeUntilETA <= 0) {
        journeyAlertSent = true;
        await sendActivityAlertNotification(
          '🎯 Journey Arrival Time!',
          `You have reached your expected arrival time. Please click "End Journey" to mark your journey as complete.`,
          'high'
        );
        console.log('📍 Journey ETA alert sent');
        return;
      }

      // Condition 2: Alert 5 minutes before ETA
      if (timeUntilETA > 0 && timeUntilETA <= 5 * 60 * 1000 && !journeyAlertSent) {
        journeyAlertSent = true;
        const minutesLeft = Math.ceil(timeUntilETA / 60000);
        await sendActivityAlertNotification(
          '⏰ Journey Almost Complete',
          `You're close to your expected arrival time (${minutesLeft} min left). Prepare to click "End Journey".`,
          'medium'
        );
        console.log('⏰ Journey pre-arrival alert sent');
        return;
      }
    } catch (locationError) {
      if (locationError instanceof Error) {
        if (!locationError.message.includes('timeout')) {
          console.error('Error getting location for journey check:', locationError);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      // Silent fail for connection errors
      if (!error.message.includes('network') && !error.message.includes('timeout')) {
        console.error('Error in journey arrival check:', error);
      }
    }
  }
}

/**
 * Start monitoring for journey arrival
 */
export const startJourneyMonitoring = async (): Promise<void> => {
  try {
    console.log('🚀 Starting journey arrival monitoring...');
    
    // Reset alert flag on start
    journeyAlertSent = false;

    // Check immediately
    await checkJourneyArrival();

    // Stop existing interval if any
    if (journeyCheckInterval) {
      clearInterval(journeyCheckInterval);
    }

    // Check periodically
    journeyCheckInterval = setInterval(async () => {
      await checkJourneyArrival();
    }, JOURNEY_CHECK_INTERVAL);

    console.log('✅ Journey arrival monitoring started');
  } catch (error) {
    console.error('Error starting journey monitoring:', error);
  }
};

/**
 * Stop monitoring for journey arrival
 */
export const stopJourneyMonitoring = (): void => {
  try {
    if (journeyCheckInterval) {
      clearInterval(journeyCheckInterval);
      journeyCheckInterval = null;
    }
    journeyAlertSent = false;
    console.log('🛑 Journey arrival monitoring stopped');
  } catch (error) {
    console.error('Error stopping journey monitoring:', error);
  }
};

/**
 * Reset journey alert flag (call when journey ends)
 */
export const resetJourneyAlert = (): void => {
  journeyAlertSent = false;
  console.log('🔄 Journey alert flag reset');
};
