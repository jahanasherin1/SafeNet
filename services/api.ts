import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 1. Define your backend port
const PORT = 5000;

// 2. Function to determine the Base URL dynamically
const getBaseUrl = () => {
  // If we have a hostUri (only available in Expo Go / Dev Client), use it
  const debuggerHost = Constants.expoConfig?.hostUri;
  
  if (debuggerHost) {
    // The debuggerHost comes as "192.168.1.5:8081". We split to get the IP.
    const ipAddress = debuggerHost.split(':')[0];
    return `http://${ipAddress}:${PORT}/api`;
  }

  // Fallback for Android Emulator (if hostUri fails)
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${PORT}/api`;
  }

  // Fallback for iOS Simulator or Web
  return `http://localhost:${PORT}/api`;
};

const BASE_URL = getBaseUrl();

console.log("🔗 Connecting to Backend at:", BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;