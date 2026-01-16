import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color?: string;
}

interface MapComponentProps {
  initialLatitude: number;
  initialLongitude: number;
  markers: MapMarker[];
  onMarkerPress?: (marker: MapMarker) => void;
}

// Platform-specific imports
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS === 'ios') {
  try {
    const mapModule = require('react-native-maps');
    MapView = mapModule.default;
    Marker = mapModule.Marker;
    PROVIDER_GOOGLE = mapModule.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('Maps not available on iOS:', e);
  }
}

export default function MapComponent({
  initialLatitude,
  initialLongitude,
  markers,
  onMarkerPress,
}: MapComponentProps) {
  const mapRef = useRef<any>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const sortedMarkers = [...markers].sort((a, b) => {
    const distA = calculateDistance(initialLatitude, initialLongitude, a.latitude, a.longitude);
    const distB = calculateDistance(initialLatitude, initialLongitude, b.latitude, b.longitude);
    return distA - distB;
  });

  // iOS Native Google Map View
  if (Platform.OS === 'ios' && MapView) {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: initialLatitude,
            longitude: initialLongitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* User Location Marker */}
          <Marker
            coordinate={{ latitude: initialLatitude, longitude: initialLongitude }}
            title="Your Location"
            description="Current position"
            pinColor="#6A5ACD"
          />

          {/* Safe Places Markers */}
          {markers
            .filter((m) => m.id !== 'user')
            .map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={marker.title}
                description={marker.description}
                pinColor={marker.color || '#FF6B6B'}
                onPress={() => onMarkerPress?.(marker)}
              />
            ))}
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => {
              if (mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: initialLatitude,
                  longitude: initialLongitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                });
              }
            }}
          >
            <Ionicons name="locate" size={24} color="#1A1B4B" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Android Leaflet Map View (List-based)
  return (
    <View style={styles.container}>
      {/* Map Visualization */}
      <View style={styles.mapVisualization}>
        <View style={styles.mapHeader}>
          <Ionicons name="map" size={24} color="#6A5ACD" />
          <Text style={styles.mapTitle}>Location Map</Text>
        </View>

        <View style={styles.coordinatesBox}>
          <Text style={styles.coordLabel}>Your Location</Text>
          <Text style={styles.coordValue}>
            {initialLatitude.toFixed(4)}° N, {initialLongitude.toFixed(4)}° E
          </Text>
        </View>

        <View style={styles.markerLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6A5ACD' }]} />
            <Text style={styles.legendText}>Your Location</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
            <Text style={styles.legendText}>Safe Places</Text>
          </View>
        </View>
      </View>

      {/* Markers List */}
      <ScrollView style={styles.markersList} showsVerticalScrollIndicator={false}>
        <Text style={styles.listTitle}>Nearby Locations</Text>
        {sortedMarkers.map((marker) => {
          const distance = calculateDistance(
            initialLatitude,
            initialLongitude,
            marker.latitude,
            marker.longitude
          );
          const isUserLocation = marker.id === 'user';

          return (
            <TouchableOpacity
              key={marker.id}
              style={[styles.markerCard, isUserLocation && styles.userMarkerCard]}
              onPress={() => onMarkerPress?.(marker)}
            >
              <View
                style={[
                  styles.markerIcon,
                  { backgroundColor: marker.color || '#6A5ACD' },
                ]}
              >
                <Ionicons
                  name={isUserLocation ? 'person' : 'location'}
                  size={20}
                  color="#FFF"
                />
              </View>

              <View style={styles.markerInfo}>
                <Text style={styles.markerTitle}>{marker.title}</Text>
                <Text style={styles.markerDesc} numberOfLines={1}>
                  {marker.description}
                </Text>
                {!isUserLocation && (
                  <Text style={styles.markerDistance}>
                    {distance.toFixed(2)} km away
                  </Text>
                )}
              </View>

              <View style={styles.markerCoords}>
                <Text style={styles.coordSmall}>{marker.latitude.toFixed(3)}</Text>
                <Text style={styles.coordSmall}>{marker.longitude.toFixed(3)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  mapControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  controlBtn: {
    width: 45,
    height: 45,
    backgroundColor: '#FFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  mapVisualization: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6F0',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1B4B',
    marginLeft: 8,
  },
  coordinatesBox: {
    backgroundColor: '#F3F0FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  coordLabel: {
    fontSize: 11,
    color: '#7A7A7A',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  coordValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1B4B',
    marginTop: 4,
  },
  markerLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  markersList: {
    flex: 1,
    padding: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 12,
  },
  markerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E6F0',
  },
  userMarkerCard: {
    backgroundColor: '#F3F0FA',
    borderColor: '#6A5ACD',
  },
  markerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  markerInfo: {
    flex: 1,
  },
  markerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  markerDesc: {
    fontSize: 12,
    color: '#7A7A7A',
    marginTop: 2,
  },
  markerDistance: {
    fontSize: 11,
    color: '#6A5ACD',
    fontWeight: '600',
    marginTop: 4,
  },
  markerCoords: {
    alignItems: 'flex-end',
  },
  coordSmall: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
});
