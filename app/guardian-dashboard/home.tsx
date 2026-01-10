import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GuardianHomeScreen() {
  const [protectingUser, setProtectingUser] = useState('Olivia');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await AsyncStorage.getItem('user');
        if (data) {
          const parsed = JSON.parse(data);
          // If backend returns the name of person being protected
          if (parsed.protecting) setProtectingUser(parsed.protecting);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guardian Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. SOS Active Card */}
        <LinearGradient
          colors={['#9D80CB', '#5B4D85']} // Muted purple gradient
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sosCard}
        >
          <Text style={styles.urgentLabel}>Urgent</Text>
          <Text style={styles.sosTitle}>SOS Active - Immediate Action Required</Text>
          <Text style={styles.sosTime}>Last alert: 10:30 AM</Text>
        </LinearGradient>

        {/* 2. User Profile Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.userRow}>
            <View style={{flex: 1}}>
                <Text style={styles.subHeader}>Live updates from the user's device</Text>
                <Text style={styles.userName}>{protectingUser}</Text>
                <Text style={styles.statusText}>SOS</Text>
                
                <TouchableOpacity style={styles.callButton}>
                    <Text style={styles.callButtonText}>Call User</Text>
                </TouchableOpacity>
            </View>
            <Image 
                source={{ uri: 'https://img.freepik.com/free-photo/portrait-beautiful-young-woman-standing-grey-wall_231208-10760.jpg' }} 
                style={styles.userImage} 
            />
          </View>
        </View>

        {/* 3. Location Overview */}
        <Text style={styles.sectionTitle}>Location Overview</Text>
        <View style={styles.cardContainer}>
            <View style={{flex: 1, paddingRight: 10}}>
                <Text style={styles.locationTitle}>123 Main St, Anytown</Text>
                <Text style={styles.timeText}>Updated 10:30 AM</Text>
                
                <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Track Live Location</Text>
                    <Ionicons name="location-outline" size={14} color="#1A1B4B" />
                </TouchableOpacity>
            </View>
            {/* Map Placeholder Image */}
            <View style={styles.mapContainer}>
                <Ionicons name="map" size={50} color="#DDD" />
            </View>
        </View>

        {/* 4. Zone Alert Overview */}
        <Text style={styles.sectionTitle}>Zone Alert Overview</Text>
        <View style={styles.cardContainer}>
            <View style={{flex: 1, paddingRight: 10}}>
                <Text style={styles.locationTitle}>Zone Activity: High Risk</Text>
                <Text style={styles.timeText}>Last activity: 10:20 AM</Text>
                
                <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>View Zone Alerts</Text>
                    <Ionicons name="alert-circle-outline" size={14} color="#1A1B4B" />
                </TouchableOpacity>
            </View>
            {/* Map Placeholder Image */}
            <View style={[styles.mapContainer, { backgroundColor: '#E0DDCA' }]}>
                <Ionicons name="navigate" size={50} color="#AAA" />
            </View>
        </View>

        {/* 5. Emergency Services Button */}
        <TouchableOpacity style={styles.emergencyButton}>
            <Text style={styles.emergencyButtonText}>Emergency Services</Text>
        </TouchableOpacity>

        <View style={{height: 20}} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  header: { paddingVertical: 15, alignItems: 'center', backgroundColor: '#FAF9FF' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1B4B' },
  scrollContent: { padding: 20 },

  // SOS Card
  sosCard: {
    padding: 25,
    borderRadius: 20,
    marginBottom: 30,
    height: 180,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  urgentLabel: { color: '#E0E0E0', fontSize: 14, marginBottom: 5 },
  sosTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', lineHeight: 32, marginBottom: 10 },
  sosTime: { color: '#EEE', fontSize: 14 },

  // User Section
  sectionContainer: { marginBottom: 25 },
  subHeader: { color: '#6A5ACD', fontSize: 14, marginBottom: 5 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1A1B4B' },
  statusText: { fontSize: 14, color: '#6A5ACD', marginBottom: 15 },
  userImage: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#DDD' },
  
  callButton: {
    backgroundColor: '#9D80CB', // Purple
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  callButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  // Generic Section
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15 },
  cardContainer: {
    backgroundColor: '#FFF', // Or transparent if relying on placeholders
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 5 },
  timeText: { fontSize: 13, color: '#666', marginBottom: 15 },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E6F0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: '#1A1B4B', marginRight: 5 },

  mapContainer: {
    width: 120,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#D1C4E9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Emergency Button
  emergencyButton: {
    backgroundColor: '#E8E6F0',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  emergencyButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
});