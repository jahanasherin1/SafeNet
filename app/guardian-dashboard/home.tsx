import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

export default function GuardianHomeScreen() {
  const router = useRouter();
  const [guardianName, setGuardianName] = useState('Guardian');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [protectingUser, setProtectingUser] = useState('User');
  const [protectingEmail, setProtectingEmail] = useState('');
  
  // State for all users
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // State for User Image (current selected user)
  const [userImage, setUserImage] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  // SOS & Location State
  const [isSosActive, setIsSosActive] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState('No recent alerts');
  const [locationStatus, setLocationStatus] = useState('Waiting for updates...');

  // 1. Initial Data Load
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const data = await AsyncStorage.getItem('user');
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.guardianName) setGuardianName(parsed.guardianName);
            if (parsed.guardianEmail) setGuardianEmail(parsed.guardianEmail);
            if (parsed.protecting) setProtectingUser(parsed.protecting);
            if (parsed.protectingEmail) setProtectingEmail(parsed.protectingEmail);
            
            // Fetch all users for this guardian
            if (parsed.guardianEmail) {
              fetchAllUsers(parsed.guardianEmail);
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadData();
    }, [])
  );

  // 2. Fetch All Users for Guardian
  const fetchAllUsers = async (email: string) => {
    setLoadingUsers(true);
    try {
      const response = await api.post('/guardian/all-users', {
        guardianEmail: email
      });

      if (response.status === 200) {
        setAllUsers(response.data.users);
        // Set first user as selected by default
        if (response.data.users.length > 0) {
          setSelectedUserId(response.data.users[0]._id);
          setProtectingUser(response.data.users[0].name);
          setProtectingEmail(response.data.users[0].email);
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 3. POLLING for current selected user
  useEffect(() => {
    if (!protectingEmail) return;

    const checkStatus = async () => {
      try {
        const response = await api.post('/guardian/sos-status', {
          protectingEmail: protectingEmail
        });

        if (response.status === 200) {
          const { isSosActive, lastSosTime, location, profileImage } = response.data;
          
          setIsSosActive(isSosActive);

          // IMAGE LOGIC
          if (profileImage) {
            const rootUrl = api.defaults.baseURL?.replace('/api', '');
            const fullImageUrl = `${rootUrl}/${profileImage}`;
            setUserImage(fullImageUrl);
          } else {
            setUserImage(null);
          }

          // TIME LOGIC
          if (lastSosTime) {
            const time = new Date(lastSosTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLastAlertTime(time);
          }

          // LOCATION LOGIC
          if (isSosActive && location && location.latitude !== 0) {
            setLocationStatus(`Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`);
          } else if (isSosActive) {
            setLocationStatus("Fetching emergency coordinates...");
          } else {
            setLocationStatus("User is safe. Location hidden.");
          }
        }
      } catch (error) {
        // Silent error for polling
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 5000); 

    return () => clearInterval(intervalId); 
  }, [protectingEmail]);

  const handleSelectUser = (user: any) => {
    setSelectedUserId(user._id);
    setProtectingUser(user.name);
    setProtectingEmail(user.email);
    
    // Persist selected user to AsyncStorage so location screen can access it
    AsyncStorage.setItem('selectedUser', JSON.stringify({
      userId: user._id,
      userName: user.name,
      userEmail: user.email
    })).catch(err => console.error('Error saving selected user:', err));
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('guardianSessionToken');
      router.replace('/main');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const gradientColors = isSosActive 
    ? ['#FF4B4B', '#FF0000'] 
    : ['#9D80CB', '#5B4D85'];

  // Render individual user card
  const renderUserCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.userCard,
        selectedUserId === item._id && styles.userCardActive
      ]}
      onPress={() => handleSelectUser(item)}
    >
      <Image
        source={{
          uri: item.profileImage 
            ? `${api.defaults.baseURL?.replace('/api', '')}/${item.profileImage}`
            : 'https://img.freepik.com/free-photo/portrait-beautiful-young-woman-standing-grey-wall_231208-10760.jpg'
        }}
        style={styles.userCardImage}
      />
      <View style={styles.userCardContent}>
        <Text style={styles.userCardName}>{item.name}</Text>
        <Text style={[styles.userCardStatus, { color: item.sosActive ? '#FF4B4B' : '#00C851' }]}>
          {item.sosActive ? '🚨 Emergency' : '✓ Safe'}
        </Text>
      </View>
      {selectedUserId === item._id && (
        <Ionicons name="checkmark-circle" size={24} color="#6A5ACD" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <Text style={styles.dashboardLabel}>Guardian Dashboard</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#6A5ACD" />
            </TouchableOpacity>
          </View>
          <Text style={styles.welcomeText}>Welcome, {guardianName}</Text>
        </View>

        {/* Users List Section */}
        {loadingUsers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6A5ACD" />
            <Text style={styles.loadingText}>Loading protected users...</Text>
          </View>
        ) : allUsers.length > 0 ? (
          <View style={styles.usersListSection}>
            <Text style={styles.usersListTitle}>Protected Users ({allUsers.length})</Text>
            <FlatList
              data={allUsers}
              renderItem={renderUserCard}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              style={styles.usersList}
            />
          </View>
        ) : (
          <View style={styles.noUsersContainer}>
            <Ionicons name="people-outline" size={50} color="#CCC" />
            <Text style={styles.noUsersText}>No users registered with you yet</Text>
          </View>
        )}

        {/* SOS Card */}
        <LinearGradient
          colors={gradientColors as unknown as readonly [any, any, ...any[]]} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sosCard}
        >
          <View style={styles.sosHeaderRow}>
             <Text style={styles.urgentLabel}>
                {isSosActive ? "⚠️ URGENT ALERT" : "Status: Normal"}
             </Text>
             {isSosActive && <Ionicons name="warning" size={24} color="#FFF" />}
          </View>

          <Text style={styles.sosTitle}>
            {isSosActive 
              ? "SOS ACTIVE - IMMEDIATE ACTION REQUIRED" 
              : "User is Safe"}
          </Text>
          <Text style={styles.sosTime}>Last update: {lastAlertTime}</Text>
        </LinearGradient>

        {/* User Profile Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.userRow}>
            <View style={{flex: 1}}>
                <Text style={styles.subHeader}>Live updates from the user's device</Text>
                <Text style={styles.userName}>{protectingUser}</Text>
                <Text style={[styles.statusText, { color: isSosActive ? '#FF4B4B' : '#00C851' }]}>
                    {isSosActive ? "Emergency Mode" : "Safe"}
                </Text>
                
                <TouchableOpacity style={[styles.callButton, isSosActive && {backgroundColor: '#FF4B4B'}]}>
                    <Text style={styles.callButtonText}>Call User</Text>
                </TouchableOpacity>
            </View>
            
            {/* DYNAMIC IMAGE COMPONENT */}
            <Image 
                source={{ 
                  uri: userImage || 'https://img.freepik.com/free-photo/portrait-beautiful-young-woman-standing-grey-wall_231208-10760.jpg' 
                }} 
                style={styles.userImage} 
                key={userImage}
            />
          </View>
        </View>

        {/* Location Overview */}
        <Text style={styles.sectionTitle}>Location Overview</Text>
        <View style={styles.cardContainer}>
            <View style={{flex: 1, paddingRight: 10}}>
                <Text style={styles.locationTitle} numberOfLines={1}>
                    {locationStatus}
                </Text>
                <Text style={styles.timeText}>Updated: {lastAlertTime}</Text>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => router.push('/guardian-dashboard/location')}
                >
                    <Text style={styles.actionButtonText}>Track Live Location</Text>
                    <Ionicons name="location-outline" size={14} color="#1A1B4B" />
                </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.mapContainer}
              onPress={() => router.push('/guardian-dashboard/location')}
            >
                <Ionicons name="map" size={50} color="#DDD" />
            </TouchableOpacity>
        </View>

        {/* Zone Alert Overview */}
        <Text style={styles.sectionTitle}>Zone Alert Overview</Text>
        <View style={styles.cardContainer}>
            <View style={{flex: 1, paddingRight: 10}}>
                <Text style={styles.locationTitle}>Zone Activity: Low Risk</Text>
                <Text style={styles.timeText}>Last activity: Just now</Text>
                
                <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>View Zone Alerts</Text>
                    <Ionicons name="alert-circle-outline" size={14} color="#1A1B4B" />
                </TouchableOpacity>
            </View>
            <View style={[styles.mapContainer, { backgroundColor: '#E0DDCA' }]}>
                <Ionicons name="navigate" size={50} color="#AAA" />
            </View>
        </View>

        {/* Emergency Button */}
        <TouchableOpacity style={[styles.emergencyButton, isSosActive && { borderColor: 'red', borderWidth: 1 }]}>
            <Text style={[styles.emergencyButtonText, isSosActive && { color: 'red' }]}>
                Contact Emergency Services
            </Text>
        </TouchableOpacity>

        <View style={{height: 20}} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  scrollContent: { padding: 20 },
  headerContainer: { marginBottom: 25 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dashboardLabel: { fontSize: 14, fontWeight: '600', color: '#6A5ACD', letterSpacing: 0.5, textTransform: 'uppercase' },
  logoutButton: { padding: 5 },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#1A1B4B' },
  
  // Users List Styles
  usersListSection: { marginBottom: 25 },
  usersListTitle: { fontSize: 16, fontWeight: '600', color: '#1A1B4B', marginBottom: 12 },
  usersList: { marginBottom: 10 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#EEE',
  },
  userCardActive: {
    borderColor: '#6A5ACD',
    backgroundColor: '#FAF7FC',
  },
  userCardImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#DDD',
  },
  userCardContent: {
    flex: 1,
  },
  userCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1B4B',
  },
  userCardStatus: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    color: '#6A5ACD',
    fontSize: 14,
  },

  noUsersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginBottom: 20,
  },
  noUsersText: {
    marginTop: 15,
    color: '#999',
    fontSize: 15,
  },
  
  sosCard: {
    padding: 25,
    borderRadius: 20,
    marginBottom: 15,
    height: 180,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sosHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  urgentLabel: { color: '#E0E0E0', fontSize: 14, fontWeight: 'bold' },
  sosTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', lineHeight: 32, marginBottom: 10 },
  sosTime: { color: '#EEE', fontSize: 14 },

  sectionContainer: { marginBottom: 25 },
  subHeader: { color: '#6A5ACD', fontSize: 14, marginBottom: 5 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1A1B4B' },
  statusText: { fontSize: 16, marginBottom: 15, fontWeight: '600' },
  userImage: { 
    width: 100, 
    height: 100, 
    borderRadius: 12, 
    backgroundColor: '#DDD',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4, 
  },
  
  callButton: {
    backgroundColor: '#9D80CB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  callButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15 },
  cardContainer: {
    backgroundColor: '#FFF', 
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15, 
    padding: 10,     
    elevation: 1,    
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
    width: 100,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#D1C4E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyButton: {
    backgroundColor: '#E8E6F0',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  emergencyButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
});