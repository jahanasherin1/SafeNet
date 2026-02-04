// backend/utils/proximityAlerts.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Parse crime-data-coordinates.csv with coordinates
export function parseProximityCrimeData() {
  try {
    const csvPath = path.join(__dirname, '../crime-data-coordinates.csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Skip header: City,Latitude,Longitude,Crime_Type,Year,Count
    const dataLines = lines.slice(1);
    
    const locationData = {};
    
    dataLines.forEach(line => {
      // Parse CSV line handling quoted values
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!values || values.length < 6) return;
      
      const [city, lat, lng, crimeType, year, count] = values.map(v => v.replace(/^"|"$/g, '').trim());
      
      if (!city || !lat || !lng || !crimeType || !year || !count) return;
      
      // Initialize location data
      if (!locationData[city]) {
        locationData[city] = {
          name: city,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          totalCrimes: 0,
          recentCrimes: 0,
          crimeTypes: {},
          yearlyData: {}
        };
      }
      
      const crimeCount = parseInt(count) || 0;
      const yearNum = parseInt(year);
      
      // Aggregate total crimes
      locationData[city].totalCrimes += crimeCount;
      
      // Track recent years (2024-2025)
      if (yearNum >= 2024) {
        locationData[city].recentCrimes += crimeCount;
      }
      
      // Track by crime type
      if (!locationData[city].crimeTypes[crimeType]) {
        locationData[city].crimeTypes[crimeType] = 0;
      }
      locationData[city].crimeTypes[crimeType] += crimeCount;
      
      // Track by year
      if (!locationData[city].yearlyData[year]) {
        locationData[city].yearlyData[year] = 0;
      }
      locationData[city].yearlyData[year] += crimeCount;
    });
    
    return locationData;
  } catch (error) {
    console.error('Error parsing crime data:', error);
    return {};
  }
}

// Calculate risk level based on recent crime data
function calculateLocationRiskLevel(locationData, allLocations) {
  const recentCrimes = locationData.recentCrimes;
  
  // Get all recent crime counts for normalization
  const allRecentCrimes = Object.values(allLocations).map(loc => loc.recentCrimes);
  const maxCrimes = Math.max(...allRecentCrimes);
  const minCrimes = Math.min(...allRecentCrimes);
  
  // Normalize score (0-100)
  let score = 0;
  if (maxCrimes > minCrimes) {
    score = ((recentCrimes - minCrimes) / (maxCrimes - minCrimes)) * 100;
  }
  
  // Determine risk level based on quintiles
  let level, color, priority;
  if (score >= 80) {
    level = 'critical';
    color = '#DC2626';
    priority = 5;
  } else if (score >= 60) {
    level = 'high';
    color = '#EA580C';
    priority = 4;
  } else if (score >= 40) {
    level = 'moderate';
    color = '#F59E0B';
    priority = 3;
  } else if (score >= 20) {
    level = 'low';
    color = '#10B981';
    priority = 2;
  } else {
    level = 'safe';
    color = '#059669';
    priority = 1;
  }
  
  return {
    level,
    score: Math.round(score),
    color,
    priority
  };
}

// Get top crime types for a location
function getTopCrimes(locationData, limit = 3) {
  const crimeTypes = Object.entries(locationData.crimeTypes)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  return crimeTypes;
}

// Check proximity to high-crime areas
export function checkProximityAlert(userLat, userLng, locationData, radiusKm = 5) {
  const nearbyLocations = [];
  
  Object.values(locationData).forEach(location => {
    const distance = calculateDistance(userLat, userLng, location.latitude, location.longitude);
    
    if (distance <= radiusKm) {
      const risk = calculateLocationRiskLevel(location, locationData);
      const topCrimes = getTopCrimes(location, 3);
      
      nearbyLocations.push({
        name: location.name,
        distance: parseFloat(distance.toFixed(2)),
        risk,
        recentCrimes: location.recentCrimes,
        topCrimes,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        }
      });
    }
  });
  
  // Sort by distance
  nearbyLocations.sort((a, b) => a.distance - b.distance);
  
  // Find closest high-risk location
  const highRiskNearby = nearbyLocations.find(loc => 
    loc.risk.priority >= 4 // critical or high
  );
  
  // Determine overall alert level
  let alertLevel = 'safe';
  let alertMessage = 'You are in a relatively safe area.';
  let alertColor = '#059669';
  
  if (nearbyLocations.length > 0) {
    const closestLocation = nearbyLocations[0];
    
    if (highRiskNearby && highRiskNearby.distance < 2) {
      alertLevel = 'danger';
      alertMessage = `⚠️ WARNING: You are ${highRiskNearby.distance}km from ${highRiskNearby.name}, a HIGH RISK area with ${highRiskNearby.recentCrimes} recent crimes. Stay alert!`;
      alertColor = '#DC2626';
    } else if (closestLocation.risk.priority >= 3) {
      alertLevel = 'caution';
      alertMessage = `⚡ CAUTION: You are ${closestLocation.distance}km from ${closestLocation.name}. Crime risk is ${closestLocation.risk.level}. Stay aware of surroundings.`;
      alertColor = '#F59E0B';
    } else {
      alertLevel = 'safe';
      alertMessage = `✓ You are in a relatively safe area. Nearest location: ${closestLocation.name} (${closestLocation.distance}km away).`;
      alertColor = '#10B981';
    }
  }
  
  return {
    success: true,
    alertLevel,
    alertMessage,
    alertColor,
    userLocation: {
      latitude: userLat,
      longitude: userLng
    },
    nearbyLocations,
    detectedAt: new Date().toISOString()
  };
}

// Get all locations with risk levels
export function getAllLocationRisks(locationData) {
  const locations = Object.values(locationData).map(location => {
    const risk = calculateLocationRiskLevel(location, locationData);
    const topCrimes = getTopCrimes(location, 3);
    
    return {
      name: location.name,
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      risk,
      totalCrimes: location.totalCrimes,
      recentCrimes: location.recentCrimes,
      topCrimes
    };
  });
  
  // Sort by risk priority (highest first)
  return locations.sort((a, b) => b.risk.priority - a.risk.priority);
}
