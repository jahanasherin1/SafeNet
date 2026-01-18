import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Linking, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

const { height: screenHeight } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = screenHeight * 0.55;
const SHEET_MIN_HEIGHT = 140; 
const DRAG_THRESHOLD = 50;

// --- CONDITIONAL MAP IMPORT ---
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const mapModule = require('react-native-maps');
    MapView = mapModule.default || mapModule;
    Marker = mapModule.Marker;
    PROVIDER_GOOGLE = mapModule.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn("Maps not available:", e);
  }
}

export default function GuardianLocationScreen() {
  const mapRef = useRef<any>(null);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [protectingUser, setProtectingUser] = useState('User');
  
  // Animation Value
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Default Location
  const [location, setLocation] = useState({
    latitude: 10.8505,
    longitude: 76.2711,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // --- PAN RESPONDER ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 10,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0 && !isCollapsed) { 
           animatedValue.setValue(dy);
        } else if (dy < 0 && isCollapsed) { 
           animatedValue.setValue(SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT + dy);
        }
      },
      onPanResponderRelease: (_, { dy }) => {
        if (dy > DRAG_THRESHOLD && !isCollapsed) {
          collapseSheet();
        } else if (dy < -DRAG_THRESHOLD && isCollapsed) {
          expandSheet();
        } else {
          if (isCollapsed) collapseSheet();
          else expandSheet();
        }
      },
    })
  ).current;

  const expandSheet = () => {
    Animated.spring(animatedValue, {
      toValue: 0,
      useNativeDriver: true,
    }).start(() => setIsCollapsed(false));
  };

  const collapseSheet = () => {
    Animated.spring(animatedValue, {
      toValue: SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT,
      useNativeDriver: true,
    }).start(() => setIsCollapsed(true));
  };

  // Cleanup state on unmount to prevent data persistence
  useEffect(() => {
    return () => {
      setAllUsers([]);
      setSelectedUserId('');
      setGuardianEmail('');
      setLocation({
        latitude: 10.8505,
        longitude: 76.2711,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    };
  }, []);

  const bottomSheetTranslateY = animatedValue.interpolate({
    inputRange: [0, SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT],
    outputRange: [0, SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  // --- DATA LOADING ---
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          const data = await AsyncStorage.getItem('user');
          if (data) {
            const parsed = JSON.parse(data);
            setGuardianEmail(parsed.guardianEmail);
            if (parsed.guardianEmail) fetchAllUsers(parsed.guardianEmail);
          }
        } catch(e) { console.error(e); }
      };
      loadData();
    }, [])
  );

  const fetchAllUsers = async (email: string) => {
    try {
      const response = await api.post('/guardian/all-users', { guardianEmail: email });
      if (response.status === 200) {
        setAllUsers(response.data.users);
        if (response.data.users.length > 0 && !selectedUserId) {
          setSelectedUserId(response.data.users[0]._id);
          setProtectingUser(response.data.users[0].name);
        }
      }
    } catch (error) {}
  };

  // --- POLLING LOGIC (REAL-TIME LOCATION UPDATES) ---
  useEffect(() => {
    if (allUsers.length === 0) return;
    
    // Poll every 3 seconds for real-time updates
    const interval = setInterval(async () => {
      try {
        const results = await Promise.all(
          allUsers.map(user => 
            api.post('/guardian/sos-status', { protectingEmail: user.email })
            .then(res => ({ email: user.email, res: res }))
            .catch(() => null)
          )
        );

        setAllUsers(prev => prev.map((u) => {
          const match = results.find(r => r?.email === u.email);
          if(match && match.res?.status === 200) {
             const data = match.res.data;
             const loc = data.location;
             
             // Format timestamp for display
             const timeStr = new Date(loc?.timestamp || data.lastSosTime || new Date())
                .toLocaleString([], { 
                    day: 'numeric', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });

             return { 
               ...u, 
               ...data, 
               individualLastUpdated: timeStr,
               locationUpdateTime: loc?.timestamp
             };
          }
          return u;
        }));
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000); // Changed from 5000ms to 3000ms for real-time updates
    
    return () => clearInterval(interval);
  }, [allUsers.length]);

  // Update map focus only when user selection changes
  useEffect(() => {
    if (!selectedUserId) return;
    const selectedUser = allUsers.find(u => u._id === selectedUserId);
    setProtectingUser(selectedUser?.name || 'User');
    
    const loc = selectedUser?.location || selectedUser?.currentLocation;
    if (loc && loc.latitude !== 0 && mapRef.current && MapView) {
      mapRef.current.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }, [selectedUserId]);

  // Handle External Navigation
  const handleNavigate = async () => {
    const selectedUser = allUsers.find(u => u._id === selectedUserId);
    const loc = selectedUser?.location || selectedUser?.currentLocation;
    
    if (!loc || !loc.latitude) {
      Alert.alert("Location Unavailable", "Wait for location update.");
      return;
    }

    const lat = loc.latitude;
    const lng = loc.longitude;
    const label = selectedUser?.name || "User";
    
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${lat},${lng}&q=${label}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      web: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    });

    if(url) Linking.openURL(url);
  };

  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webContainer}>
        <Ionicons name="map" size={60} color="#6A5ACD" />
        <Text style={styles.webText}>Live Map available on Mobile</Text>
      </View>
    );
  }

  // --- DYNAMIC DATA FOR CURRENT SELECTED USER ---
  const selectedUser = allUsers.find(u => u._id === selectedUserId);
  const selectedUserTime = selectedUser?.individualLastUpdated || 'Fetching...';

  return (
    <View style={styles.container}>
      
      {/* 1. MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={location}
        rotateEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: SHEET_MIN_HEIGHT, left: 0 }}
      >
        {allUsers.map((user) => {
          const loc = user.location || user.currentLocation;
          if (!loc || loc.latitude === 0) return null;
          return (
            <Marker 
              key={user._id}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              title={user.name}
              onPress={() => setSelectedUserId(user._id)}
            >
              <View style={[styles.markerRing, user.sosActive && styles.markerSos]}>
                 <Ionicons name="person" size={20} color="#FFF" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* 2. TOP HEADER */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={styles.statusPill}>
           <View style={[styles.dot, {backgroundColor: selectedUser?.sosActive ? '#FF4B4B' : '#00C851'}]} />
           <Text style={styles.statusText}>
             {allUsers.length} Users • {selectedUser?.sosActive ? "SOS ACTIVE" : "Live"}
           </Text>
        </View>
      </SafeAreaView>

      {/* 4. DRAGGABLE BOTTOM SHEET */}
      <Animated.View 
        style={[
          styles.bottomSheet, 
          { transform: [{ translateY: bottomSheetTranslateY }] }
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Users Being Tracked</Text>
          
          {/* User List */}
          <View style={styles.userList}>
            {allUsers.map((user) => (
              <TouchableOpacity 
                key={user._id} 
                style={[
                  styles.userCard, 
                  selectedUserId === user._id && styles.userCardActive
                ]}
                onPress={() => {
                  setSelectedUserId(user._id);
                  expandSheet(); 
                }}
              >
                <View style={[styles.avatar, user.sosActive ? {backgroundColor:'#FFEBEE'} : {backgroundColor:'#E8F5E9'}]}>
                   <Ionicons name={user.sosActive ? "warning" : "shield-checkmark"} size={22} color={user.sosActive ? "#FF4B4B" : "#00C851"} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userStatus}>
                    {user.sosActive ? "SOS Active" : "Safe"}
                  </Text>
                </View>
                {selectedUserId === user._id && <Ionicons name="checkmark-circle" size={20} color="#6A5ACD" />}
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Selected User Details (Shows Date + Time) */}
          <View style={styles.detailsContainer}>
             <View style={styles.statusBox}>
                <Ionicons name={selectedUser?.sosActive ? "warning" : "navigate-circle"} size={24} color={selectedUser?.sosActive ? "#FF4B4B" : "#6A5ACD"} />
                <View style={{marginLeft: 10, flex: 1}}>
                   <Text style={styles.statusTitle}>{selectedUser?.sosActive ? "🚨 SOS ACTIVE" : "✅ User is Safe"}</Text>
                   {selectedUser?.sosActive && selectedUser?.lastSosTime ? (
                     <Text style={styles.statusDesc}>
                       SOS Tapped: {new Date(selectedUser.lastSosTime).toLocaleString([], { 
                         day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                       })}
                     </Text>
                   ) : (
                     <Text style={styles.statusDesc}>Last updated: {selectedUserTime}</Text>
                   )}
                </View>
             </View>

             <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate}>
                <Ionicons name="navigate" size={18} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.navigateBtnText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.navigateBtn, {backgroundColor: '#E8E6F0', marginTop: 10}]} 
              onPress={() => {
                const loc = selectedUser?.location || selectedUser?.currentLocation;
                if(loc && mapRef.current) mapRef.current.animateToRegion({
                  latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05
                }, 500);
              }}
            >
                <Ionicons name="locate-sharp" size={18} color="#6A5ACD" style={{marginRight: 8}} />
                <Text style={[styles.navigateBtnText, {color: '#6A5ACD'}]}>Center View</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  headerOverlay: { position: 'absolute', top: 20, alignSelf: 'center' },
  statusPill: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.1, elevation: 3
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#1A1B4B' },
  markerRing: {
    backgroundColor: '#6A5ACD', width: 36, height: 36, borderRadius: 18, 
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.3, elevation: 5
  },
  markerSos: { backgroundColor: '#FF4B4B', transform: [{scale: 1.2}] },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_MAX_HEIGHT,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 15,
  },
  dragArea: { 
    height: 30, width: '100%', alignItems: 'center', justifyContent: 'center',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3 },
  sheetContent: { paddingHorizontal: 20, flex: 1 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1A1B4B', marginBottom: 15 },
  userList: { gap: 10 },
  userCard: { 
    flexDirection: 'row', alignItems: 'center', padding: 12, 
    borderRadius: 16, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#F0F0F0' 
  },
  userCardActive: { borderColor: '#6A5ACD', backgroundColor: '#F3F0FA' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1A1B4B' },
  userStatus: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
  detailsContainer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
  statusBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: '#1A1B4B' },
  statusDesc: { fontSize: 12, color: '#999' },
  navigateBtn: { 
    backgroundColor: '#6A5ACD', 
    padding: 14, 
    borderRadius: 12, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 3,
  },
  navigateBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  webContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF9FF' },
  webText: { marginTop: 10, color: '#6A5ACD', fontWeight: '600' }
});