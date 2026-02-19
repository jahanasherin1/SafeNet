import * as Location from 'expo-location';
import { NativeEventEmitter, NativeModules } from 'react-native';
import api from './api';

const { RCTDeviceEventEmitter } = NativeModules;

/**
 * Service to handle SOS Quick Settings Tile events
 * Listens for broadcasts from the Quick Settings tile and triggers SOS
 */
export class SOSTileService {
  private static instance: SOSTileService;
  private eventEmitter: NativeEventEmitter | null = null;
  private subscription: any = null;
  private sosCallback: ((data: any) => void) | null = null;

  private constructor() {
    this.setupEventListener();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SOSTileService {
    if (!SOSTileService.instance) {
      SOSTileService.instance = new SOSTileService();
    }
    return SOSTileService.instance;
  }

  /**
   * Setup the event listener for SOS tile presses
   */
  private setupEventListener() {
    try {
      // Listen for the SOS Tile Pressed event from native side
      const deviceEventEmitter = new NativeEventEmitter();
      this.eventEmitter = deviceEventEmitter;

      this.subscription = deviceEventEmitter.addListener(
        'SOS_TILE_PRESSED',
        (data: any) => {
          console.log('🚨 SOS Tile Event Received:', data);
          if (this.sosCallback) {
            this.sosCallback(data);
          }
          // Automatically trigger SOS
          this.triggerSOS();
        }
      );

      console.log('✅ SOS Tile listener registered successfully');
    } catch (error) {
      console.error('❌ Error setting up SOS Tile listener:', error);
    }
  }

  /**
   * Set callback to be called when SOS tile is pressed
   */
  setSOSCallback(callback: (data: any) => void) {
    this.sosCallback = callback;
  }

  /**
   * Trigger SOS from Quick Settings tile
   */
  private async triggerSOS() {
    try {
      console.log('📤 Triggering SOS from Quick Settings tile...');

      // Get user email from AsyncStorage (you might need to import AsyncStorage)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const email = await AsyncStorage.getItem('userEmail');
      const name = await AsyncStorage.getItem('userName');

      if (!email) {
        console.error('❌ No user email found');
        return;
      }

      // Get location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          console.log('📍 Location obtained:', location);
        }
      } catch (error) {
        console.warn('⚠️ Could not get location:', error);
      }

      // Send SOS alert to backend
      const alertPayload = {
        userEmail: email,
        userName: name || 'User',
        location: location || { latitude: 0, longitude: 0 },
        reason: 'SOS triggered from Quick Settings tile',
        alertType: 'TILE_SOS',
        sendPushNotification: true,
        timestamp: new Date().toISOString(),
      };

      console.log('📤 Sending alert to backend with data:', alertPayload);

      try {
        const response = await api.post('/sos/trigger', alertPayload);
        console.log('✅ SOS alert sent successfully');
        console.log('📊 Response status:', response.status);
      } catch (error: any) {
        console.error('❌ Error sending SOS alert:', error.message);
        // Retry logic
        if (error.response?.status === 500) {
          console.log('🔄 Retrying SOS alert...');
          try {
            await api.post('/sos/trigger', alertPayload);
            console.log('✅ SOS alert sent on retry');
          } catch (retryError) {
            console.error('❌ SOS alert failed on retry:', retryError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error triggering SOS:', error);
    }
  }

  /**
   * Destroy the service and clean up listeners
   */
  destroy() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    console.log('✅ SOS Tile Service destroyed');
  }
}

export default SOSTileService;
