/**
 * Test voice profile upload
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const testVoiceProfileUpload = async () => {
  try {
    console.log('\n🎤 Testing voice profile upload...\n');

    // Create a test MP3 file (minimal WAV that's valid)
    const testAudioPath = 'test-audio.wav';
    if (!fs.existsSync(testAudioPath)) {
      // Create a minimal WAV file
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46,  // "RIFF"
        0x24, 0x00, 0x00, 0x00,  // File size (36 bytes total)
        0x57, 0x41, 0x56, 0x45,  // "WAVE"
        0x66, 0x6d, 0x74, 0x20,  // "fmt "
        0x10, 0x00, 0x00, 0x00,  // Chunk size
        0x01, 0x00,              // Audio format (PCM)
        0x01, 0x00,              // Channels (mono)
        0x44, 0xac, 0x00, 0x00,  // Sample rate (44100 Hz)
        0x88, 0x58, 0x01, 0x00,  // Byte rate
        0x02, 0x00,              // Block align
        0x10, 0x00,              // Bits per sample
        0x64, 0x61, 0x74, 0x61,  // "data"
        0x00, 0x00, 0x00, 0x00   // Data size (0 bytes)
      ]);
      fs.writeFileSync(testAudioPath, wavHeader);
      console.log('📝 Created minimal test audio file');
    }

    const form = new FormData();
    form.append('email', 'debug-test@test.com');
    form.append('name', 'Test Voice Profile');
    form.append('audioFile', fs.createReadStream(testAudioPath), 'test-audio.wav');

    const response = await axios.post(
      'https://safe-net-one.vercel.app/api/voiceProfiles/add',
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000
      }
    );

    console.log('✅ Voice profile upload successful:', response.data);
  } catch (error) {
    console.error('❌ Voice profile upload failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
  }
};

testVoiceProfileUpload();
