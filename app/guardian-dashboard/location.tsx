import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

// =====================================================================
// CRITICAL FIX: DO NOT ADD 'import ... from react-native-maps' HERE.
// We load it dynamically below ONLY if we are on a phone.
// =====================================================================

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    // We use 'require' so the Web bundler ignores this block entirely
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.error("Failed to load Maps:", e);
  }
}

export default function GuardianLocationScreen() {
  const mapRef = useRef<any>(null);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [protectingUser, setProtectingUser] = useState('User');
  
  // Default Location (Kerala coordinates instead of California)
  const [location, setLocation] = useState({
    latitude: 10.8505,
    longitude: 76.2711,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [lastUpdated, setLastUpdated] = useState('Fetching...');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 1. Get Guardian Email and Fetch All Users (Update when screen is focused)
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          const data = await AsyncStorage.getItem('user');
          const selectedUserData = await AsyncStorage.getItem('selectedUser');
          
          if (data) {
            const parsed = JSON.parse(data);
            setGuardianEmail(parsed.guardianEmail);
            if (parsed.protecting) {
              setProtectingUser(parsed.protecting);
            }
            // Fetch all users for this guardian
            if (parsed.guardianEmail) {
              fetchAllUsers(parsed.guardianEmail);
            }
          }

          // Load selected user if available
          if (selectedUserData) {
            const selectedUser = JSON.parse(selectedUserData);
            setSelectedUserId(selectedUser.userId);
            setProtectingUser(selectedUser.userName);
          }
        } catch(e) { console.error(e); }
      };
      loadData();
    }, [])
  );

  // 2. Fetch All Users
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
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 3. Poll for Location Updates for All Users
  useEffect(() => {
    if (allUsers.length === 0) return;

    const fetchLocations = async () => {
      try {
        // Fetch locations for all users
        const userLocations = await Promise.all(
          allUsers.map(user => 
            api.post('/guardian/sos-status', {
              protectingEmail: user.email
            }).catch(() => null)
          )
        );

        // Update all user locations
        const updatedUsers = allUsers.map((user, index) => {
          const response = userLocations[index];
          if (response?.status === 200) {
            return {
              ...user,
              isSosActive: response.data.isSosActive,
              location: response.data.location,
              lastSosTime: response.data.lastSosTime,
            };
          }
          return user;
        });

        setAllUsers(updatedUsers);
      } catch (error) {
        // Silent catch for polling
      }
    };

    fetchLocations();
    const interval = setInterval(fetchLocations, 5000);
    return () => clearInterval(interval);
  }, [allUsers.length]); // Only re-run if number of users changes

  // 4. Update map when user selection changes or location data updates
  useEffect(() => {
    if (!selectedUserId || allUsers.length === 0) return;

    const selectedUser = allUsers.find(u => u._id === selectedUserId);
    if (!selectedUser) return;

    setProtectingUser(selectedUser.name);

    const userLocation = selectedUser.location || selectedUser.currentLocation;
    if (userLocation && userLocation.latitude !== 0) {
      const newRegion = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      
      setLocation(newRegion);
      
      // Animate map to selected user location
      if (mapRef.current && MapView) {
        mapRef.current.animateToRegion(newRegion, 500);
      }

      const timeStr = new Date(userLocation.timestamp || selectedUser.lastSosTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdated(timeStr);
    }
  }, [selectedUserId, allUsers]);

  // 5. Open External Maps
  const handleNavigate = async () => {
    if (!location.latitude || !location.longitude) {
      Alert.alert("Location Unavailable", "User location data is not available yet. Please wait for location update.");
      return;
    }

    const lat = location.latitude;
    const lng = location.longitude;
    const userName = protectingUser || "User Location";
    
    let url = "";
    
    if (Platform.OS === 'ios') {
      // iOS: Use Apple Maps
      url = `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(userName)}`;
    } else if (Platform.OS === 'android') {
      // Android: Use Google Maps
      url = `geo:${lat},${lng}?q=${encodeURIComponent(userName)}`;
    } else {
      // Web: Use Google Maps URL
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      // Fallback: Open Google Maps web
      try {
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        await Linking.openURL(webUrl);
      } catch (webError) {
        Alert.alert("Error", "Unable to open maps application. Please try again.");
      }
    }
  };

  // --- RENDER FOR WEB (Fallback UI) ---
  if (Platform.OS === 'web' || !MapView) {
    const selectedUser = allUsers.find(u => u._id === selectedUserId) || allUsers[0];
    const isSosActive = selectedUser?.isSosActive || false;
    
    return (
      <View style={styles.webContainer}>
        <View style={styles.webContent}>
            <Ionicons name="map" size={80} color="#6A5ACD" />
            <Text style={styles.webTitle}>Live Map Tracking</Text>
            <Text style={styles.webSubtitle}>
                The interactive map is optimized for the mobile app.
                Showing {allUsers.length} tracked users.
            </Text>
            
            <View style={[styles.statusBadge, isSosActive ? styles.bgRed : styles.bgGreen]}>
                <Text style={[styles.statusText, isSosActive ? {color: 'red'} : {color: 'green'}]}>
                    {isSosActive ? "⚠️ SOS ACTIVE" : "✅ All Users Safe"}
                </Text>
            </View>

            <Text style={styles.webTime}>Last Updated: {lastUpdated}</Text>

            <TouchableOpacity style={styles.webButton} onPress={handleNavigate}>
                <Text style={styles.webButtonText}>Open in Google Maps</Text>
                <Ionicons name="open-outline" size={20} color="#FFF" style={{marginLeft: 10}} />
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- RENDER FOR MOBILE (Native Map) ---
  return (
    <View style={styles.container}>
      
      {/* This MapView is only rendered if we are NOT on web */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={location}
      >
        {/* Render markers for all users */}
        {allUsers.map((user) => {
          const userLocation = user.location || user.currentLocation;
          return userLocation && userLocation.latitude !== 0 ? (
            <Marker 
              key={user._id}
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title={user.name}
              description={`${user.isSosActive ? '🚨 SOS Active' : '✓ Safe'} - ${user.email}`}
              onPress={() => {
                setSelectedUserId(user._id);
                setProtectingUser(user.name);
              }}
            >
                <View style={[
                  styles.markerContainer,
                  user.isSosActive && styles.markerSOS
                ]}>
                    <Ionicons 
                      name={user.isSosActive ? "warning" : "person-circle"} 
                      size={user.isSosActive ? 32 : 40} 
                      color={user.isSosActive ? "red" : "#6A5ACD"} 
                    />
                </View>
            </Marker>
          ) : null;
        })}
      </MapView>

      {/* Floating Header */}
      <SafeAreaView style={styles.headerOverlay}>
        <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#7A7A7A" />
            <TextInput 
                placeholder="Search location..." 
                style={styles.searchInput}
                placeholderTextColor="#7A7A7A"
            />
        </View>
      </SafeAreaView>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleNavigate}>
            <Ionicons name="navigate" size={24} color="#1A1B4B" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet - User Selector */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragHandle} />
        
        <Text style={styles.sheetTitle}>Tracked Users ({allUsers.length})</Text>
        
        {/* User List */}
        <View style={styles.userListContainer}>
          {allUsers.map((user) => (
            <TouchableOpacity 
              key={user._id}
              style={[
                styles.userListItem,
                selectedUserId === user._id && styles.userListItemActive
              ]}
              onPress={() => {
                setSelectedUserId(user._id);
                setProtectingUser(user.name);
              }}
            >
              <View style={styles.userListItemContent}>
                <Text style={styles.userListItemName}>{user.name}</Text>
                <Text style={[
                  styles.userListItemStatus,
                  { color: user.sosActive ? '#FF4B4B' : '#00C851' }
                ]}>
                  {user.sosActive ? '🚨 SOS Active' : '✓ Safe'}
                </Text>
              </View>
              {selectedUserId === user._id && (
                <Ionicons name="checkmark-circle" size={20} color="#6A5ACD" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected User Details */}
        {allUsers.length > 0 && (
          <>
            <Text style={styles.userLabel}>Tracking: <Text style={styles.userName}>{protectingUser}</Text></Text>
            
            <Text style={styles.statusTitle}>
                Live Location : {allUsers.find(u => u._id === selectedUserId)?.sosActive ? 
                  <Text style={{color:'red'}}>Active (SOS)</Text> : "Active"}
            </Text>
            <Text style={styles.statusDesc}>
                Last updated: {lastUpdated} {'\n'}
                Tracking {allUsers.length} user movements in real time
            </Text>

            <Text style={styles.destLabel}>All Users Monitored</Text>
            <Text style={styles.etaLabel}>Real-time updates enabled</Text>

            <TouchableOpacity style={styles.viewJourneyBtn}>
                <Text style={styles.viewJourneyText}>View All Journey Details</Text>
                <Ionicons name="location-outline" size={16} color="#1A1B4B" />
            </TouchableOpacity>

            {/* Navigate Button */}
            <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate}>
                <Text style={styles.navigateBtnText}>Navigate to Selected User</Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  map: { width: '100%', height: '50%' }, 
  
  // WEB STYLES
  webContainer: { flex: 1, backgroundColor: '#FAF9FF', justifyContent: 'center', alignItems: 'center' },
  webContent: { backgroundColor: 'white', padding: 40, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  webTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1B4B', marginTop: 20 },
  webSubtitle: { fontSize: 16, color: '#7A7A7A', textAlign: 'center', marginVertical: 10, maxWidth: 300 },
  webButton: { flexDirection: 'row', backgroundColor: '#6A5ACD', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, marginTop: 20 },
  webButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  webTime: { marginTop: 10, color: '#999', fontSize: 14 },
  statusBadge: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 15 },
  bgRed: { backgroundColor: '#FFEBEE' },
  bgGreen: { backgroundColor: '#E8F5E9' },
  statusText: { fontWeight: 'bold', fontSize: 16 },

  // MOBILE STYLES
  headerOverlay: { position: 'absolute', top: 10, left: 20, right: 20, flexDirection: 'row', alignItems: 'center' },
  searchBar: { 
    flex: 1, flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 25, 
    paddingHorizontal: 15, height: 50, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, elevation: 5, marginTop: 40, marginLeft: 10, marginRight: 10
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },

  mapControls: { position: 'absolute', right: 20, top: '25%' },
  controlBtn: { 
    width: 45, height: 45, backgroundColor: '#FFF', borderRadius: 8, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 3 
  },

  markerContainer: { backgroundColor: '#FFF', borderRadius: 20, padding: 2 },
  markerSOS: { backgroundColor: '#FFEBEE', borderWidth: 2, borderColor: 'red' },

  bottomSheet: {
    flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25,
    padding: 20, marginTop: -20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    paddingBottom: 30
  },
  dragHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15 },
  
  userListContainer: { marginBottom: 20, maxHeight: 200 },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#EEE',
  },
  userListItemActive: {
    backgroundColor: '#FAF7FC',
    borderColor: '#6A5ACD',
  },
  userListItemContent: {
    flex: 1,
  },
  userListItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1B4B',
  },
  userListItemStatus: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  userLabel: { fontSize: 14, color: '#7A7A7A', marginBottom: 10 },
  userName: { fontWeight: '700', color: '#6A5ACD', fontSize: 15 },
  
  statusTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B' },
  statusDesc: { fontSize: 13, color: '#666', marginTop: 5, lineHeight: 18 },
  
  destLabel: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B', marginTop: 15 },
  etaLabel: { fontSize: 13, color: '#6A5ACD', marginBottom: 15 },

  viewJourneyBtn: { 
    flexDirection: 'row', backgroundColor: '#E8E6F0', padding: 12, borderRadius: 20, 
    alignSelf: 'flex-start', alignItems: 'center', marginBottom: 20 
  },
  viewJourneyText: { fontSize: 14, fontWeight: '600', color: '#1A1B4B', marginRight: 5 },

  navigateBtn: { backgroundColor: '#7B61FF', padding: 15, borderRadius: 12, alignItems: 'center' },
  navigateBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});