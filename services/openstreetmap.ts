// OpenStreetMap service for real nearby safe places
// Uses Geoapify API (primary), Photon API and Nominatim API (fallback) for comprehensive place data

// Geoapify API Key - Free tier available at https://geoapify.com
// Free tier: 3,000 requests/day without API key
const GEOAPIFY_API_KEY = ''; // Leave empty to use free tier (3,000/day), or add your key for higher limits

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

  // OSM sometimes stores multiple numbers separated by semicolons — take the first one
  const firstNumber = phone.split(';')[0].trim();

  // Remove common formatting characters but keep + prefix and digits
  const cleaned = firstNumber
    .replace(/[\s\-\(\)\.]/g, '')
    .trim();

  // If it doesn't start with + or a digit, return as-is
  if (!cleaned.match(/^(\+)?[0-9]/)) {
    return firstNumber.trim();
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
      }
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

// Search using Geoapify Places API for detailed facility information with phone numbers
// Geoapify provides structured JSON including phone numbers, easier to use than Overpass
async function searchGeoapifyAPI(lat: number, lon: number, radiusKm: number = 5): Promise<SafePlace[]> {
  try {
    const radiusMeters = radiusKm * 1000;
    console.log(`🔍 [Geoapify] Querying facility locations (${radiusKm}km radius)...`);

    // Define facility type mappings for Geoapify categories
    const facilityCategories = [
      { type: 'police' as const, categories: 'police' },
      { type: 'hospital' as const, categories: 'healthcare.hospital' },
      { type: 'hospital' as const, categories: 'healthcare.clinic' },
      { type: 'fire' as const, categories: 'fire_station' },
      { type: 'fire' as const, categories: 'emergency.fire_station' },
    ];

    const allPlaces: SafePlace[] = [];

    // Fetch each facility type separately for better results
    for (const { type, categories } of facilityCategories) {
      try {
        // Build Geoapify API URL
        const params = new URLSearchParams();
        params.append('categories', categories);
        params.append('filter', `circle:${lon},${lat},${radiusMeters}`);
        params.append('limit', '50');
        if (GEOAPIFY_API_KEY) {
          params.append('apiKey', GEOAPIFY_API_KEY);
        }

        const geoapifyUrl = `https://api.geoapify.com/v2/places?${params.toString()}`;

        const response = await fetch(geoapifyUrl, {
          headers: {
            'User-Agent': 'SafeNet-App/1.0'
          }
        });

        if (!response.ok) {
          console.log(`  ⚠️ [Geoapify] API error for ${type}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const features = data.features || [];

        console.log(`  ✓ [Geoapify] Found ${features.length} ${type} facilities`);

        for (const feature of features) {
          const props = feature.properties;
          if (!props) continue;

          const latitude = feature.geometry.coordinates[1];
          const longitude = feature.geometry.coordinates[0];
          const distance = calculateDistance(lat, lon, latitude, longitude);

          if (distance > radiusKm) continue;

          const name = props.name || `${type} facility`;
          const address = props.address_line2 || props.address_line1 || 'Address not available';
          const defaultPhone = getDefaultEmergencyNumberSync(type);

          const icon = type === 'police'
            ? 'shield-checkmark'
            : type === 'hospital'
            ? 'medical'
            : 'flame';

          allPlaces.push({
            id: `geoapify_${type}_${props.place_id || `${latitude}_${longitude}`}`,
            type: type,
            name: name,
            address: address,
            phoneNumber: defaultPhone,        // real phone will be merged later
            hasRealPhoneNumber: false,
            icon: icon,
            distance: distance,
            coords: { latitude, longitude }
          });
        }
      } catch (err) {
        console.log(`  ⚠️ [Geoapify] Error searching for ${type}:`, err);
        continue;
      }
    }

    // Deduplicate by coordinates
    const uniquePlaces = new Map<string, SafePlace>();
    for (const place of allPlaces) {
      const coordKey = `${place.coords.latitude.toFixed(4)}_${place.coords.longitude.toFixed(4)}_${place.type}`;
      if (!uniquePlaces.has(coordKey)) {
        uniquePlaces.set(coordKey, place);
      }
    }

    const finalPlaces = Array.from(uniquePlaces.values());
    console.log(`📊 [Geoapify] ${finalPlaces.length} unique facilities found`);
    return finalPlaces;

  } catch (error) {
    console.log(`⚠️ Geoapify API error:`, error);
    return [];
  }
}

/**
 * Fetch ONLY facilities that have phone numbers in OpenStreetMap using
 * Overpass API with ["phone"] filter — guaranteed real phone numbers.
 * Works anywhere in the world (not just Kerala).
 */
async function fetchOverpassPhoneNumbers(
  lat: number,
  lon: number,
  radiusKm: number = 5
): Promise<Array<{ type: 'police' | 'hospital' | 'fire'; name: string; phone: string; lat: number; lon: number }>> {
  try {
    const radiusMeters = radiusKm * 1000;

    // Use regex key filter [~"key"~"value"] to match ANY phone-related tag.
    // This catches: phone, contact:phone, contact:mobile, mobile, telephone, phone:primary, etc.
    // Kerala/India OSM data typically uses "contact:phone" rather than "phone".
    const phoneKeyRegex = `~"^(phone|contact:phone|contact:mobile|mobile|telephone|phone:primary|contact:telephone)$"~"."`;
    const amenities = ['police', 'hospital', 'clinic', 'fire_station'];
    const elementTypes = ['node', 'way'];

    const queryLines = amenities.flatMap(amenity =>
      elementTypes.map(
        t => `${t}["amenity"="${amenity}"][${phoneKeyRegex}](around:${radiusMeters},${lat},${lon});`
      )
    ).join('\n  ');

    const overpassQuery = `[out:json][timeout:30];\n(\n  ${queryLines}\n);\nout center;`;

    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    console.log(`📡 [Overpass+Phone] Querying OSM for facilities with any phone tag (contact:phone, phone, mobile...)...`);

    const response = await fetch(overpassUrl, {
      headers: { 'User-Agent': 'SafeNet-App/1.0' }
    });

    if (!response.ok) {
      console.log(`⚠️ [Overpass+Phone] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: Array<{ type: 'police' | 'hospital' | 'fire'; name: string; phone: string; lat: number; lon: number }> = [];

    for (const element of data.elements || []) {
      const tags = element.tags || {};

      // Extract phone from any phone-related tag (priority order)
      const rawPhone =
        tags.phone ||
        tags['contact:phone'] ||
        tags['contact:mobile'] ||
        tags.mobile ||
        tags.telephone ||
        tags['phone:primary'] ||
        tags['contact:telephone'];

      if (!rawPhone) continue;

      const amenity = tags.amenity;
      let facilityType: 'police' | 'hospital' | 'fire' | null = null;
      if (amenity === 'police') facilityType = 'police';
      else if (amenity === 'hospital' || amenity === 'clinic') facilityType = 'hospital';
      else if (amenity === 'fire_station') facilityType = 'fire';
      if (!facilityType) continue;

      // Nodes have lat/lon directly; ways use center
      const elLat = element.lat ?? element.center?.lat;
      const elLon = element.lon ?? element.center?.lon;
      if (elLat == null || elLon == null) continue;

      const phone = formatPhoneNumber(rawPhone);
      const name = tags.name || `${facilityType} facility`;
      // Show which tag was the source for debugging
      const phoneSource = tags.phone ? 'phone' : tags['contact:phone'] ? 'contact:phone' : 'other';
      console.log(`  ✅ [Overpass+Phone] ${name}: ${phone}  (tag: ${phoneSource})`);

      results.push({ type: facilityType, name, phone, lat: elLat, lon: elLon });
    }

    console.log(`📊 [Overpass+Phone] ${results.length} facilities with OSM-verified phone numbers`);
    return results;

  } catch (error) {
    console.log(`⚠️ [Overpass+Phone] Error:`, error);
    return [];
  }
}

/**
 * Merge phone numbers from Overpass into Geoapify facility list.
 * Matches facilities by type + proximity (within 300m).
 */
function mergePhoneNumbers(
  places: SafePlace[],
  phoneSource: Array<{ type: 'police' | 'hospital' | 'fire'; name: string; phone: string; lat: number; lon: number }>
): SafePlace[] {
  if (phoneSource.length === 0) return places;

  let merged = 0;

  const enriched = places.map(place => {
    // Find closest Overpass match of the same type within 300m
    const MATCH_RADIUS_KM = 0.3;
    let bestMatch: typeof phoneSource[0] | null = null;
    let bestDist = Infinity;

    for (const src of phoneSource) {
      if (src.type !== place.type) continue;
      const d = calculateDistance(
        place.coords.latitude, place.coords.longitude,
        src.lat, src.lon
      );
      if (d < MATCH_RADIUS_KM && d < bestDist) {
        bestDist = d;
        bestMatch = src;
      }
    }

    if (bestMatch) {
      merged++;
      console.log(`  📞 [Merge] ${place.name} ← ${bestMatch.phone} (OSM, ${(bestDist * 1000).toFixed(0)}m match)`);
      return { ...place, phoneNumber: bestMatch.phone, hasRealPhoneNumber: true };
    }
    return place;
  });

  console.log(`📊 [Merge] Attached real phones to ${merged}/${places.length} facilities`);
  return enriched;
}

// Search using Photon API (Photon is a search API based on OpenStreetMap)
async function searchPhoton(lat: number, lon: number, query: string, radiusKm: number = 10): Promise<SafePlace[]> {
  try {
    // Photon API - removed distance_sort as it's not a valid parameter
    const photonUrl = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=20`;

    const response = await fetch(photonUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0'
      }
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

// Enhanced phone search with location-based fallback - DISABLED (Google Places API not available)
// This function is kept for reference but no longer used
async function fetchPhoneWithLocationFallback(facilityName: string, facilityType: 'police' | 'hospital' | 'fire', latitude: number, longitude: number): Promise<string | undefined> {
  // Google Places API is not properly configured
  // All phone fetching now relies on OpenStreetMap Overpass, Nominatim, and Photon APIs
  console.log(`⏭️  [Google Places] Skipped for ${facilityName} - Using OSM data instead`);
  return undefined;
}

// Fetch phone number from Google Places API as fallback - DISABLED
// Google Places API returns REQUEST_DENIED, so all fetching relies on OpenStreetMap APIs
async function fetchPhoneFromGooglePlaces(facilityName: string, latitude: number, longitude: number, facilityType?: 'police' | 'hospital' | 'fire'): Promise<string | undefined> {
  return undefined;
}

// Search using Nominatim API for more detailed results with improved phone extraction
async function searchNominatim(lat: number, lon: number, query: string, radiusKm: number = 10): Promise<SafePlace[]> {
  try {
    // Search around the user location with higher limit
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=50&addressdetails=1&extratags=1&bounded=1&viewbox=${lon - 0.15},${lat - 0.15},${lon + 0.15},${lat + 0.15}`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SafeNet-App/1.0 (contact@safenet.com)'
      }
    });

    if (!response.ok) {
      console.log(`⚠️ [Nominatim] Search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const places: SafePlace[] = [];
    let foundWithPhone = 0;
    let foundWithoutPhone = 0;

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
            case 'medical_clinic':
            case 'health_clinic':
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

        const name = place.name || place.display_name.split(',')[0] || `${facilityType} facility`;
        
        // Try to extract phone from multiple sources
        let extractedPhone: string | undefined;
        
        // 1. Try address tags first
        if (place.address) {
          extractedPhone = place.address.phone;
        }
        
        // 2. Try extratags (most complete)
        if (!extractedPhone && place.extratags) {
          extractedPhone = extractPhoneNumber(place.extratags);
        }
        
        // 3. Try properties
        if (!extractedPhone && place.properties) {
          extractedPhone = extractPhoneNumber(place.properties);
        }
        
        const phoneNumber = extractedPhone || getDefaultEmergencyNumberSync(facilityType);
        const hasRealPhone = !!extractedPhone;
        
        if (hasRealPhone) {
          foundWithPhone++;
          console.log(`  ✓ [Nominatim] ${name} - Real phone: ${phoneNumber}`);
        } else {
          foundWithoutPhone++;
          console.log(`  ⚠️ [Nominatim] ${name} - Default: ${phoneNumber}`);
        }
        
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

    console.log(`  📊 [Nominatim] Found ${foundWithPhone} with real phones, ${foundWithoutPhone} with defaults`);
    return places;

  } catch (error: any) {
    console.log(`⚠️ [Nominatim] Error:`, error.message);
    return [];
  }
}

// Main function to get nearby safe places using multiple APIs
export async function getNearbyRealSafePlaces(latitude: number, longitude: number, radiusKm: number = 5): Promise<SafePlace[]> {
  try {
    console.log(`🔍 Fetching emergency facilities (${radiusKm}km radius)`);

    // Run Geoapify (facility locations) and Overpass ["phone"] filter in parallel.
    // Overpass only returns facilities that have phone numbers in OSM — guaranteed real data.
    console.log(`📡 Fetching facility locations (Geoapify) + verified phone numbers (Overpass) in parallel...`);
    const [geoapifyPlaces, overpassPhones] = await Promise.all([
      searchGeoapifyAPI(latitude, longitude, radiusKm),
      fetchOverpassPhoneNumbers(latitude, longitude, radiusKm),
    ]);

    // Merge: attach OSM-verified phones to Geoapify facilities by proximity
    let allPlaces = mergePhoneNumbers(geoapifyPlaces, overpassPhones);

    // If Geoapify returned nothing but Overpass has results, convert Overpass entries directly
    if (allPlaces.length === 0 && overpassPhones.length > 0) {
      console.log(`📡 Geoapify returned nothing — using Overpass results directly...`);
      allPlaces = overpassPhones.map(src => ({
        id: `overpass_phone_${src.lat}_${src.lon}`,
        type: src.type,
        name: src.name,
        address: 'Address not available',
        phoneNumber: src.phone,
        hasRealPhoneNumber: true,
        icon: src.type === 'police' ? 'shield-checkmark' : src.type === 'hospital' ? 'medical' : 'flame',
        distance: calculateDistance(latitude, longitude, src.lat, src.lon),
        coords: { latitude: src.lat, longitude: src.lon }
      }));
    }

    // Fallback: If combined result is still thin, supplement with Photon and Nominatim
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

    // Smart deduplication: prefer places with real phone numbers
    const uniquePlaces: SafePlace[] = [];
    const coordIndex = new Map<string, SafePlace>();

    // First pass: Index all places with real phone numbers
    for (const place of placesWithRealPhoneNumbers) {
      const coordKey = `${place.coords.latitude.toFixed(4)}_${place.coords.longitude.toFixed(4)}_${place.type}`;
      
      if (!coordIndex.has(coordKey)) {
        coordIndex.set(coordKey, place);
      } else {
        // If we already have this location, prefer the one closer to the search center
        const existing = coordIndex.get(coordKey)!;
        if (place.distance < existing.distance) {
          coordIndex.set(coordKey, place);
        }
      }
    }

    // Second pass: Add places with default numbers only for new locations
    for (const place of placesWithDefaultNumbers) {
      const coordKey = `${place.coords.latitude.toFixed(4)}_${place.coords.longitude.toFixed(4)}_${place.type}`;
      
      if (!coordIndex.has(coordKey)) {
        coordIndex.set(coordKey, place);
      }
    }

    // Convert to array and sort by distance
    uniquePlaces.push(...Array.from(coordIndex.values()));
    uniquePlaces.sort((a, b) => a.distance - b.distance);

    // Limit to 20 closest
    const finalPlaces = uniquePlaces.slice(0, 20);

    if (finalPlaces.length > 0) {
      const police = finalPlaces.filter(p => p.type === 'police').length;
      const hospitals = finalPlaces.filter(p => p.type === 'hospital').length;
      const fire = finalPlaces.filter(p => p.type === 'fire').length;
      const withRealNumbers = finalPlaces.filter(p => p.hasRealPhoneNumber).length;
      
      console.log(`✅ Successfully found ${finalPlaces.length} facilities (🚔${police} 🏥${hospitals} 🚒${fire})`);
      console.log(`📞 ${withRealNumbers} with REAL phone numbers, ${finalPlaces.length - withRealNumbers} with defaults`);
      
      // Log details
      finalPlaces.forEach(p => {
        if (p.hasRealPhoneNumber) {
          console.log(`   ✓ ${p.name}: ${p.phoneNumber} (${p.distance.toFixed(1)}km)`);
        } else {
          console.log(`   ⚠️  ${p.name}: ${p.phoneNumber} - DEFAULT (${p.distance.toFixed(1)}km)`);
        }
      });
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