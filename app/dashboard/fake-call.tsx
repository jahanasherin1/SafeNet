import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/PrimaryButton';

// Voice profiles with different callers and their voice files
const VOICE_PROFILES = [
  { id: 'mom', name: 'Mom', icon: 'M', voiceFile: require('../../assets/voice/voice.mp3') },
  { id: 'dad', name: 'Dad', icon: 'D', voiceFile: require('../../assets/voice/voice.mp3') },
  { id: 'police', name: 'Police', icon: 'P', voiceFile: require('../../assets/voice/voice.mp3') },
  { id: 'friend', name: 'Friend', icon: 'F', voiceFile: require('../../assets/voice/voice.mp3') },
];

export default function FakeCallScreen() {
  const router = useRouter();
  const [selectedVoice, setSelectedVoice] = useState('mom'); // Default to Mom
  const [customName, setCustomName] = useState('');
  const [vibration, setVibration] = useState(true);
  const [callDelay, setCallDelay] = useState(5); // Default 5 seconds
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [shouldTriggerCall, setShouldTriggerCall] = useState(false);

  // Get the caller name from selected voice or custom input
  const getCallerName = () => {
    if (customName.trim()) return customName;
    const profile = VOICE_PROFILES.find(v => v.id === selectedVoice);
    return profile?.name || 'Unknown';
  };

  // Handle countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isCountingDown && callDelay > 0) {
      interval = setInterval(() => {
        setCallDelay((prev) => prev - 1);
      }, 1000);
    } else if (isCountingDown && callDelay === 0) {
      setShouldTriggerCall(true);
      setIsCountingDown(false);
    }

    return () => clearInterval(interval);
  }, [isCountingDown, callDelay]);

  // Handle navigation when call should trigger
  useEffect(() => {
    if (shouldTriggerCall) {
      setShouldTriggerCall(false);
      router.push({
        pathname: '/dashboard/active-call',
        params: { 
          name: getCallerName(),
          hasVibration: vibration ? 'yes' : 'no',
          voiceType: selectedVoice
        }
      });
    }
  }, [shouldTriggerCall, selectedVoice, customName, vibration, router]);

  const handleStart = () => {
    setIsCountingDown(true);
    Alert.alert("Timer Started", `Fake call will ring in ${callDelay} seconds.`, [
      { text: "OK", onPress: () => router.back() }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fake Call</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Caller Name Input */}
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Caller Name</Text>
            <TextInput 
                style={styles.input}
                value={customName}
                onChangeText={setCustomName}
                placeholder="Leave empty to use voice profile"
            />
        </View>

        {/* Voice Selection - Horizontal Scroll */}
        <View style={styles.voiceContainer}>
            <Text style={styles.sectionLabel}>Select Voice Profile</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              contentContainerStyle={styles.voiceScrollContent}
            >
              {VOICE_PROFILES.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceCard,
                    selectedVoice === voice.id && styles.voiceCardActive
                  ]}
                  onPress={() => setSelectedVoice(voice.id)}
                >
                  <View style={[
                    styles.voiceIconContainer,
                    selectedVoice === voice.id && styles.voiceIconContainerActive
                  ]}>
                    <Text style={styles.voiceIcon}>{voice.icon}</Text>
                  </View>
                  <Text style={[
                    styles.voiceName,
                    selectedVoice === voice.id && styles.voiceNameActive
                  ]}>
                    {voice.name}
                  </Text>
                  {selectedVoice === voice.id && (
                    <View style={styles.activeBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
        </View>

        {/* Vibration Toggle */}
        <View style={styles.row}>
            <Text style={styles.label}>Vibration</Text>
            <Switch 
                value={vibration}
                onValueChange={setVibration}
                trackColor={{ false: "#E0E0E0", true: "#6A5ACD" }}
                thumbColor={"#FFF"}
            />
        </View>

        {/* Call Delay Selection */}
        <View style={styles.row}>
            <Text style={styles.label}>Call Delay (Seconds)</Text>
            <View style={styles.timerControls}>
                <TouchableOpacity onPress={() => setCallDelay(Math.max(5, callDelay - 5))} style={styles.timerBtn}>
                    <Text style={styles.timerBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.timerValue}>{callDelay}s</Text>
                <TouchableOpacity onPress={() => setCallDelay(callDelay + 5)} style={styles.timerBtn}>
                    <Text style={styles.timerBtnText}>+</Text>
                </TouchableOpacity>
            </View>
        </View>

        <View style={{ marginTop: 40 }}>
            <PrimaryButton title="Schedule Fake Call" onPress={handleStart} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  scrollContent: { padding: 20 },
  
  inputContainer: { backgroundColor: '#F3F0FA', borderRadius: 12, padding: 15, marginBottom: 20 },
  inputLabel: { color: '#6A5ACD', fontSize: 12, fontWeight: '600', marginBottom: 5 },
  input: { fontSize: 16, color: '#1A1B4B', fontWeight: '500' },

  voiceContainer: { marginBottom: 25 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1B4B', marginBottom: 12 },
  
  voiceScrollContent: { paddingHorizontal: 0, gap: 10 },
  voiceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#E8E6F0',
    elevation: 1,
  },
  voiceCardActive: {
    borderColor: '#6A5ACD',
    backgroundColor: '#F3F0FA',
    elevation: 3,
  },
  voiceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  voiceIconContainerActive: {
    backgroundColor: '#E8DFF5',
  },
  voiceIcon: { fontSize: 20, fontWeight: '700', color: '#6A5ACD' },
  voiceName: { fontSize: 13, fontWeight: '500', color: '#1A1B4B', textAlign: 'center' },
  voiceNameActive: { color: '#6A5ACD', fontWeight: '600' },
  activeBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6A5ACD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  label: { fontSize: 16, color: '#1A1B4B', fontWeight: '500' },
  
  timerControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, padding: 5 },
  timerBtn: { width: 30, height: 30, backgroundColor: '#E8E6F0', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  timerBtnText: { fontSize: 18, fontWeight: 'bold', color: '#6A5ACD' },
  timerValue: { marginHorizontal: 15, fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
});