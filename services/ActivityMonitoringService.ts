import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Accelerometer, Pedometer } from 'expo-sensors';
import { Vibration } from 'react-native';
import api from './api';

// --- CONFIGURATION ---
const PRE_ALERT_TIMER = 15;
const RUNNING_ALERT_DELAY = 30;
const SUDDEN_STOP_COOLDOWN = 30;
const ACCEL_UPDATE_INTERVAL = 100;

// Fall Detection Thresholds
const FALL_IMPACT_THRESHOLD = 4.0;
const FALL_STILLNESS_THRESHOLD = 0.3;
const FALL_DETECTION_WINDOW = 2000;

// Running Detection Thresholds
const RUNNING_VARIANCE_THRESHOLD = 0.8;
const WALKING_VARIANCE_THRESHOLD = 0.15;
const STILL_VARIANCE_THRESHOLD = 0.05;

// Sudden Stop Thresholds
const SUDDEN_STOP_VARIANCE_DROP = 0.6;
const SUDDEN_STOP_MIN_RUNNING_VARIANCE = 0.8;

const ACTIVITY_HISTORY_SIZE = 30;
const RUNNING_CONFIRMATION_TIME = 3000;

let monitoringActive = false;
let accelSubscription: any = null;
let pedometerSubscription: any = null;
let activityCheckInterval: NodeJS.Timeout | null = null;

// Tracking state
let accelHistory: { magnitude: number; timestamp: number }[] = [];
let varianceHistory: { variance: number; timestamp: number }[] = [];
let isRunning = false;
let runningStartTime: number | null = null;
let baselineStepCount = 0;
let isFirstStepUpdate = true;
let lastSuddenStopAlert = 0;
let lastActivity = 'Still';
let potentialFallTime: number | null = null;
let potentialFallImpact = 0;

// Callback for UI updates
let onActivityUpdate: ((activity: string, stepCount: number) => void) | null = null;
let onAlertTriggered: ((reason: string) => void) | null = null;

export const setActivityUpdateCallback = (callback: (activity: string, stepCount: number) => void) => {
  onActivityUpdate = callback;
};

export const setAlertCallback = (callback: (reason: string) => void) => {
  onAlertTriggered = callback;
};

const calculateVariance = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
};

