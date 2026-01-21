import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

interface AlertItem {
  _id: string;
  userEmail: string;
  userName: string;
  type: 'sos' | 'journey_started' | 'journey_delayed' | 'journey_completed' | 'location_shared' | 'fake_call_activated';
  title: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export default function UserAlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useFocusEffect(
    useCallback(() => {
      loadUserEmail();
    }, [])
  );

  const loadUserEmail = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      console.log('===== USER ALERTS LOADING =====');
      
      if (userData) {
        const user = JSON.parse(userData);
        const email = user.email;
        console.log('User email:', email);
        
        if (email) {
          setUserEmail(email);
          fetchAlerts(email);
        } else {
          Alert.alert('Error', 'User email not found');
        }
      } else {
        Alert.alert('Error', 'Please log in again');
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchAlerts = async (email: string, type?: string) => {
    try {
      setLoading(true);
      console.log('===== FETCHING USER ALERTS =====');
      console.log('Email:', email);
      
      // Build query params
      let url = `/alerts/user/${email}?limit=100`;
      if (type && type !== 'all') url += `&type=${type}`;
      
      console.log('API URL:', url);
      const response = await api.get(url);
      console.log('Alerts response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.alerts) {
        setAlerts(response.data.alerts);
        setUnreadCount(response.data.pagination?.unread || 0);
        console.log(`Loaded ${response.data.alerts.length} alerts`);
      } else {
        console.log('No alerts data in response');
        setAlerts([]);
        setUnreadCount(0);
      }
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      if (error.response?.status === 404) {
        console.log('No alerts yet');
        setAlerts([]);
      } else {
        Alert.alert('Error', 'Failed to load alerts. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts(userEmail, filterType);
    setRefreshing(false);
  };

  const applyFilter = (type: string) => {
    setFilterType(type);
    fetchAlerts(userEmail, type);
  };

  const markAsRead = async (alertIds: string[]) => {
    try {
      await api.put('/alerts/mark-read', { alertIds });
      setAlerts(prev => prev.map(alert => 
        alertIds.includes(alert._id) ? { ...alert, isRead: true } : alert
      ));
      setUnreadCount(prev => Math.max(0, prev - alertIds.length));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put(`/alerts/mark-all-read/${userEmail}`);
      setAlerts(prev => prev.map(alert => ({ ...alert, isRead: true })));
      setUnreadCount(0);
      Alert.alert('Success', 'All alerts marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const openLocation = (latitude: number, longitude: number) => {
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    Alert.alert(
      'Open Location',
      'View location in Google Maps?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => {
          console.log('Open maps:', mapsUrl);
        }}
      ]
    );
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'sos':
        return { name: 'alert-circle', color: '#FF4B4B', IconComponent: Ionicons };
      case 'journey_started':
        return { name: 'walk', color: '#4CAF50', IconComponent: MaterialCommunityIcons };
      case 'journey_delayed':
        return { name: 'timer-alert-outline', color: '#FF9800', IconComponent: MaterialCommunityIcons };
      case 'journey_completed':
        return { name: 'check-circle', color: '#4CAF50', IconComponent: Ionicons };
      case 'location_shared':
        return { name: 'location-on', color: '#2196F3', IconComponent: MaterialIcons };
      case 'fake_call_activated':
        return { name: 'phone', color: '#9C27B0', IconComponent: Ionicons };
      default:
        return { name: 'notifications', color: '#757575', IconComponent: Ionicons };
    }
  };

  const getUserFacingMessage = (item: AlertItem) => {
    switch (item.type) {
      case 'sos':
        return {
          title: '🚨 Emergency SOS',
          message: `You triggered an emergency SOS alert. Your guardians have been notified with your location.`
        };
      case 'journey_started':
        return {
          title: '🚶 Journey Started',
          message: `You started a journey. Your guardians are tracking your progress.`
        };
      case 'journey_delayed':
        return {
          title: '⏰ Journey Delayed',
          message: `Your journey is taking longer than expected. Your guardians have been notified.`
        };
      case 'journey_completed':
        return {
          title: '✅ Journey Completed',
          message: `You safely completed your journey. Your guardians have been notified.`
        };
      case 'location_shared':
        return {
          title: '📍 Location Shared',
          message: `You shared your current location with your guardians.`
        };
      case 'fake_call_activated':
        return {
          title: '📞 Fake Call Activated',
          message: `You activated a fake call for safety.`
        };
      default:
        return {
          title: item.title,
          message: item.message
        };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderAlert = ({ item }: { item: AlertItem }) => {
    const { name, color, IconComponent } = getAlertIcon(item.type);
    const userMessage = getUserFacingMessage(item);
    
    return (
      <TouchableOpacity
        style={[styles.alertCard, !item.isRead && styles.unreadCard]}
        onPress={() => {
          if (!item.isRead) {
            markAsRead([item._id]);
          }
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <IconComponent name={name as any} size={28} color={color} />
        </View>

        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertTitle}>{userMessage.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.alertMessage}>{userMessage.message}</Text>
          
          {item.location && (
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => openLocation(item.location!.latitude, item.location!.longitude)}
            >
              <Ionicons name="location" size={16} color="#6A5ACD" />
              <Text style={styles.locationText}>View Location</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A5ACD" />
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Alerts</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Ionicons name="checkmark-done" size={20} color="#6A5ACD" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Section */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
            onPress={() => applyFilter('all')}
          >
            <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'sos' && styles.filterChipActive]}
            onPress={() => applyFilter('sos')}
          >
            <Text style={[styles.filterText, filterType === 'sos' && styles.filterTextActive]}>SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'journey_started' && styles.filterChipActive]}
            onPress={() => applyFilter('journey_started')}
          >
            <Text style={[styles.filterText, filterType === 'journey_started' && styles.filterTextActive]}>Journey</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'location_shared' && styles.filterChipActive]}
            onPress={() => applyFilter('location_shared')}
          >
            <Text style={[styles.filterText, filterType === 'location_shared' && styles.filterTextActive]}>Location</Text>
          </TouchableOpacity>
        </View>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#C0C0C0" />
          <Text style={styles.emptyTitle}>No Activity Yet</Text>
          <Text style={styles.emptyText}>
            Your safety activities will appear here. This includes SOS triggers, journey updates, location sharing, and fake calls.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6A5ACD']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#7A7A7A' },
  header: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8E6F0', position: 'relative' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1B4B' },
  headerSubtitle: { fontSize: 12, color: '#6A5ACD', fontWeight: '600' },
  markAllButton: { padding: 8, position: 'absolute', right: 20 },
  listContent: { padding: 15 },
  alertCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 12, elevation: 2 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#6A5ACD' },
  iconContainer: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  alertContent: { flex: 1 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#1A1B4B', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6A5ACD', marginLeft: 8 },
  alertMessage: { fontSize: 14, color: '#4A4A4A', lineHeight: 20, marginBottom: 10 },
  locationButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#F3F0FA', borderRadius: 8, marginBottom: 8 },
  locationText: { fontSize: 13, fontWeight: '600', color: '#6A5ACD', marginLeft: 5 },
  timeText: { fontSize: 12, color: '#9A9A9A', fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1B4B', marginTop: 20, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#7A7A7A', textAlign: 'center', lineHeight: 22 },
  filterContainer: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E8E6F0' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#6A5ACD', backgroundColor: '#FFF', gap: 4 },
  filterChipActive: { backgroundColor: '#6A5ACD', borderColor: '#6A5ACD' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6A5ACD' },
  filterTextActive: { color: '#FFF' },
});