import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { NativeModules } from 'react-native';
import { isActivityMonitoringActive, setAlertCallback, setShakeAlertCallbackInActivityMonitor, startActivityMonitoring, stopActivityMonitoring } from './ActivityMonitoringService';
import { startBackgroundActivityMonitoring, stopBackgroundActivityMonitoring } from './BackgroundActivityMonitoringService';
import { cleanupAppStateListener, getQueueStatus, isTrackingEnabled, processLocationQueue, startBackgroundLocationTracking, stopBackgroundLocationTracking } from './BackgroundLocationService';
import { startWeatherMonitoring, stopWeatherMonitoring } from './BackgroundWeatherAlertService';
import { checkBackgroundLocationStatus } from './DiagnosticsService';
import { startJourneyMonitoring, stopJourneyMonitoring } from './JourneyArrivalService';
import { initializeLocalNotifications, setupNotificationListeners } from './LocalNotificationService';
import NativeStorageService from './NativeStorageService';
import { acquirePartialWakeLock, releaseWakeLock } from './WakeLockService';

interface User {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
}

export interface StoredWeatherAlert {
  id: string;
  level: 'caution' | 'warning' | 'danger';
  title: string;
  message: string;
  weatherCondition: string;
  hazards: string[];
  recommendations: string[];
  timestamp: number;
  isRead: boolean;
}

