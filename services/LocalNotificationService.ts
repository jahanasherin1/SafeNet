import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Initialize local notifications
 */
export const initializeLocalNotifications = async (): Promise<void> => {
  try {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Notification permission denied');
      return;
    }

    // On Android, create notification channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergency Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
        sound: 'default',
        bypassDnd: true, // Bypass Do Not Disturb for emergency alerts
      });

      await Notifications.setNotificationChannelAsync('activity', {
        name: 'Activity Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9800',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    console.log('✅ Local notifications initialized');
  } catch (error) {
    console.warn('⚠️ Error initializing notifications:', error);
  }
};

/**
 * Send fall detected alert notification
 */
export const sendFallDetectedNotification = async (description: string = 'Fall detected!'): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 FALL DETECTED',
        body: description || 'Emergency fall detected! Alert sent to guardians.',
        sound: 'default',
        badge: 1,
        data: {
          alertType: 'FALL_DETECTED',
          severity: 'high',
          timestamp: new Date().toISOString(),
        },
      },
      trigger: null, // Show immediately
    });

    console.log('🚨 Fall detected notification sent');
  } catch (error) {
    console.error('Error sending fall notification:', error);
  }
};

/**
 * Send sudden stop alert notification
 */
export const sendSuddenStopNotification = async (description: string = 'Sudden stop detected'): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ SUDDEN STOP DETECTED',
        body: description || 'Sudden stop detected! Alert sent to guardians.',
        sound: 'default',
        badge: 1,
        data: {
          alertType: 'SUDDEN_STOP',
          severity: 'medium',
          timestamp: new Date().toISOString(),
        },
      },
      trigger: null, // Show immediately
    });

    console.log('⚠️ Sudden stop notification sent');
  } catch (error) {
    console.error('Error sending sudden stop notification:', error);
  }
};

/**
 * Send activity alert notification
 */
export const sendActivityAlertNotification = async (
  title: string,
  body: string,
  severity: 'low' | 'medium' | 'high' = 'medium'
): Promise<void> => {
  try {
    const channelId = severity === 'high' ? 'emergency' : 'activity';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
        badge: 1,
        data: {
          alertType: 'ACTIVITY_ALERT',
          severity: severity,
          timestamp: new Date().toISOString(),
        },
      },
      trigger: null, // Show immediately
    });

    console.log(`📢 Activity alert notification sent: ${title}`);
  } catch (error) {
    console.error('Error sending activity alert notification:', error);
  }
};

/**
 * Setup notification listeners for when user taps notification
 */
export function setupNotificationListeners() {
  const subscriptions: any[] = [];

  try {
    // Listener for notifications received while app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('🔔 Notification received (foreground):', notification.request.content.title);
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
        const data = response.notification.request.content.data;
        console.log('👆 Notification tapped:', data);

        // Handle different alert types
        if (data.alertType === 'FALL_DETECTED' || data.alertType === 'SUDDEN_STOP') {
          console.log('🎯 Opening alerts screen for:', data.alertType);
          // Navigate to alerts screen
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

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log(`📱 Notification permission status: ${status}`);
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Cancel all notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling notifications:', error);
  }
};
