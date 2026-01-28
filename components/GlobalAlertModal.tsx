import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api from '../services/api';
import { useSession } from '../services/SessionContext';

export default function GlobalAlertModal() {
  const { alertReason, isAlertVisible, dismissAlert } = useSession();
  
  const [countdown, setCountdown] = useState(30);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  // Handle when alert becomes visible
  useEffect(() => {
    console.log('🔔 GlobalAlertModal useEffect triggered - isAlertVisible:', isAlertVisible, 'alertReason:', alertReason);
    if (isAlertVisible && alertReason && !countdownInterval.current) {
      // Only start the countdown if it's not already running
      console.log('⏱️ Starting countdown for alert:', alertReason);
      handleAlertTriggered(alertReason);
    }
    
    return () => {
      if (countdownInterval.current) {
        console.log('🧹 Cleaning up countdown interval');
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    };
  }, [isAlertVisible, alertReason]);

  const handleAlertTriggered = (reason: string) => {
    console.log('🎬 handleAlertTriggered called with reason:', reason);
    setCountdown(30);
    setSendingAlert(false);
    setIsCancelled(false);
    isCancelledRef.current = false;

    console.log('⏲️ Setting up 30-second countdown interval');
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        console.log('⏳ Countdown tick:', prev - 1);
        if (prev <= 1) {
          console.log('⏰ Countdown reached 0 - Preparing to send alert');
          clearInterval(countdownInterval.current!);
          // Only send if not cancelled
          if (!isCancelledRef.current) {
            console.log('📤 isCancelledRef is false - calling sendAlertToGuardians');
            sendAlertToGuardians(reason);
          } else {
            console.log('❌ Alert was cancelled - not sending');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendAlertToGuardians = async (reason: string) => {
    try {
      setSendingAlert(true);
      console.log('🚨 Auto-sending alert to guardians after 30 seconds:', reason);
      
      // Get user data
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        console.error('❌ User session not found in AsyncStorage');
        Alert.alert('Error', 'User session not found');
        setSendingAlert(false);
        return;
      }
      
      const { email, name } = JSON.parse(userData);
      console.log('📱 User email:', email, 'Name:', name);

      // Get current location
      let location = { latitude: 0, longitude: 0 };
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        console.log('📍 Location obtained:', location);
      } catch (e) {
        console.log('⚠️ Could not get location for alert:', e);
      }

      // Make API call to trigger alert to guardians
      console.log('📤 Sending alert to backend with data:', {
        userEmail: email,
        userName: name || 'User',
        location: location,
        reason: reason,
        alertType: 'ACTIVITY_MONITOR',
        sendPushNotification: true,
        timestamp: new Date().toISOString()
      });

      const response = await api.post('/sos/trigger', {
        userEmail: email,
        userName: name || 'User',
        location: location,
        reason: reason,
        alertType: 'ACTIVITY_MONITOR',
        sendPushNotification: true,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Alert sent to guardians:', response.data);
      
      Alert.alert('Alert Sent', 'Emergency alert has been sent to your guardians.');
      
      setTimeout(() => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
        dismissAlert();
        setSendingAlert(false);
      }, 2000);
    } catch (error: any) {
      console.error('❌ Error sending alert:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      setSendingAlert(false);
      Alert.alert('Error', `Failed to send alert: ${error.message}`);
    }
  };

  const handleCancel = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    isCancelledRef.current = true;
    setIsCancelled(true);
    dismissAlert();
    setCountdown(30);
  };

  return (
    <Modal transparent={true} visible={isAlertVisible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.warningIcon}>
            <Ionicons name="warning" size={50} color="#FFF" />
          </View>
          
          <Text style={styles.modalTitle}>Safety Check</Text>
          <Text style={styles.modalReason}>Pattern Detected: {alertReason}</Text>
          
          <Text style={styles.modalDesc}>
            An alert will be sent to your guardians unless you cancel within 30 seconds.
          </Text>

          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Alert sending in:</Text>
            <Text style={styles.countdownTimer}>{countdown}s</Text>
          </View>

          {!sendingAlert && countdown > 0 && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          )}

          {sendingAlert && (
            <Text style={styles.sendingText}>Sending to guardians...</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    backgroundColor: '#FFF', 
    width: '85%', 
    padding: 30, 
    borderRadius: 25, 
    alignItems: 'center' 
  },
  warningIcon: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#6A5ACD', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20, 
    marginTop: -50, 
    borderWidth: 4, 
    borderColor: '#FFF' 
  },
  modalTitle: { 
    fontSize: 26, 
    fontWeight: 'bold', 
    color: '#1A1B4B' 
  },
  modalReason: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#FF4B4B', 
    marginTop: 5, 
    textTransform: 'uppercase' 
  },
  modalDesc: { 
    textAlign: 'center', 
    color: '#555', 
    marginVertical: 20, 
    lineHeight: 22 
  },
  cancelButton: { 
    backgroundColor: '#4CAF50', 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 30, 
    width: '100%', 
    alignItems: 'center', 
    marginTop: 15 
  },
  cancelText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  countdownContainer: { 
    alignItems: 'center', 
    marginVertical: 20, 
    paddingVertical: 15, 
    backgroundColor: '#F5F5F5', 
    borderRadius: 12, 
    width: '100%' 
  },
  countdownLabel: { 
    fontSize: 13, 
    color: '#666', 
    fontWeight: '600', 
    marginBottom: 5 
  },
  countdownTimer: { 
    fontSize: 42, 
    fontWeight: 'bold', 
    color: '#FF4B4B' 
  },
  sendingText: { 
    fontSize: 14, 
    color: '#4CAF50', 
    fontWeight: '600', 
    marginTop: 15 
  },
});
