#!/usr/bin/env node

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BACKEND_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'test@safenet.com';

async function testImageUpload() {
  console.log('\n🧪 Testing Image Upload to Local Backend\n');
  
  // Read a test image
  const imagePath = path.join(process.cwd(), 'assets', 'images', 'favicon.png');
  
  if (!fs.existsSync(imagePath)) {
    console.error('❌ Test image not found:', imagePath);
    process.exit(1);
  }
  
  console.log('📸 Test image:', imagePath);
  const imageBuffer = fs.readFileSync(imagePath);
  console.log('📦 Image size:', imageBuffer.length, 'bytes');
  
  // Create FormData
  const form = new FormData();
  form.append('profileImage', imageBuffer, 'test-profile.png');
  form.append('currentEmail', TEST_EMAIL);
  form.append('name', 'Test User');
  form.append('phone', '1234567890');
  
  console.log('\n📤 Uploading image to:', `${BACKEND_URL}/auth/update-profile`);
  console.log('Form fields:');
  console.log('  - profileImage: test-profile.png');
  console.log('  - currentEmail:', TEST_EMAIL);
  console.log('  - name: Test User');
  console.log('  - phone: 1234567890');
  
  try {
    const response = await axios.post(
      `${BACKEND_URL}/auth/update-profile`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000
      }
    );
    
    console.log('\n✅ Upload successful!\n');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.user?.profileImage) {
      console.log('\n✨ Profile image URL:', response.data.user.profileImage);
    }
  } catch (error) {
    console.error('\n❌ Upload failed!\n');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    
    process.exit(1);
  }
}

testImageUpload();
