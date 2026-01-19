import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { cleanupAppStateListener, getQueueStatus, isBackgroundTrackingActive, isTrackingEnabled, processLocationQueue, startBackgroundLocationTracking, stopBackgroundLocationTracking } from './BackgroundLocationService';
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
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [queuedLocations, setQueuedLocations] = useState(0);

  const isLoggedIn = !!user && !!token;

  // Initialize session on app start
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        const shouldBeTracking = await isTrackingEnabled();

        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);

          // Check if tracking should be active
          const isTracking = await isBackgroundTrackingActive();
          
          if (shouldBeTracking && !isTracking) {
            // Restart tracking if it should be active but isn't
            console.log('🔄 Restoring background location tracking...');
            await startBackgroundLocationTracking();
          } else if (shouldBeTracking) {
            console.log('✅ Background tracking already active');
          } else {
            // Start tracking by default for logged-in users
            await startBackgroundLocationTracking();
          }
          
          setIsTrackingActive(true);
          
          // Acquire partial wake lock to keep tracking active
          await acquirePartialWakeLock();

          // Update queue status
          const queueStatus = await getQueueStatus();
          setQueuedLocations(queueStatus.count);

          // Process any queued locations
          if (queueStatus.count > 0) {
            setTimeout(() => processLocationQueue(), 5000);
          }

          console.log('✅ Session restored and background tracking started');
        }
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
