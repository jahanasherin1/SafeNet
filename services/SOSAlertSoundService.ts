import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

/**
 * Service to handle SOS alert sounds for guardians
 * Plays the morse-sos.mp3 alert sound when guardians receive SOS alerts
 */
export class SOSAlertSoundService {
  private static instance: SOSAlertSoundService;
  private soundObject: Audio.Sound | null = null;
  private isPlaying: boolean = false;

  private constructor() {
    this.initializeAudio();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SOSAlertSoundService {
    if (!SOSAlertSoundService.instance) {
      SOSAlertSoundService.instance = new SOSAlertSoundService();
    }
    return SOSAlertSoundService.instance;
  }

  /**
   * Initialize audio mode
   */
  private async initializeAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // Play sound even in silent mode
        staysActiveInBackground: true,
        shouldDuckAndroid: false, // Don't duck other audio
      });
      console.log('✅ Audio mode initialized for SOS alerts');
    } catch (error) {
      console.error('❌ Error initializing audio mode:', error);
    }
  }

  /**
   * Plays the SOS alert sound with vibration
   * @param repetitions - Number of times to repeat the sound (default 1)
   */
  async playSOSAlert(repetitions: number = 1) {
    try {
      if (this.isPlaying) {
        console.log('⚠️ SOS alert sound already playing, ignoring request');
        return;
      }

      this.isPlaying = true;

      // Trigger intense vibration pattern for SOS
      try {
        // Only works on Android
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 SOS ALERT',
            body: 'Emergency alert received',
            sound: 'default',
            badge: 1,
            data: {
              alertType: 'SOS_SOUND_ALERT',
            },
          },
          trigger: null,
        });
        console.log('📳 Vibration triggered for SOS alert');
      } catch (error) {
        console.warn('⚠️ Could not trigger additional vibration:', error);
      }

      // Load and play the SOS sound file
      if (!this.soundObject) {
        console.log('🔊 Loading SOS alert sound...');
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/voice/morse-sos.mp3'),
          {
            shouldPlay: false, // Don't auto-play
            volume: 1.0, // Max volume
            isLooping: false,
          }
        );
        this.soundObject = sound;
        console.log('✅ SOS sound loaded');
      }

      // Play the sound with repetitions
      for (let i = 0; i < repetitions; i++) {
        console.log(`🔊 Playing SOS alert sound (${i + 1}/${repetitions})...`);
        
        // Reset sound position before playing
        await this.soundObject.setPositionAsync(0);
        
        // Play the sound
        await this.soundObject.playAsync();
        
        // Wait for sound to finish
        const status = await this.soundObject.getStatusAsync();
        if (status.isLoaded && status.durationMillis !== undefined) {
          // Add a small delay between repetitions
          if (i < repetitions - 1) {
            const duration = status.durationMillis || 3000; // Default 3s if duration unknown
            await new Promise(resolve => setTimeout(resolve, duration + 500));
          }
        }
      }

      console.log('✅ SOS alert sound playback completed');
    } catch (error) {
      console.error('❌ Error playing SOS alert sound:', error);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Stop the currently playing sound
   */
  async stopAlert() {
    try {
      if (this.soundObject && this.isPlaying) {
        console.log('⏹️ Stopping SOS alert sound...');
        await this.soundObject.stopAsync();
        this.isPlaying = false;
        console.log('✅ SOS alert stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping SOS alert:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.soundObject) {
        console.log('🧹 Cleaning up SOS sound service...');
        await this.soundObject.unloadAsync();
        this.soundObject = null;
        this.isPlaying = false;
        console.log('✅ SOS sound service cleaned up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up sound service:', error);
    }
  }

  /**
   * Check if sound is currently playing
   */
  isAlertPlaying(): boolean {
    return this.isPlaying;
  }
}

export default SOSAlertSoundService;
