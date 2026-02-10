// Test script for OpenStreetMap service
// Run this in a browser console or Node.js environment to test the APIs

console.log('🧪 Testing OpenStreetMap APIs...');

// Test coordinates (New York City)
const testLat = 40.7128;
const testLon = -74.0060;

// Test Photon API
async function testPhoton() {
  try {
    console.log('🔍 Testing Photon API...');
    const photonUrl = `https://photon.komoot.io/api?q=hospital&lat=${testLat}&lon=${testLon}&limit=5&distance_sort=true`;
    
    const response = await fetch(photonUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Photon API working!');
      console.log('Sample data:', data.features?.slice(0, 2));
      return true;
    } else {
      console.error('❌ Photon API error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Photon API error:', error);
    return false;
  }
}

// Test Nominatim API
async function testNominatim() {
  try {
    console.log('🔍 Testing Nominatim API...');
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=police&format=json&limit=5&addressdetails=1&bounded=1&viewbox=${testLon - 0.1},${testLat - 0.1},${testLon + 0.1},${testLat + 0.1}`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0 (test@safenet.com)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Nominatim API working!');
      console.log('Sample data:', data.slice(0, 2));
      return true;
    } else {
      console.error('❌ Nominatim API error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Nominatim API error:', error);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('📍 Testing APIs near coordinates:', testLat, testLon);
  
  const photonWorks = await testPhoton();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  const nominatimWorks = await testNominatim();

  console.log('\n🏁 Test Results:');
  console.log('Photon API:', photonWorks ? '✅ Working' : '❌ Failed');
  console.log('Nominatim API:', nominatimWorks ? '✅ Working' : '❌ Failed');

  if (photonWorks || nominatimWorks) {
    console.log('✅ At least one API is working - OpenStreetMap service should function!');
  } else {
    console.log('❌ Both APIs failed - check internet connection or API availability');
  }
}

// Uncomment to run test
// runTests();

export { runTests, testNominatim, testPhoton };
