import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';

const BATTERY_MODE_KEY = 'BATTERY_SMART_MODE';
const AUTO_ENABLE_KEY = 'BATTERY_AUTO_ENABLE';
const LOW_BATTERY_THRESHOLD = 20; // Enable battery saving mode at 20% battery

interface BatteryOptimizationConfig {
  isEnabled: boolean;
  currentBatteryLevel: number;
  isLowBattery: boolean;
  isBatterySavingActive: boolean;
}

// Get battery optimization status
export const getBatteryOptimizationStatus = async (): Promise<BatteryOptimizationConfig> => {
  try {
    const isEnabled = await isBatteryModeEnabled();
    
    // Get actual battery level from device
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryPercentage = Math.round(batteryLevel * 100);
    const isLowBattery = batteryPercentage <= LOW_BATTERY_THRESHOLD;
    
    // Auto-enable battery mode if battery is low (always automatic, no toggle needed)
    if (isLowBattery && !isEnabled) {
      console.log(`🔋 Auto-enabling battery saver mode (battery at ${batteryPercentage}%)`);
      await enableBatteryMode();
    }
    
    // Apply battery saving when user has enabled Battery Smart Mode OR battery is low
    const isBatterySavingActive = isEnabled || isLowBattery;

    return {
      isEnabled,
      currentBatteryLevel: batteryPercentage,
      isLowBattery,
      isBatterySavingActive
    };
  } catch (error) {
    console.error('Error getting battery status:', error);
    return {
      isEnabled: false,
      currentBatteryLevel: 100,
      isLowBattery: false,
      isBatterySavingActive: false
    };
  }
};

// Enable battery smart mode
export const enableBatteryMode = async (): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(BATTERY_MODE_KEY, 'true');
    console.log('✅ Battery Smart Mode enabled');
    return true;
  } catch (error) {
    console.error('Error enabling battery mode:', error);
    return false;
  }
};

// Disable battery smart mode
export const disableBatteryMode = async (): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(BATTERY_MODE_KEY, 'false');
    console.log('✅ Battery Smart Mode disabled');
    return true;
  } catch (error) {
    console.error('Error disabling battery mode:', error);
    return false;
  }
};

// Check if battery mode is currently enabled
export const isBatteryModeEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(BATTERY_MODE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking battery mode:', error);
    return false;
  }
};

// Check if auto-enable is turned on
export const isAutoEnableEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(AUTO_ENABLE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking auto-enable:', error);
    return false;
  }
};

// Enable auto-enable feature
export const enableAutoEnable = async (): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(AUTO_ENABLE_KEY, 'true');
    console.log('✅ Battery auto-enable activated');
    return true;
  } catch (error) {
    console.error('Error enabling auto-enable:', error);
    return false;
  }
};

// Disable auto-enable feature
export const disableAutoEnable = async (): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(AUTO_ENABLE_KEY, 'false');
    console.log('✅ Battery auto-enable deactivated');
    return true;
  } catch (error) {
    console.error('Error disabling auto-enable:', error);
    return false;
  }
};

// Get optimized settings based on battery status
export const getOptimizedSettings = async () => {
  const status = await getBatteryOptimizationStatus();
  
  if (!status.isBatterySavingActive) {
    // Normal mode - all features enabled
    return {
      locationUpdateInterval: 5000, // 5 seconds
      locationAccuracy: 'high' as const,
      activityMonitoringInterval: 1000, // 1 second
      enableBackgroundWatcher: true,
      enableForegroundPolling: true,
      enableHeartbeat: true,
      maxQueueSize: 100,
      logLevel: 'verbose' as const
    };
  }

  // Battery saving mode - optimized for low battery
  console.log(`🔋 Battery Saving Mode Active (${status.currentBatteryLevel}%)`);
  return {
    locationUpdateInterval: 30000, // 30 seconds (6x slower)
    locationAccuracy: 'balanced' as const,
    activityMonitoringInterval: 5000, // 5 seconds (5x slower)
    enableBackgroundWatcher: true, // Keep critical features
    enableForegroundPolling: false, // Disable non-critical polling
    enableHeartbeat: false, // Disable non-critical checks
    maxQueueSize: 50, // Reduce queue size
    logLevel: 'minimal' as const
  };
};

// Monitor battery level changes
export const startBatteryMonitoring = async (
  onLowBattery?: () => void,
  onNormalBattery?: () => void
) => {
  try {
    const isEnabled = await isBatteryModeEnabled();
    if (!isEnabled) {
      console.log('⚡ Battery monitoring not enabled');
      return;
    }

    console.log('🔋 Battery Smart Mode enabled (native monitoring unavailable in Expo Go)');
    console.log('ℹ️ Battery optimizations will apply when device battery is actually low');
  } catch (error) {
    console.error('Error starting battery monitoring:', error);
  }
};

// Stop battery monitoring
export const stopBatteryMonitoring = () => {
  console.log('🔋 Battery monitoring stopped');
};

// Get battery info for display
export const getBatteryInfo = async () => {
  try {
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryPercentage = Math.round(batteryLevel * 100);
    const batteryState = await Battery.getBatteryStateAsync();
    const isLowBattery = batteryPercentage <= 20;
    
    // Determine icon based on battery level
    let icon: 'battery-full' | 'battery-half' | 'battery-low' | 'battery-empty';
    if (batteryPercentage >= 75) {
      icon = 'battery-full';
    } else if (batteryPercentage >= 50) {
      icon = 'battery-half';
    } else if (batteryPercentage >= 20) {
      icon = 'battery-low';
    } else {
      icon = 'battery-empty';
    }
    
    return {
      percentage: batteryPercentage,
      state: batteryState,
      isLowPowerMode: isLowBattery,
      isLowBattery: isLowBattery,
      icon
    };
  } catch (error) {
    console.error('Error getting battery info:', error);
    return {
      percentage: 100,
      state: 'Unknown' as const,
      isLowPowerMode: false,
      isLowBattery: false,
      icon: 'battery-full' as const
    };
  }
};

// Apply battery optimizations to location service
export const applyLocationOptimization = async () => {
  const settings = await getOptimizedSettings();
  return {
    timeInterval: settings.locationUpdateInterval,
    accuracy: settings.locationAccuracy === 'high' ? 'BestForNavigation' : 'Balanced',
    distanceInterval: settings.locationAccuracy === 'high' ? 1 : 10,
    enableBackgroundWatcher: settings.enableBackgroundWatcher,
    enableForegroundPolling: settings.enableForegroundPolling
  };
};

// Apply battery optimizations to activity monitoring
export const applyActivityOptimization = async () => {
  const settings = await getOptimizedSettings();
  return {
    updateInterval: settings.activityMonitoringInterval,
    sensitivity: settings.locationAccuracy === 'high' ? 'high' : 'low',
    enableContinuousMonitoring: settings.enableBackgroundWatcher
  };
};

export default {
  getBatteryOptimizationStatus,
  enableBatteryMode,
  disableBatteryMode,
  isBatteryModeEnabled,
  getOptimizedSettings,
  startBatteryMonitoring,
  stopBatteryMonitoring,
  getBatteryInfo,
  applyLocationOptimization,
  applyActivityOptimization
};
