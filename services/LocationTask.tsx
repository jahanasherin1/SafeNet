// --- services/LocationTask.tsx ---

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import api from './api';

export const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("❌ Background Location Error:", error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0]; // Get the latest location

    if (location) {
      try {
        // 1. Get User
        const userData = await AsyncStorage.getItem('user');
        if (!userData) return;
        const user = JSON.parse(userData);

        // 2. Send to Backend with correct format
        await api.post('/user/update-location', {
          email: user.email,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        // 3. Save Timestamp Locally for UI "Last Updated"
        const now = new Date().toISOString();
        await AsyncStorage.setItem('lastLocationTime', now);
        
        console.log(`📍 Background Location Updated: ${now}`);

      } catch (err) {
        console.error("Background Task API Fail:", err);
      }
    }
  }
});