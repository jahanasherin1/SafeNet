import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

// ========================================
// 🌐 NETWORK SETUP - CHANGE IP HERE 👇
// ========================================
const LAPTOP_IP = '172.20.10.4';        // ← Home
//const LAPTOP_IP = '192.168.221.244';  // ← Home Alt
//const LAPTOP_IP = '192.168.1.7';     // ← College IP
// ========================================

const PORT = 5000; 

const getBaseUrl = () => {
  // 1. Attempt to get IP automatically from Expo Go (Development Mode)
  const debuggerHost = Constants.expoConfig?.hostUri;
  
  if (debuggerHost) {
    const ipAddress = debuggerHost.split(':')[0];
    return `http://${ipAddress}:${PORT}/api`;
  }

  // 2. Fallback for Android Builds (APK), iOS Simulator, or if hostUri fails.
  // We removed the '10.0.2.2' check so it ALWAYS uses your network IP.
  return `http://${LAPTOP_IP}:${PORT}/api`;
};

const BASE_URL = getBaseUrl();

console.log("🔗 Connecting to Backend at:", BASE_URL);

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

export default api;