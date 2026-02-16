import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import api from '../services/api';
import { sendWeatherAlertNotification } from '../services/LocalNotificationService';
import { StoredWeatherAlert, useSession } from '../services/SessionContext';
import { WeatherAlert, WeatherAlertService } from '../services/WeatherAlertService';
import { WeatherService } from '../services/WeatherService';

interface WeatherAlertModalProps {
  visible: boolean;
  onDismiss: () => void;
  latitude?: number;
  longitude?: number;
}

export default function WeatherAlertModal({
  visible,
  onDismiss,
  latitude,
  longitude,
}: WeatherAlertModalProps) {
  const { addWeatherAlert } = useSession();
  const [alert, setAlert] = useState<WeatherAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadWeatherAlert();
    }
  }, [visible, latitude, longitude]);

  const loadWeatherAlert = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current location if not provided
      let lat = latitude;
      let lon = longitude;

      if (!lat || !lon) {
        const weather = await WeatherService.getWeatherForCurrentLocation();
        // Note: We can't get lat/lon from weather data, so we'll fetch it separately
        const location = await require('expo-location').getCurrentPositionAsync({
          accuracy: require('expo-location').Accuracy.Balanced,
        });
        lat = location.coords.latitude;
        lon = location.coords.longitude;
      }

      // Fetch weather data
      const weatherData = await WeatherService.getWeatherCached(lat!, lon!);

      // Analyze weather
      const weatherAlert = WeatherAlertService.analyzeWeather(weatherData);
      setAlert(weatherAlert);

      // Store alert in SessionContext for alerts screen
      if (weatherAlert.level !== 'safe') {
        const storedAlert: StoredWeatherAlert = {
          id: `weather_${Date.now()}`,
          level: weatherAlert.level as 'caution' | 'warning' | 'danger',
          title: weatherAlert.title,
          message: weatherAlert.message,
          weatherCondition: weatherData.weatherCondition,
          hazards: weatherAlert.hazards,
          recommendations: weatherAlert.recommendations,
          timestamp: Date.now(),
          isRead: false,
        };
        await addWeatherAlert(storedAlert);

        // Check if we should send notifications and backend alert (prevent duplicates)
        const shouldSendAlert = !storedAlert.weatherCondition || 
          !weatherAlerts.some(a => {
            const timeDiff = Date.now() - a.timestamp;
            return timeDiff < 5 * 60 * 1000 && // Within 5 minutes
                   a.level === storedAlert.level &&
                   a.weatherCondition === storedAlert.weatherCondition;
          });

        if (!shouldSendAlert) {
          console.log('⏳ Similar weather alert already sent recently, skipping notifications');
        } else {
          const primaryHazard = weatherAlert.hazards.length > 0 
            ? weatherAlert.hazards[0] 
            : 'Hazardous weather conditions';
          
          // Send local device notification
          await sendWeatherAlertNotification(
            weatherAlert.level as 'caution' | 'warning' | 'danger',
            weatherData.weatherCondition,
            primaryHazard
          );

          // Send alert to backend
          try {
            const user = await AsyncStorage.getItem('user');
            if (user) {
              const userData = JSON.parse(user);
              console.log('📤 Sending weather alert to backend...');
              const response = await api.post('/weather-alerts/send', {
                userEmail: userData.email,
                userName: userData.name,
                safetyLevel: weatherAlert.level,
                weatherCondition: weatherData.weatherCondition,
                primaryHazard: primaryHazard,
                hazards: weatherAlert.hazards,
                recommendations: weatherAlert.recommendations,
              });
              console.log('✅ Weather alert sent to backend');
            }
          } catch (alertError: any) {
            console.error('❌ Error sending weather alert to backend:', alertError.message);
          }
        }
      }
    } catch (err) {
      console.error('Error loading weather alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to load weather data');
    } finally {
      setLoading(false);
    }
  };

  const getAlertColors = () => {
    if (!alert) return { bg: '#F3F0FA', border: '#6A5ACD', text: '#1A1B4B' };

    switch (alert.level) {
      case 'safe':
        return { bg: '#E8F5E9', border: '#4CAF50', text: '#1B5E20' };
      case 'caution':
        return { bg: '#FFF3E0', border: '#FF9800', text: '#E65100' };
      case 'warning':
        return { bg: '#FFF8E1', border: '#FBC02D', text: '#F57F17' };
      case 'danger':
        return { bg: '#FFEBEE', border: '#F44336', text: '#B71C1C' };
      default:
        return { bg: '#F3F0FA', border: '#6A5ACD', text: '#1A1B4B' };
    }
  };

  const getAlertIcon = () => {
    if (!alert) return 'information-circle';

    switch (alert.level) {
      case 'safe':
        return 'checkmark-circle';
      case 'caution':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'danger':
        return 'close-circle';
      default:
        return 'information-circle';
    }
  };

  const colors = getAlertColors();

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Weather Safety Alert</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={28} color="#212121" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading weather data...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle" size={48} color="#F44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadWeatherAlert}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : alert ? (
            <ScrollView 
              style={styles.alertContent}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Alert Header */}
              <View
                style={[
                  styles.alertHeader,
                  { borderLeftColor: colors.border, backgroundColor: colors.bg },
                ]}
              >
                <Ionicons name={getAlertIcon()} size={32} color={colors.text} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.alertTitle, { color: colors.text }]}>
                    {alert.title}
                  </Text>
                  <Text style={[styles.alertMessage, { color: colors.text }]}>
                    {alert.message}
                  </Text>
                </View>
              </View>

              {/* Current Conditions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Conditions</Text>
                <View style={styles.conditionsContainer}>
                  {Object.entries(alert.conditions).map(([key, value]) => (
                    <View key={key} style={styles.conditionBox}>
                      <Text style={styles.conditionLabel}>
                        {formatConditionLabel(key)}
                      </Text>
                      <Text style={styles.conditionValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Hazards */}
              {alert.hazards.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⚠️ Potential Hazards</Text>
                  {alert.hazards.map((hazard, index) => (
                    <View key={index} style={styles.hazardItem}>
                      <Text style={styles.hazardText}>{hazard}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Recommendations */}
              {alert.recommendations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💡 Safety Recommendations</Text>
                  {alert.recommendations.map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}

          {/* Action Buttons - Fixed at bottom */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={loadWeatherAlert}
            >
              <Ionicons name="refresh" size={20} color="#6A5ACD" />
              <Text style={styles.actionButtonText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.dismissButton]}
              onPress={onDismiss}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatConditionLabel(key: string): string {
  const labels: { [key: string]: string } = {
    temperature: '🌡️ Temperature',
    windSpeed: '💨 Wind Speed',
    visibility: '👁️ Visibility',
    precipitation: '🌧️ Precipitation',
    uvIndex: '☀️ UV Index',
  };
  return labels[key] || key;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '95%',
    maxWidth: '90%',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  alertContent: {
    flex: 1,
    padding: 0,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    padding: 12,
    borderLeftWidth: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 8,
  },
  conditionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  conditionBox: {
    width: '48%',
    backgroundColor: '#F3F0FA',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  conditionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6A5ACD',
    marginBottom: 2,
  },
  conditionValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1B4B',
  },
  hazardItem: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  hazardText: {
    fontSize: 11,
    color: '#C62828',
    lineHeight: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkmarkText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 11,
  },
  recommendationText: {
    fontSize: 11,
    color: '#212121',
    lineHeight: 16,
    flex: 1,
  },
  tipItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tipText: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F0FA',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A5ACD',
  },
  dismissButton: {
    backgroundColor: '#6A5ACD',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
