import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

interface NearbyPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'police' | 'hospital' | 'fire';
  address?: string;
  distance?: number;
  phoneNumber?: string;
}

export default function ContactAuthoritiesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userName, setUserName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  // Emergency contact numbers (customize for your region)
  const POLICE_NUMBER = '100'; // India Police
  const HOSPITAL_NUMBER = '108'; // India Ambulance
  const HELPLINE_NUMBER = '112'; // Universal Emergency Number
  
  // Google Places API Key (should be in environment variables in production)
  const GOOGLE_PLACES_API_KEY = 'AIzaSyDGpAdiZUGAza7OMuWwTBXLfznzB0shrnY';

  useEffect(() => {
    loadUserLocation();
  }, []);

  const loadUserLocation = async () => {
    setLoading(true);
    try {
      // Get guardian's email first
      const guardianData = await AsyncStorage.getItem('user');
      console.log('📦 Guardian raw data:', guardianData);
      
      if (!guardianData) {
        console.log('❌ No guardian data found');
        setLoading(false);
        return;
      }
      
      const guardian = JSON.parse(guardianData);
      console.log('👤 Guardian parsed:', guardian);
      console.log('📧 Guardian email:', guardian.guardianEmail);
      console.log('🛡️ Protecting email:', guardian.protectingEmail);
      
      if (!guardian.guardianEmail) {
        console.log('❌ Guardian has no email');
        setLoading(false);
        return;
      }
      
      // If we have the protecting user's email directly, use it
      if (guardian.protectingEmail && guardian.protecting) {
        setUserName(guardian.protecting);
        console.log('🔍 Fetching location for:', guardian.protectingEmail);
        
        // Fetch latest location directly (note: /user not /users - backend routes)
        const locationResponse = await api.get(`/user/location/${guardian.protectingEmail}`);
        console.log('📍 Location response:', JSON.stringify(locationResponse.data, null, 2));
        
        if (locationResponse.data && locationResponse.data.location) {
          const { latitude, longitude } = locationResponse.data.location;
          console.log('📌 Coordinates:', { latitude, longitude });
          
          if (latitude && longitude) {
            const location = {
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude)
            };
            setUserLocation(location);
            console.log('✅ Location set:', location);
            
            // Fetch nearby emergency services
            fetchNearbyPlaces(location.latitude, location.longitude);
          }
        }
        setLoading(false);
        return;
      }
      
      // Fallback: Fetch the list of users this guardian protects
      console.log('🔍 Calling /guardian/all-users with:', { guardianEmail: guardian.guardianEmail });
      const response = await api.post('/guardian/all-users', {
        guardianEmail: guardian.guardianEmail
      });
      console.log('📍 Users response:', response.data);
      
      if (response.data.users && response.data.users.length > 0) {
        const protectedUser = response.data.users[0]; // Get first user
        setUserName(protectedUser.name || 'User');
        console.log('🔍 Fetching location for:', protectedUser.email);
        
        // Fetch latest location
        const locationResponse = await api.get(`/users/location/${protectedUser.email}`);
        console.log('📍 Location response:', JSON.stringify(locationResponse.data, null, 2));
        
        if (locationResponse.data && locationResponse.data.location) {
          const { latitude, longitude } = locationResponse.data.location;
          console.log('📌 Coordinates:', { latitude, longitude });
          
          if (latitude && longitude) {
            const location = {
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude)
            };
            setUserLocation(location);
            console.log('✅ Location set:', location);
            
            // Fetch nearby emergency services
            fetchNearbyPlaces(location.latitude, location.longitude);
          }
        }
      } else {
        console.log('⚠️ No users found for this guardian');
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPlaces = async (latitude: number, longitude: number) => {
    setLoadingPlaces(true);
    try {
      console.log('🔍 Fetching nearby places from backend...');
      
      // Call backend endpoint instead of Google Places API directly
      const response = await api.post('/user/nearby-facilities', {
        latitude,
        longitude,
        radius: 5000 // 5km
      });

      console.log('📍 Backend response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.facilities) {
        setNearbyPlaces(response.data.facilities);
        console.log(`🏥 Found ${response.data.facilities.length} nearby emergency services`);
      } else {
        console.log('⚠️ No facilities found in response');
        setNearbyPlaces([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching nearby places:', error.message);
      console.error('❌ Error response:', error.response?.data);
      setNearbyPlaces([]);
    } finally {
      setLoadingPlaces(false);
    }
  };

  const callNearbyFacility = (place: NearbyPlace) => {
    if (!place.phoneNumber) {
      Alert.alert('No Phone Number', 'Phone number not available for this facility. Use general emergency numbers instead.');
      return;
    }

    const facilityType = place.type === 'police' ? '🚔 Police Station' : 
                         place.type === 'hospital' ? '🏥 Hospital' : 
                         '🚒 Fire Station';

    Alert.alert(
      `Call ${facilityType}?`,
      `${place.name}\n${place.address || ''}\n\nPhone: ${place.phoneNumber}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'default',
          onPress: () => makeCall(place.phoneNumber!.replace(/\s+/g, ''), place.name)
        }
      ]
    );
  };

  const handleCallPolice = () => {
    Alert.alert(
      '🚔 Call Police?',
      `This will dial ${POLICE_NUMBER} for immediate police assistance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'default',
          onPress: () => makeCall(POLICE_NUMBER, 'Police')
        }
      ]
    );
  };

  const handleCallHospital = () => {
    Alert.alert(
      '🏥 Call Hospital?',
      `This will dial ${HOSPITAL_NUMBER} for medical emergency services.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'default',
          onPress: () => makeCall(HOSPITAL_NUMBER, 'Hospital')
        }
      ]
    );
  };

  const handleCallHelpline = () => {
    Alert.alert(
      '📞 Call Emergency Helpline?',
      `This will dial ${HELPLINE_NUMBER} for national emergency assistance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'default',
          onPress: () => makeCall(HELPLINE_NUMBER, 'Emergency Helpline')
        }
      ]
    );
  };

  const makeCall = async (phoneNumber: string, serviceName: string) => {
    try {
      const phoneUrl = Platform.select({
        ios: `telprompt:${phoneNumber}`,
        android: `tel:${phoneNumber}`
      });

      const canCall = await Linking.canOpenURL(phoneUrl || '');
      
      if (canCall && phoneUrl) {
        await Linking.openURL(phoneUrl);
        console.log(`✅ Calling ${serviceName}: ${phoneNumber}`);
      } else {
        Alert.alert('Error', 'Unable to make phone calls on this device.');
      }
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to initiate call. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Authorities</Text>
        <TouchableOpacity onPress={loadUserLocation}>
          <Ionicons name="refresh" size={24} color="#6A5ACD" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Description */}
        <Text style={styles.description}>
          Official help options near {userName}'s location
        </Text>

        {/* Map with User Location */}
        {loading ? (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color="#6A5ACD" />
            <Text style={styles.loadingText}>Loading location...</Text>
          </View>
        ) : userLocation ? (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {/* User Location Marker */}
            <Marker
              coordinate={userLocation}
              title={userName}
              description="Current Location"
              pinColor="#6A5ACD"
            />
            
            {/* Nearby Emergency Services Markers */}
            {nearbyPlaces.map((place) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                title={place.name}
                description={place.address}
                pinColor={
                  place.type === 'police' ? '#FF0000' : 
                  place.type === 'hospital' ? '#4FC3F7' : 
                  '#FF6F00'
                }
              >
                <View style={styles.customMarker}>
                  <Ionicons
                    name={
                      place.type === 'police' ? 'shield-checkmark' :
                      place.type === 'hospital' ? 'medical' :
                      'flame'
                    }
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="location" size={120} color="#D4AF37" />
            <Text style={styles.noLocationText}>Location not available</Text>
          </View>
        )}

        {/* Loading Nearby Services Indicator */}
        {loadingPlaces && (
          <View style={styles.loadingPlacesContainer}>
            <ActivityIndicator size="small" color="#6A5ACD" />
            <Text style={styles.loadingPlacesText}>Finding nearby emergency services...</Text>
          </View>
        )}

        {/* Nearby Services Summary */}
        {nearbyPlaces.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>📍 Nearby Emergency Services</Text>
            <Text style={styles.summaryText}>
              Found {nearbyPlaces.filter(p => p.type === 'police').length} police stations, {' '}
              {nearbyPlaces.filter(p => p.type === 'hospital').length} hospitals, and {' '}
              {nearbyPlaces.filter(p => p.type === 'fire').length} fire stations within 5km
            </Text>
          </View>
        )}

        {/* Nearby Facilities List with Call Buttons */}
        {nearbyPlaces.length > 0 && (
          <View style={styles.facilitiesSection}>
            <Text style={styles.sectionTitle}>📞 Call Nearby Facilities</Text>
            
            {nearbyPlaces.map((place) => (
              <View key={place.id} style={styles.facilityCard}>
                <View style={styles.facilityIcon}>
                  <Ionicons
                    name={
                      place.type === 'police' ? 'shield-checkmark' :
                      place.type === 'hospital' ? 'medical' :
                      'flame'
                    }
                    size={28}
                    color={
                      place.type === 'police' ? '#FF0000' :
                      place.type === 'hospital' ? '#4FC3F7' :
                      '#FF6F00'
                    }
                  />
                </View>
                
                <View style={styles.facilityInfo}>
                  <Text style={styles.facilityName}>{place.name}</Text>
                  <Text style={styles.facilityAddress} numberOfLines={1}>{place.address}</Text>
                  {place.phoneNumber && (
                    <Text style={styles.facilityPhone}>📞 {place.phoneNumber}</Text>
                  )}
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.facilityCallButton,
                    !place.phoneNumber && styles.disabledButton
                  ]}
                  onPress={() => callNearbyFacility(place)}
                  disabled={!place.phoneNumber}
                >
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* General Emergency Numbers Section */}
        <Text style={styles.sectionTitle}>🚨 General Emergency Numbers</Text>

        {/* Police Assistance */}
        <View style={styles.serviceCard}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>Police Assistance</Text>
            <Text style={styles.serviceSubtitle}>
              Contact local police for immediate help
            </Text>
            <TouchableOpacity style={styles.callButton} onPress={handleCallPolice}>
              <Text style={styles.callButtonText}>Call Police</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.serviceIcon}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={50} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Medical Assistance */}
        <View style={styles.serviceCard}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>Medical Assistance</Text>
            <Text style={styles.serviceSubtitle}>
              Contact nearest hospital for medical emergencies
            </Text>
            <TouchableOpacity style={styles.callButton} onPress={handleCallHospital}>
              <Text style={styles.callButtonText}>Call Hospital</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.serviceIcon}>
            <View style={[styles.iconCircle, { backgroundColor: '#4FC3F7' }]}>
              <Ionicons name="medical" size={50} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Emergency Helpline */}
        <View style={styles.serviceCard}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>Emergency Helpline</Text>
            <Text style={styles.serviceSubtitle}>
              Contact national emergency helpline for guidance
            </Text>
            <TouchableOpacity style={styles.callButton} onPress={handleCallHelpline}>
              <Text style={styles.callButtonText}>Call Helpline</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.serviceIcon}>
            <View style={[styles.iconCircle, { backgroundColor: '#81C784' }]}>
              <Ionicons name="call" size={50} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  scrollContent: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    fontWeight: '500',
  },
  map: {
    height: 200,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#E8E3D8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  noLocationText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 6,
  },
  serviceSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  callButton: {
    backgroundColor: '#6A5ACD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  serviceIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#6A5ACD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customMarker: {
    backgroundColor: '#6A5ACD',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  loadingPlacesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  loadingPlacesText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  facilitiesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 12,
  },
  facilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  facilityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  facilityInfo: {
    flex: 1,
  },
  facilityName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1B4B',
    marginBottom: 4,
  },
  facilityAddress: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  facilityPhone: {
    fontSize: 13,
    color: '#6A5ACD',
    fontWeight: '500',
  },
  facilityCallButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
});
