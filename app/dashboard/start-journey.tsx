import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function StartJourneyScreen() {
  const router = useRouter();
  const [dest, setDest] = useState('');
  
  // --- DATE & TIME STATE ---
  const [expectedTime, setExpectedTime] = useState(new Date(Date.now() + 30 * 60000)); // Default +30 mins
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | 'datetime'>('date');

  const [loading, setLoading] = useState(true);
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [activeJourneyData, setActiveJourneyData] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) return;
      const { email } = JSON.parse(userData);
      const res = await api.post('/journey/status', { userEmail: email });
      if (res.data?.journey?.isActive) {
        setIsJourneyActive(true);
        setActiveJourneyData(res.data.journey);
      }
    } catch (e) {
      console.log("Status check error");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC TO HANDLE DATE THEN TIME SELECTION ---
  const showDateTimePicker = () => {
    if (Platform.OS === 'ios') {
        setPickerMode('datetime'); // iOS can pick both at once
    } else {
        setPickerMode('date'); // Android needs Date first
    }
    setShowPicker(true);
  };

  const onDateTimeChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
        setShowPicker(false);
        return;
    }

    const currentDate = selectedDate || expectedTime;
    
    // Validate selected time in real-time
    const selectedTime = currentDate.getTime();
    const now = Date.now();

    if (Platform.OS === 'android') {
        setShowPicker(false); // Close first picker
        
        if (pickerMode === 'date') {
            // If we just picked a DATE, save it and open TIME picker
            const newDate = new Date(currentDate); // Create copy
            setExpectedTime(newDate); // Update state
            setPickerMode('time'); // Switch mode
            setTimeout(() => setShowPicker(true), 100); // Open Time picker
        } else {
            // If we just picked a TIME, combine it with the date
            const finalDate = new Date(expectedTime);
            finalDate.setHours(currentDate.getHours());
            finalDate.setMinutes(currentDate.getMinutes());
            
            // Validate the final combined time
            if (finalDate.getTime() < now - 2 * 60000) {
              Alert.alert("Invalid Time", "Selected time is in the past. Please choose a future time.");
              setExpectedTime(new Date(now + 30 * 60000)); // Reset to 30 mins from now
            } else if (finalDate.getTime() < now + 5 * 60000) {
              Alert.alert("Time Too Soon", "Please select a time at least 5 minutes from now.");
              setExpectedTime(new Date(now + 30 * 60000)); // Reset to 30 mins from now
            } else if (finalDate.getTime() > now + 24 * 60 * 60000) {
              Alert.alert("Time Too Far", "Expected arrival cannot be more than 24 hours from now.");
              setExpectedTime(new Date(now + 30 * 60000)); // Reset to 30 mins from now
            } else {
              setExpectedTime(finalDate);
            }
            // Don't reopen, we are done
        }
    } else {
        // iOS Logic with validation
        if (selectedTime < now - 2 * 60000) {
          Alert.alert("Invalid Time", "Selected time is in the past. Please choose a future time.");
          setExpectedTime(new Date(now + 30 * 60000)); // Reset to 30 mins from now
        } else if (selectedTime < now + 5 * 60000) {
          Alert.alert("Time Too Soon", "Please select a time at least 5 minutes from now.");
          setExpectedTime(new Date(now + 30 * 60000)); // Reset to 30 mins from now
        } else if (selectedTime > now + 24 * 60 * 60000) {
          Alert.alert("Time Too Far", "Expected arrival cannot be more than 24 hours from now.");
          setExpectedTime(new Date(now + 30 * 60000)); // Reset to 30 mins from now
        } else {
          setExpectedTime(currentDate);
        }
        setShowPicker(false);
    }
  };

  const handleStart = async () => {
    if (!dest) return Alert.alert("Error", "Please enter destination.");
    
    // Comprehensive time validation
    const now = Date.now();
    const selectedTime = expectedTime.getTime();
    
    // Check if time is in the past (with 2 minute buffer)
    if (selectedTime < now - 2 * 60000) {
      return Alert.alert("Invalid Time", "Expected arrival time cannot be in the past. Please select a future time.");
    }
    
    // Check if time is too close (less than 5 minutes from now)
    if (selectedTime < now + 5 * 60000) {
      return Alert.alert("Time Too Soon", "Expected arrival time must be at least 5 minutes from now for proper monitoring.");
    }
    
    // Check if time is too far in the future (more than 24 hours)
    if (selectedTime > now + 24 * 60 * 60000) {
      return Alert.alert("Time Too Far", "Expected arrival time cannot be more than 24 hours from now.");
    }
    
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      const { email } = JSON.parse(userData!);

      const res = await api.post('/journey/start', { 
        email, 
        destination: dest, 
        eta: expectedTime.toISOString() 
      });

      if (res.status === 200) {
        setIsJourneyActive(true);
        setActiveJourneyData(res.data.journey);
        Alert.alert("Journey Started", "Guardians are now monitoring you.");
      }
    } catch (e) { 
      Alert.alert("Error", "Failed to start journey"); 
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      const { email } = JSON.parse(userData!);
      const res = await api.post('/journey/end', { email });
      if (res.status === 200) {
        setIsJourneyActive(false);
        setDest('');
        setExpectedTime(new Date(Date.now() + 30 * 60000));
        Alert.alert("Journey Ended", "You have reached safely.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to end journey");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleString([], { 
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#6A5ACD" /></View>;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
      </TouchableOpacity>
      
      <Text style={styles.title}>{isJourneyActive ? "Live Journey" : "Start Journey"}</Text>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {isJourneyActive ? (
            <View style={styles.activeContainer}>
            <View style={styles.monitoringCard}>
                <Ionicons name="navigate-circle" size={50} color="#6A5ACD" />
                
                <Text style={styles.activeLabel}>Destination</Text>
                <Text style={styles.activeValue}>{activeJourneyData?.destination}</Text>
                
                <View style={styles.divider} />
                
                <Text style={styles.activeLabel}>Start Time</Text>
                <Text style={styles.activeValue}>
                    {activeJourneyData?.startTime ? formatDate(activeJourneyData.startTime) : 'N/A'}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.activeLabel}>Expected Arrival</Text>
                <Text style={[styles.activeValue, { color: '#6A5ACD' }]}>
                    {activeJourneyData?.eta ? formatDate(activeJourneyData.eta) : 'N/A'}
                </Text>
            </View>
            <Text style={styles.monitoringText}>
                Monitoring is active. If you don't end the journey by the expected time, your guardians will be alerted.
            </Text>
            <TouchableOpacity style={styles.endButton} onPress={handleEnd}>
                <Text style={styles.endButtonText}>End Journey - I'm Safe</Text>
            </TouchableOpacity>
            </View>
        ) : (
            <View style={styles.form}>
            <CustomInput 
                placeholder="Enter destination" 
                iconName="location-outline" 
                value={dest} 
                onChangeText={setDest} 
            />

            {/* DATE & TIME SELECTOR BUTTON */}
            <TouchableOpacity 
                style={styles.dateTimeSelector} 
                onPress={showDateTimePicker}
            >
                <Ionicons name="calendar-outline" size={22} color="#6A5ACD" />
                <View style={{marginLeft: 12}}>
                    <Text style={styles.dateLabel}>Select Expected Arrival</Text>
                    <Text style={styles.dateTimeText}>
                        {expectedTime.toLocaleString([], { 
                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                        })}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#CCC" style={{marginLeft: 'auto'}} />
            </TouchableOpacity>

            {/* THE PICKER COMPONENT */}
            {showPicker && (
                <DateTimePicker
                    testID="dateTimePicker"
                    value={expectedTime}
                    mode={pickerMode}
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateTimeChange}
                    minimumDate={new Date(Date.now() - 60000)} // Allow roughly "now"
                />
            )}
            
            <Text style={styles.helper}>Guardians will be alerted if you do not reach on time</Text>
            
            <PrimaryButton title="Start Journey" onPress={handleStart} />

            <View style={styles.statusBox}>
                <Text style={styles.statusTitle}>Journey Status: Ready</Text>
                <Text style={styles.statusSub}>Monitoring Your Journey for Safety</Text>
            </View>
            </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 25, backgroundColor: '#FAF9FF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF9FF' },
    back: { marginTop: 40 },
    title: { fontSize: 26, fontWeight: 'bold', marginVertical: 20, textAlign: 'center', color: '#1A1B4B' },
    form: { flex: 1 },
    dateTimeSelector: {
        backgroundColor: '#F3F0FA',
        height: 70,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E8E6F0'
    },
    dateLabel: { fontSize: 10, color: '#7A7A7A', textTransform: 'uppercase' },
    dateTimeText: { fontSize: 16, color: '#1A1B4B', fontWeight: '500' },
    helper: { textAlign: 'center', color: '#7A7A7A', marginBottom: 20, fontSize: 14 },
    statusBox: { backgroundColor: '#E8E4F3', padding: 30, borderRadius: 20, alignItems: 'center', marginTop: 10 },
    statusTitle: { fontSize: 18, fontWeight: 'bold', color: '#6A5ACD' },
    statusSub: { color: '#6A5ACD', marginTop: 5 },
    activeContainer: { flex: 1 },
    monitoringCard: { 
        backgroundColor: '#FFF', padding: 25, borderRadius: 20, alignItems: 'center',
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 20
    },
    activeLabel: { fontSize: 12, color: '#7A7A7A', marginTop: 15, textTransform: 'uppercase' },
    activeValue: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginTop: 2, textAlign: 'center' },
    divider: { height: 1, backgroundColor: '#EEE', width: '100%', marginVertical: 10 },
    monitoringText: { textAlign: 'center', color: '#6A5ACD', lineHeight: 22, marginBottom: 40, paddingHorizontal: 10 },
    endButton: { 
        backgroundColor: '#FDECEC', paddingVertical: 18, borderRadius: 15, 
        alignItems: 'center', borderWidth: 1, borderColor: '#FF4B4B'
    },
    endButtonText: { color: '#FF4B4B', fontWeight: 'bold', fontSize: 16 }
});