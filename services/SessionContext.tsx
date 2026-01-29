import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { isActivityMonitoringActive, setAlertCallback, startActivityMonitoring, stopActivityMonitoring } from './ActivityMonitoringService';
import { startBackgroundActivityMonitoring, stopBackgroundActivityMonitoring } from './BackgroundActivityMonitoringService';
import { cleanupAppStateListener, getQueueStatus, isTrackingEnabled, processLocationQueue, startBackgroundLocationTracking, stopBackgroundLocationTracking } from './BackgroundLocationService';
import { checkBackgroundLocationStatus } from './DiagnosticsService';
import { initializeLocalNotifications, setupNotificationListeners } from './LocalNotificationService';
import { acquirePartialWakeLock, releaseWakeLock } from './WakeLockService';

interface User {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
}

interface SessionContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => Promise<void>;
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
            console.log('🔄 (Re)starting activity monitoring...');
            const activityMonStarted = await startActivityMonitoring();
            setIsActivityMonitoringActive(activityMonStarted);
            
            // Also start background activity monitoring for when app is minimized
            console.log('🔄 Starting background activity monitoring...');
            const bgMonStarted = await startBackgroundActivityMonitoring();
            console.log(`${bgMonStarted ? '✅' : '❌'} Background activity monitoring ${bgMonStarted ? 'active' : 'failed'}`);
            console.log('📊 NOTE: Foreground logs show impact detection while app is open');
            console.log('📊 In background, detection continues silently - notifications appear if fall detected');
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
          console.log('📱 Initializing local notifications...');
          try {
            await initializeLocalNotifications();
            console.log('✅ Local notifications initialized');
          } catch (notificationError) {
            console.warn('⚠️ Local notifications setup warning:', notificationError);
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
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('token', authToken);
      setUser(userData);
      setToken(authToken);

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
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Stop background tracking
      await stopBackgroundLocationTracking();
      setIsTrackingActive(false);
      
      // Stop activity monitoring (both foreground and background)
      await stopActivityMonitoring();
      await stopBackgroundActivityMonitoring();
      setIsActivityMonitoringActive(false);
      
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

  // Register global alert callback
  useEffect(() => {
    console.log('📢 Registering global alert callback in SessionContext');
    setAlertCallback((reason: string) => {
      console.log('📨 Global alert callback triggered with reason:', reason);
      setAlertReason(reason);
      setAlertVisible(true);
      console.log('✅ Alert state updated - isAlertVisible set to true');
    });
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
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
