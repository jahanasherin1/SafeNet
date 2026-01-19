import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

// Type for saved voice profiles
interface SavedVoice {
  id: string;
  name: string;
  audioUri: string;
  audioName: string;
  dateAdded: string;
}

export default function FakeCallScreen() {
  const router = useRouter();
  const [callerName, setCallerName] = useState('');
  const [vibration, setVibration] = useState(true);
  const [callDelay, setCallDelay] = useState(5); // Default 5 seconds
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [shouldTriggerCall, setShouldTriggerCall] = useState(false);
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  
  // Modal states for adding voice
  const [showNameModal, setShowNameModal] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [pendingAudioAsset, setPendingAudioAsset] = useState<any>(null);

  // Load saved voices on mount
  useEffect(() => {
    loadSavedVoices();
  }, []);

  const loadSavedVoices = async () => {
    try {
      // First try to get user email
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) {
        console.log('No user found, skipping voice profile load');
        return;
      }

      const user = JSON.parse(userJson);
      const email = user.email;

      // Fetch voice profiles from backend
      const response = await api.get(`/voiceProfiles/${email}`);
      const voices = response.data.voiceProfiles || [];
      
      setSavedVoices(voices);
      
      // Also cache locally for offline access
      await AsyncStorage.setItem('savedVoices', JSON.stringify(voices));
    } catch (error) {
      console.error('Failed to load saved voices from server:', error);
      
      // Fallback to local storage if server fails
      try {
        const voicesJson = await AsyncStorage.getItem('savedVoices');
        if (voicesJson) {
          const voices = JSON.parse(voicesJson);
          setSavedVoices(voices);
        }
      } catch (localError) {
        console.error('Failed to load from local storage:', localError);
      }
    }
  };

  const addNewVoice = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Store asset and show modal for Android compatibility
        setPendingAudioAsset(asset);
        setNewVoiceName('');
        setShowNameModal(true);
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('Error', 'Failed to select audio file');
    }
  };

  const saveVoiceProfile = async () => {
    if (!newVoiceName.trim()) {
      Alert.alert('Error', 'Please enter a name for the voice profile');
      return;
    }

    if (!pendingAudioAsset) {
      Alert.alert('Error', 'No audio file selected');
      return;
    }

    try {
      // Get user email
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) {
        Alert.alert('Error', 'User not found. Please login again.');
        return;
      }

      const user = JSON.parse(userJson);
      const email = user.email;

      // Prepare form data for upload
      const formData = new FormData();
      formData.append('email', email);
      formData.append('name', newVoiceName.trim());
      formData.append('id', Date.now().toString());
      formData.append('dateAdded', new Date().toISOString());

      // Add audio file
      const audioFile: any = {
        uri: pendingAudioAsset.uri,
        type: pendingAudioAsset.mimeType || 'audio/mpeg',
        name: pendingAudioAsset.name || 'audio.mp3',
      };
      formData.append('audioFile', audioFile);

      // Upload to server
      const response = await api.post('/voiceProfiles/add', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reload voice profiles from server
      await loadSavedVoices();
      
      // Close modal and reset
      setShowNameModal(false);
      setNewVoiceName('');
      setPendingAudioAsset(null);
      
      Alert.alert('Success', `Voice profile "${newVoiceName.trim()}" added and synced!`);
    } catch (error: any) {
      console.error('Error saving voice profile:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save voice profile');
    }
  };

  const deleteVoice = async (voiceId: string) => {
    Alert.alert(
      'Delete Voice',
      'Are you sure you want to delete this voice profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get user email
              const userJson = await AsyncStorage.getItem('user');
              if (userJson) {
                const user = JSON.parse(userJson);
                const email = user.email;

                // Delete from server
                await api.delete(`/voiceProfiles/${email}/${voiceId}`);
              }

              // Update local state
              const updatedVoices = savedVoices.filter(v => v.id !== voiceId);
              await AsyncStorage.setItem('savedVoices', JSON.stringify(updatedVoices));
              setSavedVoices(updatedVoices);
              
              if (selectedVoiceId === voiceId) {
                setSelectedVoiceId(null);
              }

              Alert.alert('Success', 'Voice profile deleted');
            } catch (error) {
              console.error('Error deleting voice:', error);
              Alert.alert('Error', 'Failed to delete voice profile');
            }
          },
        },
      ]
    );
  };

  const getSelectedVoice = () => {
    return savedVoices.find(v => v.id === selectedVoiceId);
  };

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
      const selectedVoice = getSelectedVoice();
      
      if (!selectedVoice) {
        Alert.alert('No Voice Selected', 'Please select a voice profile first.');
        setShouldTriggerCall(false);
        return;
      }

      console.log('📱 Starting fake call...');
      setShouldTriggerCall(false);
      
      router.push({
        pathname: '/dashboard/active-call',
        params: { 
          name: callerName || selectedVoice.name,
          hasVibration: vibration ? 'yes' : 'no',
          voiceType: 'custom',
          customAudioUri: selectedVoice.audioUri
        }
      });
    }
  }, [shouldTriggerCall, callerName, vibration, router]);

  const handleStart = useCallback(() => {
    if (savedVoices.length === 0) {
      Alert.alert('No Voice Profiles', 'Please add at least one voice profile first.');
      return;
    }
    
    if (!selectedVoiceId) {
      Alert.alert('No Voice Selected', 'Please select a voice profile to use.');
      return;
    }

    console.log('🔔 Starting fake call countdown with delay:', callDelay);
    setIsCountingDown(true);
    Alert.alert("Timer Started", `Fake call will ring in ${callDelay} seconds.`, [
      { text: "OK", onPress: () => {
        console.log('✅ Alert dismissed, countdown continues...');
      }}
    ]);
  }, [callDelay, savedVoices.length, selectedVoiceId]);

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
        
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#6A5ACD" />
          <Text style={styles.infoText}>
            Add voice profiles in advance for quick emergency use
          </Text>
        </View>

        {/* Saved Voice Profiles */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Voice Profiles</Text>
            <TouchableOpacity onPress={addNewVoice} style={styles.addButton}>
              <Ionicons name="add-circle" size={24} color="#6A5ACD" />
              <Text style={styles.addButtonText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {savedVoices.length === 0 ? (
            <TouchableOpacity style={styles.emptyState} onPress={addNewVoice}>
              <Ionicons name="mic-outline" size={48} color="#C0C0C0" />
              <Text style={styles.emptyStateTitle}>No Voice Profiles Yet</Text>
              <Text style={styles.emptyStateText}>
                Tap to add your first voice profile for emergency use
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.voiceList}>
              {savedVoices.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceItem,
                    selectedVoiceId === voice.id && styles.voiceItemSelected
                  ]}
                  onPress={() => setSelectedVoiceId(voice.id)}
                >
                  <View style={[
                    styles.voiceAvatar,
                    selectedVoiceId === voice.id && styles.voiceAvatarSelected
                  ]}>
                    <Text style={styles.voiceAvatarText}>
                      {voice.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  
                  <View style={styles.voiceInfo}>
                    <Text style={styles.voiceItemName}>{voice.name}</Text>
                    <Text style={styles.voiceItemFile} numberOfLines={1}>
                      {voice.audioName}
                    </Text>
                  </View>

                  {selectedVoiceId === voice.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#6A5ACD" />
                  )}

                  <TouchableOpacity
                    onPress={() => deleteVoice(voice.id)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4B4B" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Caller Name Override */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            Caller Name (Optional)
          </Text>
          <TextInput 
            style={styles.input}
            value={callerName}
            onChangeText={setCallerName}
            placeholder="Leave empty to use voice profile name"
            placeholderTextColor="#A0A0A0"
          />
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

      {/* Name Input Modal for Android Compatibility */}
      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Name This Voice</Text>
            <Text style={styles.modalSubtitle}>
              Give this voice profile a name (e.g., Mom, Dad, Boss)
            </Text>
            
            <TextInput
              style={styles.modalInput}
              value={newVoiceName}
              onChangeText={setNewVoiceName}
              placeholder="Enter name..."
              placeholderTextColor="#A0A0A0"
              autoFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNameModal(false);
                  setNewVoiceName('');
                  setPendingAudioAsset(null);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={saveVoiceProfile}
              >
                <Text style={styles.modalButtonTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  scrollContent: { padding: 20 },
  
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0FA',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6A5ACD',
    fontWeight: '500',
  },

  section: { marginBottom: 25 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A5ACD',
  },

  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E6F0',
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1B4B',
    marginTop: 15,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#7A7A7A',
    marginTop: 5,
    textAlign: 'center',
  },

  voiceList: { gap: 12 },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8E6F0',
    gap: 12,
  },
  voiceItemSelected: {
    borderColor: '#6A5ACD',
    backgroundColor: '#F8F6FF',
  },
  voiceAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F0FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceAvatarSelected: {
    backgroundColor: '#E8DFF5',
  },
  voiceAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6A5ACD',
  },
  voiceInfo: { flex: 1 },
  voiceItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1B4B',
    marginBottom: 4,
  },
  voiceItemFile: {
    fontSize: 12,
    color: '#7A7A7A',
  },
  deleteBtn: {
    padding: 8,
  },
  
  inputContainer: { backgroundColor: '#F3F0FA', borderRadius: 12, padding: 15, marginBottom: 20 },
  inputLabel: { color: '#6A5ACD', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: { fontSize: 16, color: '#1A1B4B', fontWeight: '500' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  label: { fontSize: 16, color: '#1A1B4B', fontWeight: '500' },
  
  timerControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, padding: 5 },
  timerBtn: { width: 30, height: 30, backgroundColor: '#E8E6F0', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  timerBtnText: { fontSize: 18, fontWeight: 'bold', color: '#6A5ACD' },
  timerValue: { marginHorizontal: 15, fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1B4B',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7A7A7A',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F3F0FA',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#1A1B4B',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E8E6F0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F0FA',
  },
  modalButtonSave: {
    backgroundColor: '#6A5ACD',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1B4B',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});