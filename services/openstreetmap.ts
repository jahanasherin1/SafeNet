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

        places.push({
          id: `photon_${feature.properties.osm_id}`,
          type: facilityType,
          name: feature.properties.name || `${facilityType} facility`,
          address: address,
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
        
        places.push({
          id: `nominatim_${place.osm_id}`,
          type: facilityType,
          name: name,
          address: place.display_name,
          phoneNumber: place.properties?.phone,
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

    // Search different types of emergency facilities
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
    const allPlaces = allResults.flat();

    // Remove duplicates based on coordinates (allowing for small variations)
    const uniquePlaces: SafePlace[] = [];
    const addedCoords = new Set<string>();

    for (const place of allPlaces) {
      // Create a coordinate key with reduced precision to catch duplicates
      const coordKey = `${place.coords.latitude.toFixed(4)}_${place.coords.longitude.toFixed(4)}_${place.type}`;
      
      if (!addedCoords.has(coordKey)) {
        addedCoords.add(coordKey);
        uniquePlaces.push(place);
      }
    }

    // Sort by distance and limit to 20 closest
    uniquePlaces.sort((a, b) => a.distance - b.distance);
    const finalPlaces = uniquePlaces.slice(0, 20);

    if (finalPlaces.length > 0) {
      const police = finalPlaces.filter(p => p.type === 'police').length;
      const hospitals = finalPlaces.filter(p => p.type === 'hospital').length;
      const fire = finalPlaces.filter(p => p.type === 'fire').length;
      console.log(`✅ Found ${finalPlaces.length} facilities (🚔${police} 🏥${hospitals} 🚒${fire})`);
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