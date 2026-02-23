import { Accelerometer } from 'expo-sensors';

interface ShakeConfig {
  shakeThreshold: number; // Acceleration magnitude threshold
  timeWindow: number; // Time window in ms to detect shakes
  minShakesRequired: number; // Number of shakes needed to trigger alert
}

// Global alert callback for triggering SOS
let onAlertTriggeredFromShake: ((reason: string) => void) | null = null;

export const setShakeAlertCallback = (callback: (reason: string) => void) => {
  onAlertTriggeredFromShake = callback;
  console.log('📢 Registered shake alert callback');
};

class ShakeDetectionService {
  private static instance: ShakeDetectionService;
  private isInitialized = false;
  private isListening = false;
  private shakeCount = 0;
  private lastShakeTime = 0;
  private subscription: any = null;

  private config: ShakeConfig = {
    shakeThreshold: 25, // m/s² - Adjust based on testing
    timeWindow: 500, // 500ms window for detecting shakes
    minShakesRequired: 3, // 3 shakes to trigger SOS
  };

  private lastAcceleration = { x: 0, y: 0, z: 0 };

  private constructor() {}

  static getInstance(): ShakeDetectionService {
    if (!ShakeDetectionService.instance) {
      ShakeDetectionService.instance = new ShakeDetectionService();
    }
    return ShakeDetectionService.instance;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('🤝 Shake detection already initialized');
      return;
    }

    try {
      // Set accelerometer update interval
      await Accelerometer.setUpdateInterval(100); // 100ms update rate for responsiveness

      console.log('✅ Shake detection initialized');
      this.isInitialized = true;
      this.startListening();
    } catch (error) {
      console.error('❌ Error initializing shake detection:', error);
    }
  }

  private startListening() {
    if (this.isListening) {
      console.log('⚠️ Already listening to accelerometer');
      return;
    }

    try {
      this.subscription = Accelerometer.addListener((data) => {
        this.handleAccelerometerData(data);
      });

      this.isListening = true;
      console.log('📡 Started listening to accelerometer for shake detection');
    } catch (error) {
      console.error('❌ Error starting accelerometer listener:', error);
    }
  }

  private handleAccelerometerData(data: { x: number; y: number; z: number }) {
    const { x, y, z } = data;

    // Calculate the magnitude of acceleration change
    const deltaX = Math.abs(x - this.lastAcceleration.x);
    const deltaY = Math.abs(y - this.lastAcceleration.y);
    const deltaZ = Math.abs(z - this.lastAcceleration.z);

    const accelerationMagnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

    // Update last acceleration values
    this.lastAcceleration = { x, y, z };

    const currentTime = Date.now();

    // Check if this is a shake event
    if (accelerationMagnitude > this.config.shakeThreshold) {
      const timeSinceLastShake = currentTime - this.lastShakeTime;

      // If within time window, increment shake count
      if (timeSinceLastShake < this.config.timeWindow) {
        this.shakeCount++;
        console.log(`🤳 Shake detected! Count: ${this.shakeCount}/${this.config.minShakesRequired}`);

        // Check if we've reached the required number of shakes
        if (this.shakeCount >= this.config.minShakesRequired) {
          this.triggerSOS();
        }
      } else {
        // Reset counter if outside time window
        this.shakeCount = 1;
      }

      this.lastShakeTime = currentTime;
    }
  }

  private triggerSOS() {
    console.log('🚨 Multiple shakes detected! Triggering emergency SOS...');

    // Reset shake counter immediately
    this.shakeCount = 0;

    // Trigger alert through registered callback
    if (onAlertTriggeredFromShake) {
      onAlertTriggeredFromShake('Shake Detected - Emergency SOS Triggered');
      console.log('✅ SOS alert triggered from shake detection');
    } else {
      console.warn('⚠️ No alert callback registered for shake detection. Call setShakeAlertCallback first.');
    }
  }

  stopListening() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
      this.isListening = false;
      console.log('🛑 Stopped listening to accelerometer');
    }
  }

  destroy() {
    this.stopListening();
    this.isInitialized = false;
    this.shakeCount = 0;
  }

  // Allow external configuration of shake detection sensitivity
  setConfig(newConfig: Partial<ShakeConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Shake detection config updated:', this.config);
  }

  getConfig(): ShakeConfig {
    return { ...this.config };
  }
}

export default ShakeDetectionService;
