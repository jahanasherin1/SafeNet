import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Get base URL for audio files
const getAudioBaseUrl = () => {
  const LAPTOP_IP = '172.20.10.2';
  const PORT = 5000;
  
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ipAddress = debuggerHost.split(':')[0];
    return `http://${ipAddress}:${PORT}`;
  }
  return `http://${LAPTOP_IP}:${PORT}`;
};

const AUDIO_BASE_URL = getAudioBaseUrl();

export default function ActiveCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const callerName = params.name || 'Mom';
  const hasVibration = params.hasVibration === 'yes';
  const voiceType = params.voiceType || 'mom'; // Get the voice type from params
  const customAudioUri = params.customAudioUri as string; // Get custom audio URI

  // State: 'incoming' (ringing) or 'connected' (talking)
  const [callState, setCallState] = useState<'incoming' | 'connected'>('incoming');
  
  // Realism States
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [keypadVisible, setKeypadVisible] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  
  // Audio Objects
  const [ringtoneSound, setRingtoneSound] = useState<Audio.Sound | null>(null);
  const [voiceSound, setVoiceSound] = useState<Audio.Sound | null>(null);
  
  // Call Timer
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setupAudioMode();
    startRinging();

    return () => {
      cleanupSounds();
    };
  }, []);

  // Timer Logic
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    if (callState === 'connected') {
      timerInterval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [callState]);

  const setupAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // Default to speaker for ringtone
      });
    } catch (e) {
      console.log("Audio setup error", e);
    }
  };

  const cleanupSounds = async () => {
    Vibration.cancel();
    if (ringtoneSound) {
      try {
        await ringtoneSound.stopAsync();
        await ringtoneSound.unloadAsync();
      } catch (e) { /* ignore cleanup errors */ }
    }
    if (voiceSound) {
      try {
        await voiceSound.stopAsync();
        await voiceSound.unloadAsync();
      } catch (e) { /* ignore cleanup errors */ }
    }
  };

  const startRinging = async () => {
    if (hasVibration) {
      // Pattern: Vibrate 1s, Wait 1s, Repeat
      Vibration.vibrate([1000, 1000], true); 
    }

    try {
      const audioSound = new Audio.Sound();
      
      // Add error listener
      audioSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded === false && status.error) {
          console.log("Sound playback error:", status.error);
        }
      });
      
      // Try to load local ringtone file
      try {
        await audioSound.loadAsync(
          require('../../assets/voice/ringtone.mp3'),
          { shouldPlay: false }
        );
        setRingtoneSound(audioSound);
        
        // Set to loop and play
        await audioSound.setIsLoopingAsync(true);
        await audioSound.playAsync();
        
        console.log("Ringtone started successfully");
      } catch (loadError) {
        console.log("Ringtone file not found, continuing with vibration only");
        // Continue without ringtone - vibration will still work
      }
    } catch (error) {
      console.error("Error in startRinging:", error);
      // Continue without ringtone if it fails
    }
  };

  const handleAnswer = async () => {
    // 1. Stop Ringing & Vibration
    Vibration.cancel();
    if (ringtoneSound) {
      try {
        await ringtoneSound.stopAsync();
        await ringtoneSound.unloadAsync();
      } catch(e) {}
      setRingtoneSound(null);
    }

    // 2. Reset Timer
    setSeconds(0);

    // 3. Change UI State
    setCallState('connected');

    // 4. Play Fake Voice in Loop
    try {
      const audioSound = new Audio.Sound();
      
      // Use custom audio if available
      if (customAudioUri && customAudioUri.trim() !== '') {
        console.log('Using custom audio file:', customAudioUri);
        
        // Check if it's a server URL or local file
        let audioUri = customAudioUri;
        if (customAudioUri.startsWith('/uploads/')) {
          // It's a server file, construct full URL
          audioUri = `${AUDIO_BASE_URL}${customAudioUri}`;
          console.log('Full audio URL:', audioUri);
        }
        
        await audioSound.loadAsync({ uri: audioUri });
        
        // Set voice to loop continuously
        await audioSound.setIsLoopingAsync(true);
        setVoiceSound(audioSound);
        
        console.log('Playing custom voice in loop');
        await audioSound.playAsync();
      } else {
        console.log('No custom audio available - fake call will be silent');
        // No audio to play, but call UI will still show
      }
    } catch (error) {
      console.log("Error loading voice", error);
    }
  };

  const handleHangup = async () => {
    setCallState('incoming'); // Reset state for next call
    await cleanupSounds();
    router.replace('/dashboard/home'); 
  };

  const toggleSpeaker = async () => {
    const newMode = !isSpeakerOn;
    setIsSpeakerOn(newMode);
    
    // Attempt to switch output
    try {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: !newMode, // false = speaker
        });
    } catch (e) {
        console.log("Speaker toggle not supported on this device/simulator");
    }
  };

  const toggleKeypad = () => {
    setKeypadVisible(!keypadVisible);
  };

  const addCall = () => {
    // In a real app, this would open a call selection dialog
    console.log("Add call feature - opening call selection");
  };

  const toggleHold = () => {
    setIsOnHold(!isOnHold);
    if (voiceSound) {
      if (!isOnHold) {
        voiceSound.pauseAsync();
      } else {
        voiceSound.playAsync();
      }
    }
  };

  const formatTime = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* --- TOP SECTION: CALLER INFO --- */}
      <View style={styles.topSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={60} color="#FFF" />
        </View>
        <Text style={styles.callerName}>{callerName}</Text>
        
        {callState === 'incoming' ? (
           <Text style={styles.status}>Incoming Audio Call...</Text>
        ) : (
           <Text style={styles.timer}>{formatTime(seconds)}</Text>
        )}
      </View>

      {/* --- MIDDLE SECTION: CONNECTED CONTROLS --- */}
      {callState === 'connected' && (
        <View style={styles.gridContainer}>
          
          {/* Mute Toggle */}
          <TouchableOpacity style={styles.gridItem} onPress={() => setIsMuted(!isMuted)}>
             <Ionicons name={isMuted ? "mic-off" : "mic"} size={32} color={isMuted ? "#FFF" : "#FFF"} style={{opacity: isMuted ? 1 : 1}} />
             <Text style={styles.gridLabel}>Mute</Text>
          </TouchableOpacity>

          {/* Keypad Toggle */}
          <TouchableOpacity style={styles.gridItem} onPress={toggleKeypad}>
             <Ionicons name="keypad" size={32} color="#FFF" style={{opacity: keypadVisible ? 1 : 0.6}} />
             <Text style={[styles.gridLabel, keypadVisible && {fontWeight: 'bold'}]}>Keypad</Text>
          </TouchableOpacity>

          {/* Speaker Toggle */}
          <TouchableOpacity style={styles.gridItem} onPress={toggleSpeaker}>
             <Ionicons name="volume-high" size={32} color={isSpeakerOn ? "#FFF" : "#FFF"} style={{opacity: isSpeakerOn ? 1 : 0.6}} />
             <Text style={[styles.gridLabel, isSpeakerOn && {fontWeight:'bold'}]}>Speaker</Text>
          </TouchableOpacity>

          {/* Add Call */}
          <TouchableOpacity style={styles.gridItem} onPress={addCall}>
             <Ionicons name="add" size={32} color="#FFF" style={{opacity: 0.6}} />
             <Text style={styles.gridLabel}>Add Call</Text>
          </TouchableOpacity>

          {/* Hold Button */}
          <TouchableOpacity style={styles.gridItem} onPress={toggleHold}>
             <Ionicons name={isOnHold ? "pause" : "videocam"} size={32} color={isOnHold ? "#FFF" : "#5F6368"} />
             <Text style={[styles.gridLabel, isOnHold && {color: '#FFF'}]}>{isOnHold ? 'Resume' : 'Hold'}</Text>
          </TouchableOpacity>

          {/* Contacts */}
          <TouchableOpacity style={styles.gridItem} onPress={() => console.log("Opening contacts")}>
             <Ionicons name="person-circle" size={32} color="#FFF" style={{opacity: 0.6}} />
             <Text style={styles.gridLabel}>Contacts</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- BOTTOM SECTION: ACTIONS --- */}
      <View style={styles.bottomSection}>
        
        {callState === 'incoming' ? (
          // INCOMING LAYOUT
          <View style={styles.incomingRow}>
            {/* Decline */}
            <TouchableOpacity style={styles.declineButton} onPress={handleHangup}>
              <Ionicons name="call" size={35} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            
            <View style={{width: 40}} /> 

            {/* Answer */}
            <TouchableOpacity style={styles.answerButton} onPress={handleAnswer}>
              <Ionicons name="call" size={35} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          // CONNECTED LAYOUT
          <TouchableOpacity style={styles.hangupButton} onPress={handleHangup}>
            <Ionicons name="call" size={35} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#202124', justifyContent: 'space-between' },
  
  topSection: { alignItems: 'center', marginTop: 80 },
  avatar: { 
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#5F6368', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 20 
  },
  callerName: { fontSize: 32, color: '#FFF', fontWeight: 'bold', marginBottom: 10 },
  status: { fontSize: 18, color: '#BDC1C6' },
  timer: { fontSize: 20, color: '#FFF', letterSpacing: 1 },

  // Grid
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '80%', alignSelf: 'center', marginTop: 20 },
  gridItem: { width: '33%', alignItems: 'center', marginBottom: 30 },
  gridLabel: { color: '#FFF', marginTop: 8, fontSize: 12 },

  bottomSection: { alignItems: 'center', marginBottom: 60 },
  
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around', width: '80%' },
  
  declineButton: {
    width: 75, height: 75, borderRadius: 40, backgroundColor: '#FF3B30',
    justifyContent: 'center', alignItems: 'center'
  },
  answerButton: {
    width: 75, height: 75, borderRadius: 40, backgroundColor: '#34C759',
    justifyContent: 'center', alignItems: 'center'
  },
  
  hangupButton: {
    width: 75, height: 75, borderRadius: 40, backgroundColor: '#FF3B30',
    justifyContent: 'center', alignItems: 'center'
  }
});