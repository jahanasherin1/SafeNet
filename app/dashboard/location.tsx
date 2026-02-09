import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapComponent from '../../components/MapComponent';
import WeatherAlertModal from '../../components/WeatherAlertModal';
import api from '../../services/api';
import { useSession } from '../../services/SessionContext';

interface SafePlace {
  id: string;
  type: 'police' | 'hospital';
  name: string;
  address: string;
  phoneNumber?: string;
  icon: string;
  coords: { latitude: number; longitude: number };
}

export default function UserLocationScreen() {
  const router = useRouter();
  const { user, weatherAlertVisible, setWeatherAlertVisible } = useSession();
  const mapRef = useRef<any>(null);
  
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('My Location');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid' | 'terrain'>('standard');
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'police' | 'hospital'>('all');

  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        try {
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
          // Show alert for critical errors only
          if (error instanceof Error && error.message.includes('permission')) {
            Alert.alert('Permission Required', 'Location permission is needed to use this feature.');
          }
        } finally {
          setLoadingLocation(false);
        }
      };
      loadUserData();
    }, [user])
  );

  // --- FIX: UNIVERSAL MAP CENTER FUNCTION ---
  const centerMapOnLocation = (lat: number, lng: number) => {
    if (!mapRef.current) return;

    if (Platform.OS === 'android') {
        // ANDROID (WebView): Inject JS to pan Leaflet map
        const script = `
            if (typeof map !== 'undefined') {
                map.setView([${lat}, ${lng}], 16);
            }
            true; // Required for injectJavaScript
        `;
        mapRef.current.injectJavaScript(script);
    } else {
        // iOS (Native): Use animateToRegion if function exists
        if (typeof mapRef.current.animateToRegion === 'function') {
            mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }, 1000);
        }
    }
  };

  const requestAndUpdateLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setLoadingLocation(false);
        return;
      }

      let currentLocation = await Location.getLastKnownPositionAsync();
      if (!currentLocation) {
        try {
          currentLocation = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced
          });
        } catch (gpsError: any) {
          console.error('GPS Error Details:', gpsError);
          Alert.alert(
            'Location Unavailable',
            'Could not retrieve your current location. Please ensure:\n\n• Location services are enabled\n• GPS is active\n• You have a clear view of the sky\n\nTap the refresh button to try again.',
            [
              { text: 'OK', onPress: () => setLoadingLocation(false) }
            ]
          );
          return;
        }
      }

      if (currentLocation) {
        const newLocation = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude
        };
        setUserLocation(newLocation);
        
        // Use the fixed helper function
        centerMapOnLocation(newLocation.latitude, newLocation.longitude);

        const emailToSend = userEmail || user?.email;
        if (emailToSend) {
            api.post('/user/update-location', {
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                email: emailToSend
            }).catch(() => {});
        }

        // Fetch nearby safe places
        fetchNearbySafePlaces(newLocation.latitude, newLocation.longitude);
      } else {
        Alert.alert(
          'Location Error',
          'Unable to determine your location. Please try again.',
          [
            { text: 'Retry', onPress: () => requestAndUpdateLocation() },
            { text: 'Cancel', onPress: () => setLoadingLocation(false) }
          ]
        );
      }
    } catch (error: any) {
      console.error("Location Error:", error?.message || error);
      Alert.alert(
        'Location Error',
        'An unexpected error occurred while fetching your location. Please try again.',
        [
          { text: 'Retry', onPress: () => requestAndUpdateLocation() },
          { text: 'Cancel', onPress: () => setLoadingLocation(false) }
        ]
      );
    } finally {
      setLoadingLocation(false);
    }
  };

  const fetchNearbySafePlaces = async (latitude: number, longitude: number) => {
    setLoadingPlaces(true);
    try {
      console.log('🔍 Fetching nearby safe places from Google Maps API...');
      console.log(`📍 Location: ${latitude}, ${longitude}`);
      
      const response = await api.post('/user/nearby-facilities', {
        latitude,
        longitude,
        radius: 5000, // 5km radius
      });

      console.log('📡 API Response:', response.data);

      if (response.data && response.data.facilities) {
        const facilities = response.data.facilities;
        console.log(`🗺️ Google Maps API returned ${facilities.length} facilities`);
        
        if (facilities.length > 0) {
          const formattedPlaces: SafePlace[] = facilities.map((facility: any, index: number) => {
            console.log(`[${index + 1}] ${facility.type.toUpperCase()}: ${facility.name}`);
            console.log(`    Address: ${facility.address}`);
            console.log(`    Phone: ${facility.phoneNumber || 'N/A'}`);
            console.log(`    Coords: ${facility.latitude}, ${facility.longitude}`);
            
            return {
              id: facility.id,
              type: facility.type,
              name: facility.name,
              address: facility.address,
              phoneNumber: facility.phoneNumber,
              icon: facility.type === 'police' ? 'car-sport' : 'medkit',
              coords: {
                latitude: facility.latitude,
                longitude: facility.longitude,
              },
            };
          });

          setSafePlaces(formattedPlaces);
          console.log(`✅ Successfully loaded ${formattedPlaces.length} safe places from Google Maps`);
        } else {
          setSafePlaces([]);
          console.log('⚠️ No facilities found in the 5km radius');
        }
      } else {
        setSafePlaces([]);
        console.log('⚠️ Invalid response format from API');
      }
    } catch (error: any) {
      console.error('❌ Error fetching nearby safe places:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      setSafePlaces([]);
      Alert.alert('Error', `Could not fetch nearby safe places.\n\nError: ${error.message}`);
    } finally {
      setLoadingPlaces(false);
    }
  };

  const handleDirections = (place: SafePlace) => {
    const label = place.name;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${place.coords.latitude},${place.coords.longitude}&q=${label}`,
      android: `geo:${place.coords.latitude},${place.coords.longitude}?q=${place.coords.latitude},${place.coords.longitude}(${label})`,
    });
    if (url) Linking.openURL(url);
  };

  const handleCall = (phoneNumber: string) => {
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not initiate phone call');
    });
  };

  // Extract area name from address (handles multiple formats)
  const extractAreaName = (address: string): string => {
    if (!address) return '';
    
    // Try to extract from comma-separated format
    const parts = address.split(',').map(part => part.trim());
    
    if (parts.length > 1) {
      // Return the area (usually 2nd or 3rd part before state/country)
      // e.g., "Koduvally Police Station, Koduvally, Kerala" -> "Koduvally"
      return parts[1];
    }
    
    // Fallback: try to extract from spaces or return first meaningful part
    const words = address.split(' ');
    return words[0] || address;
  };

  const renderPlaceItem = ({ item }: { item: SafePlace }) => {
    const areaName = extractAreaName(item.address);
    console.log(`📍 Area extracted: "${areaName}" from address: "${item.address}"`);
    return (
      <View style={styles.placeCard} key={item.id}>
        <View style={styles.placeIconBox}>
          <Ionicons name={item.icon as any} size={24} color="#1A1B4B" />
        </View>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName}>{item.name}</Text>
          {areaName && (
            <Text style={styles.placeArea}>📍 {areaName}</Text>
          )}
          <Text style={styles.placeAddress}>{item.address}</Text>
          {item.phoneNumber && (
            <TouchableOpacity onPress={() => handleCall(item.phoneNumber!)}>
              <Text style={styles.placePhone}>📞 {item.phoneNumber}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.directionsBtn} onPress={() => handleDirections(item)}>
          <Ionicons name="navigate" size={16} color="#1A1B4B" />
          <Text style={styles.directionsText}>Go</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const filteredPlaces = filterType === 'all' 
    ? safePlaces 
    : safePlaces.filter(place => place.type === filterType);

  return (
    <SafeAreaView style={styles.container} edges={['top']}> 
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Live Location</Text>
          <Text style={styles.headerSubtitle}>
            {loadingLocation ? 'Updating...' : userLocation ? '📍 Active' : 'Waiting...'}
          </Text>
          <Text style={{ fontSize: 11, color: '#6A5ACD', marginTop: 2 }}>🌤️ Auto weather monitoring active</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setWeatherAlertVisible(true)} style={styles.headerButton}>
            <Ionicons name="cloud" size={24} color="#FF9800" />
          </TouchableOpacity>
          <TouchableOpacity onPress={requestAndUpdateLocation} style={styles.headerButton}>
            <Ionicons name="refresh" size={24} color="#6A5ACD" />
          </TouchableOpacity>
        </View>
      </View>

      <WeatherAlertModal
        visible={weatherAlertVisible}
        onDismiss={() => setWeatherAlertVisible(false)}
        latitude={userLocation?.latitude}
        longitude={userLocation?.longitude}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- MAP SECTION --- */}
        <View style={styles.mapContainer}>
          {userLocation ? (
            <>
              <MapComponent
                initialLatitude={userLocation.latitude}
                initialLongitude={userLocation.longitude}
                mapRef={mapRef}
                mapType={mapType}
                markers={[
                  ...safePlaces.map((place) => ({
                    id: place.id,
                    latitude: place.coords.latitude,
                    longitude: place.coords.longitude,
                    title: place.name,
                    description: place.address,
                    color: place.type === 'police' ? '#3B82F6' : '#EF4444',
                  })),
                ]}
                onMarkerPress={(marker: any) => {
                    const place = safePlaces.find(p => p.id === marker.id);
                    if(place) handleDirections(place);
                }}
              />

              {/* Map Type Toggle */}
              <TouchableOpacity 
                style={styles.mapTypeToggle}
                onPress={() => {
                  const types: Array<'standard' | 'satellite' | 'hybrid' | 'terrain'> = ['standard', 'satellite', 'hybrid', 'terrain'];
                  const currentIndex = types.indexOf(mapType);
                  setMapType(types[(currentIndex + 1) % types.length]);
                }}
              >
                <Ionicons name={mapType === 'satellite' ? 'layers' : 'map'} size={20} color="#FFF" />
                <Text style={styles.mapTypeText}>{mapType === 'standard' ? 'Map' : mapType === 'satellite' ? 'Satellite' : mapType === 'hybrid' ? 'Hybrid' : 'Terrain'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.mapLoadingContainer}>
              {loadingLocation ? (
                <>
                  <ActivityIndicator size="large" color="#6A5ACD" />
                  <Text style={{color: '#666', marginTop: 10, fontWeight: '600'}}>Acquiring GPS...</Text>
                  <Text style={{color: '#999', marginTop: 4, fontSize: 12, textAlign: 'center', paddingHorizontal: 20}}>
                    Make sure location services are enabled on your device
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="alert-circle" size={50} color="#FF9800" />
                  <Text style={{color: '#E65100', marginTop: 10, fontWeight: '600'}}>Location Unavailable</Text>
                  <Text style={{color: '#999', marginTop: 4, fontSize: 12, textAlign: 'center', paddingHorizontal: 20}}>
                    Tap the refresh button to try again
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* --- FILTER CHIPS --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
          <TouchableOpacity 
            style={[styles.chip, filterType === 'all' && styles.chipActive]}
            onPress={() => setFilterType('all')}
          >
            <Ionicons name="list" size={18} color={filterType === 'all' ? '#FFF' : '#1A1B4B'} />
            <Text style={[styles.chipText, filterType === 'all' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.chip, filterType === 'police' && styles.chipActive]}
            onPress={() => setFilterType('police')}
          >
            <Ionicons name="car-sport" size={18} color={filterType === 'police' ? '#FFF' : '#1A1B4B'} />
            <Text style={[styles.chipText, filterType === 'police' && styles.chipTextActive]}>Police</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.chip, filterType === 'hospital' && styles.chipActive]}
            onPress={() => setFilterType('hospital')}
          >
            <Ionicons name="medkit" size={18} color={filterType === 'hospital' ? '#FFF' : '#1A1B4B'} />
            <Text style={[styles.chipText, filterType === 'hospital' && styles.chipTextActive]}>Hospital</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* --- LIST SECTION --- */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>📍 Nearby Safe Places (from Google Maps)</Text>
            {loadingPlaces && <ActivityIndicator size="small" color="#6A5ACD" />}
          </View>
          
          {loadingPlaces ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6A5ACD" />
              <Text style={styles.loadingText}>🔍 Searching Google Maps for nearby hospitals & police stations...</Text>
            </View>
          ) : filteredPlaces.length > 0 ? (
            <>
              <Text style={styles.foundCountText}>✅ Found {filteredPlaces.length} nearby facilities</Text>
              {filteredPlaces.map(item => renderPlaceItem({ item }))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="sad-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No safe places found nearby</Text>
              <Text style={styles.emptySubtext}>Try adjusting your location or filters</Text>
            </View>
          )}
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
  headerButtons: { flexDirection: 'row', gap: 12 },
  headerButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  headerSubtitle: { fontSize: 12, color: '#6A5ACD', marginTop: 4, fontWeight: '600' },
  
  scrollContent: { flexGrow: 1 },

  // Map
  mapContainer: { height: 350, width: '100%', position: 'relative', marginBottom: 20 },
  mapLoadingContainer: { width: '100%', height: 350, backgroundColor: '#F3F0FA', justifyContent: 'center', alignItems: 'center', borderRadius: 15 },
  mapTypeToggle: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    backgroundColor: '#6A5ACD', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  mapTypeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  
  // Chips
  chipsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 },
  chip: { 
    flexDirection: 'row', backgroundColor: '#E8E6F0', paddingHorizontal: 15, paddingVertical: 10, 
    borderRadius: 20, marginRight: 10, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1
  },
  chipActive: { backgroundColor: '#6A5ACD' },
  chipText: { marginLeft: 8, fontWeight: '600', color: '#1A1B4B' },
  chipTextActive: { color: '#FFF' },

  // List
  listSection: { paddingHorizontal: 20, marginTop: 10 },
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionHeader: { fontSize: 16, fontWeight: '600', color: '#1A1B4B' },
  
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
  
  foundCountText: { fontSize: 13, fontWeight: '600', color: '#2E7D32', marginBottom: 15, paddingHorizontal: 5 },
  
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 10, fontSize: 16, fontWeight: '600', color: '#999' },
  emptySubtext: { marginTop: 5, fontSize: 13, color: '#BBB' },
  
  placeCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#F9F9F9', padding: 12, borderRadius: 12 },
  placeIconBox: { 
    width: 50, height: 50, backgroundColor: '#F3F0FA', borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center' 
  },
  placeInfo: { flex: 1, marginLeft: 15 },
  placeName: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  placeArea: { fontSize: 14, fontWeight: '700', color: '#6A5ACD', marginTop: 4, marginBottom: 2 },
  placeAddress: { fontSize: 13, color: '#999', marginVertical: 2 },
  placePhone: { fontSize: 13, color: '#2E7D32', marginTop: 4, fontWeight: '600' },
  
  directionsBtn: { backgroundColor: '#6A5ACD', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  directionsText: { fontSize: 12, fontWeight: 'bold', color: '#FFF' },

  // Heat Zones
  heatZoneContainer: { paddingHorizontal: 20, marginTop: 10 },
  heatZoneTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 10 },
  heatZoneButton: { backgroundColor: '#E8E6F0', padding: 15, borderRadius: 12, alignItems: 'center' },
  heatZoneText: { fontSize: 14, fontWeight: '600', color: '#1A1B4B' }
});