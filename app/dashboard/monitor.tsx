import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Accelerometer, Pedometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

// --- CONFIGURATION ---
const FALL_THRESHOLD = 2.5; // G-force
const RUNNING_CADENCE = 2.5; // Steps per second (approx 150 steps/min)
const SUDDEN_STOP_THRESHOLD = 2.0; // Deceleration G-force
const PRE_ALERT_TIMER = 15; // Time to cancel alert

export default function ActivityMonitorScreen() {
  const router = useRouter();
  
  // State
  const [monitoring, setMonitoring] = useState(false);
  const [currentActivity, setCurrentActivity] = useState('Still');
  const [stepCount, setStepCount] = useState(0);
  const [lastStepTime, setLastStepTime] = useState(Date.now());
  const [sensorsAvailable, setSensorsAvailable] = useState(true);
  
  // Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertReason, setAlertReason] = useState('');
  const [countdown, setCountdown] = useState(PRE_ALERT_TIMER);
  const [sendingAlert, setSendingAlert] = useState(false);

  // Refs for subscriptions & logic
  const accelSubscription = useRef<any>(null);
  const pedometerSubscription = useRef<any>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Tracking history for logic
  const recentGForces = useRef<number[]>([]);
  const wasRunning = useRef(false);

  // --- START / STOP LOGIC ---
  const toggleMonitoring = async () => {
    if (monitoring) {
      stopMonitoring();
    } else {
      if (!sensorsAvailable) {
        Alert.alert("Permission Required", "Activity permission is required to use fall detection. Please enable it in settings.");
        return;
      }
      startMonitoring();
    }
  };

  const startMonitoring = () => {
    setMonitoring(true);
    setAlertVisible(false);
    setCurrentActivity('Monitoring...');
    wasRunning.current = false;

    // 1. ACCELEROMETER (Fall & Sudden Stop)
    try {
      Accelerometer.setUpdateInterval(100); // Fast updates (10 per sec)
      accelSubscription.current = Accelerometer.addListener((data: any) => {
          analyzeMotion(data);
      });
    } catch (e) {
      console.log('⚠️ Accelerometer initialization failed:', e);
      setCurrentActivity('Fall Detection Not Available');
      return;
    }

    // 2. PEDOMETER (Running & Walking)
    try {
      pedometerSubscription.current = Pedometer.watchStepCount((result: any) => {
          analyzeSteps(result.steps);
      });
      setCurrentActivity('Monitoring Activity...');
    } catch (e) {
      console.log('⚠️ Pedometer initialization failed:', e);
      setCurrentActivity('Fall Detection Active (Accelerometer Only)');
    }
  };

  const stopMonitoring = () => {
    setMonitoring(false);
    setCurrentActivity('Stopped');
    if (accelSubscription.current) {
      try {
        accelSubscription.current.remove();
      } catch (e) {
        console.log('Cleanup:', e);
      }
    }
    if (pedometerSubscription.current) {
      try {
        pedometerSubscription.current.remove();
      } catch (e) {
        console.log('Pedometer cleanup:', e);
      }
    }
  };

  // --- ANALYZE STEPS (Walking vs Running) ---
  const analyzeSteps = (totalSteps: number) => {
    const now = Date.now();
    const timeDiff = (now - lastStepTime) / 1000; // Seconds since last check
    
    // Only calculate cadence if steps actually increased
    if (totalSteps > stepCount && timeDiff > 0) {
        const stepsDiff = totalSteps - stepCount;
        const cadence = stepsDiff / timeDiff; // Steps per second

        if (cadence > RUNNING_CADENCE) {
            setCurrentActivity('Running 🏃‍♂️');
            wasRunning.current = true;
        } else if (cadence > 0.5) {
            setCurrentActivity('Walking 🚶');
            wasRunning.current = false;
        } else {
            setCurrentActivity('Standing 🧍');
            wasRunning.current = false;
        }
    }
    
    setStepCount(totalSteps);
    setLastStepTime(now);
  };

  // --- ANALYZE MOTION (Falls & Stops) ---
  const analyzeMotion = ({ x, y, z }: { x: number, y: number, z: number }) => {
    const totalForce = Math.sqrt(x * x + y * y + z * z);
    
    // Keep a small history for trend analysis
    recentGForces.current.push(totalForce);
    if (recentGForces.current.length > 10) recentGForces.current.shift();

    // 1. FALL DETECTION
    if (totalForce > FALL_THRESHOLD) {
        // High impact detected
        triggerAlert('FALL DETECTED');
    }

    // 2. SUDDEN STOP DETECTION
    // Logic: High deceleration (force spike) AND activity was "Running" just before
    if (totalForce > SUDDEN_STOP_THRESHOLD && wasRunning.current) {
        triggerAlert('SUDDEN STOP');
    }
  };

  // --- ALERT SYSTEM ---
  const triggerAlert = (reason: string) => {
    if (alertVisible) return; // Prevent double alerts

    stopMonitoring(); // Pause sensors
    Vibration.vibrate([500, 500, 500]); // Vibrate pattern
    setAlertReason(reason);
    setAlertVisible(true);
    setCountdown(PRE_ALERT_TIMER);

    // Start Countdown
    countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
            if (prev <= 1) {
                clearInterval(countdownInterval.current!);
                sendEmergencyAlert(reason);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
  };

  const handleImOkay = () => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setAlertVisible(false);
    startMonitoring(); // Resume
  };

  const sendEmergencyAlert = async (reason: string) => {
    setSendingAlert(true);
    try {
        const userData = await AsyncStorage.getItem('user');
        if (!userData) return;
        const { email } = JSON.parse(userData);

        // Get Location for context
        let location = { latitude: 0, longitude: 0 };
        try {
            const loc = await Location.getCurrentPositionAsync({});
            location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        } catch(e) {}

        // Send to Backend
        // NOTE: Ensure your /sos/trigger route handles the 'reason' field in the email body
        await api.post('/sos/trigger', { 
            userEmail: email,
            location: location,
            reason: reason // "FALL DETECTED", "SUDDEN STOP", etc.
        });

        Alert.alert("Alert Sent", `Guardians notified: ${reason}`);
    } catch (error) {
        Alert.alert("Error", "Failed to send alert.");
    } finally {
        setSendingAlert(false);
        setAlertVisible(false);
    }
  };

  // Cleanup & Request Permissions
  useEffect(() => {
    requestActivityPermission();
    return () => {
        stopMonitoring();
        if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  const requestActivityPermission = async () => {
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      if (status === 'granted') {
        console.log('✅ Pedometer permission granted');
        setSensorsAvailable(true);
      } else {
        console.log('⚠️ Pedometer permission denied');
        setSensorsAvailable(false);
      }
    } catch (e) {
      console.log('⚠️ Error requesting Pedometer permission:', e);
      setSensorsAvailable(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Guard</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        
        {/* Status Circle */}
        <View style={styles.radarContainer}>
            <LinearGradient
                colors={monitoring ? ['#E0F7FA', '#B2EBF2'] : ['#FFEBEE', '#FFCDD2']}
                style={styles.radarCircle}
            >
                {/* Dynamic Icon based on Activity */}
                <Ionicons 
                    name={
                        currentActivity.includes('Running') ? "bicycle" : 
                        currentActivity.includes('Walking') ? "walk" : 
                        "body"
                    } 
                    size={80} 
                    color={monitoring ? "#FFF" : "#AAA"} 
                />
            </LinearGradient>
            <Text style={styles.statusText}>{currentActivity}</Text>
            {monitoring && <Text style={styles.subText}>AI analyzing movement patterns...</Text>}
        </View>

        {/* Feature Grid */}
        <View style={styles.grid}>
            <View style={styles.card}>
                <Ionicons name="alert-circle" size={30} color="#6A5ACD" />
                <Text style={styles.cardLabel}>Fall Detect</Text>
            </View>
            <View style={styles.card}>
                <Ionicons name="hand-left" size={30} color="#8A7FD8" />
                <Text style={styles.cardLabel}>Sudden Stop</Text>
            </View>
            <View style={styles.card}>
                <Ionicons name="speedometer" size={30} color="#A89FE8" />
                <Text style={styles.cardLabel}>Running</Text>
            </View>
        </View>

        {/* Toggle Button */}
        <TouchableOpacity 
            style={[styles.mainButton, monitoring ? styles.btnStop : styles.btnStart]}
            onPress={toggleMonitoring}
        >
            <Text style={styles.btnText}>{monitoring ? "DEACTIVATE GUARD" : "ACTIVATE GUARD"}</Text>
        </TouchableOpacity>

      </View>

      {/* --- ALERT MODAL --- */}
      <Modal transparent={true} visible={alertVisible} animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.warningIcon}>
                    <Ionicons name="warning" size={50} color="#FFF" />
                </View>
                
                <Text style={styles.modalTitle}>Safety Check</Text>
                <Text style={styles.modalReason}>Pattern Detected: {alertReason}</Text>
                
                <Text style={styles.modalDesc}>
                    Guardians will be notified in <Text style={{fontWeight:'bold', color: '#FF4B4B'}}>{countdown}s</Text> with your location and activity data.
                </Text>

                {sendingAlert ? (
                    <ActivityIndicator size="large" color="#FF4B4B" />
                ) : (
                    <TouchableOpacity style={styles.okayButton} onPress={handleImOkay}>
                        <Text style={styles.okayText}>I AM OKAY - CANCEL</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  content: { flex: 1, padding: 20, alignItems: 'center' },
  
  radarContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  radarCircle: { width: 200, height: 200, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  statusText: { fontSize: 24, fontWeight: 'bold', color: '#1A1B4B' },
  subText: { fontSize: 13, color: '#777', marginTop: 5 },

  grid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 40 },
  card: { backgroundColor: '#FFF', width: '30%', padding: 15, borderRadius: 15, alignItems: 'center', elevation: 3, shadowColor: '#6A5ACD', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#1A1B4B', marginTop: 8, textAlign: 'center' },

  mainButton: { width: '100%', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 'auto', marginBottom: 10, elevation: 5 },
  btnStart: { backgroundColor: '#6A5ACD' },
  btnStop: { backgroundColor: '#FF4B4B' },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '85%', padding: 30, borderRadius: 25, alignItems: 'center' },
  warningIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6A5ACD', justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: -50, borderWidth: 4, borderColor: '#FFF' },
  modalTitle: { fontSize: 26, fontWeight: 'bold', color: '#1A1B4B' },
  modalReason: { fontSize: 16, fontWeight: '700', color: '#FF4B4B', marginTop: 5, textTransform: 'uppercase' },
  modalDesc: { textAlign: 'center', color: '#555', marginVertical: 20, lineHeight: 22 },
  okayButton: { backgroundColor: '#00C851', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, width: '100%', alignItems: 'center' },
  okayText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
