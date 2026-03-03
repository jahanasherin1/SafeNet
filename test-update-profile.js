import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Test updating profile with actual form data
const testUpdateProfile = async () => {
  try {
    const form = new FormData();
    form.append('currentEmail', 'test@test.com');
    form.append('name', 'Test User');
    form.append('phone', '1234567890');

    // Optional: add a test image if it exists
    const testImagePath = path.join(process.cwd(), 'test-image.jpg');
    if (fs.existsSync(testImagePath)) {
      form.append('profileImage', fs.createReadStream(testImagePath));
    }

    console.log('🧪 Testing update-profile endpoint...');
    console.log('Form fields:', {
      currentEmail: 'test@test.com',
      name: 'Test User',
      phone: '1234567890',
      hasImage: fs.existsSync(testImagePath)
    });

    const response = await axios.post(
      'https://safe-net-one.vercel.app/api/auth/update-profile',
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000
      }
    );

    console.log('✅ Response:', response.data);
  } catch (error) {
    console.error('❌ Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
  }
};

testUpdateProfile();
