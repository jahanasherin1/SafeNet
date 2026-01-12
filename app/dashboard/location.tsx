import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- LAZY LOAD MAPS ONLY ON NATIVE PLATFORMS ---
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
let mapsLoaded = false;

const loadMapsIfNeeded = () => {
  if (mapsLoaded || Platform.OS === 'web') return;
  
  try {
    const reactNativeMaps = require('react-native-maps');
    MapView = reactNativeMaps.default;
    Marker = reactNativeMaps.Marker;
    PROVIDER_GOOGLE = reactNativeMaps.PROVIDER_GOOGLE;
    mapsLoaded = true;
  } catch (e) {
    console.warn("Maps module not available:", e);
  }
};

// Dummy Data for Safe Places (Kerala locations)
const SAFE_PLACES = [
  {
    id: '1',
    type: 'Police',
    name: 'Kochi Police Station',
    address: 'Ernakulathappan Road, Kochi, Kerala',
    hours: 'Open 24 hours',
    icon: 'car-sport',
    coords: { latitude: 9.9816, longitude: 76.2856 }
  },
  {
    id: '2',
    type: 'Hospital',
    name: 'General Hospital Kochi',
    address: 'West Fort, Kochi, Kerala',
    hours: 'Open 24 hours',
    icon: 'medkit',
    coords: { latitude: 9.9689, longitude: 76.2532 }
  },
  {
    id: '3',
    type: 'SafeZone',
    name: 'Community Safe Zone',
    address: 'Panampilly Nagar, Kochi, Kerala',
    hours: 'Open 24 hours',
    icon: 'shield-checkmark',
    coords: { latitude: 9.9901, longitude: 76.3247 }
  },
];

