import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import { Vibration } from 'react-native';
import { sendFallDetectedNotification } from './LocalNotificationService';
import { isNativeActivityMonitoringRunning, startNativeActivityMonitoring, stopNativeActivityMonitoring } from './NativeActivityMonitoringService';

// Background Activity Monitoring Task
const ACTIVITY_MONITORING_TASK = 'SAFENET_ACTIVITY_MONITORING';
const ACTIVITY_MONITORING_ENABLED = 'ACTIVITY_MONITORING_ENABLED';

let backgroundActivitySubscription: any = null;

// --- Define the background task for activity monitoring ---
const defineActivityMonitoringTask = () => {
  const isAlreadyDefined = TaskManager.isTaskDefined(ACTIVITY_MONITORING_TASK);
  
  if (isAlreadyDefined) {
    console.log('📊 Activity monitoring task already defined');
    return;
  }

  console.log('📝 Defining background activity monitoring task...');

  TaskManager.defineTask(ACTIVITY_MONITORING_TASK, async () => {
    try {
      console.log('📊 Background activity monitoring task triggered');
      
      // Get accelerometer data
      const accelData = await new Promise<{ x: number; y: number; z: number }>((resolve) => {
        const subscription = Accelerometer.addListener((data) => {
          subscription.remove();
          resolve(data);
        });
        
        // Timeout after 2 seconds
        setTimeout(() => {
          subscription.remove();
          resolve({ x: 0, y: 0, z: 0 });
        }, 2000);
      });

      const magnitude = Math.sqrt(accelData.x ** 2 + accelData.y ** 2 + accelData.z ** 2);
      
      // Check for fall (high impact)
      if (magnitude > 4.0) {
        console.log(`⚡ High impact detected in background: ${magnitude.toFixed(2)}G`);
        
        // Send alert notification
        await sendFallDetectedNotification('Fall detected! Emergency notification sent to guardians.');
        Vibration.vibrate([500, 500, 500]);
      }

      return TaskManager.Status.Ok;
    } catch (error) {
      console.error('❌ Error in activity monitoring task:', error);
      return TaskManager.Status.Failed;
    }
  });

  console.log('✅ Activity monitoring task registered');
};

// Initialize task
defineActivityMonitoringTask();

/**
 * Start background activity monitoring
 * PRIMARY METHOD: Uses native Android foreground service (works when app is closed)
 * FALLBACK: Expo Accelerometer listener (works only when app is open/minimized)
 */
export const startBackgroundActivityMonitoring = async () => {
  try {
    console.log('🚀 Starting background activity monitoring...');
    console.log('   📱 Using NATIVE Android foreground service - works even when app is closed');

    // Store state
    await AsyncStorage.setItem(ACTIVITY_MONITORING_ENABLED, 'true');

    // PRIMARY: Try to start native Android service (most reliable for background)
    const nativeStarted = await startNativeActivityMonitoring();
    
    if (nativeStarted) {
      console.log('✅ Native activity monitoring service started');
      console.log('   🔔 Fall detection will work when app is closed');
      console.log('   📊 Notifications will appear on lock screen if falls detected');
      return true;
    }

    // FALLBACK: If native module not available, use Expo Accelerometer
    console.log('⚠️  Native module not available, falling back to Expo Accelerometer');
    console.log('   ℹ️  Note: This only works when app is open or minimized');

    // Define task if not already defined
    const isTaskDefined = TaskManager.isTaskDefined(ACTIVITY_MONITORING_TASK);
    if (!isTaskDefined) {
      defineActivityMonitoringTask();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Accelerometer listener - runs even when app is minimized in Expo
    // This is a fallback for devices without the native module
    backgroundActivitySubscription = await Accelerometer.addListener(async (data) => {
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      
      // Detect sudden falls (high impact)
      if (magnitude > 4.0) {
        console.log(`⚡ [BACKGROUND] High impact: ${magnitude.toFixed(2)}G - Fall detected!`);
        await sendFallDetectedNotification('Fall detected! Emergency notification sent to guardians.');
        Vibration.vibrate([500, 500, 500]);
      }
    });

    console.log('✅ Fallback activity monitoring started (Accelerometer listener)');
    console.log('   ℹ️  This method only works when app is open/minimized');
    return true;
  } catch (error) {
    console.error('❌ Error starting background activity monitoring:', error);
    return false;
  }
};

/**
 * Stop background activity monitoring
 */
export const stopBackgroundActivityMonitoring = async () => {
  try {
    await AsyncStorage.setItem(ACTIVITY_MONITORING_ENABLED, 'false');

    // Stop native service
    await stopNativeActivityMonitoring();

    // Also stop Expo fallback
    if (backgroundActivitySubscription) {
      backgroundActivitySubscription.remove();
      backgroundActivitySubscription = null;
    }

    console.log('✅ Background activity monitoring stopped');
    return true;
  } catch (error) {
    console.error('❌ Error stopping background activity monitoring:', error);
    return false;
  }
};

/**
 * Check if background activity monitoring is enabled
 */
export const isBackgroundActivityMonitoringEnabled = async (): Promise<boolean> => {
  try {
    // Check native service first
    const nativeRunning = await isNativeActivityMonitoringRunning();
    if (nativeRunning) {
      return true;
    }

    // Fallback to stored state
    const enabled = await AsyncStorage.getItem(ACTIVITY_MONITORING_ENABLED);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};