const analyzeMotion = ({ x, y, z }: { x: number; y: number; z: number }) => {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const now = Date.now();

  accelHistory.push({ magnitude, timestamp: now });
  if (accelHistory.length > ACTIVITY_HISTORY_SIZE) {
    accelHistory.shift();
  }

  if (accelHistory.length < 10) return;

  const recentMagnitudes = accelHistory.slice(-15).map(h => h.magnitude);
  const currentVariance = calculateVariance(recentMagnitudes);

  varianceHistory.push({ variance: currentVariance, timestamp: now });
  if (varianceHistory.length > 20) {
    varianceHistory.shift();
  }

  // --- 1. FALL DETECTION ---
  if (magnitude > FALL_IMPACT_THRESHOLD) {
    if (potentialFallTime === null) {
      potentialFallTime = now;
      potentialFallImpact = magnitude;
      console.log(`⚡ High impact: ${magnitude.toFixed(2)}G - monitoring for fall...`);
    }
  }

  if (potentialFallTime !== null) {
    const timeSinceImpact = now - potentialFallTime;

    if (timeSinceImpact > 500 && timeSinceImpact < FALL_DETECTION_WINDOW) {
      if (currentVariance < FALL_STILLNESS_THRESHOLD) {
        console.log(
          `🔴 FALL CONFIRMED: Impact ${potentialFallImpact.toFixed(2)}G followed by stillness (var: ${currentVariance.toFixed(3)})`
        );
        potentialFallTime = null;
        potentialFallImpact = 0;
        triggerAlert('FALL DETECTED');
        return;
      }
    } else if (timeSinceImpact >= FALL_DETECTION_WINDOW) {
      console.log(`✅ Impact was activity, not fall (variance: ${currentVariance.toFixed(2)})`);
      potentialFallTime = null;
      potentialFallImpact = 0;
    }
  }

  // --- 2. ACTIVITY DETECTION (Running vs Walking) ---
  const previousActivity = lastActivity;

  if (currentVariance > RUNNING_VARIANCE_THRESHOLD) {
    // HIGH VARIANCE = RUNNING
    if (!isRunning) {
      if (runningStartTime === null) {
        runningStartTime = now;
      } else if (now - runningStartTime > RUNNING_CONFIRMATION_TIME) {
        isRunning = true;
        console.log('🏃 RUNNING detected (sustained high variance)');
      }
    }

    if (isRunning) {
      updateActivity('Running 🏃‍♂️');

      // Check for prolonged running alert
      const runningDuration = (now - (runningStartTime || now)) / 1000;
      if (runningDuration >= RUNNING_ALERT_DELAY) {
        console.log(`⚠️ Prolonged running: ${runningDuration.toFixed(0)}s`);
        triggerAlert('PROLONGED RUNNING DETECTED');
      }
    } else {
      updateActivity('Fast Movement 🚶‍♂️💨');
    }
  } else if (currentVariance > WALKING_VARIANCE_THRESHOLD) {
    // MEDIUM VARIANCE = WALKING
    updateActivity('Walking 🚶');

    // === 3. SUDDEN STOP DETECTION ===
    if (isRunning || previousActivity === 'Running') {
      const timeSinceLastSuddenStop = (now - lastSuddenStopAlert) / 1000;
      if (timeSinceLastSuddenStop > SUDDEN_STOP_COOLDOWN) {
        const recentVariances = varianceHistory.slice(-5).map(v => v.variance);
        const olderVariances = varianceHistory.slice(-15, -5).map(v => v.variance);

        if (olderVariances.length >= 3 && recentVariances.length >= 3) {
          const oldAvg = olderVariances.reduce((a, b) => a + b, 0) / olderVariances.length;
          const newAvg = recentVariances.reduce((a, b) => a + b, 0) / recentVariances.length;
          const drop = oldAvg - newAvg;

          if (drop > SUDDEN_STOP_VARIANCE_DROP && oldAvg > SUDDEN_STOP_MIN_RUNNING_VARIANCE) {
            console.log(`⚠️ SUDDEN STOP: Variance dropped ${oldAvg.toFixed(2)} → ${newAvg.toFixed(2)}`);
            triggerAlert('SUDDEN STOP DETECTED');
            lastSuddenStopAlert = now;
          }
        }
      }
    }

    isRunning = false;
    runningStartTime = null;
  } else {
    // LOW VARIANCE = STANDING STILL
    if (lastActivity !== 'Still') {
      updateActivity('Standing Still 🧍');

      // Check for sudden stop from running
      if (isRunning || previousActivity === 'Running') {
        const timeSinceLastSuddenStop = (now - lastSuddenStopAlert) / 1000;
        if (timeSinceLastSuddenStop > SUDDEN_STOP_COOLDOWN) {
          console.log('⚠️ SUDDEN STOP: Running → Still');
          triggerAlert('SUDDEN STOP DETECTED');
          lastSuddenStopAlert = now;
        }
      }

      lastActivity = 'Still';
    }

    isRunning = false;
    runningStartTime = null;
  }
};

const checkActivityTimeout = () => {
  const now = Date.now();

  if (varianceHistory.length > 0) {
    const lastEntry = varianceHistory[varianceHistory.length - 1];
    const timeSinceLastUpdate = now - lastEntry.timestamp;

    if (timeSinceLastUpdate > 3000 || lastEntry.variance < STILL_VARIANCE_THRESHOLD) {
      if (monitoringActive && lastActivity !== 'Still') {
        updateActivity('Standing Still 🧍');

        if (isRunning) {
          const timeSinceLastSuddenStop = (now - lastSuddenStopAlert) / 1000;
          if (timeSinceLastSuddenStop > SUDDEN_STOP_COOLDOWN) {
            console.log('⚠️ SUDDEN STOP detected via timeout');
            triggerAlert('SUDDEN STOP DETECTED');
            lastSuddenStopAlert = now;
          }
        }

        lastActivity = 'Still';
      }
    }
  }
};

