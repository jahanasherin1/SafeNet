// OpenStreetMap service for real nearby safe places
// Uses Photon API and Nominatim API for comprehensive place data

interface OSMPlace {
  osm_id: string;
  osm_type: string;
  display_name: string;
  lat: number;
  lon: number;
  boundingbox: [string, string, string, string];
  class: string;
  type: string;
  importance: number;
  properties?: {
    name?: string;
    'addr:housenumber'?: string;
    'addr:street'?: string;
    'addr:city'?: string;
    'addr:postcode'?: string;
    phone?: string;
    website?: string;
    opening_hours?: string;
  };
}

interface PhotonFeature {
  geometry: {
    coordinates: [number, number];
    type: string;
  };
  properties: {
    osm_id: number;
    osm_type: string;
    name: string;
    housenumber?: string;
    street?: string;
    city?: string;
    postcode?: string;
    district?: string;
    osm_key: string;
    osm_value: string;
  };
  type: string;
}

interface SafePlace {
  id: string;
  type: 'police' | 'hospital' | 'fire';
  name: string;
  address: string;
  phoneNumber?: string;
  hasRealPhoneNumber?: boolean; // Flag to indicate if phone is from facility or default
  icon: string;
  distance: number;
  rating?: number;
  isOpen?: boolean;
  coords: { latitude: number; longitude: number };
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format address from OSM properties
function formatAddress(properties: any, displayName: string): string {
  if (properties.street && properties.housenumber) {
    const street = `${properties.housenumber} ${properties.street}`;
    const city = properties.city || properties.district || '';
    return city ? `${street}, ${city}` : street;
  }
  
  // Fall back to display name, clean it up
  const parts = displayName.split(',').map(part => part.trim());
  return parts.slice(0, 3).join(', '); // First 3 parts usually contain the most relevant info
}

// Format and validate phone number
function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove common formatting characters
  let cleaned = phone.trim()
    .replace(/[\s\-\(\)]/g, '')
    .replace(/^(\+)?([0-9]+)$/, '$1$2');
  
  // If it doesn't start with + or a digit, return as is
  if (!cleaned.match(/^(\+)?[0-9]/)) {
    return phone.trim();
  }
  
  return cleaned;
}

// Extract phone number from properties with multiple fallback keys
function extractPhoneNumber(properties: any): string | undefined {
  if (!properties) return undefined;
  
  // Try multiple possible phone number keys from OpenStreetMap (comprehensive list)
  const phoneNumber = 
    properties.phone ||
    properties['contact:phone'] ||
    properties['phone'] ||
    properties['mobile'] ||
    properties['contact:mobile'] ||
    properties['contact:telephone'] ||
    properties.telephone ||
    properties['phone:main'] ||
    properties['contact:fax'] ||
    properties['phone_number'] ||
    undefined;
  
  // Return formatted phone number if found
  return phoneNumber ? formatPhoneNumber(phoneNumber) : undefined;
}

