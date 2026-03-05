import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const testSMS = async () => {
  console.log('\n=== SMS DIRECT API TEST ===\n');
  
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;
  
  console.log('📋 Configuration Check:');
  console.log(`API Key: ${apiKey ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`Device ID: ${deviceId ? '✅ SET' : '❌ NOT SET'}`);
  
  if (!apiKey || !deviceId) {
    console.error('\n❌ Missing TextBee credentials!');
    process.exit(1);
  }
  
  // Test with a sample phone number (replace with actual guardian number)
  const testPhone = '+919876543210'; // Example Indian phone number
  const testMessage = 'SafeNet Test SMS: This is a test message to verify SMS sending is working.';
  
  const apiUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
  
  try {
    console.log('\n📤 Sending test SMS...');
    console.log(`   To: ${testPhone}`);
    console.log(`   Message: "${testMessage}"`);
    console.log(`   API URL: ${apiUrl}`);
    
    const response = await axios.post(apiUrl, {
      recipients: [testPhone],
      message: testMessage,
    }, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    console.log('\n✅ SUCCESS! SMS API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('\n❌ FAILED! Error Details:');
    console.error('Error Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Request made but no response received');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error);
    }
  }
};

testSMS();
