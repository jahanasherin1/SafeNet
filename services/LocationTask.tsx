import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export const LOCATION_TASK_NAME = 'background-location-task';

// Define the Background Task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background Location Error:", error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0]; // Get the latest location object

    if (location) {
      try {
        // 1. We cannot use React State here, so we get User from Storage
        const userData = await AsyncStorage.getItem('user');
        if (!userData) return;
        
        const user = JSON.parse(userData);

        // 2. Send to Backend
        // console.log(`📍 Background Update: ${location.coords.latitude}, ${location.coords.longitude}`);
        
        await api.post('/user/update-location', {
          userEmail: user.email,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }
        });

      } catch (err) {
        // Silent fail in background to save battery/logs
      }
    }
  }
});