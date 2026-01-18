import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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
  mapRef?: React.RefObject<any>;
}

export default function MapComponent({
  initialLatitude,
  initialLongitude,
  markers,
  onMarkerPress,
  mapRef: externalMapRef,
}: MapComponentProps) {
  const internalMapRef = useRef<any>(null);
  const mapRef = externalMapRef || internalMapRef;
  const [zoomLevel, setZoomLevel] = useState(13);

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

  const handleZoomIn = () => {
    if (mapRef.current && zoomLevel < 20) {
      const newZoom = zoomLevel + 1;
      setZoomLevel(newZoom);
      mapRef.current.animateToRegion({
        latitude: initialLatitude,
        longitude: initialLongitude,
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
        latitude: initialLatitude,
        longitude: initialLongitude,
        latitudeDelta: 20 / newZoom,
        longitudeDelta: 20 / newZoom,
      });
    }
  };

  const handleLocateMe = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: initialLatitude,
        longitude: initialLongitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

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
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        showsUserLocation={true}
        showsMyLocationButton={false}
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
          onPress={handleZoomIn}
        >
          <Ionicons name="add" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleZoomOut}
        >
          <Ionicons name="remove" size={24} color="#1A1B4B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleLocateMe}
        >
          <Ionicons name="locate" size={24} color="#1A1B4B" />
        </TouchableOpacity>
      </View>
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
    gap: 10,
  },
  controlBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
});
