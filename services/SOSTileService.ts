import AsyncStorage from '@react-native-async-storage/async-storage';
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

      console.log('🔔 Setting up SOS Tile Event Emitter listener...');

      this.subscription = deviceEventEmitter.addListener(
        'SOS_TILE_PRESSED',
        (data: any) => {
          console.log('🚨 [SOS TILE] Event Received:', data);
          console.log('⏰ Event timestamp:', new Date().toISOString());
          if (this.sosCallback) {
            console.log('📞 Calling SOS callback...');
            this.sosCallback(data);
          }
          // Automatically trigger SOS
          console.log('📤 Calling triggerSOS()...');
          this.triggerSOS();
        }
      );

      console.log('✅ SOS Tile listener registered successfully for event: SOS_TILE_PRESSED');
    } catch (error) {
      console.error('❌ Error setting up SOS Tile listener:', error);
      console.error('Error stack:', (error as any).stack);
    }
  }

  /**
   * Set callback to be called when SOS tile is pressed
   */
  setSOSCallback(callback: (data: any) => void) {
    this.sosCallback = callback;
  }

  /**
   * ✅ Trigger SOS from Quick Settings tile
   * Integrated with SessionContext for consistent cancel button behavior across all alert types
   */
  private async triggerSOS() {
    try {
      console.log('🚨 [TILE SOS] Triggering SOS from Quick Settings tile...');
      console.log('⏰ Current time:', new Date().toISOString());

      const email = await AsyncStorage.getItem('userEmail');
      const name = await AsyncStorage.getItem('userName');

      console.log('👤 User email:', email);
      console.log('👤 User name:', name);

      if (!email) {
        console.error('❌ [TILE SOS] No user email found in AsyncStorage');
        return;
      }

      // ✅ Store lastSosTime immediately (cancel button appears like other alerts)
      const sosTime = new Date().toISOString();
      await AsyncStorage.setItem('lastSosTime', sosTime);
      await AsyncStorage.setItem('lastAlertType', 'TILE_SOS');
      console.log('✅ [TILE SOS] lastSosTime stored for cancel button:', sosTime);

      // Get location
      let location = null;
      try {
        console.log('📍 [TILE SOS] Requesting location permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('📍 [TILE SOS] Location permission status:', status);
        
        if (status === 'granted') {
          console.log('📍 [TILE SOS] Getting current position...');
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          console.log('✅ [TILE SOS] Location obtained:', location);
        } else {
          console.warn('⚠️ [TILE SOS] Location permission not granted');
        }
      } catch (error) {
        console.warn('⚠️ [TILE SOS] Could not get location:', error);
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

      console.log('📦 [TILE SOS] Alert payload prepared:', JSON.stringify(alertPayload, null, 2));
      console.log('🔗 [TILE SOS] Sending to backend at:', api.defaults.baseURL);

      try {
        console.log('📤 [TILE SOS] Making POST request to /sos/trigger...');
        const response = await api.post('/sos/trigger', alertPayload);
        
        console.log('✅ [TILE SOS] Alert sent successfully to backend');
        console.log('📊 [TILE SOS] Response status:', response.status);
        console.log('📊 [TILE SOS] Response data:', response.data);
        console.log('📨 [TILE SOS] Guardians have been notified with location');
      } catch (error: any) {
        console.error('❌ [TILE SOS] Error sending to backend:', error.message);
        console.error('❌ [TILE SOS] Error response:', error.response?.data);
        console.error('❌ [TILE SOS] But cancel button will still work', { sosTime });
        
        // Retry logic for 500 errors
        if (error.response?.status === 500) {
          console.log('🔄 [TILE SOS] Retrying alert...');
          try {
            const retryResponse = await api.post('/sos/trigger', alertPayload);
            console.log('✅ [TILE SOS] Alert sent on retry');
            console.log('📊 [TILE SOS] Retry response:', retryResponse.data);
          } catch (retryError: any) {
            console.error('❌ [TILE SOS] Retry failed:', retryError.message);
            console.error('⚠️ [TILE SOS] Cancel button functional regardless');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ [TILE SOS] Unexpected error in triggerSOS:', error);
      console.error('❌ [TILE SOS] Error message:', error.message);
      console.error('❌ [TILE SOS] Error stack:', error.stack);
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
