import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    console.log('📱 Registering for push notifications...');

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Push notification permission denied');
      return null;
    }

    try {
      // Try to get Expo push token (this will fail on Android without FCM setup)
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '12c6fa68-9e00-4a75-92b9-29dd976db3b9', // Replace with your project ID
      });

      console.log('✅ Expo Push Token:', token.data);

      // On Android, create notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7F',
          sound: 'default',
        });
      }

      return token.data;
    } catch (tokenError) {
      // If FCM is not initialized, try with just Expo notifications
      if (tokenError instanceof Error && tokenError.message.includes('FirebaseApp')) {
        console.warn('⚠️ Firebase not initialized for push notifications');
        console.log('ℹ️ Push notifications will use Expo notifications only');
        
        // On Android, still create notification channel for local notifications
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7F',
              sound: 'default',
            });
          } catch (e) {
            console.warn('Could not set notification channel:', e);
          }
        }
        
        // Return a placeholder token for local notifications
        return 'expo-local-notifications';
      }
      throw tokenError;
    }
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return null;
  }
}

export async function savePushTokenToBackend(userEmail: string, token: string): Promise<void> {
  try {
    console.log('💾 Saving push token to backend...');
    await api.post('/users/save-push-token', {
      userEmail,
      pushToken: token,
    });
    console.log('✅ Push token saved successfully');
  } catch (error) {
    console.error('❌ Error saving push token:', error);
  }
}

export function setupPushNotificationListeners() {
  const subscriptions: any[] = [];

  try {
    // Listener for notifications received while app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('🔔 Notification received (foreground):', notification);
        // Handle notification in foreground if needed
      }
    );
    subscriptions.push(notificationListener);
  } catch (e) {
    console.warn('Could not set up notification received listener:', e);
  }

  try {
    // Listener for notification taps (app in background or closed)
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response.notification.request.content.data);
        // Handle notification tap - navigate to relevant screen
        const data = response.notification.request.content.data;
        if (data.alertType === 'ACTIVITY_MONITOR') {
          // Navigate to alerts or activity screen
          console.log('🎯 Navigating to alerts for activity alert');
        }
      }
    );
    subscriptions.push(responseListener);
  } catch (e) {
    console.warn('Could not set up notification response listener:', e);
  }

  // Cleanup listeners
  return () => {
    subscriptions.forEach((sub) => {
      try {
        if (sub && typeof sub.remove === 'function') {
          sub.remove();
        }
      } catch (e) {
        console.warn('Error removing subscription:', e);
      }
    });
  };
}
