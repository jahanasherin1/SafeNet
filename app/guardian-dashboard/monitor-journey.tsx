import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

const { width } = Dimensions.get('window');

export default function MonitorJourney() {
  const { userEmail } = useLocalSearchParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [liveLocation, setLiveLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      // Fetch journey data
      const journeyRes = await api.post('/journey/status', { userEmail });
      setData(journeyRes.data);
      
      // Fetch live location for accurate snapshot
      try {
        const locationRes = await api.get(`/user/location/${userEmail}`);
        if (locationRes.data && locationRes.data.location) {
          setLiveLocation(locationRes.data.location);
        }
      } catch (locErr) {
        console.log("Live location fetch error:", locErr);
      }
    } catch (e) {
      console.log("Monitoring Error:", e);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3 seconds for real-time updates
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color="#6A5ACD" /></View>
    );
  }

  if (!data?.journey?.isActive) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="map-outline" size={80} color="#CCC" />
        <Text style={styles.noJourneyText}>No Active Journey Detected</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
           <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const userLoc = data.currentLocation || { latitude: 0, longitude: 0 };
  const isDelayed = Date.now() > new Date(data.journey.eta).getTime();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Journey Monitoring</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Destination Card */}
        <View style={styles.infoCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.destLabel}>Destination: {data.journey.destination}</Text>
            
            {/* Planned Arrival with Date and Time */}
            <Text style={styles.etaTitle}>
              Planned Arrival: {new Date(data.journey.eta).toLocaleString('en-US', { 
                day: 'numeric', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            
            <Text style={styles.subText}>This journey is being monitored for safety</Text>
          </View>
          <View style={styles.cardGraphic}>
            <MaterialCommunityIcons name="map-marker-path" size={40} color="#6A5ACD" />
          </View>
        </View>

        {/* Schedule Status Card */}
        <View style={[styles.statusCard, isDelayed && { borderColor: '#FF4B4B', backgroundColor: '#FFF5F5' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBold, isDelayed && { color: '#FF4B4B' }]}>
                {isDelayed ? "Journey Delayed" : "Journey On Schedule"}
            </Text>
            <Text style={styles.statusSmall}>
              {isDelayed 
                ? "The user is past the expected arrival time." 
                : `No delays detected. ${data.userName} is proceeding as planned.`}
            </Text>
          </View>
          <View style={styles.smallGraphic}>
             <Ionicons 
                name={isDelayed ? "alert-circle" : "checkmark-done-circle"} 
                size={30} 
                color={isDelayed ? "#FF4B4B" : "#6A5ACD"} 
             />
          </View>
        </View>

        {/* Live Map Snapshot */}
        <View style={styles.mapSection}>
           <View style={styles.mapWrapper}>
             <MapView
               provider={PROVIDER_GOOGLE}
               style={styles.map}
               region={{
                 latitude: liveLocation?.latitude || userLoc.latitude || 10.8505,
                 longitude: liveLocation?.longitude || userLoc.longitude || 76.2711,
                 latitudeDelta: 0.02,
                 longitudeDelta: 0.02,
               }}
               scrollEnabled={false} 
               zoomEnabled={false}
             >
               {(liveLocation?.latitude || userLoc.latitude) !== 0 && (
                 <Marker coordinate={{ 
                   latitude: liveLocation?.latitude || userLoc.latitude, 
                   longitude: liveLocation?.longitude || userLoc.longitude 
                 }}>
                    <View style={styles.markerContainer}>
                        <Ionicons name="person" size={18} color="white" />
                    </View>
                 </Marker>
               )}
             </MapView>
           </View>

           <Text style={styles.snapshotLabel}>Live Location Snapshot</Text>
           <View style={styles.locationInfo}>
             <Text style={styles.coordText}>
               📍 Lat: {(liveLocation?.latitude || userLoc.latitude || 0).toFixed(4)}, 
               Lng: {(liveLocation?.longitude || userLoc.longitude || 0).toFixed(4)}
             </Text>
             <Text style={styles.coordText}>
               🕐 Updated: {liveLocation?.timestamp 
                 ? new Date(liveLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                 : 'Waiting for update...'}
             </Text>
           </View>
           <View style={styles.snapshotFooter}>
             <Text style={styles.updatedText}>Tracking user in real time</Text>
             <TouchableOpacity 
               style={styles.openMapBtn}
               onPress={() => router.push('/guardian-dashboard/location')}
             >
               <Text style={styles.openMapText}>Open Live Map</Text>
             </TouchableOpacity>
           </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B' },
  scrollContent: { paddingHorizontal: 25 },

  infoCard: { backgroundColor: '#F3F0FA', padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  destLabel: { color: '#6A5ACD', fontSize: 14, fontWeight: '500' },
  etaTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginVertical: 4 },
  subText: { fontSize: 12, color: '#7A7A7A' },
  cardGraphic: { backgroundColor: '#D1C4E9', padding: 10, borderRadius: 15, opacity: 0.8 },

  statusCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    borderWidth: 1, 
    borderColor: '#E8E6F0', 
    borderRadius: 18, 
    backgroundColor: '#FFF' 
  },
  statusBold: { fontWeight: 'bold', fontSize: 16, color: '#1A1B4B' },
  statusSmall: { fontSize: 13, color: '#7A7A7A', marginTop: 4, lineHeight: 18 },
  smallGraphic: { marginLeft: 10 },

  mapSection: { marginTop: 30 },
  mapWrapper: { height: 200, borderRadius: 24, overflow: 'hidden', backgroundColor: '#EEE', borderWidth: 1, borderColor: '#EEE' },
  map: { flex: 1 },
  markerContainer: { backgroundColor: '#6A5ACD', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: 'white' },
  
  locationInfo: { backgroundColor: '#F3F0FA', padding: 12, borderRadius: 12, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#6A5ACD' },
  coordText: { fontSize: 12, color: '#1A1B4B', fontWeight: '500', marginVertical: 4, lineHeight: 18 },
  
  snapshotLabel: { fontWeight: 'bold', marginTop: 15, fontSize: 16, color: '#1A1B4B' },
  snapshotFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  updatedText: { color: '#7A7A7A', fontSize: 13 },
  openMapBtn: { backgroundColor: '#6A5ACD', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  openMapText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noJourneyText: { marginTop: 10, color: '#7A7A7A', fontSize: 16 },
  backButton: { marginTop: 20, backgroundColor: '#F3F0FA', padding: 12, borderRadius: 10 },
  backButtonText: { color: '#6A5ACD', fontWeight: 'bold' }
});