// components/ZoneAlertCard.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ZoneAlertProps {
  city: string;
  riskLevel: {
    level: string;
    score: number;
    color: string;
  };
  recentCrimes: number;
  topCrimes: Array<{type: string; count: number}>;
  trend: {
    direction: string;
    percentage: string;
  };
  address?: string;
  isCurrentLocation?: boolean;
}

export default function ZoneAlertCard({ 
  city, 
  riskLevel, 
  recentCrimes, 
  topCrimes, 
  trend,
  address,
  isCurrentLocation = false
}: ZoneAlertProps) {
  
  const getRiskIcon = () => {
    switch (riskLevel.level) {
      case 'critical':
        return 'warning';
      case 'high':
        return 'alert-circle';
      case 'moderate':
        return 'information-circle';
      case 'low':
      case 'very low':
        return 'shield-checkmark';
      default:
        return 'help-circle';
    }
  };

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'increasing':
        return 'trending-up';
      case 'decreasing':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  const getTrendColor = () => {
    switch (trend.direction) {
      case 'increasing':
        return '#DC2626';
      case 'decreasing':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={[
      styles.card, 
      { borderLeftColor: riskLevel.color, borderLeftWidth: 4 },
      isCurrentLocation && styles.currentLocationCard
    ]}>
      {/* Current Location Badge */}
      {isCurrentLocation && (
        <View style={styles.currentLocationBadge}>
          <Ionicons name="navigate" size={14} color="#6A5ACD" />
          <Text style={styles.currentLocationText}>Current Location</Text>
        </View>
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={getRiskIcon()} size={24} color={riskLevel.color} />
          <View style={styles.headerText}>
            <Text style={styles.cityName}>{city}</Text>
            {address && <Text style={styles.address} numberOfLines={1}>{address}</Text>}
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: riskLevel.color }]}>
          <Text style={styles.badgeText}>{riskLevel.level.toUpperCase()}</Text>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{recentCrimes}</Text>
          <Text style={styles.statLabel}>Recent Crimes</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <View style={styles.trendContainer}>
            <Ionicons name={getTrendIcon()} size={20} color={getTrendColor()} />
            <Text style={[styles.statValue, { color: getTrendColor(), fontSize: 18 }]}>
              {trend.percentage}%
            </Text>
          </View>
          <Text style={styles.statLabel}>
            {trend.direction === 'increasing' ? 'Increasing' : 
             trend.direction === 'decreasing' ? 'Decreasing' : 'Stable'}
          </Text>
        </View>
      </View>

      {/* Top Crimes */}
      {topCrimes && topCrimes.length > 0 && (
        <View style={styles.crimesContainer}>
          <Text style={styles.crimesTitle}>Most Common Crimes:</Text>
          {topCrimes.slice(0, 3).map((crime, index) => (
            <View key={index} style={styles.crimeItem}>
              <View style={styles.crimeIcon}>
                <Ionicons name="alert-circle-outline" size={14} color="#6B7280" />
              </View>
              <Text style={styles.crimeType}>{crime.type}</Text>
              <Text style={styles.crimeCount}>({crime.count})</Text>
            </View>
          ))}
        </View>
      )}

      {/* Risk Score */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>Risk Score:</Text>
        <View style={styles.scoreBar}>
          <View 
            style={[
              styles.scoreBarFill, 
              { width: `${riskLevel.score}%`, backgroundColor: riskLevel.color }
            ]} 
          />
        </View>
        <Text style={styles.scoreValue}>{riskLevel.score}/100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentLocationCard: {
    backgroundColor: '#F8F5FF',
    borderWidth: 2,
    borderColor: '#6A5ACD',
    shadowColor: '#6A5ACD',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  currentLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0D7F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  currentLocationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A5ACD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  cityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  address: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crimesContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  crimesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  crimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  crimeIcon: {
    marginRight: 6,
  },
  crimeType: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  crimeCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginRight: 8,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginLeft: 8,
  },
});
