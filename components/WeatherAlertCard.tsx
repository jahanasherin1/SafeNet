import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WeatherAlert } from '../services/WeatherAlertService';

interface WeatherAlertCardProps {
  alert: WeatherAlert;
  onDismiss?: () => void;
  onLearnMore?: () => void;
}

export default function WeatherAlertCard({
  alert,
  onDismiss,
  onLearnMore,
}: WeatherAlertCardProps) {
  const getAlertColors = () => {
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
    <View style={[styles.container, { borderLeftColor: colors.border }]}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <Ionicons name={getAlertIcon()} size={24} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>
      </View>

      {/* Main message */}
      <Text style={[styles.message, { color: colors.text }]}>{alert.message}</Text>

      {/* Conditions section */}
      {Object.keys(alert.conditions).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Current Conditions
          </Text>
          <View style={styles.conditionsGrid}>
            {Object.entries(alert.conditions).map(([key, value]) => (
              <View key={key} style={styles.conditionItem}>
                <Text style={[styles.conditionLabel, { color: colors.text }]}>
                  {formatConditionLabel(key)}
                </Text>
                <Text style={[styles.conditionValue, { color: colors.text }]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Hazards section */}
      {alert.hazards.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            ⚠️ Hazards
          </Text>
          {alert.hazards.map((hazard, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={[styles.bulletPoint, { color: colors.text }]}>•</Text>
              <Text style={[styles.listText, { color: colors.text }]}>{hazard}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations section */}
      {alert.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            💡 Recommendations
          </Text>
          {alert.recommendations.map((rec, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={[styles.bulletPoint, { color: colors.text }]}>•</Text>
              <Text style={[styles.listText, { color: colors.text }]}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Travel Safety Indicator */}
      <View style={[styles.travelSafety, { backgroundColor: alert.isSafeToTravel ? '#C8E6C9' : '#FFCDD2' }]}>
        <Ionicons
          name={alert.isSafeToTravel ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={alert.isSafeToTravel ? '#2E7D32' : '#C62828'}
        />
        <Text style={[styles.travelText, { color: alert.isSafeToTravel ? '#2E7D32' : '#C62828' }]}>
          {alert.isSafeToTravel ? 'Travel is generally safe' : 'Travel is NOT recommended'}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        {onLearnMore && (
          <TouchableOpacity
            style={[styles.button, styles.learnMoreButton, { borderColor: colors.border }]}
            onPress={onLearnMore}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>Learn More</Text>
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity
            style={[styles.button, styles.dismissButton]}
            onPress={onDismiss}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Helper function to format condition labels
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
  container: {
    backgroundColor: '#F3F0FA',
    borderRadius: 12,
    borderLeftWidth: 6,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    flex: 1,
    color: '#1A1B4B',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    color: '#1A1B4B',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1A1B4B',
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  conditionItem: {
    width: '48%',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  conditionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    color: '#6A5ACD',
  },
  conditionValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1B4B',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    marginRight: 8,
    marginTop: -2,
    color: '#6A5ACD',
  },
  listText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    color: '#1A1B4B',
  },
  travelSafety: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  travelText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnMoreButton: {
    backgroundColor: '#F3F0FA',
    borderWidth: 1.5,
  },
  dismissButton: {
    backgroundColor: '#6A5ACD',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A5ACD',
  },
  dismissButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
