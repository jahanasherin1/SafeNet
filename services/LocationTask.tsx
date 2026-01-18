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
    const location = locations[0]; // Get the latest location object

    if (location) {
      try {
        // 1. Get User Data
        const userData = await AsyncStorage.getItem('user');
        
        // If no user is logged in, stop.
        if (!userData) {
            console.log("Background Task: No user found in storage.");
            return;
        }
        
        const user = JSON.parse(userData);

        // 2. VALIDATION CHECK
        if (!user.email) {
            console.warn("Background Task: User email is missing. Cannot sync.");
            return;
        }

        // 3. Send to Backend with correct format
        await api.post('/user/update-location', {
          email: user.email,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          isBackgroundUpdate: true
        });

        // 4. Save timestamp locally
        const now = new Date().toISOString();
        await AsyncStorage.setItem('lastLocationTime', now);
        
        console.log(`✅ Background location synced: ${user.email} (${location.coords.latitude}, ${location.coords.longitude})`);

      } catch (err: any) {
        console.warn(`⚠️ Background Task Failed: ${err.message}`, err.response?.data);
      }
    }
  }
});