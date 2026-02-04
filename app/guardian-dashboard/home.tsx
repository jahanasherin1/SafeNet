import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

export default function GuardianHomeScreen() {
  const router = useRouter();
  const [guardianName, setGuardianName] = useState('Guardian');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [protectingUser, setProtectingUser] = useState('User');
  const [protectingEmail, setProtectingEmail] = useState('');
  const [protectingPhone, setProtectingPhone] = useState('');
  
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const [userImage, setUserImage] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  // SOS & Journey State
  const [isSosActive, setIsSosActive] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState('No recent alerts'); // Specific to SOS
  const [lastLocationTime, setLastLocationTime] = useState('Waiting for updates...'); // Specific to Location
  const [locationStatus, setLocationStatus] = useState('Waiting for updates...');
  const [journeyData, setJourneyData] = useState(null);

  // 1. Initial Load from Storage
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

  // 2. Fetch User List
  const fetchAllUsers = async (email) => {
    setLoadingUsers(true);
    try {
      const response = await api.post('/guardian/all-users', {
        guardianEmail: email
      });

      if (response.status === 200) {
        setAllUsers(response.data.users);
        if (response.data.users.length > 0) {
          setSelectedUserId(response.data.users[0]._id);
          setProtectingUser(response.data.users[0].name);
          setProtectingEmail(response.data.users[0].email);
          setProtectingPhone(response.data.users[0].phone);
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 3. Real-time Polling
  useEffect(() => {
    if (!protectingEmail) return;

    const checkAllStatuses = async () => {
      try {
        const results = await Promise.all(
          allUsers.map(async (user) => {
            const res = await api.post('/guardian/sos-status', {
              protectingEmail: user.email
            });
            return { email: user.email, data: res.data };
          })
        );

        setAllUsers((prevUsers) =>
          prevUsers.map((u) => {
            const update = results.find((r) => r.email === u.email);
            if (update) {
              return {
                ...u,
                sosActive: update.data.isSosActive,
                lastUpdated: update.data.lastUpdated,
                currentLocation: update.data.location,
                journey: update.data.journey
              };
            }
            return u;
          })
        );

        const currentBatch = results.find(r => r.email === protectingEmail);
        if (currentBatch) {
          const { isSosActive, lastUpdated, lastSosTime, location, profileImage, journey } = currentBatch.data;
          
          setIsSosActive(isSosActive);
          setJourneyData(journey);

          if (profileImage) {
            setUserImage(`${api.defaults.baseURL?.replace('/api', '')}/${profileImage}`);
          } else {
            setUserImage(null);
          }

          // A. Update SOS Time (Red Card)
          if (isSosActive && lastSosTime) {
            setLastAlertTime(new Date(lastSosTime).toLocaleString([], { 
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
            }));
          } else {
            setLastAlertTime("No recent alerts");
          }

          // B. Update Location Time (Location Card)
          if (lastUpdated) {
            setLastLocationTime(new Date(lastUpdated).toLocaleString([], { 
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
            }));
          }

          if (location && location.latitude !== 0) {
            setLocationStatus(`Lat: ${location.latitude.toFixed(4)}, Lng: ${location.longitude.toFixed(4)}`);
          } else {
            setLocationStatus("Waiting for location...");
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    checkAllStatuses();
    const intervalId = setInterval(checkAllStatuses, 5000); 
    return () => clearInterval(intervalId); 
  }, [allUsers.length, protectingEmail]);

  const handleSelectUser = (user) => {
    setSelectedUserId(user._id);
    setProtectingUser(user.name);
    setProtectingEmail(user.email);
    setProtectingPhone(user.phone);
    AsyncStorage.setItem('selectedUser', JSON.stringify({
      userId: user._id, userName: user.name, userEmail: user.email, userPhone: user.phone
    })).catch(err => console.error('Error saving selected user:', err));
  };

  const handleCallUser = () => {
    if (!protectingPhone) {
      Alert.alert(
        'No Phone Number',
        'Phone number not available for this user.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Call User',
      `Do you want to call ${protectingUser} at ${protectingPhone}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Call',
          onPress: () => {
            const phoneNumber = Platform.OS === 'ios' 
              ? `telprompt:${protectingPhone}` 
              : `tel:${protectingPhone}`;
            
            Linking.canOpenURL(phoneNumber)
              .then((supported) => {
                if (!supported) {
                  Alert.alert('Error', 'Phone calling is not supported on this device');
                } else {
                  return Linking.openURL(phoneNumber);
                }
              })
              .catch((err) => {
                console.error('Error making call:', err);
                Alert.alert('Error', 'Failed to initiate call');
              });
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    try {
      // Clear all user-related AsyncStorage items
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('selectedUser');
      await AsyncStorage.removeItem('guardianEmail');
      await AsyncStorage.removeItem('lastLocationTime');
      
      // Reset all local state
      setGuardianName('Guardian');
      setGuardianEmail('');
      setProtectingUser('User');
      setProtectingEmail('');
      setAllUsers([]);
      setSelectedUserId('');
      setIsSosActive(false);
      setLastAlertTime('No recent alerts');
      setLastLocationTime('Waiting for updates...');
      setLocationStatus('Waiting for updates...');
      setJourneyData(null);
      setUserImage(null);
      
      router.replace('/main');
    } catch (error) { console.error("Logout error:", error); }
  };

  const gradientColors = isSosActive ? ['#FF4B4B', '#FF0000'] : ['#9D80CB', '#5B4D85'];

  const renderUserCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.userCard, selectedUserId === item._id && styles.userCardActive]}
      onPress={() => handleSelectUser(item)}
    >
      <Image
        source={{ uri: item.profileImage ? `${api.defaults.baseURL?.replace('/api', '')}/${item.profileImage}` : 'https://img.freepik.com/free-photo/portrait-beautiful-young-woman-standing-grey-wall_231208-10760.jpg' }}
        style={styles.userCardImage}
      />
      <View style={styles.userCardContent}>
        <Text style={styles.userCardName}>{item.name}</Text>
        <Text style={[styles.userCardStatus, { color: item.sosActive ? '#FF4B4B' : '#00C851' }]}>
          {item.sosActive ? '🚨 Emergency' : '✓ Safe'}
        </Text>
        <Text style={{fontSize: 10, color: '#999', marginTop: 2}}>
          Updated: {item.lastUpdated ? new Date(item.lastUpdated).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '...'}
        </Text>
      </View>
      {selectedUserId === item._id && <Ionicons name="checkmark-circle" size={24} color="#6A5ACD" />}
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

        {/* User List */}
        {loadingUsers ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6A5ACD" /></View>
        ) : allUsers.length > 0 ? (
          <View style={styles.usersListSection}>
            <Text style={styles.usersListTitle}>Protected Users ({allUsers.length})</Text>
            <FlatList data={allUsers} renderItem={renderUserCard} keyExtractor={(item) => item._id} scrollEnabled={false} style={styles.usersList} />
          </View>
        ) : null}

        {/* SOS Card */}
        <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sosCard}>
          <View style={styles.sosHeaderRow}>
             <Text style={styles.urgentLabel}>{isSosActive ? "⚠️ URGENT ALERT" : "Status: Normal"}</Text>
             {isSosActive && <Ionicons name="warning" size={24} color="#FFF" />}
          </View>
          <Text style={styles.sosTitle}>{isSosActive ? "SOS ACTIVE - IMMEDIATE ACTION REQUIRED" : "User is Safe"}</Text>
          <View style={styles.sosTimeRow}>
            <Ionicons name="time-outline" size={14} color="#FFF" />
            <Text style={styles.sosTime}>
              {isSosActive ? `SOS Tapped: ${lastAlertTime}` : "No recent alerts"}
            </Text>
          </View>
        </LinearGradient>

        {/* User Summary Row */}
        <View style={styles.sectionContainer}>
          <View style={styles.userRow}>
            <View style={{flex: 1}}>
                <Text style={styles.subHeader}>Live updates from the user's device</Text>
                <Text style={styles.userName}>{protectingUser}</Text>
                <Text style={[styles.statusText, { color: isSosActive ? '#FF4B4B' : '#00C851' }]}>{isSosActive ? "Emergency Mode" : "Safe"}</Text>
                <TouchableOpacity 
                  style={[styles.callButton, isSosActive && {backgroundColor: '#FF4B4B'}]}
                  onPress={handleCallUser}
                >
                  <Ionicons name="call" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.callButtonText}>Call User</Text>
                </TouchableOpacity>
            </View>
            <Image source={{ uri: userImage || 'https://img.freepik.com/free-photo/portrait-beautiful-young-woman-standing-grey-wall_231208-10760.jpg' }} style={styles.userImage} key={userImage} />
          </View>
        </View>

        {/* Location Overview */}
        <Text style={styles.sectionTitle}>Location Overview</Text>
        <View style={styles.cardContainer}>
            <View style={{flex: 1, paddingRight: 10}}>
                <Text style={styles.locationTitle} numberOfLines={1}>{locationStatus}</Text>
                
                {/* UPDATED: Now shows real tracking time from backend */}
                <Text style={styles.timeText}>Updated: {lastLocationTime}</Text>
                
                <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/guardian-dashboard/location')}>
                    <Text style={styles.actionButtonText}>Track Live Location</Text>
                    <Ionicons name="location-outline" size={14} color="#1A1B4B" style={{marginLeft: 5}} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.mapContainer} onPress={() => router.push('/guardian-dashboard/location')}><Ionicons name="map" size={50} color="#DDD" /></TouchableOpacity>
        </View>

        {/* Journey Monitoring Section */}
        <Text style={styles.sectionTitle}>Journey Monitoring</Text>
        <View style={styles.cardContainer}>
            <View style={{flex: 1, paddingRight: 10}}>
                <Text style={styles.locationTitle}>
                    Destination: {journeyData?.isActive ? journeyData.destination : "No destination set"}
                </Text>
                <Text style={styles.timeText}>
                    {journeyData?.isActive 
                        ? `ETA: ${new Date(journeyData.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Status: En route` 
                        : "No active journey"}
                </Text>
                
                <TouchableOpacity 
                    style={[styles.actionButton, !journeyData?.isActive && { opacity: 0.5 }]}
                    disabled={!journeyData?.isActive}
                    onPress={() => router.push({
                        pathname: '/guardian-dashboard/monitor-journey',
                        params: { userEmail: protectingEmail }
                    })}
                >
                    <Text style={styles.actionButtonText}>View Journey Details</Text>
                    <Ionicons name="navigate-outline" size={14} color="#1A1B4B" style={{marginLeft: 5}} />
                </TouchableOpacity>
            </View>
            <View style={[styles.mapContainer, { backgroundColor: '#D1C4E9' }]}>
                <Ionicons name="bicycle" size={50} color="#957DAD" />
            </View>
        </View>

        <TouchableOpacity 
          style={[styles.emergencyButton, isSosActive && { borderColor: 'red', borderWidth: 1 }]}
          onPress={() => router.push('/guardian-dashboard/contact-authorities')}
        >
            <Text style={[styles.emergencyButtonText, isSosActive && { color: 'red' }]}>Contact Emergency Services</Text>
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
  usersListSection: { marginBottom: 25 },
  usersListTitle: { fontSize: 16, fontWeight: '600', color: '#1A1B4B', marginBottom: 12 },
  usersList: { marginBottom: 10 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 2, borderColor: '#EEE' },
  userCardActive: { borderColor: '#6A5ACD', backgroundColor: '#FAF7FC' },
  userCardImage: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#DDD' },
  userCardContent: { flex: 1 },
  userCardName: { fontSize: 15, fontWeight: '600', color: '#1A1B4B' },
  userCardStatus: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  sosCard: { padding: 25, borderRadius: 20, marginBottom: 15, height: 180, justifyContent: 'center', elevation: 5 },
  sosHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  urgentLabel: { color: '#E0E0E0', fontSize: 14, fontWeight: 'bold' },
  sosTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', lineHeight: 32, marginBottom: 10 },
  sosTimeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  sosTime: { color: '#EEE', fontSize: 14, marginLeft: 6, fontWeight: '500' },
  sectionContainer: { marginBottom: 25 },
  subHeader: { color: '#6A5ACD', fontSize: 14, marginBottom: 5 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1A1B4B' },
  statusText: { fontSize: 16, marginBottom: 15, fontWeight: '600' },
  userImage: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#DDD', borderWidth: 2, borderColor: '#FFF' },
  callButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#9D80CB', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignSelf: 'flex-start' },
  callButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15 },
  cardContainer: { backgroundColor: '#FFF', marginBottom: 25, flexDirection: 'row', alignItems: 'center', borderRadius: 15, padding: 15, elevation: 1 },
  locationTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 5 },
  timeText: { fontSize: 13, color: '#666', marginBottom: 15 },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F0FA', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignItems: 'center', marginTop: 5 },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: '#1A1B4B' },
  mapContainer: { width: 100, height: 80, borderRadius: 12, backgroundColor: '#D1C4E9', justifyContent: 'center', alignItems: 'center' },
  emergencyButton: { backgroundColor: '#E8E6F0', paddingVertical: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#FF4B4B' },
  emergencyButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FF4B4B' },
}); 