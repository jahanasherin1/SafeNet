import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient'; // 1. ADD THIS IMPORT

export default function ProfileScreen() {
  const router = useRouter();
  
  // State for user data
  const [userName, setUserName] = useState('User');
  const [userPhone, setUserPhone] = useState('+0 000 000-0000');

  // State for toggles
  const [isBatteryMode, setIsBatteryMode] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Load actual user info from storage
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserName(user.name || 'Sophia Carter');
        setUserPhone(user.phone || '+1 (555) 123-4567');
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* User Info Section */}
        <View style={styles.profileSection}>
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg' }} 
              style={styles.profileImage} 
            />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userPhone}>{userPhone}</Text>
          
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => router.push('/dashboard/edit-profile')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* App Preferences */}
        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>App Preferences</Text>

          {/* Notifications */}
          <TouchableOpacity style={styles.prefItem}>
            <Text style={styles.prefText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#7A7A7A" />
          </TouchableOpacity>

          {/* Battery Mode */}
          <View style={styles.prefItem}>
            <Text style={styles.prefText}>Battery Smart Mode</Text>
            <Switch 
              value={isBatteryMode} 
              onValueChange={setIsBatteryMode}
              trackColor={{ false: "#E0E0E0", true: "#6A5ACD" }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Monitoring Status */}
          <View style={styles.prefItem}>
            <Text style={styles.prefText}>Monitoring Status</Text>
            <Switch 
              value={isMonitoring} 
              onValueChange={setIsMonitoring}
              trackColor={{ false: "#E0E0E0", true: "#6A5ACD" }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* About */}
          <TouchableOpacity style={styles.prefItem}>
            <Text style={styles.prefText}>About the App</Text>
            <Ionicons name="chevron-forward" size={20} color="#7A7A7A" />
          </TouchableOpacity>
        </View>

        {/* --- GRADIENT LOGOUT BUTTON --- */}
        <TouchableOpacity style={styles.logoutContainer} onPress={handleLogout}>
          <LinearGradient
            colors={['#C18FFF', '#6A5ACD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FAF9FF' 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  imageContainer: {
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1B4B',
    marginTop: 15,
  },
  userPhone: {
    fontSize: 14,
    color: '#7A7A7A',
    marginTop: 5,
  },
  editButton: {
    backgroundColor: '#E8E6F0',
    paddingHorizontal: 60,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  editButtonText: {
    color: '#1A1B4B',
    fontWeight: '600',
    fontSize: 14,
  },
  preferencesSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1B4B',
    marginBottom: 20,
  },
  prefItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  prefText: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '500',
  },
  // LOGOUT BUTTON STYLES
  logoutContainer: {
    marginTop: 40,
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});