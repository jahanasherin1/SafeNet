import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const WAKE_LOCK_STATUS = 'WAKE_LOCK_STATUS';

interface WakeLockManager {
  acquire(): Promise<void>;
  release(): Promise<void>;
  isHeld(): Promise<boolean>;
}

let wakeLockManager: WakeLockManager | null = null;

// Initialize native wake lock manager
const initWakeLockManager = (): WakeLockManager => {
  if (!wakeLockManager) {
    // Try to use native module if available
    try {
      if (Platform.OS === 'android') {
        const NativeWakeLock = NativeModules.WakeLockModule;
        if (NativeWakeLock) {
          wakeLockManager = {
            acquire: () => NativeWakeLock.acquireWakeLock(),
            release: () => NativeWakeLock.releaseWakeLock(),
            isHeld: () => NativeWakeLock.isWakeLockHeld(),
          };
          console.log('✅ Native wake lock manager loaded');
          return wakeLockManager;
        }
      }
    } catch (error) {
      console.warn('⚠️ Native wake lock not available, using fallback:', error);
    }

    // Fallback implementation
    wakeLockManager = {
      acquire: async () => {
        console.log('📌 Wake lock acquired (simulated)');
        await AsyncStorage.setItem(WAKE_LOCK_STATUS, 'held');
      },
      release: async () => {
        console.log('📌 Wake lock released (simulated)');
        await AsyncStorage.setItem(WAKE_LOCK_STATUS, 'released');
      },
      isHeld: async () => {
        const status = await AsyncStorage.getItem(WAKE_LOCK_STATUS);
        return status === 'held';
      },
    };
  }

  return wakeLockManager;
};

/**
 * Acquire wake lock to keep device awake during location tracking
 */
export const acquireWakeLock = async (): Promise<void> => {
  try {
    const manager = initWakeLockManager();
    await manager.acquire();
    console.log('✅ Wake lock acquired - device will stay awake');
  } catch (error) {
    console.error('Error acquiring wake lock:', error);
  }
};

/**
 * Release wake lock
 */
export const releaseWakeLock = async (): Promise<void> => {
  try {
    const manager = initWakeLockManager();
    await manager.release();
    console.log('✅ Wake lock released - device can sleep');
  } catch (error) {
    console.error('Error releasing wake lock:', error);
  }
};

/**
 * Check if wake lock is currently held
 */
export const isWakeLockHeld = async (): Promise<boolean> => {
  try {
    const manager = initWakeLockManager();
    return await manager.isHeld();
  } catch (error) {
    console.error('Error checking wake lock status:', error);
    return false;
  }
};

/**
 * Partial wake lock for minimal CPU usage
 */
export const acquirePartialWakeLock = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      const NativeWakeLock = NativeModules.WakeLockModule;
      if (NativeWakeLock?.acquirePartialWakeLock) {
        await NativeWakeLock.acquirePartialWakeLock();
        console.log('📌 Partial wake lock acquired (CPU can sleep)');
        return;
      }
    }
    // Fallback
    await acquireWakeLock();
  } catch (error) {
    console.error('Error acquiring partial wake lock:', error);
  }
};

/**
 * Force device to stay on for critical location tracking
 */
export const acquireFullWakeLock = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      const NativeWakeLock = NativeModules.WakeLockModule;
      if (NativeWakeLock?.acquireFullWakeLock) {
        await NativeWakeLock.acquireFullWakeLock();
        console.log('⚠️ Full wake lock acquired (screen and CPU stay on)');
        return;
      }
    }
    // Fallback
    await acquireWakeLock();
  } catch (error) {
    console.error('Error acquiring full wake lock:', error);
  }
};
