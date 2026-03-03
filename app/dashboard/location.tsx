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
import { getNearbyRealSafePlaces } from '../../services/openstreetmap';
import { useSession } from '../../services/SessionContext';

interface SafePlace {
  id: string;
  type: 'police' | 'hospital' | 'fire';
  name: string;
  address: string;
  phoneNumber?: string;
  icon: string;
  distance?: number; // Distance in km
  rating?: number; // Google rating if available
  isOpen?: boolean; // Whether currently open
  coords: { latitude: number; longitude: number };
}

interface HeatmapPoint {
  city: string;
  latitude: number;
  longitude: number;
  intensity: number;
  color: string;
  recentCrimes: number;
  totalCrimes: number;
  riskLevel: string;
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
  const [filterType, setFilterType] = useState<'all' | 'police' | 'hospital' | 'fire'>('all');
  const [dataSource, setDataSource] = useState<string>(''); // Track data source
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);

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
      setDataSource('OpenStreetMap (Live Data)');

      // Use the new OpenStreetMap service for real places
      const realPlaces = await getNearbyRealSafePlaces(latitude, longitude, 10); // 10km radius

      if (realPlaces.length > 0) {
        setSafePlaces(realPlaces);
      } else {
        setSafePlaces([]);
        Alert.alert(
          'No Safe Places Found', 
          'No emergency facilities were found in your area using OpenStreetMap data. This could be due to:\n\n• Limited data coverage in your area\n• Remote location\n• Connectivity issues\n\nTry expanding your search radius or check your internet connection.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌ Error fetching nearby safe places:', error);
      setSafePlaces([]);
      setDataSource('Error');
      Alert.alert(
        'Error Fetching Places', 
        `Could not fetch real nearby safe places from OpenStreetMap.\n\nError: ${error.message}\n\nPlease check your internet connection and try again.`,
        [
          { text: 'Retry', onPress: () => fetchNearbySafePlaces(latitude, longitude) },
          { text: 'Cancel' }
        ]
      );
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

  const fetchHeatmapData = async () => {
    setLoadingHeatmap(true);
    try {
      const response = await api.get('/crime-zone/heatmap-coordinates');
      if (response.data.success && response.data.points) {
        setHeatmapData(response.data.points);
        setHeatmapVisible(true);
      } else {
        Alert.alert('Error', 'Failed to fetch heatmap data');
        setHeatmapVisible(false);
      }
    } catch (error: any) {
      console.error('Error fetching heatmap data:', error);
      Alert.alert('Error', 'Could not fetch crime heatmap data. Please try again.');
      setHeatmapVisible(false);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  const handleHeatmapToggle = async () => {
    if (heatmapVisible) {
      // Hide heatmap
      setHeatmapVisible(false);
      setHeatmapData([]);
    } else {
      // Show heatmap - fetch data if not already loaded
      if (heatmapData.length === 0) {
        await fetchHeatmapData();
      } else {
        setHeatmapVisible(true);
      }
    }
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
    return (
      <View style={styles.placeCard} key={item.id}>
        <View style={styles.placeIconBox}>
          <Ionicons name={item.icon as any} size={24} color="#1A1B4B" />
        </View>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName}>{item.name}</Text>
          {/* Show Distance and Rating */}
          <View style={styles.placeMetaInfo}>
            {item.distance && (
              <Text style={styles.placeDistance}>📏 {item.distance.toFixed(2)}km</Text>
            )}
            {item.rating && (
              <Text style={styles.placeRating}>⭐ {item.rating.toFixed(1)}</Text>
            )}
            {item.isOpen !== undefined && (
              <Text style={[styles.placeStatus, { color: item.isOpen ? '#2E8B57' : '#DC143C' }]}>
                {item.isOpen ? '🟢 Open' : '🔴 Closed'}
              </Text>
            )}
          </View>
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
          {userLocation && userLocation.latitude !== 0 && userLocation.longitude !== 0 ? (
            <>
              <MapComponent
                initialLatitude={userLocation.latitude}
                initialLongitude={userLocation.longitude}
                mapRef={mapRef}
                mapType={mapType}
                heatmapData={heatmapData}
                showHeatmap={heatmapVisible}
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
          <TouchableOpacity 
            style={[styles.chip, filterType === 'fire' && styles.chipActive]}
            onPress={() => setFilterType('fire')}
          >
            <Ionicons name="flame" size={18} color={filterType === 'fire' ? '#FFF' : '#1A1B4B'} />
            <Text style={[styles.chipText, filterType === 'fire' && styles.chipTextActive]}>Fire</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* --- LIST SECTION --- */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>
              📍 Nearby Safe Places
            </Text>
            {loadingPlaces && <ActivityIndicator size="small" color="#6A5ACD" />}
            {!loadingPlaces && safePlaces.length > 0 && (
              <Text style={styles.realDataBadge}>✅ Real Places</Text>
            )}
          </View>
          
          {loadingPlaces ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6A5ACD" />
              <Text style={styles.loadingText}>🔍 Searching OpenStreetMap for real nearby emergency facilities...</Text>
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
            <View style={styles.heatZoneHeaderContainer}>
              <Text style={styles.heatZoneTitle}>Crime Heat Map</Text>
              {loadingHeatmap && <ActivityIndicator size="small" color="#6A5ACD" />}
            </View>
            <Text style={styles.heatZoneDescription}>
              View crime intensity zones - Green (Low) → Orange (Medium) → Red (High)
            </Text>
            <TouchableOpacity 
              style={[styles.heatZoneButton, heatmapVisible && styles.heatZoneButtonActive]}
              onPress={handleHeatmapToggle}
              disabled={loadingHeatmap}
            >
              <Ionicons 
                name={heatmapVisible ? 'eye-off' : 'eye'} 
                size={18} 
                color={heatmapVisible ? '#FFF' : '#666'} 
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.heatZoneText, heatmapVisible && styles.heatZoneTextActive]}>
                {loadingHeatmap ? 'Loading...' : heatmapVisible ? 'Hide Heat Map' : 'Show Heat Map'}
              </Text>
            </TouchableOpacity>
            {heatmapData.length > 0 && (
              <Text style={styles.heatmapStatsText}>
                📍 {heatmapData.length} crime zones detected
              </Text>
            )}
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1B4B' },
  headerSubtitle: { fontSize: 14, color: '#6A5ACD', marginTop: 2 },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  
  mapContainer: { height: 300, margin: 20, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  mapLoadingContainer: { flex: 1, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  mapTypeToggle: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(26, 27, 75, 0.8)',
    padding: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapTypeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  chipsContainer: { paddingHorizontal: 20, marginBottom: 15 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  chipActive: { backgroundColor: '#6A5ACD', borderColor: '#6A5ACD' },
  chipText: { fontSize: 14, color: '#1A1B4B', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },

  listSection: { paddingHorizontal: 20 },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  sourceText: { fontSize: 14, fontWeight: '500', color: '#6A5ACD' },
  realDataBadge: { fontSize: 12, fontWeight: '700', color: '#2E8B57', backgroundColor: '#E8F5E8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  foundCountText: { fontSize: 14, color: '#2E8B57', marginBottom: 15, fontWeight: '600' },

  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 10, color: '#666', fontWeight: '600' },

  placeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'flex-start',
  },
  placeIconBox: {
    width: 48,
    height: 48,
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 16, fontWeight: '700', color: '#1A1B4B', marginBottom: 4 },
  placeMetaInfo: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    gap: 12, 
    marginBottom: 6 
  },
  placeDistance: { fontSize: 12, color: '#666', fontWeight: '500' },
  placeRating: { fontSize: 12, color: '#FF9500', fontWeight: '600' },
  placeStatus: { fontSize: 12, fontWeight: '600' },
  placeArea: { fontSize: 13, color: '#6A5ACD', fontWeight: '600', marginBottom: 4 },
  placeAddress: { fontSize: 14, color: '#666', lineHeight: 18, marginBottom: 6 },
  placePhone: { fontSize: 14, color: '#2E8B57', fontWeight: '600' },
  directionsBtn: {
    backgroundColor: '#E8E4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  directionsText: { fontSize: 12, color: '#1A1B4B', fontWeight: '600' },

  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '600', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#CCC', marginTop: 4 },

  heatZoneContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heatZoneHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heatZoneTitle: { fontSize: 16, fontWeight: '700', color: '#1A1B4B' },
  heatZoneDescription: { fontSize: 12, color: '#999', marginBottom: 12, fontStyle: 'italic' },
  heatZoneButton: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  heatZoneButtonActive: {
    backgroundColor: '#6A5ACD',
  },
  heatZoneText: { color: '#666', fontWeight: '600' },
  heatZoneTextActive: { color: '#FFF' },
  heatmapStatsText: { fontSize: 12, color: '#6A5ACD', marginTop: 12, fontWeight: '600', textAlign: 'center' },
});