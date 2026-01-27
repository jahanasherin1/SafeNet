import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { useSession } from '../../services/SessionContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user, isActivityMonitoringActive, toggleActivityMonitoring } = useSession();
  
  // State for user data
  const [userName, setUserName] = useState('User');
  const [userPhone, setUserPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // State for toggles
  const [isBatteryMode, setIsBatteryMode] = useState(false);
  const [togglingActivity, setTogglingActivity] = useState(false);

  // --- 2. REFRESH DATA WHEN SCREEN IS FOCUSED ---
  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        try {
          // Use session context if available
          if (user) {
            setUserName(user.name || 'User');
            setUserPhone(user.phone || '');
            if (user.profileImage) {
              const baseUrl = api.defaults.baseURL?.replace('/api', '');
              setProfileImage(`${baseUrl}/${user.profileImage}`);
            }
          } else {
            // Fallback to AsyncStorage
            const storedUser = await AsyncStorage.getItem('user');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              setUserName(parsedUser.name || 'User');
              setUserPhone(parsedUser.phone || '');
              if (parsedUser.profileImage) {
                const baseUrl = api.defaults.baseURL?.replace('/api', '');
                setProfileImage(`${baseUrl}/${parsedUser.profileImage}`);
              }
            }
          }
        } catch (error) {
          console.error("Failed to load profile", error);
        }
      };
      loadUser();
    }, [user])
  );

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/main');
    } catch (error) {
      console.error('Logout error:', error);
    }
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
              // 3. Use Dynamic Image or Default Fallback
              source={{ 
                uri: profileImage || 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg' 
              }} 
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
              value={isActivityMonitoringActive}
              onValueChange={async (value) => {
                setTogglingActivity(true);
                try {
                  await toggleActivityMonitoring(value);
                  Alert.alert('Success', value ? 'Activity monitoring enabled' : 'Activity monitoring disabled');
                } catch (error) {
                  Alert.alert('Error', 'Failed to toggle activity monitoring');
                } finally {
                  setTogglingActivity(false);
                }
              }}
              disabled={togglingActivity}
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

        {/* Gradient Logout Button */}
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
    backgroundColor: '#DDD', // Gray background while loading
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