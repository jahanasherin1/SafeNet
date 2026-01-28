import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';

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
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
}

export default function MapComponent({
  initialLatitude,
  initialLongitude,
  markers,
  onMarkerPress,
  mapRef: externalMapRef,
  mapType = 'standard',
}: MapComponentProps) {
  const internalMapRef = useRef<any>(null);
  const mapRef = externalMapRef || internalMapRef;

  // --- CONTROLS ---
  const handleZoomIn = () => {
    if (Platform.OS === 'android' && mapRef.current) {
        mapRef.current.injectJavaScript('map.zoomIn(); true;');
    } else if (Platform.OS === 'ios' && mapRef.current) {
        mapRef.current.getCamera().then((cam: any) => {
            if (cam) mapRef.current.animateCamera({ zoom: cam.zoom + 1 });
        });
    }
  };

  const handleZoomOut = () => {
    if (Platform.OS === 'android' && mapRef.current) {
        mapRef.current.injectJavaScript('map.zoomOut(); true;');
    } else if (Platform.OS === 'ios' && mapRef.current) {
        mapRef.current.getCamera().then((cam: any) => {
            if (cam) mapRef.current.animateCamera({ zoom: cam.zoom - 1 });
        });
    }
  };

  const handleLocateMe = () => {
    if (Platform.OS === 'android' && mapRef.current) {
        mapRef.current.injectJavaScript(`map.setView([${initialLatitude}, ${initialLongitude}], 16); true;`);
    } else if (Platform.OS === 'ios' && mapRef.current) {
        mapRef.current.animateToRegion({
            latitude: initialLatitude,
            longitude: initialLongitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        });
    }
  };

  // --- ANDROID: LEAFLET + SATELLITE ---
  const generateLeafletHTML = () => {
    // Determine tile layer based on mapType
    let tileLayer = '';
    let tileLayerUrl = '';
    
    switch(mapType) {
      case 'satellite':
        tileLayerUrl = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
        break;
      case 'hybrid':
        tileLayerUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        break;
      case 'terrain':
        tileLayerUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
        break;
      case 'standard':
      default:
        tileLayerUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
        break;
    }

    const markerHTML = [
      // Pulse User Icon
      `
      var userIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='position:relative; width:20px; height:20px;'>" +
                  "<div style='position:absolute; top:0; left:0; width:20px; height:20px; background:#4285F4; border:3px solid white; border-radius:50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index:2;'></div>" +
                  "<div style='position:absolute; top:-10px; left:-10px; width:40px; height:40px; background:rgba(66, 133, 244, 0.4); border-radius:50%; animation: pulse 2s infinite; z-index:1;'></div>" +
                "</div>",
          iconSize: [20, 20],
          iconAnchor: [10, 10]
      });
      L.marker([${initialLatitude}, ${initialLongitude}], { icon: userIcon }).addTo(map);
      `,
      // Other Markers
      ...markers.filter(m => m.id !== 'user').map(marker => `
        var pinIcon = L.divIcon({
            className: 'custom-pin-icon',
            html: "<div style='background-color:${marker.color || '#EA4335'}; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 1px 1px 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;'><div style='width: 8px; height: 8px; background: white; border-radius: 50%; transform: rotate(45deg);'></div></div>",
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -24]
        });
        L.marker([${marker.latitude}, ${marker.longitude}], {icon: pinIcon}).addTo(map)
          .bindPopup('<div style="font-family: Roboto, sans-serif; font-size: 14px; padding: 5px;"><b>${marker.title}</b><br><span style="color:#555;">${marker.description || ''}</span></div>');
      `)
    ].join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          /* CRITICAL: touch-action: none prevents the page from scrolling when dragging map */
          body { margin: 0; padding: 0; background: #ddd; touch-action: none; overflow: hidden; }
          #map { width: 100%; height: 100vh; background: #ddd; }
          @keyframes pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
          .leaflet-control-attribution { display: none !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false, 
            attributionControl: false,
            zoomSnap: 0.5,
            zoomDelta: 0.5
          }).setView([${initialLatitude}, ${initialLongitude}], 16);

          // Tile Layer based on mapType
          L.tileLayer('${tileLayerUrl}', {
            maxZoom: 20
          }).addTo(map);

          ${markerHTML}
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' ? (
        <WebView
          key={mapType}
          ref={mapRef}
          style={styles.map}
          source={{ html: generateLeafletHTML() }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          androidLayerType="hardware"
          scrollEnabled={false} // Disable native scroll to let map handle gestures
          overScrollMode="never"
        />
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: initialLatitude,
            longitude: initialLongitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          mapType={mapType}
        >
          {markers.filter((m) => m.id !== 'user').map((marker) => (
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
      )}

      {/* ZOOM CONTROLS (TOP-LEFT) */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn}>
          <Ionicons name="add" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut}>
          <Ionicons name="remove" size={24} color="#1A1B4B" />
        </TouchableOpacity>
      </View>

      {/* LOCATE/CENTER BUTTON (BOTTOM-RIGHT) */}
      <View style={styles.centerControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleLocateMe}>
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
  zoomControls: {
    position: 'absolute',
    top: 20,
    left: 20,
    gap: 10,
  },
  centerControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    gap: 10,
  },
  controlBtn: {
    width: 45,
    height: 45,
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