interface SessionContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
  isTrackingActive: boolean;
  queuedLocations: number;
  isActivityMonitoringActive: boolean;
  toggleActivityMonitoring: (enabled: boolean) => Promise<void>;
  alertReason: string | null;
  isAlertVisible: boolean;
  setAlertVisible: (visible: boolean) => void;
  dismissAlert: () => void;
  weatherAlertVisible: boolean;
  setWeatherAlertVisible: (visible: boolean) => void;
  enableWeatherAlerts: boolean;
  setEnableWeatherAlerts: (enabled: boolean) => Promise<void>;
  weatherAlerts: StoredWeatherAlert[];
  addWeatherAlert: (alert: StoredWeatherAlert) => Promise<void>;
  markWeatherAlertAsRead: (alertId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [queuedLocations, setQueuedLocations] = useState(0);
  const [isActivityMonitoringActiveState, setIsActivityMonitoringActive] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [alertReason, setAlertReason] = useState<string | null>(null);
  const [isAlertVisible, setAlertVisible] = useState(false);
  const [weatherAlertVisible, setWeatherAlertVisible] = useState(false);
  const [enableWeatherAlerts, setEnableWeatherAlertsState] = useState(false);
  const [weatherAlerts, setWeatherAlerts] = useState<StoredWeatherAlert[]>([]);

  const isLoggedIn = !!user && !!token;

  // Initialize session on app start
  useEffect(() => {
    // Prevent multiple initializations
    if (sessionInitialized) return;

    const initializeSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        const shouldBeTracking = await isTrackingEnabled();
        const activityMonEnabled = await isActivityMonitoringActive();

        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);

          // Sync user data to native file storage for SOS tile on every app start
          // This ensures the tile always has current user email even if app was killed
          console.log('📝 Syncing user data to native storage on app startup...');
          try {
            await NativeStorageService.syncUserDataToNative({
              email: parsedUser.email,
              name: parsedUser.name
            });
            console.log('✅ User data synced to native storage');
          } catch (syncError) {
            console.warn('⚠️ Failed to sync user data to native storage:', syncError);
          }

          // Always restart tracking for logged-in users to ensure it's working
          // This handles cases where the task was registered but not receiving updates
          console.log('🔄 (Re)starting background location tracking...');
          const trackingStarted = await startBackgroundLocationTracking();
          
          if (trackingStarted) {
            console.log('✅ Background tracking active');
            console.log('ℹ️  Location updates should be appearing every 5 seconds...');
            
            // Run diagnostics to verify everything is configured
            setTimeout(() => {
              console.log('\n🔍 Running background location diagnostics...');
              checkBackgroundLocationStatus();
            }, 2000);
            
            setIsTrackingActive(true);
          } else {
            console.warn('⚠️ Failed to start background tracking');
            setIsTrackingActive(false);
          }
          
          // Restart activity monitoring if it was enabled
          if (activityMonEnabled) {
            const activityMonStarted = await startActivityMonitoring();
            setIsActivityMonitoringActive(activityMonStarted);
            
            // Also start background activity monitoring for when app is minimized
            const bgMonStarted = await startBackgroundActivityMonitoring();
            if (bgMonStarted) {
              console.log('✅ Background monitoring active');
            }
          }
          
          // Acquire partial wake lock to keep tracking active
          await acquirePartialWakeLock();

          // Update queue status
          const queueStatus = await getQueueStatus();
          setQueuedLocations(queueStatus.count);

          // Process any queued locations
          if (queueStatus.count > 0) {
            setTimeout(() => processLocationQueue(), 5000);
          }

          // Initialize local notifications for alerts
          try {
            await initializeLocalNotifications();
            console.log('✅ Notifications ready');
          } catch (notificationError) {
            // Silently fail
          }

          // Start auto weather monitoring
          try {
            await startWeatherMonitoring();
            console.log('🌤️  Weather monitoring active');
          } catch (weatherError) {
            // Silently fail
          }
        }
        
        setSessionInitialized(true);
      } catch (error) {
        console.error('Error initializing session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();

    // Cleanup on unmount
    return () => {
      // Keep background tracking active even if context unmounts
      // Cleanup is handled elsewhere
    };
  }, []);

  // Periodically sync queued locations
  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = setInterval(async () => {
      try {
        const queueStatus = await getQueueStatus();
        setQueuedLocations(queueStatus.count);

        if (queueStatus.count > 0) {
          console.log(`📤 Syncing ${queueStatus.count} queued locations...`);
          await processLocationQueue();
        }
      } catch (error) {
        console.error('Error in queue sync interval:', error);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Setup notification listeners
  useEffect(() => {
    if (!isLoggedIn) return;

    console.log('🔔 Setting up notification listeners...');
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, [isLoggedIn]);

  const login = async (userData: User, authToken: string) => {
    try {
      console.log('🔐 Login initiated for:', userData.email);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('token', authToken);
      await AsyncStorage.setItem('userEmail', userData.email);
      await AsyncStorage.setItem('userName', userData.name);
      
      setUser(userData);
      setToken(authToken);

      // Sync user data to native SharedPreferences for Quick Settings tile
      console.log('📱 Syncing user data to native SharedPreferences...');
      await NativeStorageService.syncUserDataToNative({
        email: userData.email,
        name: userData.name
      });
      console.log('✅ User data sync completed');

      // Also broadcast user data to native code (including SOS tile)
      try {
        const { RCTDeviceEventEmitter } = NativeModules;
        if (RCTDeviceEventEmitter) {
          console.log('📢 Broadcasting user login to native code...');
          RCTDeviceEventEmitter.emit('USER_LOGIN', {
            email: userData.email,
            name: userData.name
          });
        }
      } catch (broadcastError) {
        console.warn('⚠️ Could not broadcast user login:', broadcastError);
      }

      // Start background location tracking
      const trackingStarted = await startBackgroundLocationTracking();
      if (trackingStarted) {
        setIsTrackingActive(true);
        console.log('✅ Background location tracking started on login');
        
        // Acquire partial wake lock
        await acquirePartialWakeLock();
      } else {
        console.warn('⚠️ Failed to start background location tracking');
      }

      // Process any queued locations
      setTimeout(() => processLocationQueue(), 5000);

      // Start auto weather monitoring
      console.log('🌤️  Starting auto weather monitoring...');
      try {
        await startWeatherMonitoring();
        console.log('✅ Weather monitoring started');
      } catch (weatherError) {
        console.warn('⚠️ Weather monitoring setup warning:', weatherError);
      }

      // Start journey arrival monitoring
      try {
        await startJourneyMonitoring();
        console.log('🚗 Journey arrival monitoring started');
      } catch (journeyError) {
        console.warn('⚠️ Journey monitoring setup warning:', journeyError);
      }
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  };

  const updateUser = async (userData: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const logout = async () => {
    try {
      // Clear user data from native SharedPreferences
      await NativeStorageService.clearNativeUserData();

      // Stop background tracking
      await stopBackgroundLocationTracking();
      setIsTrackingActive(false);
      
      // Stop activity monitoring (both foreground and background)
      await stopActivityMonitoring();
      await stopBackgroundActivityMonitoring();
      setIsActivityMonitoringActive(false);

      // Stop weather monitoring
      stopWeatherMonitoring();
      
      // Stop journey arrival monitoring
      stopJourneyMonitoring();
      
      // Release wake lock
      await releaseWakeLock();
      
      // Clean up app state listener
      cleanupAppStateListener();

      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      setUser(null);
      setToken(null);
      
      console.log('✅ Session cleared and background tracking stopped');
    } catch (error) {
      console.error('Error clearing session:', error);
      throw error;
    }
  };

  const toggleActivityMonitoring = async (enabled: boolean) => {
    try {
      if (enabled) {
        const started = await startActivityMonitoring();
        setIsActivityMonitoringActive(started);
        if (started) {
          console.log('✅ Activity monitoring started');
          // Also start background activity monitoring
          await startBackgroundActivityMonitoring();
          console.log('✅ Background activity monitoring started');
        }
      } else {
        await stopActivityMonitoring();
        await stopBackgroundActivityMonitoring();
        setIsActivityMonitoringActive(false);
        console.log('✅ Activity monitoring stopped');
      }
    } catch (error) {
      console.error('Error toggling activity monitoring:', error);
      throw error;
    }
  };

  const dismissAlert = () => {
    setAlertVisible(false);
    setAlertReason(null);
  };

  const setEnableWeatherAlerts = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('enableWeatherAlerts', enabled.toString());
      setEnableWeatherAlertsState(enabled);
      console.log(`⛈️ Weather alerts ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error saving weather alerts preference:', error);
      throw error;
    }
  };

  // Load weather alerts preference on startup
  useEffect(() => {
    const loadWeatherAlertsPreference = async () => {
      try {
        const enabled = await AsyncStorage.getItem('enableWeatherAlerts');
        setEnableWeatherAlertsState(enabled === 'true');
      } catch (error) {
        console.warn('Error loading weather alerts preference:', error);
      }
    };

    loadWeatherAlertsPreference();
  }, []);

  // Weather alerts management
  const addWeatherAlert = async (alert: StoredWeatherAlert) => {
    try {
      // Check if a similar alert was already sent recently (5 minute cooldown)
      const recentAlert = weatherAlerts.find(a => {
        const timeDiff = Date.now() - a.timestamp;
        return timeDiff < 5 * 60 * 1000 && // Within 5 minutes
               a.level === alert.level && // Same safety level
               a.weatherCondition === alert.weatherCondition; // Same weather condition
      });

      if (recentAlert) {
        console.log('⏳ Similar weather alert already sent recently, skipping duplicate');
        return;
      }

      const updatedAlerts = [alert, ...weatherAlerts].slice(0, 50); // Keep last 50 alerts
      setWeatherAlerts(updatedAlerts);
      await AsyncStorage.setItem('weatherAlerts', JSON.stringify(updatedAlerts));
      console.log('☁️ Weather alert added and stored');
    } catch (error) {
      console.error('Error adding weather alert:', error);
    }
  };

  const markWeatherAlertAsRead = async (alertId: string) => {
    try {
      const updatedAlerts = weatherAlerts.map(alert =>
        alert.id === alertId ? { ...alert, isRead: true } : alert
      );
      setWeatherAlerts(updatedAlerts);
      await AsyncStorage.setItem('weatherAlerts', JSON.stringify(updatedAlerts));
      console.log('☁️ Weather alert marked as read');
    } catch (error) {
      console.error('Error marking weather alert as read:', error);
    }
  };

  // Load weather alerts from storage
  useEffect(() => {
    const loadWeatherAlerts = async () => {
      try {
        const storedAlerts = await AsyncStorage.getItem('weatherAlerts');
        if (storedAlerts) {
          setWeatherAlerts(JSON.parse(storedAlerts));
        }
      } catch (error) {
        console.error('Error loading weather alerts:', error);
      }
    };

    loadWeatherAlerts();
  }, []);

  // Register global alert callbacks
  useEffect(() => {
    console.log('📢 Registering global alert callback in SessionContext');
    setAlertCallback((reason: string) => {
      console.log('📨 Global alert callback triggered with reason:', reason);
      setAlertReason(reason);
      setAlertVisible(true);
      console.log('✅ Alert state updated - isAlertVisible set to true');
    });

    // Register shake detection alert callback with activity monitoring service
    console.log('📢 Registering shake detection alert callback');
    setShakeAlertCallbackInActivityMonitor((reason: string) => {
      console.log('📨 Shake alert callback triggered with reason:', reason);
      setAlertReason(reason);
      setAlertVisible(true);
      console.log('✅ Shake SOS alert state updated - isAlertVisible set to true');
    });
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        updateUser,
        logout,
        isLoggedIn,
        isTrackingActive,
        queuedLocations,
        isActivityMonitoringActive: isActivityMonitoringActiveState,
        toggleActivityMonitoring,
        alertReason,
        isAlertVisible,
        setAlertVisible,
        dismissAlert,
        weatherAlertVisible,
        setWeatherAlertVisible,
        enableWeatherAlerts,
        setEnableWeatherAlerts,
        weatherAlerts,
        addWeatherAlert,
        markWeatherAlertAsRead,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};
