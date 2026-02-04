// backend/test-crime-zone.js
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/crime-zone';

async function testCrimeZoneAPI() {
  console.log('🧪 Testing Crime Zone API...\n');

  try {
    // Test 1: Get all city risks
    console.log('1️⃣ Testing GET /city-risks');
    const cityRisksResponse = await axios.get(`${API_URL}/city-risks`);
    console.log('✅ Success!');
    console.log(`   - Total cities: ${cityRisksResponse.data.totalCities}`);
    console.log(`   - Top 3 high-risk cities:`);
    cityRisksResponse.data.cities.slice(0, 3).forEach((city, i) => {
      console.log(`     ${i + 1}. ${city.city} - ${city.risk.level} (${city.recentCrimes} recent crimes)`);
    });
    console.log('');

    // Test 2: Get available cities
    console.log('2️⃣ Testing GET /cities');
    const citiesResponse = await axios.get(`${API_URL}/cities`);
    console.log('✅ Success!');
    console.log(`   - Available cities: ${citiesResponse.data.cities.slice(0, 5).join(', ')}...`);
    console.log('');

    // Test 3: Get specific city details
    const testCity = 'Kozhikode';
    console.log(`3️⃣ Testing GET /city/${testCity}`);
    const cityResponse = await axios.get(`${API_URL}/city/${testCity}`);
    console.log('✅ Success!');
    console.log(`   - Risk Level: ${cityResponse.data.risk.level} (Score: ${cityResponse.data.risk.score})`);
    console.log(`   - Recent Crimes: ${cityResponse.data.statistics.recentCrimes}`);
    console.log(`   - Top Crime: ${cityResponse.data.statistics.topCrimes[0].type} (${cityResponse.data.statistics.topCrimes[0].count})`);
    console.log(`   - Trend: ${cityResponse.data.statistics.trend.direction} (${cityResponse.data.statistics.trend.percentage}%)`);
    console.log('');

    // Test 4: Get zone alert for location
    console.log('4️⃣ Testing POST /zone-alert');
    const zoneAlertResponse = await axios.post(`${API_URL}/zone-alert`, {
      latitude: 11.2588,
      longitude: 75.7804,
      address: 'Kozhikode, Kerala'
    });
    console.log('✅ Success!');
    console.log(`   - City detected: ${zoneAlertResponse.data.city}`);
    console.log(`   - Alert: ${zoneAlertResponse.data.alert}`);
    console.log('');

    console.log('✨ All tests passed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

testCrimeZoneAPI();
