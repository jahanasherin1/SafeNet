// --- backend/routes/users.js ---

import express from 'express';
import { User } from '../models/schemas.js';

const router = express.Router();

// OpenStreetMap (OSM) Overpass API endpoint for fetching nearby facilities
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Nominatim API for reverse geocoding (get address from coordinates)
const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org';

// ========================================
// Health Check Endpoint
// ========================================
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date(),
    message: 'Backend is running'
  });
});

// Update User Location
router.post('/update-location', async (req, res) => {
  try {
    const { email, latitude, longitude, isBackgroundUpdate } = req.body;

    if (!email || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Missing required fields: email, latitude, longitude' });
    }

    // Find and update user location
    const user = await User.findOneAndUpdate(
      { email },
      {
        currentLocation: {
          latitude,
          longitude,
          timestamp: new Date(),
          isBackgroundUpdate: isBackgroundUpdate || false
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log background updates with detailed timestamp showing when backend received update
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    const dateStamp = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    if (isBackgroundUpdate) {
      console.log(`📍 [${dateStamp} ${timestamp}] Backend received location from ${user.name || email}: (${latitude.toFixed(6)}, ${longitude.toFixed(6)}) - Accuracy: ${req.body.accuracy || 'N/A'}m`);
    } else {
      console.log(`📍 [${dateStamp} ${timestamp}] Manual location from ${user.name || email}: (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);
    }

    res.status(200).json({ 
      message: 'Location updated successfully',
      timestamp: user.currentLocation.timestamp
    });

  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({ message: 'Failed to update location' });
  }
});

// Get User's Current Live Location (for guardians)
router.get('/location/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.currentLocation) {
      return res.status(200).json({ 
        message: 'No location available',
        location: null 
      });
    }

    res.status(200).json({ 
      message: 'Live location retrieved',
      email: user.email,
      name: user.name,
      location: {
        latitude: user.currentLocation.latitude,
        longitude: user.currentLocation.longitude,
        timestamp: user.currentLocation.timestamp,
        isBackgroundUpdate: user.currentLocation.isBackgroundUpdate
      }
    });

  } catch (error) {
    console.error("Get Location Error:", error);
    res.status(500).json({ message: 'Failed to get location' });
  }
});

// ========================================
// 🗺️ OSM OVERPASS API HELPER FUNCTIONS
// ========================================

/**
 * Fetch facilities from OpenStreetMap using Overpass API
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @param {string} amenityType - OSM amenity type (police, hospital, fire_station, etc.)
 * @param {string} facilityType - Internal facility type label
 * @returns {Promise<Array>} - Array of facilities
 */
async function fetchOSMFacilities(latitude, longitude, radiusKm, amenityType, facilityType) {
  try {
    // Simplified Overpass QL query for better performance
    // Using a bounding box instead of haversine to avoid timeouts
    const bbox = {
      south: latitude - (radiusKm / 111),
      west: longitude - (radiusKm / 111.32),
      north: latitude + (radiusKm / 111),
      east: longitude + (radiusKm / 111.32)
    };

    const query = `[bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}];(node["amenity"="${amenityType}"];way["amenity"="${amenityType}"];);out center;`;

    console.log(`🔍 Querying OSM for ${facilityType}...`);

    // Use AbortController for proper timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ Overpass API HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const facilities = [];

    if (data.elements && data.elements.length > 0) {
      console.log(`✅ Found ${data.elements.length} ${facilityType} from OSM`);

      for (const element of data.elements) {
        let lat, lng;

        // Get coordinates from node or way
        if (element.lat && element.lon) {
          lat = element.lat;
          lng = element.lon;
        } else if (element.center) {
          lat = element.center.lat;
          lng = element.center.lon;
        } else {
          continue; // Skip elements without coordinates
        }

        // Calculate distance from user location
        const distance = calculateOSMDistance(latitude, longitude, lat, lng);

        // Extract phone number - try multiple keys
        let phoneNumber = element.tags?.phone || 
                         element.tags?.['contact:phone'] || 
                         element.tags?.['contact:mobile'] ||
                         undefined;
        
        // If no phone number found, use default emergency number for this type
        if (!phoneNumber) {
          const defaultNumbers = {
            'police': '100',      // India Police Emergency
            'hospital': '108',    // India Ambulance/Medical
            'fire_station': '101' // India Fire Emergency
          };
          phoneNumber = defaultNumbers[facilityType] || '112';
        }

        facilities.push({
          id: `osm_${element.id}`,
          name: element.tags?.name || `${facilityType} #${element.id}`,
          latitude: lat,
          longitude: lng,
          type: facilityType,
          address: element.tags?.['addr:full'] || 
                   `${element.tags?.['addr:street'] || ''} ${element.tags?.['addr:housenumber'] || ''}`.trim() ||
                   'Address not available',
          phoneNumber: phoneNumber,
          website: element.tags?.website || element.tags?.['contact:website'] || undefined,
          operatingHours: element.tags?.opening_hours || undefined,
          distance: distance
        });
      }

      // Sort by distance and return top 5
      facilities.sort((a, b) => a.distance - b.distance);
      console.log(`✅ Returning ${facilities.length} ${facilityType} with phone numbers: ${facilities.map(f => `${f.name} (${f.phoneNumber})`).join(', ')}`);
      return facilities.slice(0, 5);
    } else {
      console.log(`⚠️ No ${facilityType} found from OSM in the specified area`);
      return [];
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`⏱️ Timeout fetching ${facilityType} from Overpass API (15s exceeded)`);
    } else {
      console.error(`❌ Error fetching ${facilityType} from OSM:`, error.message);
    }
    return [];
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in kilometers
 */
function calculateOSMDistance(lat1, lon1, lat2, lon2) {
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

// ========================================
// Get Nearby Emergency Facilities (OSM - OpenStreetMap)
// ========================================
router.post('/nearby-facilities', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Missing latitude or longitude' });
    }

    const radiusKm = radius / 1000; // Convert meters to kilometers
    console.log(`\n🔍 Fetching OSM facilities near ${latitude}, ${longitude} (radius: ${radiusKm}km)`);

    const facilities = [];

    // Fetch from OpenStreetMap in parallel
    const [policeStations, hospitals, fireStations] = await Promise.all([
      fetchOSMFacilities(latitude, longitude, radiusKm, 'police', 'police'),
      fetchOSMFacilities(latitude, longitude, radiusKm, 'hospital', 'hospital'),
      fetchOSMFacilities(latitude, longitude, radiusKm, 'fire_station', 'fire')
    ]);

    facilities.push(...policeStations, ...hospitals, ...fireStations);

    // Sort all facilities by distance and filter out invalid entries
    facilities.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    
    // Filter to ensure all facilities have required fields
    const validFacilities = facilities.filter(f => f && f.id && f.name && f.type && f.latitude && f.longitude);

    console.log(`✅ Total facilities found: ${facilities.length}`);
    console.log(`   🚔 Police: ${policeStations.length}`);
    console.log(`   🏥 Hospitals: ${hospitals.length}`);
    console.log(`   🚒 Fire Stations: ${fireStations.length}`);

    // If OSM returns no valid results, provide fallback facilities based on user location
    if (validFacilities.length === 0) {
      console.log('⚠️ No OSM facilities found. Using fallback data...');
      
      const fallbackFacilities = [
        {
          id: 'fallback_police_1',
          name: 'Local Police Station',
          latitude: latitude + 0.005,
          longitude: longitude + 0.005,
          type: 'police',
          address: 'Nearby Police Station',
          phoneNumber: '100',
          distance: 0.5
        },
        {
          id: 'fallback_hospital_1',
          name: 'Nearby Hospital',
          latitude: latitude - 0.004,
          longitude: longitude + 0.006,
          type: 'hospital',
          address: 'Medical Facility',
          phoneNumber: '108',
          distance: 0.6
        },
        {
          id: 'fallback_hospital_2',
          name: 'Emergency Medical Center',
          latitude: latitude + 0.008,
          longitude: longitude - 0.003,
          type: 'hospital',
          address: 'Emergency Center',
          phoneNumber: '102',
          distance: 0.85
        },
        {
          id: 'fallback_fire_1',
          name: 'Fire & Rescue Station',
          latitude: latitude - 0.006,
          longitude: longitude + 0.007,
          type: 'fire',
          address: 'Rescue Station',
          phoneNumber: '101',
          distance: 0.75
        }
      ];
      
      validFacilities.push(...fallbackFacilities);
      console.log(`✅ Added ${fallbackFacilities.length} fallback facilities`);
    }

    res.status(200).json({
      message: validFacilities.length > 0 ? 'Nearby facilities retrieved' : 'Using fallback facilities',
      count: validFacilities.length,
      source: (policeStations.length + hospitals.length + fireStations.length) > 0 ? 'OpenStreetMap (OSM)' : 'Fallback Data',
      facilities: validFacilities,
      warning: validFacilities.length === 0 ? 'No facilities found from OpenStreetMap. Showing fallback locations.' : undefined
    });

  } catch (error) {
    console.error('❌ Nearby Facilities Error:', error);
    res.status(500).json({ message: 'Failed to get nearby facilities', error: error.message });
  }
});

export default router;