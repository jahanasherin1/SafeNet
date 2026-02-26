import axios from 'axios';

const sendSMS = async (to, message) => {
  console.log(`\n📱 Starting SMS send process to: ${to}`);
  try {
    // Validate TextBee environment variables
    if (!process.env.TEXTBEE_API_KEY || !process.env.TEXTBEE_DEVICE_ID) {
      console.warn('⚠️ TextBee credentials not configured in environment variables');
      console.warn('TEXTBEE_API_KEY:', process.env.TEXTBEE_API_KEY ? 'Set' : 'NOT SET');
      console.warn('TEXTBEE_DEVICE_ID:', process.env.TEXTBEE_DEVICE_ID ? 'Set' : 'NOT SET');
      throw new Error('TextBee credentials not configured');
    }

    console.log(`🔐 TextBee credentials found. Device ID: ${process.env.TEXTBEE_DEVICE_ID}`);

    // Format phone number to E.164 format: +[country code][number]
    // Handle different input formats:
    // +919876543210 → +919876543210 (already formatted)
    // 919876543210  → +919876543210 (add +)
    // 9876543210    → +919876543210 (Indian 10-digit, add +91)
    let formattedPhone = to.trim();
    
    if (formattedPhone.startsWith('+')) {
      // Already has +, check if it has country code
      if (formattedPhone.startsWith('+91')) {
        // Already properly formatted
        console.log(`✅ Phone number already formatted with +91: ${formattedPhone}`);
      } else {
        console.warn(`⚠️ Phone number has + but not +91 country code: ${formattedPhone}`);
      }
    } else if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
      // Has 91 country code but no +
      formattedPhone = `+${formattedPhone}`;
      console.log(`✅ Added + prefix to country code: ${formattedPhone}`);
    } else if (/^\d{10}$/.test(formattedPhone)) {
      // Indian 10-digit number without country code
      formattedPhone = `+91${formattedPhone}`;
      console.log(`✅ 10-digit number converted to +91 format: ${formattedPhone}`);
    } else {
      console.warn(`⚠️ Could not auto-format phone number, using as-is: ${formattedPhone}`);
    }

    // TextBee API endpoint
    const apiUrl = `https://api.textbee.dev/api/v1/gateway/devices/${process.env.TEXTBEE_DEVICE_ID}/send-sms`;

    console.log(`📤 Sending SMS to ${formattedPhone}`);
    const result = await axios.post(apiUrl, {
      recipients: [formattedPhone],
      message: message,
    }, {
      headers: {
        'x-api-key': process.env.TEXTBEE_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log("✅ SMS sent successfully!");
    console.log("   Recipient:", formattedPhone);
    console.log("   Status:", result.data.status);
    console.log("   Response:", result.data);
    return { success: true, data: result.data, status: result.data.status };
  } catch (error) {
    console.error("\n❌ SMS SEND FAILED");
    console.error("Recipient:", to);
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return { success: false, error: error.message };
  }
};

export default sendSMS;
