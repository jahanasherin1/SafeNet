import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location'; 
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api'; 

export default function DashboardHome() {
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [sosLoading, setSosLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // --- REFRESH DATA EVERY TIME SCREEN IS FOCUSED ---
  useFocusEffect(
    useCallback(() => {
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

      loadUserData();
    }, [])
  );

  // --- PERIODIC LOCATION UPDATE (Every 30 seconds) ---
  useEffect(() => {
    // FIX: Changed type from NodeJS.Timeout to any
    let locationInterval: any; 

    const startLocationTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log("Location permission not granted");
          return;
        }

        // Update location every 30 seconds
        locationInterval = setInterval(async () => {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced
            });

            if (userEmail) {
              // Note: Ensure this route exists in your backend
              // If not, you can create it or just comment this out for now
              await api.post('/user/update-location', {
                userEmail: userEmail,
                location: {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude
                }
              });
              console.log('✅ Location updated:', location.coords);
            }
          } catch (error) {
            console.error('Location update error:', error);
          }
        }, 30000); 

      } catch (error) {
        console.error("Location tracking error:", error);
      }
    };

    startLocationTracking();

    // Cleanup interval on unmount
    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [userEmail]);

  const handleLogout = async () => {
    try {
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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert("Permission Denied: Allow location to use SOS.");
        setSosLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const userData = await AsyncStorage.getItem('user');
      if (!userData) return;
      const user = JSON.parse(userData);

      const response = await api.post('/sos/trigger', {
        userEmail: user.email,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        }
      });

      if (response.status === 200) {
        alert("SOS SENT: Guardians notified.");
      }
    } catch (error) {
      alert("SOS Failed to send.");
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
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#6A5ACD" />
            </TouchableOpacity>
          </View>
          <Text style={styles.welcomeText}>Welcome, {userName}</Text>
        </View>

        {/* SOS Card */}
        <LinearGradient
          colors={['#6A5ACD', '#4B3F8C']} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sosCard}
        >
          <View>
            <Text style={styles.sosTitle}>SOS</Text>
            <Text style={styles.sosSubtitle}>Tap in case of Emergency</Text>
          </View>
          <TouchableOpacity 
            style={styles.sosButton} 
            activeOpacity={0.8}
            onPress={handleSOS} 
          >
            <Text style={styles.sosButtonText}>{sosLoading ? "..." : "Tap"}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Live Location Card */}
        <View style={styles.locationCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Live Location: Active</Text>
            <Text style={styles.cardDesc}>Shared with guardians during emergencies</Text>
            <TouchableOpacity style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Enable</Text>
              <Ionicons name="location-outline" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.locationIconContainer}>
            <Ionicons name="navigate-circle" size={80} color="#7B61FF" />
          </View>
        </View>

        {/* Quick Safety Actions */}
        <Text style={styles.sectionTitle}>Quick Safety Actions</Text>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Start Journey</Text>
            <Text style={styles.actionDesc}>Alert guardians if you don't reach your destination</Text>
            <TouchableOpacity style={styles.smallButton}>
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
            <TouchableOpacity style={styles.smallButton}>
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
            <Image 
              source={{ uri: 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg' }} 
              style={styles.avatar} 
            />
            <View style={{flex: 1, marginLeft: 15}}>
                <Text style={styles.guardianTitle}>Add / Manage Guardians</Text>
                <Text style={styles.guardianDesc}>Alerts are sent only to your trusted contacts</Text>
            </View>
            <TouchableOpacity 
              style={styles.manageButton}
              onPress={() => router.push('/guardians/list')}
            >
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
  sosButton: { backgroundColor: '#F0F0F0', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20 },
  sosButtonText: { color: '#1A1B4B', fontWeight: 'bold' },
  locationCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, flexDirection: 'row', marginBottom: 25, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  cardDesc: { fontSize: 13, color: '#7A7A7A', marginVertical: 8, lineHeight: 18 },
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