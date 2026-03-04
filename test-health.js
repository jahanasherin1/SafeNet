import axios from 'axios';

const testHealth = async () => {
  try {
    console.log('🧪 Testing health endpoint...');
    const response = await axios.get('https://safe-net-one.vercel.app/api/health', {
      timeout: 10000
    });
    console.log('✅ Health check passed:', response.data);
  } catch (error) {
    console.error('❌ Health check failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
};

testHealth();
