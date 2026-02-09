import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import api from './api';
import { sendWeatherAlertNotification } from './LocalNotificationService';
import { WeatherAlertService } from './WeatherAlertService';
import { WeatherService } from './WeatherService';

export const WEATHER_CHECK_TASK_NAME = 'SAFENET_BACKGROUND_WEATHER_CHECK';
const LAST_WEATHER_ALERT_TIME = 'LAST_WEATHER_ALERT_TIME';
const WEATHER_CHECK_INTERVAL_MS = 30 * 60 * 1000; // Check every 30 minutes
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // Send alerts every 15 minutes when in risk areas

interface WeatherAlertRecord {
  timestamp: number;
  level: string;
  condition: string;
}

let weatherCheckInterval: any = null;
let lastWeatherCheck = 0;

/**
 * Register background weather check task
 * This runs periodically to check weather conditions and send auto alerts
 */
export const registerBackgroundWeatherCheckTask = async () => {
  const isAlreadyDefined = TaskManager.isTaskDefined(WEATHER_CHECK_TASK_NAME);

  if (!isAlreadyDefined) {
    TaskManager.defineTask(WEATHER_CHECK_TASK_NAME, async () => {
      try {
        console.log('🌤️  Background weather check task executing...');
        await checkWeatherAndAlert();
      } catch (error) {
        console.error('❌ Error in background weather check task:', error);
      }
    });
  }
};

/**
 * Start periodic weather checking in foreground
 */
export const startWeatherMonitoring = async () => {
  try {
    console.log('🌤️  Starting weather monitoring service...');
    
    // Register the background task first
    await registerBackgroundWeatherCheckTask();

    // Start foreground polling as primary method
    if (!weatherCheckInterval) {
      weatherCheckInterval = setInterval(async () => {
        if (Date.now() - lastWeatherCheck > WEATHER_CHECK_INTERVAL_MS) {
          try {
            await checkWeatherAndAlert();
            lastWeatherCheck = Date.now();
          } catch (error) {
            console.error('Error checking weather:', error);
          }
        }
      }, WEATHER_CHECK_INTERVAL_MS);

      console.log('✅ Weather monitoring started with 30-minute interval');
    }
  } catch (error) {
    console.error('Error starting weather monitoring:', error);
  }
};

/**
 * Stop weather monitoring
 */
export const stopWeatherMonitoring = () => {
  if (weatherCheckInterval) {
    clearInterval(weatherCheckInterval);
    weatherCheckInterval = null;
    console.log('🛑 Weather monitoring stopped');
  }
};

/**
 * Check weather at specific location and send alert if unsafe
 * This is called from the location tracking service
 */
export const checkWeatherAtLocation = async (latitude: number, longitude: number): Promise<void> => {
  try {
    // Get user data
    const userStr = await AsyncStorage.getItem('user');
    if (!userStr) {
      return;
    }

    const userData = JSON.parse(userStr);

    // Fetch weather data at this location
    const weatherData = await WeatherService.getWeatherCached(latitude, longitude);
    console.log(`🌤️ Weather check at [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]: ${weatherData.weatherCondition}`);
    
    // Analyze weather
    const weatherAlert = WeatherAlertService.analyzeWeather(weatherData);
    console.log(`📊 Analysis result: ${weatherAlert.level.toUpperCase()}`);

    // Only send alert if conditions are not safe
    if (weatherAlert.level === 'safe') {
      console.log('✅ Weather is safe - no alert needed');
      return;
    }

    // Check if we've already sent an alert recently (cooldown)
    const lastAlertTimeStr = await AsyncStorage.getItem(LAST_WEATHER_ALERT_TIME);
    if (lastAlertTimeStr) {
      const lastAlertTime = parseInt(lastAlertTimeStr, 10);
      const timeSinceLastAlert = Date.now() - lastAlertTime;

      if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((ALERT_COOLDOWN_MS - timeSinceLastAlert) / 60000);
        console.log(`⏳ Alert cooldown active (${minutesLeft}min remaining)`);
        // Still in cooldown, don't send another alert
        return;
      }
    }

    // Get primary hazard
    const primaryHazard = weatherAlert.hazards.length > 0 
      ? weatherAlert.hazards[0] 
      : 'Hazardous weather conditions';

    console.log(`🚨 UNSAFE WEATHER DETECTED: ${weatherAlert.level.toUpperCase()} - ${weatherData.weatherCondition}`);
    console.log(`   Hazard: ${primaryHazard}`);

    // Send local device notification to user
    try {
      await sendWeatherAlertNotification(
        weatherAlert.level as 'caution' | 'warning' | 'danger',
        weatherData.weatherCondition,
        primaryHazard
      );
      console.log('🔔 Weather alert notification sent to user');
    } catch (notifyError) {
      console.error('❌ Error sending notification:', notifyError);
    }

    // Send alert to backend
    try {
      console.log('📤 Sending weather alert to backend...');
      const response = await api.post('/weather-alerts/send', {
        userEmail: userData.email,
        userName: userData.name,
        safetyLevel: weatherAlert.level,
        weatherCondition: weatherData.weatherCondition,
        primaryHazard: primaryHazard,
        hazards: weatherAlert.hazards,
        recommendations: weatherAlert.recommendations,
      });
      console.log('✅ Weather alert sent to backend');

      // Update last alert time after successful backend send
      await AsyncStorage.setItem(LAST_WEATHER_ALERT_TIME, Date.now().toString());
    } catch (backendError: any) {
      console.error('❌ Error sending to backend:', backendError.message);
      // Still update cooldown even if backend fails, to prevent spam
      await AsyncStorage.setItem(LAST_WEATHER_ALERT_TIME, Date.now().toString());
    }
  } catch (error) {
    // Silently fail - this shouldn't block location updates
    // Only log if verbose
    if (error instanceof Error) {
      console.warn('⚠️ Error checking weather at location:', error.message);
    }
  }
};

