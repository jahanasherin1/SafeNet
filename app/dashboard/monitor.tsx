import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setActivityUpdateCallback, setAlertCallback } from '../../services/ActivityMonitoringService';
import { useSession } from '../../services/SessionContext';

export default function ActivityMonitorScreen() {
  const router = useRouter();
  const { isActivityMonitoringActive, toggleActivityMonitoring } = useSession();
  
  // UI State
  const [currentActivity, setCurrentActivity] = useState('Monitoring Status...');
  const [stepCount, setStepCount] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertReason, setAlertReason] = useState('');
  const [countdown, setCountdown] = useState(15);
  const [sendingAlert, setSendingAlert] = useState(false);

  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // Register callbacks for activity updates
  useEffect(() => {
    setActivityUpdateCallback((activity, steps) => {
      setCurrentActivity(activity);
      setStepCount(steps);
    });

    setAlertCallback((reason) => {
      handleAlertTriggered(reason);
    });

    return () => {
      setActivityUpdateCallback(null as any);
      setAlertCallback(null as any);
    };
  }, []);

  // Update initial activity status
  useEffect(() => {
    if (isActivityMonitoringActive) {
      setCurrentActivity('Monitoring Activity...');
    } else {
      setCurrentActivity('Monitoring Inactive');
    }
  }, [isActivityMonitoringActive]);

  const handleAlertTriggered = (reason: string) => {
    setAlertReason(reason);
    setAlertVisible(true);
    setCountdown(15);

    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleImOkay = () => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setAlertVisible(false);
  };

  const handleToggleMonitoring = async () => {
    try {
      await toggleActivityMonitoring(!isActivityMonitoringActive);
      Alert.alert(
        'Activity Guard',
        isActivityMonitoringActive ? 'Monitoring Deactivated' : 'Monitoring Activated'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle activity monitoring');
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
                colors={isActivityMonitoringActive ? ['#E0F7FA', '#B2EBF2'] : ['#FFEBEE', '#FFCDD2']}
                style={styles.radarCircle}
            >
                {/* Dynamic Icon based on Activity */}
                <Ionicons 
                    name={
                        currentActivity.includes('Running') ? "bicycle" : 
                        currentActivity.includes('Fast') ? "speedometer" :
                        currentActivity.includes('Walking') ? "walk" : 
                        isActivityMonitoringActive ? "pulse" : "body"
                    } 
                    size={80} 
                    color={isActivityMonitoringActive ? "#FFF" : "#AAA"} 
                />
            </LinearGradient>
            <Text style={styles.statusText}>{currentActivity}</Text>
            {isActivityMonitoringActive && <Text style={styles.subText}>AI analyzing movement patterns...</Text>}
            {isActivityMonitoringActive && <Text style={styles.stepText}>Steps: {stepCount}</Text>}
            {!isActivityMonitoringActive && <Text style={styles.inactiveText}>Enable monitoring from dashboard</Text>}
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

        {/* Status Info */}
        <View style={styles.infoContainer}>
            <View style={styles.infoBox}>
                <Ionicons 
                    name={isActivityMonitoringActive ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={isActivityMonitoringActive ? "#4CAF50" : "#FF6B6B"} 
                />
                <Text style={styles.infoText}>
                    {isActivityMonitoringActive ? 'Monitoring Active' : 'Monitoring Inactive'}
                </Text>
            </View>
            <TouchableOpacity 
                style={[styles.toggleButton, isActivityMonitoringActive ? styles.btnDeactivate : styles.btnActivate]}
                onPress={handleToggleMonitoring}
            >
                <Text style={styles.toggleButtonText}>
                    {isActivityMonitoringActive ? 'DEACTIVATE' : 'ACTIVATE'}
                </Text>
            </TouchableOpacity>
        </View>

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
                    Guardians have been notified with your location and activity data.
                </Text>

                {!sendingAlert && (
                    <TouchableOpacity style={styles.okayButton} onPress={handleImOkay}>
                        <Text style={styles.okayText}>DISMISS</Text>
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
  inactiveText: { fontSize: 12, color: '#999', marginTop: 5, fontStyle: 'italic' },
  stepText: { fontSize: 14, color: '#555', marginTop: 5, fontWeight: '600' },

  grid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 40 },
  card: { backgroundColor: '#FFF', width: '30%', padding: 15, borderRadius: 15, alignItems: 'center', elevation: 3, shadowColor: '#6A5ACD', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#1A1B4B', marginTop: 8, textAlign: 'center' },

  infoContainer: { width: '100%', marginBottom: 20, alignItems: 'center' },
  infoBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoText: { fontSize: 14, fontWeight: '600', color: '#1A1B4B', marginLeft: 10 },
  toggleButton: { width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 3 },
  btnActivate: { backgroundColor: '#6A5ACD' },
  btnDeactivate: { backgroundColor: '#FF4B4B' },
  toggleButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },

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