// Get default emergency number based on facility type and location
async function getDefaultEmergencyNumber(type: 'police' | 'hospital' | 'fire', latitude?: number, longitude?: number): Promise<string> {
  // Default numbers by country (expanded list)
  const emergencyNumbers: Record<string, Record<string, string>> = {
    'IN': { police: '100', hospital: '108', fire: '101' },      // India
    'US': { police: '911', hospital: '911', fire: '911' },      // USA
    'GB': { police: '999', hospital: '999', fire: '999' },      // UK
    'CA': { police: '911', hospital: '911', fire: '911' },      // Canada
    'AU': { police: '000', hospital: '000', fire: '000' },      // Australia
    'DE': { police: '110', hospital: '112', fire: '112' },      // Germany
    'FR': { police: '17', hospital: '15', fire: '18' },         // France
    'JP': { police: '110', hospital: '119', fire: '119' },      // Japan
    'CN': { police: '110', hospital: '120', fire: '119' },      // China
    'BR': { police: '190', hospital: '192', fire: '193' },      // Brazil
    'MX': { police: '066', hospital: '066', fire: '068' },      // Mexico
    'ZA': { police: '10177', hospital: '10177', fire: '10177' },// South Africa
    'NG': { police: '112', hospital: '112', fire: '112' },      // Nigeria
    'KE': { police: '999', hospital: '999', fire: '999' },      // Kenya
    'SG': { police: '999', hospital: '995', fire: '995' },      // Singapore
    'MY': { police: '999', hospital: '999', fire: '999' },      // Malaysia
    'TH': { police: '191', hospital: '1669', fire: '199' },     // Thailand
    'PH': { police: '117', hospital: '117', fire: '117' },      // Philippines
  };
  
  try {
    // Try to determine country from location if provided
    if (latitude && longitude) {
      const address = await reverseGeocode(latitude, longitude);
      // Extract country code from address (last part usually contains country)
      const parts = address.split(',');
      if (parts.length > 0) {
        const countryPart = parts[parts.length - 1].trim();
        // This is a simplified approach; ideally use a geocoding API for country code
        
        // Check for country name matches
        for (const [code, numbers] of Object.entries(emergencyNumbers)) {
          if (countryPart.includes(code) || 
              (code === 'IN' && countryPart.includes('India')) ||
              (code === 'US' && (countryPart.includes('United States') || countryPart.includes('USA'))) ||
              (code === 'GB' && countryPart.includes('United Kingdom'))) {
            return numbers[type] || '112';
          }
        }
      }
    }
  } catch (error) {
    console.log('📍 Could not determine country from location');
  }
  
  // Default fallback (India as default)
  const defaultNumbers: Record<string, string> = {
    police: '100',      // India Police Emergency
    hospital: '108',    // India Ambulance/Medical Emergency
    fire: '101'         // India Fire Emergency
  };
  
  return defaultNumbers[type] || '112'; // 112 Universal Emergency
}

// Fetch detailed OSM data for a specific element to get phone numbers
async function fetchOSMElementDetails(osmType: string, osmId: string): Promise<any> {
  try {
    // OSM API endpoint for detailed element information
    const osmApiUrl = `https://api.openstreetmap.org/api/0.6/${osmType}/${osmId}?format=json`;
    
    const response = await fetch(osmApiUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0'
      },
      timeout: 5000
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Extract tags from the response
    if (osmType === 'node' && data.node?.tags) {
      return data.node.tags;
    } else if (osmType === 'way' && data.way?.tags) {
      return data.way.tags;
    } else if (osmType === 'relation' && data.relation?.tags) {
      return data.relation.tags;
    }
    
    return null;
  } catch (error) {
    // Silently handle errors - OSM API can be slow sometimes
    return null;
  }
}

// Get default emergency number based on facility type (synchronous version with hardcoded defaults)
function getDefaultEmergencyNumberSync(type: 'police' | 'hospital' | 'fire'): string {
  const defaults: Record<string, string> = {
    police: '100',      // India Police Emergency
    hospital: '108',    // India Ambulance/Medical Emergency
    fire: '101'         // India Fire Emergency
  };
  return defaults[type] || '112'; // 112 Universal Emergency
}

