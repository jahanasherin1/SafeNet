import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://safe-net-one.vercel.app/api';
const testEmail = `test_${Date.now()}@test.com`;

// Test 1: Sign up a user
const testSignup = async () => {
  try {
    console.log('🧪 Step 1: Testing signup endpoint...');
    console.log('📋 Creating user:', { email: testEmail, password: 'TestPass123' });

    const response = await axios.post(`${BASE_URL}/auth/signup`, {
      name: 'Test User',
      phone: '1234567890',
      email: testEmail,
      password: 'TestPass123',
      location: { latitude: 40.7128, longitude: -74.0060 }
    }, {
      timeout: 30000
    });

    console.log('✅ Signup successful:', { 
      email: response.data.user.email,
      name: response.data.user.name 
    });
    
    return testEmail;
  } catch (error) {
    console.error('❌ Signup error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

// Test 2: Update profile
const testUpdateProfile = async (email) => {
  try {
    console.log('\n🧪 Step 2: Testing update-profile endpoint...');
    
    const form = new FormData();
    form.append('currentEmail', email);
    form.append('name', 'Updated User Name');
    form.append('phone', '9876543210');

    // Optional: add a test image if it exists
    const testImagePath = path.join(process.cwd(), 'test-image.jpg');
    if (fs.existsSync(testImagePath)) {
      form.append('profileImage', fs.createReadStream(testImagePath));
      console.log('📸 Including test image...');
    }

    console.log('📋 Updating profile for:', email);

    const response = await axios.post(
      `${BASE_URL}/auth/update-profile`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000
      }
    );

    console.log('✅ Profile update successful:', {
      email: response.data.user.email,
      name: response.data.user.name,
      phone: response.data.user.phone
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Update profile error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    throw error;
  }
};

// Run tests
(async () => {
  try {
    const email = await testSignup();
    await testUpdateProfile(email);
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Tests failed');
    process.exit(1);
  }
})();
