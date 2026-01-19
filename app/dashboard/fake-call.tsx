import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as DocumentPicker from 'expo-document-picker'; // Temporarily disabled - rebuild app to enable
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [customAudioUri, setCustomAudioUri] = useState<string | null>(null);
  const [customAudioName, setCustomAudioName] = useState<string>('');

  // Load custom audio on mount
  useEffect(() => {
    loadCustomAudio();
  }, []);

  const loadCustomAudio = async () => {
    try {
      const uri = await AsyncStorage.getItem('customVoiceUri');
      const name = await AsyncStorage.getItem('customVoiceName');
      if (uri) setCustomAudioUri(uri);
      if (name) setCustomAudioName(name);
    } catch (error) {
      console.error('Failed to load custom audio:', error);
    }
  };

  const pickAudioFile = async () => {
    // Temporarily disabled - need to rebuild app with expo-document-picker
    Alert.alert(
      'Feature Unavailable',
      'Custom audio file selection requires rebuilding the app.\n\nRun: npm run android\n\nFor now, use the default voice profiles.'
    );
    /* 
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await AsyncStorage.setItem('customVoiceUri', asset.uri);
        await AsyncStorage.setItem('customVoiceName', asset.name);
        setCustomAudioUri(asset.uri);
        setCustomAudioName(asset.name);
        Alert.alert('Success', 'Custom voice file selected successfully!');
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('Error', 'Failed to select audio file');
    }
    */
  };

  const removeCustomAudio = async () => {
    try {
      await AsyncStorage.removeItem('customVoiceUri');
      await AsyncStorage.removeItem('customVoiceName');
      setCustomAudioUri(null);
      setCustomAudioName('');
      Alert.alert('Removed', 'Custom voice file removed');
    } catch (error) {
      console.error('Error removing custom audio:', error);
    }
  };

  // Memoize the caller name to avoid recalculation
  const callerName = useMemo(() => {
    if (customName.trim()) return customName;
    const profile = VOICE_PROFILES.find(v => v.id === selectedVoice);
    return profile?.name || 'Unknown';
  }, [customName, selectedVoice]);

  // Handle countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isCountingDown && callDelay > 0) {
      console.log('⏱️ Countdown active - remaining:', callDelay);
      interval = setInterval(() => {
        setCallDelay((prev) => {
          console.log('⏳ Countdown tick:', prev - 1);
          return prev - 1;
        });
      }, 1000);
    } else if (isCountingDown && callDelay === 0) {
      console.log('🎯 Countdown complete! Triggering call...');
      setShouldTriggerCall(true);
      setIsCountingDown(false);
      setCallDelay(5);
    }

    return () => clearInterval(interval);
  }, [isCountingDown, callDelay]);

  // Handle navigation when call should trigger
  useEffect(() => {
    if (shouldTriggerCall) {
      console.log('📱 Should trigger call is TRUE, navigating to active-call...');
      setShouldTriggerCall(false);
      console.log('📞 Caller Name:', callerName, 'Voice:', selectedVoice, 'Vibration:', vibration);
      router.push({
        pathname: '/dashboard/active-call',
        params: { 
          name: callerName,
          hasVibration: vibration ? 'yes' : 'no',
          voiceType: selectedVoice,
          customAudioUri: customAudioUri || ''
        }
      });
    }
  }, [shouldTriggerCall, callerName, selectedVoice, vibration, router]);

  const handleStart = useCallback(() => {
    console.log('🔔 Starting fake call countdown with delay:', callDelay);
    setIsCountingDown(true);
    Alert.alert("Timer Started", `Fake call will ring in ${callDelay} seconds.`, [
      { text: "OK", onPress: () => {
        console.log('✅ Alert dismissed, countdown continues...');
        // Alert just closes, countdown continues in background
      }}
    ]);
  }, [callDelay]);

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

        {/* Custom Audio File Selection */}
        <View style={styles.customAudioContainer}>
          <Text style={styles.sectionLabel}>Custom Voice Audio</Text>
          {customAudioUri ? (
            <View style={styles.customAudioCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customAudioName} numberOfLines={1}>
                  {customAudioName || 'Custom Audio'}
                </Text>
                <Text style={styles.customAudioSubtext}>Tap to change or remove</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={pickAudioFile} style={styles.audioActionBtn}>
                  <Ionicons name="refresh" size={20} color="#6A5ACD" />
                </TouchableOpacity>
                <TouchableOpacity onPress={removeCustomAudio} style={styles.audioActionBtn}>
                  <Ionicons name="trash-outline" size={20} color="#FF4B4B" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickAudioButton} onPress={pickAudioFile}>
              <Ionicons name="musical-notes" size={24} color="#6A5ACD" />
              <Text style={styles.pickAudioText}>Select Audio File</Text>
              <Text style={styles.pickAudioSubtext}>Choose from your files</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Voice Selection - Horizontal Scroll */}
        <View style={styles.voiceContainer}>
            <Text style={styles.sectionLabel}>Default Voice Profiles</Text>
            <Text style={styles.sectionSubtext}>Used only if no custom audio is selected</Text>
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
                <TouchableOpacity onPress={() => setCallDelay(Math.max(5, callDelay - 5))} style={styles.timerBtn} disabled={isCountingDown}>
                    <Text style={styles.timerBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.timerValue}>{callDelay}s</Text>
                <TouchableOpacity onPress={() => setCallDelay(callDelay + 5)} style={styles.timerBtn} disabled={isCountingDown}>
                    <Text style={styles.timerBtnText}>+</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Countdown Display */}
        {isCountingDown && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Calling in</Text>
            <Text style={styles.countdownValue}>{callDelay}s</Text>
            <Text style={styles.countdownStatus}>Keep this screen open</Text>
          </View>
        )}

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

  customAudioContainer: { marginBottom: 25 },
  customAudioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6A5ACD',
    elevation: 2,
  },
  customAudioName: { fontSize: 15, fontWeight: '600', color: '#1A1B4B', marginBottom: 4 },
  customAudioSubtext: { fontSize: 12, color: '#7A7A7A' },
  audioActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F0FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickAudioButton: {
    backgroundColor: '#F3F0FA',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E6F0',
    borderStyle: 'dashed',
  },
  pickAudioText: { fontSize: 16, fontWeight: '600', color: '#6A5ACD', marginTop: 8 },
  pickAudioSubtext: { fontSize: 13, color: '#7A7A7A', marginTop: 4 },

  voiceContainer: { marginBottom: 25 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1B4B', marginBottom: 12 },
  sectionSubtext: { fontSize: 13, color: '#7A7A7A', marginBottom: 10 },
  
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
  
  // Countdown display styles
  countdownContainer: {
    backgroundColor: '#6A5ACD',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 10,
  },
  countdownValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 10,
  },
  countdownStatus: {
    fontSize: 14,
    color: '#F0F0F0',
    fontWeight: '500',
    textAlign: 'center',
  },
});