// Search using Overpass API for detailed facility information with phone numbers
async function searchOverpassAPI(lat: number, lon: number, radiusKm: number = 5): Promise<SafePlace[]> {
  try {
    const radiusMeters = radiusKm * 1000;
    
    // Improved Overpass query that explicitly requests phone data and returns centers
    // Including relations for multi-part amenities
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="police"](around:${radiusMeters},${lat},${lon});
        way["amenity"="police"](around:${radiusMeters},${lat},${lon});
        relation["amenity"="police"](around:${radiusMeters},${lat},${lon});
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        relation["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        relation["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        node["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
        way["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
        relation["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
      );
      out center;
    `;

    const encodedQuery = encodeURIComponent(overpassQuery);
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;
    
    console.log(`🔍 [Overpass] Querying detailed facility data with phone numbers...`);

    const response = await fetch(overpassUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0'
      },
      timeout: 25000 // Overpass can be slower
    });

    if (!response.ok) {
      console.log(`⚠️ Overpass API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const places: SafePlace[] = [];
    
    // Log sample of what tags we're getting for debugging
    let sampleLoggedCount = 0;
    const maxSampleLogs = 5;

    // Process nodes and ways
    const allElements = [...(data.elements || [])];

    for (const element of allElements) {
      if (!element.tags) continue;

      // Skip if not an emergency facility
      const amenityType = element.tags.amenity;
      if (!['police', 'hospital', 'clinic', 'fire_station'].includes(amenityType)) continue;

      // Log sample tags for first few facilities to debug what data is available
      if (sampleLoggedCount < maxSampleLogs) {
        const allTagKeys = Object.keys(element.tags);
        const phoneRelatedTags = allTagKeys.filter(key => 
          key.toLowerCase().includes('phone') || 
          key.toLowerCase().includes('contact') || 
          key.toLowerCase().includes('tel')
        );
        console.log(`  📋 Sample: ${element.tags.name || 'Unknown'}`);
        console.log(`     All tags: ${allTagKeys.join(', ')}`);
        if (phoneRelatedTags.length > 0) {
          console.log(`     Phone tags: ${phoneRelatedTags.map(k => `${k}=${element.tags[k]}`).join(', ')}`);
        } else {
          console.log(`     ⚠️  NO phone-related tags found in OSM`);
        }
        sampleLoggedCount++;
      }
      let facilityType: 'police' | 'hospital' | 'fire' | null = null;
      switch (amenityType) {
        case 'police':
          facilityType = 'police';
          break;
        case 'hospital':
        case 'clinic':
          facilityType = 'hospital';
          break;
        case 'fire_station':
          facilityType = 'fire';
          break;
      }

      if (!facilityType) continue;

      // Get coordinates
      let latitude: number, longitude: number;
      if (element.lat && element.lon) {
        latitude = element.lat;
        longitude = element.lon;
      } else if (element.center) {
        latitude = element.center.lat;
        longitude = element.center.lon;
      } else {
        continue;
      }

      const distance = calculateDistance(lat, lon, latitude, longitude);
      if (distance > radiusKm) continue;

      // Extract facility information
      const name = element.tags.name || `${facilityType} facility`;
      const address = element.tags['addr:street'] 
        ? `${element.tags['addr:housenumber'] || ''} ${element.tags['addr:street']}, ${element.tags['addr:city'] || ''}`.trim()
        : 'Address not available';

      // Extract phone number from OSM tags
      let phoneNumber = extractPhoneNumber(element.tags);
      let hasRealPhone = !!phoneNumber;
      
      // Store elements without phone for potential Google Places lookup later
      if (!phoneNumber) {
        places.push({
          id: `overpass_${element.type}_${element.id}`,
          type: facilityType,
          name: name,
          address: address,
          phoneNumber: undefined, // Mark for later lookup
          hasRealPhoneNumber: false,
          icon: amenityType === 'police' ? 'shield-checkmark' : amenityType.includes('hospital') || amenityType === 'clinic' ? 'medical' : 'flame',
          distance: distance,
          coords: {
            latitude: latitude,
            longitude: longitude
          }
        });
        console.log(`  ⏳ [Overpass] ${name} - No phone in OSM, will try Google Places...`);
      } else {
        console.log(`  ✓ [Overpass] ${name} - Phone: ${phoneNumber} (from OSM)`);
        places.push({
          id: `overpass_${element.type}_${element.id}`,
          type: facilityType,
          name: name,
          address: address,
          phoneNumber: phoneNumber,
          hasRealPhoneNumber: true,
          icon: amenityType === 'police' ? 'shield-checkmark' : amenityType.includes('hospital') || amenityType === 'clinic' ? 'medical' : 'flame',
          distance: distance,
          coords: {
            latitude: latitude,
            longitude: longitude
          }
        });
      }
    }

    // Try to fetch phone numbers from Google Places for facilities without OSM phone numbers
    const placesWithRealPhone = places.filter(p => p.hasRealPhoneNumber);
    const placesWithoutPhone = places.filter(p => !p.phoneNumber);
    
    console.log(`📊 [Overpass] Summary: ${places.length} total facilities found`);
    console.log(`   ✓ ${placesWithRealPhone.length} with phone numbers in OSM`);
    console.log(`   ⏳ ${placesWithoutPhone.length} without phone numbers (will fetch from Google Places...)`);
    
    if (placesWithoutPhone.length > 0) {
      // Fetch in parallel with a limit to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < placesWithoutPhone.length; i += batchSize) {
        const batch = placesWithoutPhone.slice(i, i + batchSize);
        const phonePromises = batch.map(place => 
          fetchPhoneFromGooglePlaces(place.name, place.coords.latitude, place.coords.longitude)
            .then(phone => ({
              id: place.id,
              phone: phone
            }))
        );
        
        const results = await Promise.all(phonePromises);
        
        // Update places with fetched phone numbers
        for (const result of results) {
          const place = places.find(p => p.id === result.id);
          if (place && result.phone) {
            place.phoneNumber = result.phone;
            place.hasRealPhoneNumber = true;
            console.log(`  ✓ Updated ${place.name} with phone: ${result.phone}`);
          }
        }
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < placesWithoutPhone.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // Add default numbers to remaining places without phone
    let finalWithRealPhones = 0;
    for (const place of places) {
      if (!place.phoneNumber) {
        place.phoneNumber = getDefaultEmergencyNumberSync(place.type);
        place.hasRealPhoneNumber = false;
      } else if (place.hasRealPhoneNumber) {
        finalWithRealPhones++;
      }
    }

    console.log(`📊 [Overpass] Final result: ${finalWithRealPhones}/${places.length} facilities with real phone numbers`);
    return places;

  } catch (error) {
    console.log(`⚠️ Overpass API error:`, error);
    return [];
  }
}

// Search using Photon API (Photon is a search API based on OpenStreetMap)
async function searchPhoton(lat: number, lon: number, query: string, radiusKm: number = 10): Promise<SafePlace[]> {
  try {
    // Photon API - removed distance_sort as it's not a valid parameter
    const photonUrl = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=20`;

    const response = await fetch(photonUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const places: SafePlace[] = [];

    if (data.features && Array.isArray(data.features)) {
      for (const feature of data.features) {
        if (!feature.geometry?.coordinates) continue;

        const [longitude, latitude] = feature.geometry.coordinates;
        const distance = calculateDistance(lat, lon, latitude, longitude);

        // Filter by distance
        if (distance > radiusKm) continue;

        // Determine facility type
        let facilityType: 'police' | 'hospital' | 'fire' | null = null;
        let icon = 'location';
        
        if (feature.properties.osm_key === 'amenity') {
          switch (feature.properties.osm_value) {
            case 'police':
              facilityType = 'police';
              icon = 'car-sport';
              break;
            case 'hospital':
            case 'clinic':
            case 'doctors':
              facilityType = 'hospital';
              icon = 'medkit';
              break;
            case 'fire_station':
              facilityType = 'fire';
              icon = 'flame';
              break;
          }
        }

        // Only include emergency facilities
        if (!facilityType) continue;

        const address = formatAddress(feature.properties, feature.properties.name);
        const extractedPhone = extractPhoneNumber(feature.properties);
        const phoneNumber = extractedPhone || getDefaultEmergencyNumberSync(facilityType);
        const hasRealPhone = !!extractedPhone;

        console.log(`  📍 [Photon] ${feature.properties.name} - Phone: ${phoneNumber} (real: ${hasRealPhone})`);

        places.push({
          id: `photon_${feature.properties.osm_id}`,
          type: facilityType,
          name: feature.properties.name || `${facilityType} facility`,
          address: address,
          phoneNumber: phoneNumber,
          hasRealPhoneNumber: hasRealPhone,
          icon: icon,
          distance: distance,
          coords: {
            latitude: latitude,
            longitude: longitude
          }
        });
      }
    }

    return places;

  } catch (error) {
    // Silently handle errors - network failures are common with public APIs
    return [];
  }
}

// Fetch phone number from Google Places API as fallback
async function fetchPhoneFromGooglePlaces(facilityName: string, latitude: number, longitude: number): Promise<string | undefined> {
  try {
    // Google Places API key
    const GOOGLE_PLACES_API_KEY = 'AIzaSyDGpAdiZUGAza7OMuWwTBXLfznzB0shrnY';
    
    // Do a nearby search to find the place details
    const nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=100&keyword=${encodeURIComponent(facilityName)}&key=${GOOGLE_PLACES_API_KEY}`;
    
    const searchResponse = await fetch(nearbySearchUrl);
    if (!searchResponse.ok) return undefined;

    const searchData = await searchResponse.json();
    const results = searchData.results || [];
    
    if (results.length === 0) return undefined;

    // Get the first result's place ID
    const placeId = results[0].place_id;

    // Get detailed information including phone number
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number&key=${GOOGLE_PLACES_API_KEY}`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) return undefined;

    const detailsData = await detailsResponse.json();
    const phoneNumber = detailsData.result?.formatted_phone_number;
    
    if (phoneNumber) {
      console.log(`  📞 [Google Places] ${facilityName} - Found: ${phoneNumber}`);
      return phoneNumber;
    }
    
    return undefined;
  } catch (error) {
    // Silently handle errors
    return undefined;
  }
}

// Search using Nominatim API for more detailed results
async function searchNominatim(lat: number, lon: number, query: string, radiusKm: number = 10): Promise<SafePlace[]> {
  try {
    // Search around the user location
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=20&addressdetails=1&extratags=1&bounded=1&viewbox=${lon - 0.1},${lat - 0.1},${lon + 0.1},${lat + 0.1}`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0 (contact@safenet.com)'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const places: SafePlace[] = [];

    if (Array.isArray(data)) {
      for (const place of data) {
        const latitude = parseFloat(place.lat.toString());
        const longitude = parseFloat(place.lon.toString());
        const distance = calculateDistance(lat, lon, latitude, longitude);

        // Filter by distance
        if (distance > radiusKm) continue;

        // Determine facility type from class and type
        let facilityType: 'police' | 'hospital' | 'fire' | null = null;
        let icon = 'location';

        if (place.class === 'amenity') {
          switch (place.type) {
            case 'police':
              facilityType = 'police';
              icon = 'car-sport';
              break;
            case 'hospital':
            case 'clinic':
            case 'doctors':
              facilityType = 'hospital';
              icon = 'medkit';
              break;
            case 'fire_station':
              facilityType = 'fire';
              icon = 'flame';
              break;
          }
        }

        // Only include emergency facilities
        if (!facilityType) continue;

        const name = place.properties?.name || place.display_name.split(',')[0] || `${facilityType} facility`;
        const extractedPhone = extractPhoneNumber(place.properties) || extractPhoneNumber(place.extratags);
        const phoneNumber = extractedPhone || getDefaultEmergencyNumberSync(facilityType);
        const hasRealPhone = !!extractedPhone;
        
        console.log(`  📍 [Nominatim] ${name} - Phone: ${phoneNumber} (real: ${hasRealPhone})`);
        
        places.push({
          id: `nominatim_${place.osm_id}`,
          type: facilityType,
          name: name,
          address: place.display_name,
          phoneNumber: phoneNumber,
          hasRealPhoneNumber: hasRealPhone,
          icon: icon,
          distance: distance,
          coords: {
            latitude: latitude,
            longitude: longitude
          }
        });
      }
    }

    return places;

  } catch (error) {
    // Silently handle errors - network failures are common with public APIs
    return [];
  }
}

// Main function to get nearby safe places using both APIs
export async function getNearbyRealSafePlaces(latitude: number, longitude: number, radiusKm: number = 5): Promise<SafePlace[]> {
  try {
    console.log(`🔍 Fetching emergency facilities (${radiusKm}km radius)`);

    // Primary: Use Overpass API for detailed facility information with phone numbers
    console.log(`📡 Attempting Overpass API (most detailed data)...`);
    let allPlaces = await searchOverpassAPI(latitude, longitude, radiusKm);

    // Fallback: If Overpass doesn't return enough results, use Photon and Nominatim
    if (allPlaces.length < 5) {
      console.log(`📡 Supplementing with Photon & Nominatim APIs...`);
      
      const searchTerms = [
        'police station',
        'hospital',
        'clinic', 
        'fire station',
        'emergency',
        'medical center'
      ];

      // Use both APIs in parallel for comprehensive coverage
      const allPromises = searchTerms.flatMap(term => [
        searchPhoton(latitude, longitude, term, radiusKm),
        searchNominatim(latitude, longitude, term, radiusKm)
      ]);

      const allResults = await Promise.all(allPromises);
      const supplementaryPlaces = allResults.flat();
      
      // Add supplementary results
      allPlaces = [...allPlaces, ...supplementaryPlaces];
    }

    // Separate places by whether they have real phone numbers
    const placesWithRealPhoneNumbers: SafePlace[] = [];
    const placesWithDefaultNumbers: SafePlace[] = [];
    
    for (const place of allPlaces) {
      if (place.hasRealPhoneNumber) {
        placesWithRealPhoneNumbers.push(place);
      } else {
        placesWithDefaultNumbers.push(place);
      }
    }

    console.log(`📊 Facilities with REAL phone numbers: ${placesWithRealPhoneNumbers.length}, with default numbers: ${placesWithDefaultNumbers.length}`);

    // Remove duplicates from places with real phone numbers (prioritize these)
    const uniqueRealPhones: SafePlace[] = [];
    const addedCoords = new Set<string>();

    for (const place of placesWithRealPhoneNumbers) {
      const coordKey = `${place.coords.latitude.toFixed(4)}_${place.coords.longitude.toFixed(4)}_${place.type}`;
      
      if (!addedCoords.has(coordKey)) {
        addedCoords.add(coordKey);
        uniqueRealPhones.push(place);
        console.log(`✅ ${place.name} - Real phone: ${place.phoneNumber} (${place.distance.toFixed(1)}km)`);
      }
    }

    // Add filtered places with default numbers only if we don't have enough results
    for (const place of placesWithDefaultNumbers) {
      const coordKey = `${place.coords.latitude.toFixed(4)}_${place.coords.longitude.toFixed(4)}_${place.type}`;
      
      if (!addedCoords.has(coordKey) && uniqueRealPhones.length < 15) {
        addedCoords.add(coordKey);
        uniqueRealPhones.push(place);
        console.log(`⚠️ ${place.name} - Default phone: ${place.phoneNumber} (${place.distance.toFixed(1)}km)`);
      }
    }

    // Sort by distance and limit to 20 closest
    uniqueRealPhones.sort((a, b) => a.distance - b.distance);
    const finalPlaces = uniqueRealPhones.slice(0, 20);

    if (finalPlaces.length > 0) {
      const police = finalPlaces.filter(p => p.type === 'police').length;
      const hospitals = finalPlaces.filter(p => p.type === 'hospital').length;
      const fire = finalPlaces.filter(p => p.type === 'fire').length;
      const withRealNumbers = finalPlaces.filter(p => p.hasRealPhoneNumber).length;
      console.log(`✅ Successfully found ${finalPlaces.length} facilities (🚔${police} 🏥${hospitals} 🚒${fire}) | ${withRealNumbers} with REAL phone numbers`);
    } else {
      console.log('⚠️ No emergency facilities found in the specified area');
    }

    return finalPlaces;

  } catch (error) {
    console.error('❌ Error getting nearby real safe places:', error);
    return [];
  }
}

// Reverse geocoding to get address from coordinates
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0 (contact@safenet.com)'
      }
    });

    if (!response.ok) {
      return 'Address not available';
    }

    const data = await response.json();
    return data.display_name || 'Address not available';

  } catch (error) {
    console.error('❌ Reverse geocoding error:', error);
    return 'Address not available';
  }
}