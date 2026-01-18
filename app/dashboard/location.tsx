import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapComponent from '../../components/MapComponent';
import api from '../../services/api';
import { useSession } from '../../services/SessionContext';

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
  const { user } = useSession();
  const mapRef = useRef<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('My Location');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(13);

  // User's Current Location
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        try {
          // Use session context if available, otherwise fall back to AsyncStorage
          if (user) {
            setUserEmail(user.email);
            setUserName(user.name || 'My Location');
          } else {
            const storedUser = await AsyncStorage.getItem('user');
            if (storedUser) {
              const parsed = JSON.parse(storedUser);
              setUserEmail(parsed.email);
              setUserName(parsed.name || 'My Location');
            }
          }
          await requestAndUpdateLocation();
        } catch (error) {
          console.error('Load user error:', error);
        } finally {
          setLoadingLocation(false);
        }
      };
      loadUserData();
    }, [user])
  );

  const requestAndUpdateLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location');
        setLoadingLocation(false);
        return;
      }

      let currentLocation = null;

      // Try to get current location
      try {
        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000
        });
      } catch (locationError) {
        console.warn('Failed to get current location, attempting to use last known location:', locationError);
        // Fallback to last known location
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          currentLocation = lastKnown;
          console.log('Using last known location');
        } else {
          throw new Error('Unable to get location. Please ensure location services are enabled.');
        }
      }

      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      };

      setUserLocation(newLocation);

      // Send location to backend
      const emailToSend = userEmail || user?.email;
      if (emailToSend) {
        try {
          await api.post('/user/update-location', {
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            email: emailToSend
          });
          console.log('Location updated successfully on backend');
        } catch (apiError) {
          console.warn('Failed to update location on backend:', apiError);
          // Don't fail the entire operation if backend update fails
        }
      } else {
        console.warn('No email available to send location update');
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to get your location. Make sure location services are enabled.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleDirections = (place: any) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const label = place.name;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${place.coords.latitude},${place.coords.longitude}&q=${label}`,
      android: `geo:${place.coords.latitude},${place.coords.longitude}?q=${place.coords.latitude},${place.coords.longitude}(${label})`,
    });
    if (url) Linking.openURL(url);
  };

  const handleZoomIn = () => {
    if (mapRef.current && zoomLevel < 20) {
      const newZoom = zoomLevel + 1;
      setZoomLevel(newZoom);
      mapRef.current.animateToRegion({
        latitude: userLocation?.latitude || 9.9816,
        longitude: userLocation?.longitude || 76.2856,
        latitudeDelta: 20 / newZoom,
        longitudeDelta: 20 / newZoom,
      });
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && zoomLevel > 5) {
      const newZoom = zoomLevel - 1;
      setZoomLevel(newZoom);
      mapRef.current.animateToRegion({
        latitude: userLocation?.latitude || 9.9816,
        longitude: userLocation?.longitude || 76.2856,
        latitudeDelta: 20 / newZoom,
        longitudeDelta: 20 / newZoom,
      });
    }
  };

  const handleCenterView = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } else {
      Alert.alert('Location Not Available', 'Unable to center on your location');
    }
  };

  const handleNavigateToMyLocation = async () => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Unable to navigate');
      return;
    }
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${userLocation.latitude},${userLocation.longitude}&q=My Location`,
      android: `geo:${userLocation.latitude},${userLocation.longitude}?q=${userLocation.latitude},${userLocation.longitude}(My Location)`,
    });
    if (url) Linking.openURL(url);
  };

  const renderPlaceItem = ({ item }: { item: any }) => (
    <View style={styles.placeCard} key={item.id}>
      <View style={styles.placeIconBox}>
        <Ionicons name={item.icon as any} size={24} color="#1A1B4B" />
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{item.name}</Text>
        <Text style={styles.placeAddress}>{item.address}</Text>
        <Text style={styles.placeHours}>{item.hours}</Text>
      </View>
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
        <TouchableOpacity onPress={requestAndUpdateLocation} style={{ padding: 8 }}>
          <Ionicons name={loadingLocation ? "hourglass" : "refresh"} size={24} color="#6A5ACD" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* --- MAP SECTION --- */}
        <View style={styles.mapContainer}>
          {userLocation ? (
            <>
              <MapComponent
                initialLatitude={userLocation.latitude}
                initialLongitude={userLocation.longitude}
                mapRef={mapRef}
                markers={[
                  {
                    id: 'user',
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    title: userName,
                    description: 'Your current location',
                    color: '#6A5ACD',
                  },
                  ...SAFE_PLACES.map((place) => ({
                    id: place.id,
                    latitude: place.coords.latitude,
                    longitude: place.coords.longitude,
                    title: place.name,
                    description: place.address,
                    color: '#FF6B6B',
                  })),
                ]}
                onMarkerPress={(marker: any) => {
                  const place = SAFE_PLACES.find((p) => p.id === marker.id);
                  if (place) {
                    handleDirections(place);
                  }
                }}
              />

              {/* Map Controls */}
              <View style={styles.mapControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={handleCenterView}>
                  <Ionicons name="locate" size={24} color="#1A1B4B" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.controlBtn} onPress={handleNavigateToMyLocation}>
                  <Ionicons name="navigate" size={24} color="#1A1B4B" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.mapLoadingContainer}>
              <Ionicons name="map" size={50} color="#6A5ACD" />
              <Text style={{color: '#666', marginTop: 10}}>Getting location...</Text>
            </View>
          )}
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
          {SAFE_PLACES.map(item => renderPlaceItem({ item }))}
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
  mapContainer: { height: 350, width: '100%', position: 'relative', marginBottom: 20, borderRadius: 15, overflow: 'hidden' },
  mapLoadingContainer: { width: '100%', height: '100%', backgroundColor: '#F3F0FA', justifyContent: 'center', alignItems: 'center', borderRadius: 15 },
  mapControls: { position: 'absolute', bottom: 20, right: 20, gap: 10 },
  controlBtn: { 
    width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }
  },
  chipsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 15, marginBottom: 15 },
  chip: { 
    flexDirection: 'row', backgroundColor: '#E8E6F0', paddingHorizontal: 15, paddingVertical: 10, 
    borderRadius: 20, marginRight: 10, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1
  },
  chipText: { marginLeft: 8, fontWeight: '600', color: '#1A1B4B' },
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
  heatZoneContainer: { paddingHorizontal: 20, marginTop: 10 },
  heatZoneTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 10 },
  heatZoneButton: { backgroundColor: '#E8E6F0', padding: 15, borderRadius: 12, alignItems: 'center' },
  heatZoneText: { fontSize: 14, fontWeight: '600', color: '#1A1B4B' }
});