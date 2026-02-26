import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

// ========================================
// 🌐 NETWORK SETUP - CHANGE IP HERE 👇
// ========================================
// Comment out the hardcoded IP to use auto-detection
 const LAPTOP_IP = '10.172.89.244';        // ← Home
// const LAPTOP_IP = '192.168.1.13';       // ← Home Alt
//const LAPTOP_IP = '192.168.1.30';      // ← Old IP
// ========================================

const PORT = 5000;  

const getBaseUrl = () => {
  // 0. Check for production backend URL first (Vercel)
  if (process.env.EXPO_PUBLIC_BACKEND_API_URL) {
    console.log('✅ Using production backend URL:', process.env.EXPO_PUBLIC_BACKEND_API_URL);
    return process.env.EXPO_PUBLIC_BACKEND_API_URL;
  }

  // 1. Attempt to get IP automatically from Expo Go (Development Mode)
  const debuggerHost = Constants.expoConfig?.hostUri;
  
  if (debuggerHost) {
    const ipAddress = debuggerHost.split(':')[0];
    // If auto-detected IP is loopback (ADB tunnel), use the real laptop IP instead
    if (ipAddress === '127.0.0.1' || ipAddress === 'localhost') {
      const url = `http://${LAPTOP_IP}:${PORT}/api`;
      console.log('✅ ADB tunnel detected — using LAPTOP_IP:', LAPTOP_IP);
      return url;
    }
    const url = `http://${ipAddress}:${PORT}/api`;
    console.log('✅ Using auto-detected IP from Expo:', ipAddress);
    return url;
  }

  // 2. Fallback: Use LAPTOP_IP
  console.log('✅ Using configured LAPTOP_IP:', LAPTOP_IP);
  return `http://${LAPTOP_IP}:${PORT}/api`;
};

const BASE_URL = getBaseUrl();

console.log("🔗 Connecting to Backend at:", BASE_URL);

// ✅ Store BASE_URL in AsyncStorage for Android native code access (e.g., SOS Tile)
(async () => {
  try {
    await AsyncStorage.setItem('backendUrl', BASE_URL);
    console.log('💾 Stored backend URL in AsyncStorage:', BASE_URL);
    
    // Also try to write to native preferences/file for more reliable access
    try {
      // This attempts to call a native module if available
      const { NativeModules } = require('react-native');
      if (NativeModules.UserDataModule) {
        NativeModules.UserDataModule.setBackendUrl?.(BASE_URL);
        console.log('📱 Sent backend URL to Android native module');
      }
    } catch (nativeError) {
      console.warn('⚠️ Could not write to Android native code:', nativeError);
    }
  } catch (error) {
    console.error('Error storing backend URL:', error);
  }
})();

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Increased timeout for network latency
});

// Add request interceptor to include token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      try {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
      } catch (e) {
        console.error('Error clearing storage:', e);
      }
    }
    return Promise.reject(error);
  }
);

// ========================================
// 🗺️ NEARBY SAFE PLACES API METHODS
// ========================================

export interface NearbyPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'police' | 'hospital' | 'fire';
  address?: string;
  distance?: number;
  phoneNumber?: string;
  website?: string;
  operatingHours?: string;
}

export interface NearbyPlacesResponse {
  message: string;
  count: number;
  source?: string;
  facilities: NearbyPlace[];
}

/**
 * Check if the backend is reachable
 * @returns Promise<boolean> - true if backend is reachable
 */
export const isBackendReachable = async (): Promise<boolean> => {
  try {
    console.log('🔗 Checking backend connectivity...');
    const response = await api.get('/health', {
      timeout: 5000
    });
    console.log('✅ Backend is reachable');
    return true;
  } catch (error: any) {
    console.error('❌ Backend is not reachable:', error.message);
    return false;
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 User's latitude
 * @param lon1 User's longitude
 * @param lat2 Place's latitude
 * @param lon2 Place's longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
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

/**
 * Fetch nearby safe places using OpenStreetMap with retry logic
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param radius Search radius in meters (default: 5000m = 5km)
 * @param maxRetries Maximum number of retry attempts (default: 2)
 * @returns Promise with nearby places data from OSM
 */
export const fetchNearbySafePlaces = async (
  latitude: number,
  longitude: number,
  radius: number = 5000,
  maxRetries: number = 2
): Promise<NearbyPlacesResponse> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt}/${maxRetries}: Fetching nearby safe places at ${latitude}, ${longitude} (radius: ${radius}m)`);
      
      const response = await api.post<NearbyPlacesResponse>('/user/nearby-facilities', {
        latitude,
        longitude,
        radius,
      }, {
        timeout: 20000 // 20 second timeout
      });

      // Ensure distance is calculated for all facilities
      if (response.data.facilities) {
        response.data.facilities = response.data.facilities.map((place) => ({
          ...place,
          distance: place.distance || calculateDistance(latitude, longitude, place.latitude, place.longitude),
        }));

        // Sort by distance
        response.data.facilities.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      console.log(`✅ Found ${response.data.count} nearby safe places from ${response.data.source || 'OpenStreetMap'}`);
      return response.data;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Only retry on network errors, not on other errors
      if (attempt < maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
        console.log(`⏳ Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  // All retries failed
  console.error('❌ All retry attempts failed:', lastError?.message);
  throw new Error(`Failed to fetch nearby safe places after ${maxRetries} attempts: ${lastError?.message || 'Network error'}`);
};