/**
 * Main function to check weather and send alerts
 */
const checkWeatherAndAlert = async () => {
  try {
    // Get user data
    const userStr = await AsyncStorage.getItem('user');
    if (!userStr) {
      console.log('⚠️  No user found, skipping weather check');
      return;
    }

    const userData = JSON.parse(userStr);
    const userEmail = userData.email;
    const userName = userData.name;

    // Get current location
    const location = await AsyncStorage.getItem('currentLocation');
    if (!location) {
      console.log('⚠️  No location available, skipping weather check');
      return;
    }

    const { latitude, longitude } = JSON.parse(location);

    // Fetch weather data
    const weatherData = await WeatherService.getWeatherCached(latitude, longitude);
    console.log(`🌤️  Weather check: ${weatherData.weatherCondition} at ${latitude}, ${longitude}`);

    // Analyze weather
    const weatherAlert = WeatherAlertService.analyzeWeather(weatherData);

    // Only send alert if conditions are not safe
    if (weatherAlert.level === 'safe') {
      console.log('✅ Weather is safe, no alert needed');
      return;
    }

    // Check if we've already sent an alert recently (cooldown)
    const lastAlertTimeStr = await AsyncStorage.getItem(LAST_WEATHER_ALERT_TIME);
    if (lastAlertTimeStr) {
      const lastAlertTime = parseInt(lastAlertTimeStr, 10);
      const timeSinceLastAlert = Date.now() - lastAlertTime;

      if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((ALERT_COOLDOWN_MS - timeSinceLastAlert) / 60000);
        console.log(
          `⏳ Alert cooldown active. Last alert was ${Math.ceil(timeSinceLastAlert / 60000)} minutes ago. Next alert in ${minutesLeft} minutes.`
        );
        return;
      }
    }

    // Get primary hazard
    const primaryHazard = weatherAlert.hazards.length > 0 
      ? weatherAlert.hazards[0] 
      : 'Hazardous weather conditions';

    console.log(
      `⚠️  Weather alert needed: ${weatherAlert.level.toUpperCase()} - ${weatherData.weatherCondition}`
    );

    // Send local device notification to user
    try {
      await sendWeatherAlertNotification(
        weatherAlert.level as 'caution' | 'warning' | 'danger',
        weatherData.weatherCondition,
        primaryHazard
      );
      console.log('🔔 Weather alert notification sent to user');
    } catch (notifyError) {
      console.error('❌ Error sending notification:', notifyError);
    }

    // Send alert to backend
    try {
      console.log('📤 Sending weather alert to backend...');
      const response = await api.post('/weather-alerts/send', {
        userEmail: userEmail,
        userName: userName,
        safetyLevel: weatherAlert.level,
        weatherCondition: weatherData.weatherCondition,
        primaryHazard: primaryHazard,
        hazards: weatherAlert.hazards,
        recommendations: weatherAlert.recommendations,
      });
      console.log('✅ Weather alert sent to backend');

      // Update last alert time after successful backend send
      await AsyncStorage.setItem(LAST_WEATHER_ALERT_TIME, Date.now().toString());
    } catch (backendError: any) {
      console.error('❌ Error sending to backend:', backendError.message);
      // Still update cooldown even if backend fails, to prevent spam
      await AsyncStorage.setItem(LAST_WEATHER_ALERT_TIME, Date.now().toString());
    }
  } catch (error) {
    console.error('❌ Error in checkWeatherAndAlert:', error);
  }
};

/**
 * Manual trigger for testing
 */
export const triggerWeatherCheckManually = async () => {
  console.log('🔄 Manual weather check triggered');
  await checkWeatherAndAlert();
};

/**
 * Get last weather alert info
 */
export const getLastWeatherAlertTime = async (): Promise<number | null> => {
  try {
    const timeStr = await AsyncStorage.getItem(LAST_WEATHER_ALERT_TIME);
    return timeStr ? parseInt(timeStr, 10) : null;
  } catch (error) {
    console.error('Error getting last weather alert time:', error);
    return null;
  }
};

/**
 * Reset weather alert cooldown (for testing)
 */
export const resetWeatherAlertCooldown = async () => {
  try {
    await AsyncStorage.removeItem(LAST_WEATHER_ALERT_TIME);
    console.log('✅ Weather alert cooldown reset');
  } catch (error) {
    console.error('Error resetting weather alert cooldown:', error);
  }
};
/**
 * Send test weather alert to user
 * Used for testing the notification system
 */
export const sendTestWeatherAlert = async () => {
  try {
    console.log('🧪 Sending test weather alert...');
    await sendWeatherAlertNotification(
      'danger',
      'Heavy thunderstorm with high winds',
      'Severe thunderstorm warning'
    );
    console.log('✅ Test weather alert sent successfully');
  } catch (error) {
    console.error('❌ Error sending test alert:', error);
  }
};