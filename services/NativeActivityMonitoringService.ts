import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const BACKGROUND_ACTIVITY_ENABLED = 'BACKGROUND_ACTIVITY_ENABLED';

// Try to get the native module
const ActivityMonitoringNative = Platform.OS === 'android' 
  ? NativeModules.ActivityMonitoring 
  : null;

/**
 * Start native background activity monitoring (Android foreground service)
 * This runs continuously even when the app is closed
 */
export const startNativeActivityMonitoring = async (): Promise<boolean> => {
  try {
    if (!ActivityMonitoringNative) {
      console.warn('⚠️ Native activity monitoring module not available');
      return false;
    }

    console.log('🚀 Starting native activity monitoring service...');
    await ActivityMonitoringNative.startActivityMonitoring();
    await AsyncStorage.setItem(BACKGROUND_ACTIVITY_ENABLED, 'true');
    
    console.log('✅ Native activity monitoring service started');
    console.log('📱 Service runs as Android foreground service');
    console.log('🔔 Fall detections will trigger notifications even when app is closed');
    return true;
  } catch (error) {
    console.error('❌ Error starting native activity monitoring:', error);
    return false;
  }
};

/**
 * Stop native background activity monitoring
 */
export const stopNativeActivityMonitoring = async (): Promise<boolean> => {
  try {
    if (!ActivityMonitoringNative) {
      console.warn('⚠️ Native activity monitoring module not available');
      return false;
    }

    console.log('🛑 Stopping native activity monitoring service...');
    await ActivityMonitoringNative.stopActivityMonitoring();
    await AsyncStorage.setItem(BACKGROUND_ACTIVITY_ENABLED, 'false');
    
    console.log('✅ Native activity monitoring service stopped');
    return true;
  } catch (error) {
    console.error('❌ Error stopping native activity monitoring:', error);
    return false;
  }
};

/**
 * Check if native activity monitoring is running
 */
export const isNativeActivityMonitoringRunning = async (): Promise<boolean> => {
  try {
    if (!ActivityMonitoringNative) {
      return false;
    }

    const isRunning = await ActivityMonitoringNative.isMonitoring();
    return isRunning;
  } catch (error) {
    console.error('❌ Error checking native activity monitoring status:', error);
    return false;
  }
};

/**
 * Get persisted state of activity monitoring
 */
export const isNativeActivityMonitoringEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(BACKGROUND_ACTIVITY_ENABLED);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};