/**
 * Fetch nearby safe places filtered by type
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param type Filter by place type ('police', 'hospital', or 'fire')
 * @param radius Search radius in meters (default: 5000m = 5km)
 * @returns Promise with filtered nearby places
 */
export const fetchNearbySafePlacesByType = async (
  latitude: number,
  longitude: number,
  type: 'police' | 'hospital' | 'fire',
  radius: number = 5000
): Promise<NearbyPlace[]> => {
  try {
    const response = await fetchNearbySafePlaces(latitude, longitude, radius);
    const filtered = response.facilities.filter((place) => place.type === type);
    console.log(`🔍 Found ${filtered.length} ${type} facilities nearby`);
    return filtered;
  } catch (error: any) {
    console.error(`❌ Error fetching nearby ${type} facilities:`, error.message);
    throw error;
  }
};

/**
 * Fetch and sort nearby safe places by distance
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param limit Maximum number of results (default: 10)
 * @param radius Search radius in meters (default: 5000m = 5km)
 * @returns Promise with nearby places sorted by distance
 */
export const fetchNearestSafePlaces = async (
  latitude: number,
  longitude: number,
  limit: number = 10,
  radius: number = 5000
): Promise<NearbyPlace[]> => {
  try {
    const response = await fetchNearbySafePlaces(latitude, longitude, radius);
    const sorted = (response.facilities || []).slice(0, limit);
    
    console.log(`✅ Returning ${sorted.length} nearest safe places (from ${response.source || 'OpenStreetMap'})`);
    return sorted;
  } catch (error: any) {
    console.error('❌ Error fetching nearest safe places:', error.message);
    throw error;
  }
};

/**
 * Get the closest safe place of a specific type
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param type Place type to search for ('police', 'hospital', or 'fire')
 * @param radius Search radius in meters (default: 5000m = 5km)
 * @returns Promise with the closest place of the specified type
 */
export const getClosestSafePlace = async (
  latitude: number,
  longitude: number,
  type: 'police' | 'hospital' | 'fire',
  radius: number = 5000
): Promise<NearbyPlace | null> => {
  try {
    const places = await fetchNearbySafePlacesByType(latitude, longitude, type, radius);
    
    if (places.length === 0) {
      console.log(`⚠️ No ${type} facilities found nearby`);
      return null;
    }

    const closest = places[0];
    console.log(`✅ Found closest ${type} facility: ${closest.name} (${closest.distance?.toFixed(2)}km away)`);
    return closest;
  } catch (error: any) {
    console.error(`❌ Error getting closest ${type} facility:`, error.message);
    throw error;
  }
};

/**
 * Get all facility types (police, hospitals, fire) sorted by distance
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param radius Search radius in meters (default: 5000m = 5km)
 * @returns Promise with all facility types grouped by category
 */
export const getGroupedSafePlacesByType = async (
  latitude: number,
  longitude: number,
  radius: number = 5000
): Promise<{ police: NearbyPlace[]; hospital: NearbyPlace[]; fire: NearbyPlace[] }> => {
  try {
    const response = await fetchNearbySafePlaces(latitude, longitude, radius);
    
    const grouped = {
      police: response.facilities.filter(p => p.type === 'police'),
      hospital: response.facilities.filter(p => p.type === 'hospital'),
      fire: response.facilities.filter(p => p.type === 'fire'),
    };

    console.log(`✅ Grouped facilities - Police: ${grouped.police.length}, Hospital: ${grouped.hospital.length}, Fire: ${grouped.fire.length}`);
    return grouped;
  } catch (error: any) {
    console.error('❌ Error getting grouped safe places:', error.message);
    throw error;
  }
};

export default api;