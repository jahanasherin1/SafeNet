import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

interface CrimeChance {
  crimeType: string;
  count: number;
  chance: number;
  level: string;
  color: string;
  percentage: string;
  range: { min: number; max: number };
}

interface OverallRisk {
  level: string;
  color: string;
  icon: string;
  avgChance: number;
  totalRecentCrimes: number;
}

interface CrimeChanceData {
  success: boolean;
  location: {
    name: string;
    distance: number;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  overallRisk: OverallRisk;
  crimeChances: CrimeChance[];
  detectedAt: string;
}

export default function ZoneActivityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crimeChanceData, setCrimeChanceData] = useState<CrimeChanceData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useEffect(() => {
    loadCrimeChances();
  }, []);

  const loadCrimeChances = async () => {
    try {
      await fetchCurrentLocationAndChances();
    } catch (error) {
      console.error('Error loading crime chances:', error);
    }
  };

  const notifyGuardiansOfHighRisk = async (
    locationName: string,
    overallRisk: OverallRisk,
    latitude: number,
    longitude: number,
    address: string
  ) => {
    try {
      // Get user email from storage
      const storedUser = await AsyncStorage.getItem('user');
      if (!storedUser) return;
      
      const user = JSON.parse(storedUser);
      const userEmail = user.email;
      const userName = user.name || 'User';

      // Check if we already notified recently (within 30 minutes)
      const lastNotifyKey = `lastHighRiskNotify_${locationName}`;
      const lastNotifyTime = await AsyncStorage.getItem(lastNotifyKey);
      
      if (lastNotifyTime) {
        const timeDiff = Date.now() - parseInt(lastNotifyTime);
        const minutesDiff = timeDiff / (1000 * 60);
        if (minutesDiff < 30) {
          console.log('Already notified guardians recently, skipping...');
          return;
        }
      }

      // Prepare alert message
      const riskEmoji = overallRisk.level === 'Critical' ? '🚨' : '⚠️';
      const alertMessage = `${riskEmoji} ${userName} has entered a ${overallRisk.level.toUpperCase()} RISK area: ${locationName}. Average crime chance: ${overallRisk.avgChance}%. Recent crimes: ${overallRisk.totalRecentCrimes}.`;

      // Send alert to guardians
      const alertResponse = await api.post('/sos/trigger', {
        userEmail: userEmail,
        userName: userName,
        location: {
          latitude,
          longitude
        },
        reason: alertMessage,
        alertType: 'HIGH_RISK_AREA',
        timestamp: new Date().toISOString()
      });

      if (alertResponse.status === 200) {
        console.log('✅ Guardians notified of high-risk area');
        // Store notification time
        await AsyncStorage.setItem(lastNotifyKey, Date.now().toString());
        
        // Show user confirmation
        Alert.alert(
          `${riskEmoji} High Risk Area`,
          `You are in a ${overallRisk.level} risk area (${locationName}). Your guardians have been notified of your location.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error notifying guardians:', error);
      // Don't show error to user, fail silently
    }
  };

  const fetchCurrentLocationAndChances = async () => {
    try {
      // Get user's current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show crime chances in your area.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Reverse geocode to get address
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const addressString = address[0] 
        ? `${address[0].city || address[0].subregion || address[0].region}, ${address[0].region}`
        : 'Current Location';

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: addressString,
      });

      // Fetch crime chances
      const response = await api.post('/crime-chance/at-location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radius: 3 // 3km radius
      });

      if (response.status === 200 && response.data.success) {
        setCrimeChanceData(response.data);
        
        // Check if overall risk is high or critical and notify guardians
        const riskLevel = response.data.overallRisk.level.toLowerCase();
        if (riskLevel === 'high' || riskLevel === 'critical') {
          await notifyGuardiansOfHighRisk(
            response.data.location.name,
            response.data.overallRisk,
            location.coords.latitude,
            location.coords.longitude,
            addressString
          );
        }
      } else {
        Alert.alert('No Data', response.data.message || 'No crime data available for your location.');
      }
    } catch (error) {
      console.error('Error fetching crime chances:', error);
      Alert.alert('Error', 'Failed to load crime data for your location.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCrimeChances();
    setRefreshing(false);
  }, []);

  const getRiskIcon = (level: string): any => {
    switch (level.toLowerCase()) {
      case 'critical': return 'warning';
      case 'high': return 'alert-circle';
      case 'moderate': return 'alert';
      default: return 'checkmark-circle';
    }
  };

  const getChanceLevelIcon = (level: string): any => {
    if (level === 'very high' || level === 'high') return 'arrow-up-circle';
    if (level === 'moderate') return 'remove-circle';
    return 'arrow-down-circle';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crime Chances</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#6A5ACD" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6A5ACD']} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6A5ACD" />
            <Text style={styles.loadingText}>Analyzing crime data...</Text>
          </View>
        ) : crimeChanceData ? (
          <>
            {/* Location Info */}
            <View style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={28} color="#6A5ACD" />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName}>{crimeChanceData.location.name}</Text>
                  <Text style={styles.locationDistance}>
                    {crimeChanceData.location.distance === 0 
                      ? 'You are here' 
                      : `${crimeChanceData.location.distance}km from your location`}
                  </Text>
                  {currentLocation && (
                    <Text style={styles.locationAddress}>{currentLocation.address}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Overall Risk Summary */}
            <View style={[styles.overallRiskCard, { borderColor: crimeChanceData.overallRisk.color }]}>
              <View style={styles.overallRiskHeader}>
                <Ionicons 
                  name={getRiskIcon(crimeChanceData.overallRisk.level)} 
                  size={48} 
                  color={crimeChanceData.overallRisk.color} 
                />
                <View style={styles.overallRiskInfo}>
                  <Text style={styles.overallRiskLabel}>Overall Risk Level</Text>
                  <Text style={[styles.overallRiskLevel, { color: crimeChanceData.overallRisk.color }]}>
                    {crimeChanceData.overallRisk.level.toUpperCase()}
                  </Text>
                  <Text style={styles.overallRiskChance}>
                    Average Chance: {crimeChanceData.overallRisk.avgChance}%
                  </Text>
                </View>
              </View>
              <View style={styles.overallRiskStats}>
                <View style={styles.overallRiskStat}>
                  <Text style={styles.overallRiskStatValue}>
                    {crimeChanceData.overallRisk.totalRecentCrimes}
                  </Text>
                  <Text style={styles.overallRiskStatLabel}>Recent Crimes (2024-2025)</Text>
                </View>
                <View style={styles.overallRiskDivider} />
                <View style={styles.overallRiskStat}>
                  <Text style={styles.overallRiskStatValue}>
                    {crimeChanceData.crimeChances.length}
                  </Text>
                  <Text style={styles.overallRiskStatLabel}>Crime Types</Text>
                </View>
              </View>
            </View>

            {/* Crime Type Chances */}
            <Text style={styles.sectionTitle}>
              Crime Type Chances ({crimeChanceData.crimeChances.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Based on recent crime data (2024-2025) in this area
            </Text>

            {crimeChanceData.crimeChances.map((crime, index) => (
              <View key={index} style={styles.crimeCard}>
                <View style={styles.crimeCardHeader}>
                  <View style={styles.crimeCardRank}>
                    <Text style={styles.crimeCardRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.crimeCardInfo}>
                    <Text style={styles.crimeCardType}>{crime.crimeType}</Text>
                    <Text style={styles.crimeCardCount}>{crime.count} cases recently</Text>
                  </View>
                  <Ionicons 
                    name={getChanceLevelIcon(crime.level)} 
                    size={24} 
                    color={crime.color} 
                  />
                </View>

                {/* Chance Meter */}
                <View style={styles.chanceMeter}>
                  <View style={styles.chanceMeterBg}>
                    <View 
                      style={[
                        styles.chanceMeterFill, 
                        { width: `${crime.chance}%`, backgroundColor: crime.color }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.chanceMeterText, { color: crime.color }]}>
                    {crime.percentage} Chance
                  </Text>
                </View>

                {/* Chance Level */}
                <View style={[styles.chanceLevel, { backgroundColor: crime.color + '20' }]}>
                  <Text style={[styles.chanceLevelText, { color: crime.color }]}>
                    {crime.level.toUpperCase()} RISK
                  </Text>
                </View>

                {/* Range Info */}
                <View style={styles.rangeInfo}>
                  <Text style={styles.rangeLabel}>Data Range:</Text>
                  <Text style={styles.rangeText}>
                    Min: {crime.range.min} | Max: {crime.range.max} cases
                  </Text>
                </View>
              </View>
            ))}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                Crime chances are calculated based on recent crime statistics (2024-2025) in {crimeChanceData.location.name}. 
                The high/low ranges are determined from actual data in the area. Higher percentages indicate higher likelihood based on historical patterns.
              </Text>
            </View>

            <View style={{ height: 20 }} />
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="alert-circle" size={64} color="#9CA3AF" />
            <Text style={styles.noDataText}>No crime data available for your location</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadCrimeChances}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 5,
  },
  refreshButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  locationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 4,
  },
  locationDistance: {
    fontSize: 13,
    color: '#6A5ACD',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: '#6B7280',
  },
  overallRiskCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  overallRiskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  overallRiskInfo: {
    flex: 1,
  },
  overallRiskLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  overallRiskLevel: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  overallRiskChance: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  overallRiskStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overallRiskStat: {
    flex: 1,
    alignItems: 'center',
  },
  overallRiskStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 4,
  },
  overallRiskStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  overallRiskDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  crimeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  crimeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  crimeCardRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6A5ACD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crimeCardRankText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  crimeCardInfo: {
    flex: 1,
  },
  crimeCardType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 2,
  },
  crimeCardCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  chanceMeter: {
    marginBottom: 12,
  },
  chanceMeterBg: {
    height: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  chanceMeterFill: {
    height: '100%',
    borderRadius: 12,
  },
  chanceMeterText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  chanceLevel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  chanceLevelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  rangeText: {
    fontSize: 12,
    color: '#1F2937',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6A5ACD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
