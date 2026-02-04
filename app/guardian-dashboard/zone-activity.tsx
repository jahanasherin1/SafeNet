import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ZoneAlertCard from '../../components/ZoneAlertCard';
import api from '../../services/api';

interface RiskLevel {
  level: string;
  score: number;
  color: string;
  priority: number;
}

interface Trend {
  direction: string;
  percentage: string;
}

interface TopCrime {
  type: string;
  count: number;
}

interface ZoneAlert {
  success: boolean;
  city: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  risk: RiskLevel;
  statistics: {
    totalCrimes: number;
    recentCrimes: number;
    topCrimes: TopCrime[];
    trend: Trend;
  };
  alert: string;
}

interface CityRisk {
  city: string;
  risk: RiskLevel;
  recentCrimes: number;
  topCrimes: TopCrime[];
  trend: Trend;
}

export default function ZoneActivityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneAlert, setZoneAlert] = useState<ZoneAlert | null>(null);
  const [cityRisks, setCityRisks] = useState<CityRisk[]>([]);
  const [protectingEmail, setProtectingEmail] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AsyncStorage.getItem('user');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.protectingEmail) {
          setProtectingEmail(parsed.protectingEmail);
          fetchUserLocation(parsed.protectingEmail);
        }
      }
      fetchAllCityRisks();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchUserLocation = async (email: string) => {
    try {
      const response = await api.post('/guardian/sos-status', {
        protectingEmail: email
      });

      if (response.status === 200 && response.data.location) {
        const location = response.data.location;
        setUserLocation(location);
        
        if (location.latitude && location.longitude) {
          fetchZoneAlert(location.latitude, location.longitude, location.address);
        }
      }
    } catch (error) {
      console.error('Error fetching user location:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZoneAlert = async (latitude: number, longitude: number, address: string) => {
    try {
      const response = await api.post('/crime-zone/zone-alert', {
        latitude,
        longitude,
        address: address || ''
      });

      if (response.status === 200 && response.data.success) {
        setZoneAlert(response.data);
      }
    } catch (error) {
      console.error('Error fetching zone alert:', error);
    }
  };

  const fetchAllCityRisks = async () => {
    try {
      const response = await api.get('/crime-zone/city-risks');
      
      if (response.status === 200 && response.data.success) {
        setCityRisks(response.data.cities);
      }
    } catch (error) {
      console.error('Error fetching city risks:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, [protectingEmail]);

  const getRiskSummary = () => {
    if (cityRisks.length === 0) return { critical: 0, high: 0, moderate: 0, low: 0 };
    
    return cityRisks.reduce((acc, city) => {
      const level = city.risk.level;
      if (level === 'critical') acc.critical++;
      else if (level === 'high') acc.high++;
      else if (level === 'moderate') acc.moderate++;
      else acc.low++;
      return acc;
    }, { critical: 0, high: 0, moderate: 0, low: 0 });
  };

  const riskSummary = getRiskSummary();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zone Activity</Text>
        <View style={{ width: 24 }} />
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
            <Text style={styles.loadingText}>Loading zone data...</Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <Text style={styles.sectionTitle}>Kerala Crime Risk Overview</Text>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={styles.summaryNumber}>{riskSummary.critical}</Text>
                  <Text style={styles.summaryLabel}>Critical</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#FED7AA' }]}>
                  <Text style={styles.summaryNumber}>{riskSummary.high}</Text>
                  <Text style={styles.summaryLabel}>High</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={styles.summaryNumber}>{riskSummary.moderate}</Text>
                  <Text style={styles.summaryLabel}>Moderate</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={styles.summaryNumber}>{riskSummary.low}</Text>
                  <Text style={styles.summaryLabel}>Low Risk</Text>
                </View>
              </View>
            </View>

            {/* Current Location Alert - Highlighted */}
            {zoneAlert && zoneAlert.success && (
              <>
                <View style={styles.currentLocationHeader}>
                  <Ionicons name="location" size={24} color="#6A5ACD" />
                  <Text style={styles.currentLocationTitle}>Your Protected User's Location</Text>
                </View>
                
                <View style={styles.currentLocationHighlight}>
                  <View style={styles.highlightBanner}>
                    <Ionicons name="navigate-circle" size={32} color="#6A5ACD" />
                    <View style={styles.highlightBannerText}>
                      <Text style={styles.highlightDistrict}>{zoneAlert.city} District</Text>
                      <Text style={styles.highlightAddress} numberOfLines={2}>
                        {zoneAlert.location.address || 'Location detected'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.highlightStats}>
                    <View style={styles.highlightStatItem}>
                      <Text style={styles.highlightStatLabel}>Risk Level</Text>
                      <View style={[styles.highlightRiskBadge, { backgroundColor: zoneAlert.risk.color }]}>
                        <Text style={styles.highlightRiskText}>{zoneAlert.risk.level.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.highlightDivider} />
                    <View style={styles.highlightStatItem}>
                      <Text style={styles.highlightStatLabel}>Risk Score</Text>
                      <Text style={[styles.highlightStatValue, { color: zoneAlert.risk.color }]}>
                        {zoneAlert.risk.score}/100
                      </Text>
                    </View>
                    <View style={styles.highlightDivider} />
                    <View style={styles.highlightStatItem}>
                      <Text style={styles.highlightStatLabel}>Recent Crimes</Text>
                      <Text style={styles.highlightStatValue}>{zoneAlert.statistics.recentCrimes}</Text>
                    </View>
                  </View>

                  {zoneAlert.statistics.topCrimes && zoneAlert.statistics.topCrimes.length > 0 && (
                    <View style={styles.highlightCrimes}>
                      <Text style={styles.highlightCrimesTitle}>⚠️ Most Common Crimes in {zoneAlert.city}</Text>
                      {zoneAlert.statistics.topCrimes.map((crime: TopCrime, idx: number) => (
                        <View key={idx} style={styles.highlightCrimeItem}>
                          <View style={styles.highlightCrimeRank}>
                            <Text style={styles.highlightCrimeRankText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.highlightCrimeType}>{crime.type}</Text>
                          <Text style={styles.highlightCrimeCount}>{crime.count} cases</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.highlightAlert}>
                    <Ionicons name="information-circle" size={20} color="#6A5ACD" />
                    <Text style={styles.highlightAlertText}>{zoneAlert.alert}</Text>
                  </View>
                </View>
              </>
            )}

            {/* All City Risks */}
            <Text style={styles.sectionTitle}>All Districts ({cityRisks.length})</Text>
            {cityRisks.map((city, index) => {
              const isCurrentLocation = !!(zoneAlert && zoneAlert.success && 
                                       city.city === zoneAlert.city);
              
              return (
                <ZoneAlertCard
                  key={index}
                  city={city.city}
                  riskLevel={city.risk}
                  recentCrimes={city.recentCrimes}
                  topCrimes={city.topCrimes || []}
                  trend={city.trend}
                  isCurrentLocation={isCurrentLocation}
                />
              );
            })}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                Crime data is based on historical statistics from Kerala Police Department. 
                Risk levels are calculated using recent crime reports (2024-2025).
              </Text>
            </View>

            <View style={{ height: 20 }} />
          </>
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
  currentLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
    gap: 10,
  },
  currentLocationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A5ACD',
  },
  currentLocationHighlight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#6A5ACD',
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  highlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E0D7F5',
    gap: 12,
  },
  highlightBannerText: {
    flex: 1,
  },
  highlightDistrict: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 4,
  },
  highlightAddress: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  highlightStats: {
    flexDirection: 'row',
    backgroundColor: '#F8F5FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  highlightStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  highlightDivider: {
    width: 1,
    backgroundColor: '#D1C4E9',
    marginHorizontal: 8,
  },
  highlightStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  highlightRiskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  highlightRiskText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  highlightStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  highlightCrimes: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  highlightCrimesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  highlightCrimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  highlightCrimeRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6A5ACD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightCrimeRankText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  highlightCrimeType: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  highlightCrimeCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A5ACD',
  },
  highlightAlert: {
    flexDirection: 'row',
    backgroundColor: '#E0D7F5',
    padding: 14,
    borderRadius: 10,
    gap: 10,
    alignItems: 'flex-start',
  },
  highlightAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#4C1D95',
    lineHeight: 20,
    fontWeight: '500',
  },
  summaryContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 4,
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
});