const updateActivity = (activity: string) => {
  lastActivity = activity;
  if (onActivityUpdate) {
    onActivityUpdate(activity, 0);
  }
};

const triggerAlert = async (reason: string) => {
  console.log(`🚨 Activity Alert Triggered: ${reason}`);
  Vibration.vibrate([500, 500, 500]);

  try {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      console.error('User session not found');
      return;
    }
    const { email, name } = JSON.parse(userData);

    // Get Location for context
    let location = { latitude: 0, longitude: 0 };
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch (e) {
      console.log('⚠️ Could not get location for alert');
    }

    // Send activity alert to backend
    await api.post('/sos/trigger', {
      userEmail: email,
      userName: name || 'User',
      location: location,
      reason: reason,
      alertType: 'ACTIVITY_MONITOR',
      sendPushNotification: true,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Activity alert sent successfully');

    if (onAlertTriggered) {
      onAlertTriggered(reason);
    }
  } catch (error) {
    console.error('❌ Failed to send activity alert:', error);
  }
};

export const startActivityMonitoring = async () => {
  if (monitoringActive) {
    console.log('ℹ️  Activity monitoring already active');
    return true;
  }

  try {
    // Request permissions
    const { status } = await Pedometer.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('⚠️ Pedometer permission denied');
      return false;
    }

    monitoringActive = true;
    console.log('🚀 Starting activity monitoring...');

    // Reset state
    accelHistory = [];
    varianceHistory = [];
    isRunning = false;
    runningStartTime = null;
    baselineStepCount = 0;
    isFirstStepUpdate = true;
    lastSuddenStopAlert = 0;
    lastActivity = 'Still';
    potentialFallTime = null;
    potentialFallImpact = 0;

    // 1. ACCELEROMETER
    Accelerometer.setUpdateInterval(ACCEL_UPDATE_INTERVAL);
    accelSubscription = Accelerometer.addListener((data: any) => {
      analyzeMotion(data);
    });

    // 2. PEDOMETER
    pedometerSubscription = Pedometer.watchStepCount((result: any) => {
      if (isFirstStepUpdate) {
        baselineStepCount = result.steps;
        isFirstStepUpdate = false;
        return;
      }
      const relativeSteps = result.steps - baselineStepCount;
      if (onActivityUpdate) {
        onActivityUpdate(lastActivity, relativeSteps);
      }
    });

    // 3. ACTIVITY CHECK INTERVAL
    activityCheckInterval = setInterval(() => {
      checkActivityTimeout();
    }, 2000);

    updateActivity('Monitoring Activity...');
    await AsyncStorage.setItem('activityMonitoringEnabled', 'true');

    return true;
  } catch (error) {
    console.error('⚠️ Error starting activity monitoring:', error);
    monitoringActive = false;
    return false;
  }
};

export const stopActivityMonitoring = async () => {
  monitoringActive = false;
  console.log('🛑 Stopping activity monitoring...');

  if (accelSubscription) {
    try {
      accelSubscription.remove();
    } catch (e) {
      console.log('Cleanup:', e);
    }
  }

  if (pedometerSubscription) {
    try {
      pedometerSubscription.remove();
    } catch (e) {
      console.log('Pedometer cleanup:', e);
    }
  }

  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
    activityCheckInterval = null;
  }

  updateActivity('Stopped');
  await AsyncStorage.setItem('activityMonitoringEnabled', 'false');
};

export const isActivityMonitoringActive = async (): Promise<boolean> => {
  if (monitoringActive) return true;

  try {
    const stored = await AsyncStorage.getItem('activityMonitoringEnabled');
    return stored === 'true';
  } catch {
    return false;
  }
};