export default function UserLocationScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('My Location');
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Map Region (Kerala coordinates instead of San Francisco)
  const [region, setRegion] = useState({
    latitude: 10.8505,
    longitude: 76.2711,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // User's Current Location
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);

  // Load user data on screen focus
  useFocusEffect(
    React.useCallback(() => {
      // Load maps module if on native platform
      loadMapsIfNeeded();
      
      const loadUserData = async () => {
        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUserEmail(parsed.email);
            setUserName(parsed.name || 'My Location');
            
            // Get current location
            await requestAndUpdateLocation();
          }
        } catch (error) {
          console.error('Load user error:', error);
        } finally {
          setLoadingLocation(false);
        }
      };
      loadUserData();
    }, [])
  );

  // Request location permission and get current location
  const requestAndUpdateLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      };

      setUserLocation(newLocation);
      
      // Update region to center on user
      setRegion({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      // Animate map to user location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }, 1000);
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location');
    }
  };

  const handleDirections = (place: any) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${place.coords.latitude},${place.coords.longitude}`;
    const label = place.name;
    
    // Web Link
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${place.coords.latitude},${place.coords.longitude}`;

    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${place.coords.latitude},${place.coords.longitude}&q=${encodeURIComponent(label)}`,
      android: `geo:${place.coords.latitude},${place.coords.longitude}?q=${encodeURIComponent(label)}`,
      web: webUrl
    });

    if(url) {
      Linking.openURL(url).catch(err => {
        console.error('Error opening maps:', err);
        // Fallback to web
        Linking.openURL(webUrl);
      });
    }
  };

  // Navigate to user's own location
  const handleNavigateToMyLocation = async () => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Unable to open location');
      return;
    }

    const webUrl = `https://www.google.com/maps/search/?api=1&query=${userLocation.latitude},${userLocation.longitude}`;

    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${userLocation.latitude},${userLocation.longitude}&q=${encodeURIComponent(userName)}`,
      android: `geo:${userLocation.latitude},${userLocation.longitude}?q=${encodeURIComponent(userName)}`,
      web: webUrl
    });

    if(url) {
      Linking.openURL(url).catch(() => Linking.openURL(webUrl));
    }
  };

  const renderPlaceItem = ({ item }: { item: any }) => (
    <View style={styles.placeCard}>
      {/* Icon Box */}
      <View style={styles.placeIconBox}>
        <Ionicons name={item.icon as any} size={24} color="#1A1B4B" />
      </View>

      {/* Info */}
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{item.name}</Text>
        <Text style={styles.placeAddress}>{item.address}</Text>
        <Text style={styles.placeHours}>{item.hours}</Text>
      </View>

      {/* Directions Button */}
      <TouchableOpacity style={styles.directionsBtn} onPress={() => handleDirections(item)}>
        <Text style={styles.directionsText}>Directions</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}> 
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Live Location</Text>
          {userLocation && (
            <Text style={styles.headerSubtitle}>
              {loadingLocation ? 'Getting location...' : '📍 Active'}
            </Text>
          )}
        </View>
        <TouchableOpacity 
          onPress={requestAndUpdateLocation}
          style={{ padding: 8 }}
        >
          <Ionicons 
            name={loadingLocation ? "hourglass" : "refresh"} 
            size={24} 
            color="#6A5ACD" 
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- MAP SECTION --- */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' || !MapView ? (
            // Web Fallback
            <View style={styles.webMapFallback}>
              <Ionicons name="map" size={50} color="#6A5ACD" />
              <Text style={{color: '#666', marginTop: 10}}>Map view available on mobile</Text>
            </View>
          ) : (
            // Mobile Map
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={region}
              showsUserLocation={true}
              followsUserLocation={true}
              onMapReady={() => {
                if (userLocation && mapRef.current) {
                  mapRef.current.animateToRegion({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }, 500);
                }
              }}
            >
              {/* User's Location Marker */}
              {userLocation && (
                <Marker
                  coordinate={userLocation}
                  title={userName}
                  description="Your Location"
                >
                  <View style={styles.userMarker}>
                    <Ionicons name="person-circle" size={40} color="#6A5ACD" />
                  </View>
                </Marker>
              )}

              {/* Safe Places Markers */}
              {SAFE_PLACES.map(place => (
                <Marker
                  key={place.id}
                  coordinate={place.coords}
                  title={place.name}
                  description={place.type}
                >
                  <View style={styles.safeMarker}>
                    <Ionicons name={place.icon as any} size={24} color="#1A1B4B" />
                  </View>
                </Marker>
              ))}
            </MapView>
          )}

          {/* Floating Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#7A7A7A" />
            <TextInput 
              placeholder="Search for a location" 
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Map Controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity 
              style={styles.controlBtn}
              onPress={requestAndUpdateLocation}
            >
              <Ionicons name="locate" size={24} color="#1A1B4B" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlBtn}
              onPress={handleNavigateToMyLocation}
            >
              <Ionicons name="navigate" size={24} color="#1A1B4B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- FILTER CHIPS --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
          <TouchableOpacity style={styles.chip}>
            <Ionicons name="car-sport" size={18} color="#1A1B4B" />
            <Text style={styles.chipText}>Police</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip}>
            <Ionicons name="medkit" size={18} color="#1A1B4B" />
            <Text style={styles.chipText}>Hospital</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip}>
            <Ionicons name="shield-checkmark" size={18} color="#1A1B4B" />
            <Text style={styles.chipText}>Safe Zones</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* --- LIST SECTION --- */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>Choose the nearest safe place for immediate help</Text>
          
          {SAFE_PLACES.map(item => (
             <View key={item.id}>{renderPlaceItem({ item })}</View>
          ))}
        </View>

        {/* --- HEAT ZONES --- */}
        <View style={styles.heatZoneContainer}>
            <Text style={styles.heatZoneTitle}>Heat zones</Text>
            <TouchableOpacity style={styles.heatZoneButton}>
                <Text style={styles.heatZoneText}>Show/Hide Heat Zones</Text>
            </TouchableOpacity>
        </View>

        <View style={{height: 100}} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  headerSubtitle: { fontSize: 12, color: '#6A5ACD', marginTop: 4, fontWeight: '600' },
  
  scrollContent: { flexGrow: 1 },

  // Map
  mapContainer: { height: 300, width: '100%', position: 'relative' },
  map: { width: '100%', height: '100%' },
  webMapFallback: { width: '100%', height: '100%', backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  
  // Markers
  userMarker: { backgroundColor: '#FFF', borderRadius: 20, padding: 2, borderWidth: 2, borderColor: '#6A5ACD' },
  safeMarker: { backgroundColor: '#FFF', borderRadius: 15, padding: 8, shadowColor: '#000', shadowOpacity: 0.1, elevation: 3 },
  
  // Search
  searchBar: { 
    position: 'absolute', top: 20, left: 20, right: 20, 
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 15, 
    paddingHorizontal: 15, height: 50, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, elevation: 5 
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },

  // Controls
  mapControls: { position: 'absolute', bottom: 20, right: 20 },
  controlBtn: { 
    width: 45, height: 45, backgroundColor: '#FFF', borderRadius: 10, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 3 
  },

  // Chips
  chipsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: -25, marginBottom: 15 },
  chip: { 
    flexDirection: 'row', backgroundColor: '#E8E6F0', paddingHorizontal: 15, paddingVertical: 10, 
    borderRadius: 20, marginRight: 10, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1
  },
  chipText: { marginLeft: 8, fontWeight: '600', color: '#1A1B4B' },

  // List
  listSection: { paddingHorizontal: 20, marginTop: 10 },
  sectionHeader: { fontSize: 16, fontWeight: '600', color: '#1A1B4B', marginBottom: 15 },
  
  placeCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  placeIconBox: { 
    width: 50, height: 50, backgroundColor: '#F3F0FA', borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center' 
  },
  placeInfo: { flex: 1, marginLeft: 15 },
  placeName: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  placeAddress: { fontSize: 13, color: '#6A5ACD', marginVertical: 2 },
  placeHours: { fontSize: 12, color: '#7A7A7A' },
  
  directionsBtn: { backgroundColor: '#E8E6F0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  directionsText: { fontSize: 12, fontWeight: 'bold', color: '#1A1B4B' },

  // Heat Zones
  heatZoneContainer: { paddingHorizontal: 20, marginTop: 10 },
  heatZoneTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 10 },
  heatZoneButton: { backgroundColor: '#E8E6F0', padding: 15, borderRadius: 12, alignItems: 'center' },
  heatZoneText: { fontSize: 14, fontWeight: '600', color: '#1A1B4B' }
});