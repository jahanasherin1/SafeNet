import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, AppState, Image, NativeModules, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { useSession } from '../../services/SessionContext';
// Import the task name and functions
import { isBackgroundTrackingActive, startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../../services/BackgroundLocationService';
import { startWeatherMonitoring, stopWeatherMonitoring } from '../../services/BackgroundWeatherAlertService';

export default function DashboardHome() {
  const router = useRouter();
  const { isAlertVisible } = useSession();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Tracking State
  const [sosLoading, setSosLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Waiting for updates...');
  const [lastSosTime, setLastSosTime] = useState<string | null>(null);
  const [lastSosTimeDisplay, setLastSosTimeDisplay] = useState<string | null>(null);
  const [cancelAlarmLoading, setCancelAlarmLoading] = useState(false);

  // --- 1. LOAD DATA & CHECK STATUS ON FOCUS ---
  useFocusEffect(
    useCallback(() => {
      console.log('📱 [DASHBOARD] Screen focused - reloading all data');
      loadUserData();
      checkTrackingStatus();
      loadSosStatus(); // ✅ Check for tile SOS when screen comes into focus
      storeBackendUrlForAndroid(); // ✅ Store URL for Android native code
    }, [])
  );

  // --- 1.5. RELOAD SOS STATUS WHEN ALERT MODAL CLOSES ---
  React.useEffect(() => {
    // When alert modal closes (isAlertVisible becomes false), reload lastSosTime
    // This ensures the cancel button appears immediately after SOS is sent
    if (!isAlertVisible) {
      console.log('🔄 Alert modal closed, reloading SOS status...');
      loadSosStatus();
    }
  }, [isAlertVisible]);

  // --- 1.6. ✅ RELOAD SOS STATUS WHEN APP COMES TO FOREGROUND (FOR TILE SOS) ---
  React.useEffect(() => {
    // Listen for app state changes (e.g., tile clicked, app opened)
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Also check immediately in case tile was clicked while app was open in background
    loadSosStatus();
    
    return () => {
      subscription.remove();
    };
  }, []);

  // --- 1.7. LOG LASTSOS TIME CHANGES ---
  React.useEffect(() => {
    if (lastSosTime) {
      console.log('✅ [CANCEL BUTTON STATE] lastSosTime updated:', lastSosTime);
      console.log('✅ [CANCEL BUTTON] Should be VISIBLE now');
    } else {
      console.log('⚠️ [CANCEL BUTTON STATE] lastSosTime cleared or null');
      console.log('⚠️ [CANCEL BUTTON] Should be HIDDEN now');
    }
  }, [lastSosTime]);

  const handleAppStateChange = (nextAppState: string) => {
    console.log('📱 [APP STATE] State changed to:', nextAppState);
    // Reload SOS status when app comes to foreground
    if (nextAppState === 'active') {
      console.log('🔄 [TILE SOS] App came to foreground, checking for new SOS alerts...');
      loadSosStatus();
    }
  };

  /**
   * ✅ Check if alert time is stale (older than 1 hour)
   */
  const isAlertStale = (sosTimeString: string): boolean => {
    try {
      const sosTime = new Date(sosTimeString).getTime();
      const now = new Date().getTime();
      const diffMinutes = (now - sosTime) / (1000 * 60);
      
      // If alert is older than 1 hour, it's stale
      if (diffMinutes > 60) {
        console.log(`⏰ [CANCEL BUTTON] Alert is stale (${diffMinutes.toFixed(0)} mins old) - clearing`);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ [CANCEL BUTTON] Error checking if alert is stale:', error);
      return false;
    }
  };

  const loadSosStatus = async () => {
    try {
      const sosTime = await AsyncStorage.getItem('lastSosTime');
      console.log('📖 [CANCEL BUTTON] Reading from AsyncStorage - lastSosTime:', sosTime || 'NULL');
      
      if (sosTime) {
        // ✅ NEW: Check if alert is stale (older than 1 hour)
        if (isAlertStale(sosTime)) {
          console.log('⏰ [CANCEL BUTTON] Clearing stale alert from storage');
          await AsyncStorage.removeItem('lastSosTime');
          setLastSosTime(null);
          return;
        }
        
        console.log('✅ [CANCEL BUTTON] lastSosTime loaded:', sosTime);
        setLastSosTime(sosTime);
        // ✅ Format for display
        const displayTime = new Date(sosTime).toLocaleString([], { 
          day: 'numeric', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setLastSosTimeDisplay(displayTime);
      } else {
        // ✅ If AsyncStorage is empty, try to read from Android SharedPreferences
        // This is needed because tile SOS stores to SharedPreferences when app is closed
        console.log('⚠️ [CANCEL BUTTON] AsyncStorage empty, checking SharedPreferences...');
        try {
          const SharedPreferencesModule = NativeModules.SharedPreferencesModule;
          if (SharedPreferencesModule && SharedPreferencesModule.getString) {
            console.log('🔧 [CANCEL BUTTON] SharedPreferencesModule found, reading RCTAsyncStorage_user_prefs...');
            const sharedPrefValue = await SharedPreferencesModule.getString('RCTAsyncStorage_user_prefs', 'lastSosTime');
            
            if (sharedPrefValue) {
              // ✅ NEW: Check if alert is stale before setting
              if (isAlertStale(sharedPrefValue)) {
                console.log('⏰ [CANCEL BUTTON] Clearing stale alert from SharedPreferences');
                setLastSosTime(null);
                setLastSosTimeDisplay(null);
                return;
              }
              
              console.log('✅ [CANCEL BUTTON] Found in SharedPreferences:', sharedPrefValue);
              // Sync back to AsyncStorage for next time
              await AsyncStorage.setItem('lastSosTime', sharedPrefValue);
              setLastSosTime(sharedPrefValue);
              // ✅ Format for display
              const displayTime = new Date(sharedPrefValue).toLocaleString([], { 
                day: 'numeric', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              });
              setLastSosTimeDisplay(displayTime);
            } else {
              console.log('⚠️ [CANCEL BUTTON] SharedPreferences also empty - no tile click detected');
              setLastSosTime(null);
              setLastSosTimeDisplay(null);
            }
          } else {
            console.log('⚠️ [CANCEL BUTTON] SharedPreferencesModule not available - clearing state');
            setLastSosTime(null);
            setLastSosTimeDisplay(null);
          }
        } catch (nativeError) {
          console.warn('⚠️ [CANCEL BUTTON] Could not read SharedPreferences:', (nativeError as any).message);
          setLastSosTime(null);
          setLastSosTimeDisplay(null);
        }
      }
    } catch (e) {
      console.error("❌ [CANCEL BUTTON] Failed to load SOS status", e);
      setLastSosTime(null);
      setLastSosTimeDisplay(null);
    }
  };

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUserName(parsedUser.name || 'User');
        setUserEmail(parsedUser.email || '');
        setProfileImage(parsedUser.profileImage || null);
      }
    } catch (error) {
      console.error("Failed to load user data", error);
    }
  };

  /**
   * ✅ NEW: Store backend URL for Android native code (SOS Tile) to access
   * Works with any backend URL - both SharedPreferences and file storage
   */
  const storeBackendUrlForAndroid = async () => {
    try {
      const backendUrl = api.defaults.baseURL;
      if (!backendUrl) {
        console.warn('⚠️ No backend URL found');
        return;
      }

      // Store in AsyncStorage (already done by api.ts, but double-check)
      await AsyncStorage.setItem('backendUrl', backendUrl);
      console.log('💾 Backend URL stored in AsyncStorage:', backendUrl);

      // Try to write to Android SharedPreferences via native module if available
      try {
        if (NativeModules.UserDataModule) {
          NativeModules.UserDataModule.setBackendUrl(backendUrl);
          console.log('📱 Backend URL sent to Android native code');
        }
      } catch (nativeError) {
        console.warn('⚠️ Could not write to Android SharedPreferences:', nativeError);
        // This is OK - fallback to file storage via UserDataHelper
      }
    } catch (error) {
      console.error('❌ Error storing backend URL:', error);
    }
  };


  const checkTrackingStatus = async () => {
    try {
      // 1. Check if the Background Task is running using the proper API
      const isTracking = await isBackgroundTrackingActive();
      setIsTracking(isTracking);

      // 2. Load the last known timestamp from Storage (written by the Background Task)
      const storedTime = await AsyncStorage.getItem('lastLocationTime');
      if (storedTime) {
        const date = new Date(storedTime);
        setLastUpdated(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else if (!isTracking) {
        setLastUpdated("Tracking Disabled");
      }
    } catch (e) {
      console.error("Status check failed", e);
    }
  };

  // --- 2. TOGGLE TRACKING (START/STOP) ---
  const toggleTracking = async () => {
    if (isTracking) {
      // --- STOP TRACKING ---
      try {
        await stopBackgroundLocationTracking();
        await stopWeatherMonitoring();
        setIsTracking(false);
        setLastUpdated("Stopped");
        Alert.alert("Location Tracking", "Live tracking disabled.");
      } catch (err) {
        console.log("Error stopping location:", err);
      }
    } else {
      // --- START TRACKING ---
      try {
        const success = await startBackgroundLocationTracking();
        if (success) {
          // Start weather monitoring alongside location tracking
          await startWeatherMonitoring();
          
          setIsTracking(true);
          
          // Update Timestamp immediately
          const now = new Date();
          const iso = now.toISOString();
          await AsyncStorage.setItem('lastLocationTime', iso);
          setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          
          Alert.alert("Location Tracking", "Live tracking and weather alerting enabled.");
        } else {
          Alert.alert("Error", "Could not start location tracking. Check permissions.");
        }
      } catch (error) {
        console.error("Start tracking error:", error);
        Alert.alert("Error", "Could not start location tracking.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      // Stop tracking and weather monitoring on logout
      await stopBackgroundLocationTracking();
      await stopWeatherMonitoring();
      
      // Clear all user-related AsyncStorage items
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('lastLocationTime');
      await AsyncStorage.removeItem('selectedUser');
      await AsyncStorage.removeItem('guardianEmail');
      
      // Reset all local state
      setIsTracking(false);
      setLastUpdated('Not Started');
      setSosLoading(false);
      
      router.replace('/main'); 
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCancelFalseAlarm = async () => {
    setCancelAlarmLoading(true);
    try {
      if (!userEmail) {
        Alert.alert("Error", "User email not found. Please refresh the app.");
        setCancelAlarmLoading(false);
        return;
      }

      // Confirm with user first
      Alert.alert(
        "Cancel False Alarm?",
        "This will notify your guardians that you are safe and the alert was accidental.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              console.log('❌ User cancelled the confirmation dialog');
              setCancelAlarmLoading(false);
            }
          },
          {
            text: "Confirm",
            style: "default",
            onPress: async () => {
              try {
                console.log('🚀 Sending false alarm cancellation request...');
                console.log('📧 User email:', userEmail);
                
                // ✅ CRITICAL FIX: Clear from BOTH AsyncStorage AND SharedPreferences BEFORE making API call
                console.log('🧹 Clearing SOS from all storage...');
                
                // 1. Clear from AsyncStorage
                await AsyncStorage.removeItem('lastSosTime');
                console.log('✅ Removed from AsyncStorage');
                
                // 2. Clear from Android SharedPreferences (where tile SOS stores it)
                try {
                  const SharedPreferencesModule = NativeModules.SharedPreferencesModule;
                  if (SharedPreferencesModule && SharedPreferencesModule.remove) {
                    await SharedPreferencesModule.remove('RCTAsyncStorage_user_prefs', 'lastSosTime');
                    console.log('✅ Removed from SharedPreferences');
                  }
                } catch (nativeError) {
                  console.warn('⚠️ Could not clear SharedPreferences:', (nativeError as any).message);
                  // Continue anyway - not critical
                }
                
                // 3. NOW clear the state (after storage is definitely cleared)
                setLastSosTime(null);
                setLastSosTimeDisplay(null);
                console.log('✅ State cleared - button should now be hidden');
                
                const response = await api.post('/sos/cancel-false-alarm', {
                  userEmail: userEmail
                });

                console.log('✅ Response received:', response.status, response.data);

                if (response.status === 200) {
                  // Calculate total notifications sent
                  const emailsSent = response.data?.emailsSent || 0;
                  const smsSent = response.data?.smsSent || 0;
                  const totalNotifications = emailsSent + smsSent;

                  const notificationMessage = totalNotifications > 0
                    ? `Your guardians have been notified via ${emailsSent > 0 ? `${emailsSent} email${emailsSent > 1 ? 's' : ''}` : ''}${emailsSent > 0 && smsSent > 0 ? ' and ' : ''}${smsSent > 0 ? `${smsSent} SMS` : ''}.`
                    : 'Notifications sent to your guardians.';

                  Alert.alert(
                    "✅ False Alarm Cancelled",
                    notificationMessage
                  );
                }
              } catch (error: any) {
                console.error("❌ Cancel false alarm error:", error);
                console.error("❌ Error response:", error.response?.data);
                console.error("❌ Error message:", error.message);
                
                // ⚠️ ONLY reload if API fails - storage was already cleared
                console.log('⚠️ API call failed, reloading SOS status');
                loadSosStatus();
                
                Alert.alert(
                  "Error",
                  error.response?.data?.message || error.message || "Failed to cancel false alarm"
                );
              } finally {
                setCancelAlarmLoading(false);
              }
            }
          }
        ],
        { cancelable: true, onDismiss: () => {
          console.log('📋 Alert dialog dismissed');
          setCancelAlarmLoading(false);
        }}
      );
    } catch (error) {
      console.error("Cancel false alarm error:", error);
      setCancelAlarmLoading(false);
    }
  };

  const handleSOS = async () => {
    setSosLoading(true);
    try {
      // Check if email is available
      if (!userEmail) {
        Alert.alert("Error", "User email not found. Please refresh the app.");
        setSosLoading(false);
        return;
      }

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Location permission is required for SOS.");
        setSosLoading(false);
        return;
      }

      // Force high accuracy for SOS with timeout
      console.log("Getting high-accuracy location for SOS...");
      
      let location;
      try {
        location = await Location.getCurrentPositionAsync({ 
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 0
        });
      } catch (locationError: any) {
        console.log("High accuracy failed, trying balanced accuracy...");
        // Fallback to balanced accuracy if high accuracy fails
        try {
          location = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced
          });
        } catch (fallbackError) {
          console.log("Balanced accuracy failed, trying last known location...");
          // Final fallback to last known location
          location = await Location.getLastKnownPositionAsync();
          
          if (!location) {
            throw new Error("Unable to get location. Please check your GPS settings.");
          }
        }
      }
      
      console.log("SOS Location:", location.coords);

      const sosData = {
        userEmail: userEmail,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        }
      };

      console.log("Sending SOS with data:", sosData);
      
      const response = await api.post('/sos/trigger', sosData);

        console.log("SOS Response:", response.status, response.data);

        // Check if SMS was also sent
        const emailsSent = response.data.emailsSent || 0;
        const smsSent = response.data.smsSent || 0;
        const totalNotifications = emailsSent + smsSent;

        if (response.status === 200) {
          // Play SOS notification sound
          try {
            const { sound } = await Audio.Sound.createAsync(
              require('../../assets/voice/morse-sos.mp3'),
              { shouldPlay: true, volume: 1.0 }
            );
            // Unload sound after playing to free resources
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) {
                sound.unloadAsync();
              }
            });
          } catch (soundError) {
            console.warn('Failed to play SOS sound:', soundError);
          }

          // Alert message mentioning both email and SMS
          const notificationMessage = totalNotifications > 0
            ? `Guardians notified: ${emailsSent} via email${smsSent > 0 ? ` and ${smsSent} via SMS` : ''}!`
            : 'Guardians have been notified with your location!';

          Alert.alert("🚨 SOS SENT", notificationMessage);
          
          // ✅ Store SOS trigger timestamp in ISO format for consistency
          const sosIsoTime = new Date().toISOString();
          setLastSosTime(sosIsoTime);
          await AsyncStorage.setItem('lastSosTime', sosIsoTime);
          console.log('💾 Stored lastSosTime in AsyncStorage:', sosIsoTime);
          
          // ✅ Format for display
          const sosDisplayTime = new Date().toLocaleString([], { 
            day: 'numeric', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
          setLastSosTimeDisplay(sosDisplayTime);
          
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastUpdated(now);
        
        // Auto-enable tracking if not already on
        if (!isTracking) {
          console.log("Auto-enabling tracking after SOS...");
          toggleTracking();
        }
      }
    } catch (error: any) {
      console.error("SOS Error:", error.message, error.response?.data);
      const errorMsg = error.response?.data?.message || error.message || "SOS Failed to send";
      Alert.alert("❌ SOS Error", errorMsg);
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.dashboardLabel}>SafeNet Dashboard</Text>
          <Text style={styles.welcomeText}>Welcome, {userName}</Text>
        </View>

        {/* SOS Card */}
        <LinearGradient colors={['#6A5ACD', '#4B3F8C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sosCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>SOS</Text>
            <Text style={styles.sosSubtitle}>Tap in case of Emergency</Text>
            <View style={styles.sosTimeContainer}>
              <Ionicons name="time-outline" size={12} color="#E0E0E0" />
              <Text style={styles.miniTime}>
                {lastSosTimeDisplay ? `SOS Tapped: ${lastSosTimeDisplay}` : "Not triggered yet"}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.sosButton} activeOpacity={0.8} onPress={handleSOS}>
            <Text style={styles.sosButtonText}>{sosLoading ? "..." : "Tap"}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Live Location Card - UPDATED WITH SWITCH */}
        <View style={styles.locationCard}>
          <View style={{ flex: 1 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={[styles.statusDot, { backgroundColor: isTracking ? '#00C851' : '#FF4B4B' }]} />
                <Text style={styles.cardTitle}>Live Location: {isTracking ? "ON" : "OFF"}</Text>
            </View>
            
            <Text style={styles.cardDesc}>
              {isTracking 
                ? "Background tracking active." 
                : "Enable to share real-time movements."}
            </Text>
            
            <Text style={styles.updateText}>Last sync: {lastUpdated}</Text>

            {/* Toggle Switch */}
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 5}}>
                <Switch 
                    value={isTracking}
                    onValueChange={toggleTracking}
                    trackColor={{ false: "#E0E0E0", true: "#D1C4E9" }}
                    thumbColor={isTracking ? "#6A5ACD" : "#f4f3f4"}
                />
                <Text style={styles.switchLabel}>{isTracking ? "Disable" : "Enable"}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.locationIconContainer} onPress={() => router.push('/dashboard/location')}>
            <Ionicons name={isTracking ? "navigate-circle" : "navigate-circle-outline"} size={80} color="#7B61FF" />
          </TouchableOpacity>
        </View>

        {/* Quick Safety Actions */}
        <Text style={styles.sectionTitle}>Quick Safety Actions</Text>

        {/* Zone Safety Overview */}
        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Zone Safety</Text>
            <Text style={styles.actionDesc}>Check crime risk levels in your area</Text>
            <TouchableOpacity 
              style={styles.smallButton}
              onPress={() => router.push('/dashboard/zone-activity')}
            >
              <Text style={styles.smallButtonText}>View Zones</Text>
              <Ionicons name="location" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#D1C4E9', '#9575CD']} style={styles.actionImageContainer}>
             <Ionicons name="shield-checkmark" size={50} color="#4A148C" />
          </LinearGradient>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Start Journey</Text>
            <Text style={styles.actionDesc}>Alert guardians if you don't reach your destination</Text>
            <TouchableOpacity style={styles.smallButton} onPress={() => router.push('/dashboard/start-journey')}>
              <Text style={styles.smallButtonText}>Start</Text>
              <Ionicons name="arrow-forward" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#E0BBE4', '#957DAD']} style={styles.actionImageContainer}>
             <FontAwesome5 name="walking" size={40} color="#4B3F8C" />
          </LinearGradient>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Fake Call</Text>
            <Text style={styles.actionDesc}>Simulate an incoming call with vibration</Text>
            
            {/* UPDATED FAKE CALL LINK HERE */}
            <TouchableOpacity 
              style={styles.smallButton} 
              onPress={() => router.push('/dashboard/fake-call')}
            >
              <Text style={styles.smallButtonText}>Start</Text>
              <Ionicons name="call-outline" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

          </View>
          <LinearGradient colors={['#42275a', '#734b6d']} style={styles.actionImageContainer}>
             <Ionicons name="call" size={40} color="#FFF" />
          </LinearGradient>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Nearby Safe Places</Text>
            <Text style={styles.actionDesc}>Find help near you</Text>
            <TouchableOpacity style={styles.smallButton} onPress={() => router.push('/dashboard/location')}>
              <Text style={styles.smallButtonText}>Find</Text>
              <Ionicons name="location-outline" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#9D80CB', '#6A5ACD']} style={styles.actionImageContainer}>
             <MaterialIcons name="local-police" size={40} color="#FFF" />
          </LinearGradient>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.actionTitle}>Activity Monitoring</Text>
            <Text style={styles.actionDesc}>AI detects falls, sudden stops, and running</Text>
            <TouchableOpacity style={styles.smallButton} onPress={() => router.push('/dashboard/monitor')}>
              <Text style={styles.smallButtonText}>View</Text>
              <Ionicons name="analytics-outline" size={14} color="#1A1B4B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={['#FF6B6B', '#EE5A6F']} style={styles.actionImageContainer}>
             <Ionicons name="pulse" size={40} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Trusted Guardians */}
        <Text style={styles.sectionTitle}>Trusted Guardians</Text>
        <View style={styles.guardianCard}>
            <Image
              source={require('../../assets/images/guard.png')}
              style={styles.avatar}
            />
            <View style={{flex: 1, marginLeft: 15}}>
                <Text style={styles.guardianTitle}>Add / Manage Guardians</Text>
                <Text style={styles.guardianDesc}>Alerts are sent only to your trusted contacts</Text>
            </View>
            <TouchableOpacity style={styles.manageButton} onPress={() => router.push('/guardians/list')}>
                <Text style={styles.manageButtonText}>Manage</Text>
            </TouchableOpacity>
        </View>

        {/* Cancel False Alarm Button - Below Trusted Guardians */}
        {/* Shows when any alert is triggered: SOS Button, Fall Detection, Sudden Stop, High Risk Area, Quick Settings Tile */}
        {lastSosTime && (
          <TouchableOpacity 
            onPress={handleCancelFalseAlarm}
            disabled={cancelAlarmLoading}
            activeOpacity={0.85}
            style={styles.cancelAlarmContainer}
          >
            <LinearGradient
              colors={cancelAlarmLoading ? ['#B0A4D8', '#9B8FCB'] : ['#C18FFF', '#6A5ACD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cancelAlarmButton}
            >
              <Ionicons name="checkmark-circle" size={22} color="#FFF" />
              <Text style={styles.cancelAlarmButtonText}>
                {cancelAlarmLoading ? "Notifying Guardians..." : "I'm Safe - Cancel Alert"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        <View style={{height: 20}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  headerContainer: { marginBottom: 25 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dashboardLabel: { fontSize: 14, fontWeight: '600', color: '#6A5ACD', letterSpacing: 0.5, textTransform: 'uppercase' },
  logoutButton: { padding: 5 },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#1A1B4B' },
  
  sosCard: { height: 160, borderRadius: 20, padding: 25, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'flex-end', marginBottom: 25, shadowColor: '#6A5ACD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5 },
  sosTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  sosSubtitle: { fontSize: 14, color: '#E0E0E0', marginTop: 5 },
  sosTimeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  miniTime: { fontSize: 11, color: '#E0E0E0', marginTop: 0, marginLeft: 6, fontWeight: '500' },
  sosButton: { backgroundColor: '#F0F0F0', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20 },
  sosButtonText: { color: '#1A1B4B', fontWeight: 'bold' },
  
  // Location Card Styles
  locationCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, flexDirection: 'row', marginBottom: 25, elevation: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  cardDesc: { fontSize: 13, color: '#7A7A7A', marginTop: 5, marginBottom: 5, lineHeight: 18 },
  updateText: { fontSize: 12, color: '#6A5ACD', marginBottom: 10, fontWeight: '600' },
  switchLabel: { fontSize: 14, fontWeight: '500', color: '#1A1B4B', marginLeft: 8 },
  locationIconContainer: { justifyContent: 'center', alignItems: 'center', width: 80 },
  
  smallButton: { flexDirection: 'row', backgroundColor: '#F3F0FA', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignItems: 'center', marginTop: 5 },
  smallButtonText: { fontSize: 13, fontWeight: '600', color: '#1A1B4B' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15, marginTop: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  actionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  actionDesc: { fontSize: 13, color: '#7A7A7A', marginVertical: 5 },
  actionImageContainer: { width: 120, height: 80, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  guardianCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 15, elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#DDD' },
  guardianTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1B4B' },
  guardianDesc: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
  manageButton: { backgroundColor: '#F3F0FA', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  manageButtonText: { fontSize: 12, fontWeight: '600', color: '#1A1B4B' },
  
  cancelAlarmContainer: { marginTop: 15, marginBottom: 10, shadowColor: '#6A5ACD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  cancelAlarmButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 15, gap: 10 },
  cancelAlarmButtonText: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },
});