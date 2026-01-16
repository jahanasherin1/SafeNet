import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import * as TaskManager from 'expo-task-manager'; // Import TaskManager
import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
// Import the task name
import { LOCATION_TASK_NAME } from '../../services/LocationTask';

export default function DashboardHome() {
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  
  // Tracking State
  const [sosLoading, setSosLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Waiting for updates...');

  // --- 1. LOAD DATA & CHECK STATUS ON FOCUS ---
  useFocusEffect(
    useCallback(() => {
      loadUserData();
      checkTrackingStatus();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUserName(parsedUser.name || 'User');
        setUserEmail(parsedUser.email || '');
      }
    } catch (error) {
      console.error("Failed to load user data", error);
    }
  };

  const checkTrackingStatus = async () => {
    try {
      // 1. Check if the Background Task is running
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      setIsTracking(isRegistered);

      // 2. Load the last known timestamp from Storage (written by the Background Task)
      const storedTime = await AsyncStorage.getItem('lastLocationTime');
      if (storedTime) {
        const date = new Date(storedTime);
        setLastUpdated(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else if (!isRegistered) {
        setLastUpdated("Tracking Disabled");
      }
    } catch (e) {
      console.error("Status check failed", e);
    }
  };

  // --- 2. TOGGLE TRACKING (START/STOP) ---
  const toggleTracking = async () => {
    if (isTracking) {
      // --- STOP TRACKING ---
      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        setIsTracking(false);
        setLastUpdated("Stopped");
        Alert.alert("Location Tracking", "Live tracking disabled.");
      } catch (err) {
        console.log("Error stopping location:", err);
      }
    } else {
      // --- START TRACKING ---
      try {
        // A. Foreground Permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          Alert.alert("Permission Denied", "Allow location access to enable tracking.");
          return;
        }

        // B. Background Permission (Crucial for Android)
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          Alert.alert(
            "Background Permission Required", 
            "To keep you safe when the app is closed, please select 'Allow all the time' in settings."
          );
          // We continue anyway, but it might stop when minimized on some Android versions
        }

        // C. Start The Service
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10, // Update every 10 meters
          deferredUpdatesInterval: 5000, // Minimum 5 seconds
          
          // ANDROID NOTIFICATION CONFIG (Required for background)
          foregroundService: {
            notificationTitle: "SafeNet Active",
            notificationBody: "Sharing your live location with guardians.",
            notificationColor: "#6A5ACD"
          }
        });

        setIsTracking(true);
        
        // Update Timestamp immediately
        const now = new Date();
        const iso = now.toISOString();
        await AsyncStorage.setItem('lastLocationTime', iso);
        setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      } catch (error) {
        console.error("Start tracking error:", error);
        Alert.alert("Error", "Could not start location tracking.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      // Optional: Stop tracking on logout? 
      // Usually safety apps keep tracking, but let's stop it for clean session exit.
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      router.replace('/main'); 
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSOS = async () => {
    setSosLoading(true);
    try {
      // Force high accuracy for SOS
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      const response = await api.post('/sos/trigger', {
        userEmail: userEmail,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        }
      });

      if (response.status === 200) {
        Alert.alert("SOS SENT", "Guardians notified.");
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastUpdated(now);
        
        // Auto-enable tracking if not already on
        if (!isTracking) {
            toggleTracking();
        }
      }
    } catch (error) {
      Alert.alert("Error", "SOS Failed to send.");
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <Text style={styles.dashboardLabel}>SafeNet Dashboard</Text>
          </View>
          <Text style={styles.welcomeText}>Welcome, {userName}</Text>
        </View>

        {/* SOS Card */}
        <LinearGradient colors={['#6A5ACD', '#4B3F8C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sosCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>SOS</Text>
            <Text style={styles.sosSubtitle}>Tap in case of Emergency</Text>
            <Text style={styles.miniTime}>Last Signal: {lastUpdated}</Text>
          </View>
          <TouchableOpacity style={styles.sosButton} activeOpacity={0.8} onPress={handleSOS}>
            <Text style={styles.sosButtonText}>{sosLoading ? "..." : "Tap"}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Live Location Card - UPDATED WITH SWITCH */}
        <View style={styles.locationCard}>
          <View style={{ flex: 1 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={[styles.statusDot, { backgroundColor: isTracking ? '#00C851' : '#FF4B4B' }]} />
                <Text style={styles.cardTitle}>Live Location: {isTracking ? "ON" : "OFF"}</Text>
            </View>
            
            <Text style={styles.cardDesc}>
              {isTracking 
                ? "Background tracking active." 
                : "Enable to share real-time movements."}
            </Text>
            
            <Text style={styles.updateText}>Last sync: {lastUpdated}</Text>

            {/* Toggle Switch */}
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 5}}>
                <Switch 
                    value={isTracking}
                    onValueChange={toggleTracking}
                    trackColor={{ false: "#E0E0E0", true: "#D1C4E9" }}
                    thumbColor={isTracking ? "#6A5ACD" : "#f4f3f4"}
                />
                <Text style={styles.switchLabel}>{isTracking ? "Disable" : "Enable"}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.locationIconContainer} onPress={() => router.push('/dashboard/location')}>
            <Ionicons name={isTracking ? "navigate-circle" : "navigate-circle-outline"} size={80} color="#7B61FF" />
          </TouchableOpacity>
        </View>

        {/* Quick Safety Actions */}
        <Text style={styles.sectionTitle}>Quick Safety Actions</Text>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Start Journey</Text>
            <Text style={styles.actionDesc}>Alert guardians if you don't reach your destination</Text>
            <TouchableOpacity style={styles.smallButton} onPress={() => router.push('/dashboard/start-journey')}>
              <Text style={styles.smallButtonText}>Start</Text>
              <Ionicons name="arrow-forward" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#E0BBE4', '#957DAD']} style={styles.actionImageContainer}>
             <FontAwesome5 name="walking" size={40} color="#4B3F8C" />
          </LinearGradient>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Fake Call</Text>
            <Text style={styles.actionDesc}>Simulate an incoming call with vibration</Text>
            <TouchableOpacity style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Start</Text>
              <Ionicons name="call-outline" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#42275a', '#734b6d']} style={styles.actionImageContainer}>
             <Ionicons name="call" size={40} color="#FFF" />
          </LinearGradient>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Nearby Safe Places</Text>
            <Text style={styles.actionDesc}>Find help near you</Text>
            <TouchableOpacity style={styles.smallButton} onPress={() => router.push('/dashboard/location')}>
              <Text style={styles.smallButtonText}>Find</Text>
              <Ionicons name="location-outline" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#9D80CB', '#6A5ACD']} style={styles.actionImageContainer}>
             <MaterialIcons name="local-police" size={40} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Trusted Guardians */}
        <Text style={styles.sectionTitle}>Trusted Guardians</Text>
        <View style={styles.guardianCard}>
            <Image source={{ uri: 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg' }} style={styles.avatar} />
            <View style={{flex: 1, marginLeft: 15}}>
                <Text style={styles.guardianTitle}>Add / Manage Guardians</Text>
                <Text style={styles.guardianDesc}>Alerts are sent only to your trusted contacts</Text>
            </View>
            <TouchableOpacity style={styles.manageButton} onPress={() => router.push('/guardians/list')}>
                <Text style={styles.manageButtonText}>Manage</Text>
            </TouchableOpacity>
        </View>
        <View style={{height: 20}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 20 },
  headerContainer: { marginBottom: 25 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dashboardLabel: { fontSize: 14, fontWeight: '600', color: '#6A5ACD', letterSpacing: 0.5, textTransform: 'uppercase' },
  logoutButton: { padding: 5 },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#1A1B4B' },
  
  sosCard: { height: 160, borderRadius: 20, padding: 25, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'flex-end', marginBottom: 25, shadowColor: '#6A5ACD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5 },
  sosTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  sosSubtitle: { fontSize: 14, color: '#E0E0E0', marginTop: 5 },
  miniTime: { fontSize: 10, color: '#E0E0E0', marginTop: 8 },
  sosButton: { backgroundColor: '#F0F0F0', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20 },
  sosButtonText: { color: '#1A1B4B', fontWeight: 'bold' },
  
  // Location Card Styles
  locationCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, flexDirection: 'row', marginBottom: 25, elevation: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  cardDesc: { fontSize: 13, color: '#7A7A7A', marginTop: 5, marginBottom: 5, lineHeight: 18 },
  updateText: { fontSize: 12, color: '#6A5ACD', marginBottom: 10, fontWeight: '600' },
  switchLabel: { fontSize: 14, fontWeight: '500', color: '#1A1B4B', marginLeft: 8 },
  locationIconContainer: { justifyContent: 'center', alignItems: 'center', width: 80 },
  
  smallButton: { flexDirection: 'row', backgroundColor: '#F3F0FA', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignItems: 'center', marginTop: 5 },
  smallButtonText: { fontSize: 13, fontWeight: '600', color: '#1A1B4B' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15, marginTop: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  actionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  actionDesc: { fontSize: 13, color: '#7A7A7A', marginVertical: 5 },
  actionImageContainer: { width: 120, height: 80, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  guardianCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 15, elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#DDD' },
  guardianTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1B4B' },
  guardianDesc: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
  manageButton: { backgroundColor: '#F3F0FA', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  manageButtonText: { fontSize: 12, fontWeight: '600', color: '#1A1B4B' },
});