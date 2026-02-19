// backend/utils/crimeChanceAnalytics.js
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

// Parse crime-data-coordinates.csv and organize by crime type
export function parseCrimeChanceData() {
  try {
    const csvPath = path.join(__dirname, '../crime-data-coordinates.csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Skip header: City,Latitude,Longitude,Crime_Type,Year,Count
    const dataLines = lines.slice(1);
    
    const locationData = {};
    const crimeTypeRanges = {}; // Track min/max for each crime type
    
    dataLines.forEach(line => {
      // Parse CSV line handling quoted values
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!values || values.length < 6) return;
      
      const [city, lat, lng, crimeType, year, count] = values.map(v => v.replace(/^"|"$/g, '').trim());
      
      if (!city || !lat || !lng || !crimeType || !year || !count) return;
      
      const crimeCount = parseInt(count) || 0;
      const yearNum = parseInt(year);
      
      // Initialize location data
      if (!locationData[city]) {
        locationData[city] = {
          name: city,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          crimeTypes: {},
          recentCrimesByType: {},
          totalCrimes: 0,
          recentCrimes: 0
        };
      }
      
      // Track by crime type
      if (!locationData[city].crimeTypes[crimeType]) {
        locationData[city].crimeTypes[crimeType] = {
          total: 0,
          recent: 0,
          years: {}
        };
      }
      
      locationData[city].crimeTypes[crimeType].total += crimeCount;
      locationData[city].crimeTypes[crimeType].years[year] = crimeCount;
      locationData[city].totalCrimes += crimeCount;
      
      // Track recent years (2024-2025)
      if (yearNum >= 2024) {
        locationData[city].crimeTypes[crimeType].recent += crimeCount;
        locationData[city].recentCrimes += crimeCount;
        
        if (!locationData[city].recentCrimesByType[crimeType]) {
          locationData[city].recentCrimesByType[crimeType] = 0;
        }
        locationData[city].recentCrimesByType[crimeType] += crimeCount;
      }
      
      // Track ranges for each crime type (recent years only)
      if (yearNum >= 2024) {
        if (!crimeTypeRanges[crimeType]) {
          crimeTypeRanges[crimeType] = { min: Infinity, max: 0, total: 0, count: 0 };
        }
        if (crimeCount > 0) {
          crimeTypeRanges[crimeType].min = Math.min(crimeTypeRanges[crimeType].min, crimeCount);
          crimeTypeRanges[crimeType].max = Math.max(crimeTypeRanges[crimeType].max, crimeCount);
          crimeTypeRanges[crimeType].total += crimeCount;
          crimeTypeRanges[crimeType].count++;
        }
      }
    });
    
    return { locationData, crimeTypeRanges };
  } catch (error) {
    console.error('Error parsing crime chance data:', error);
    return { locationData: {}, crimeTypeRanges: {} };
  }
}

// Extract unique locations for fast nearest lookup
function extractLocationsFromData(locationData) {
  const locations = [];
  Object.values(locationData).forEach(location => {
    locations.push({
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude
    });
  });
  return locations;
}

// Find the nearest location by coordinates
function findNearestLocation(userLat, userLng, locations) {
  let nearestLocation = null;
  let minDistance = Infinity;
  
  locations.forEach(location => {
    const distance = calculateDistance(userLat, userLng, location.latitude, location.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = {
        ...location,
        distance
      };
    }
  });
  
  return nearestLocation;
}

// Calculate crime type chance/probability
function calculateCrimeChance(crimeCount, crimeTypeRange) {
  if (!crimeTypeRange || crimeTypeRange.max === 0) {
    return {
      chance: 0,
      level: 'very low',
      color: '#059669',
      percentage: '0%'
    };
  }
  
  const { min, max } = crimeTypeRange;
  
  // Normalize to 0-100 scale
  let score = 0;
  if (max > min) {
    score = ((crimeCount - min) / (max - min)) * 100;
  } else if (crimeCount > 0) {
    score = 100;
  }
  
  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));
  
  // Determine chance level
  let level, color, percentage;
  if (score >= 80) {
    level = 'very high';
    color = '#DC2626';
    percentage = `${Math.round(score)}%`;
  } else if (score >= 60) {
    level = 'high';
    color = '#EA580C';
    percentage = `${Math.round(score)}%`;
  } else if (score >= 40) {
    level = 'moderate';
    color = '#F59E0B';
    percentage = `${Math.round(score)}%`;
  } else if (score >= 20) {
    level = 'low';
    color = '#10B981';
    percentage = `${Math.round(score)}%`;
  } else {
    level = 'very low';
    color = '#059669';
    percentage = `${Math.round(score)}%`;
  }
  
  return {
    chance: Math.round(score),
    level,
    color,
    percentage
  };
}

// Get crime chances for user's location
export function getCrimeChancesAtLocation(userLat, userLng, locationData, crimeTypeRanges, radiusKm = 3) {
  // Extract all locations with coordinates for nearest lookup
  const locations = extractLocationsFromData(locationData);
  
  // Find the nearest location (regardless of distance)
  const nearestLocationInfo = findNearestLocation(userLat, userLng, locations);
  
  if (!nearestLocationInfo) {
    return {
      success: false,
      message: 'No crime data available for your location'
    };
  }
  
  // Get full location data from the nearest location name
  const locationName = nearestLocationInfo.name;
  const closestLocation = locationData[locationName];
  
  if (!closestLocation) {
    return {
      success: false,
      message: 'No crime data available for your location'
    };
  }
  
  const minDistance = nearestLocationInfo.distance;
  let isExpandedSearch = false;
  
  // Check if we're using expanded search (location beyond initial radius)
  if (minDistance > radiusKm) {
    isExpandedSearch = true;
  }
  
  // Calculate chances for each crime type
  const crimeChances = [];
  Object.entries(closestLocation.recentCrimesByType || {}).forEach(([crimeType, count]) => {
    const range = crimeTypeRanges[crimeType];
    const chanceData = calculateCrimeChance(count, range);
    
    crimeChances.push({
      crimeType,
      count,
      ...chanceData,
      range: range ? { min: range.min, max: range.max } : { min: 0, max: 0 }
    });
  });
  
  // Sort by chance (highest first), then by count
  crimeChances.sort((a, b) => {
    if (b.chance === a.chance) {
      return b.count - a.count;
    }
    return b.chance - a.chance;
  });
  
  // Calculate overall risk
  const totalRecentCrimes = closestLocation.recentCrimes || 0;
  const avgChance = crimeChances.length > 0 
    ? Math.round(crimeChances.reduce((sum, c) => sum + c.chance, 0) / crimeChances.length)
    : 0;
  
  let overallRisk;
  if (avgChance >= 70) {
    overallRisk = { level: 'Critical', color: '#DC2626', icon: 'warning' };
  } else if (avgChance >= 50) {
    overallRisk = { level: 'High', color: '#EA580C', icon: 'alert-circle' };
  } else if (avgChance >= 30) {
    overallRisk = { level: 'Moderate', color: '#F59E0B', icon: 'alert' };
  } else {
    overallRisk = { level: 'Low', color: '#10B981', icon: 'checkmark-circle' };
  }
  
  return {
    success: true,
    location: {
      name: closestLocation.name,
      distance: parseFloat(minDistance.toFixed(2)),
      coordinates: {
        latitude: closestLocation.latitude,
        longitude: closestLocation.longitude
      }
    },
    overallRisk: {
      ...overallRisk,
      avgChance,
      totalRecentCrimes
    },
    crimeChances,
    isExpandedSearch,
    searchNote: isExpandedSearch ? `Showing data from nearest location (${closestLocation.name}). No crime data available within ${radiusKm}km radius.` : `Crime data within ${radiusKm}km radius`,
    detectedAt: new Date().toISOString()
  };
}

// Get all crime type statistics
export function getAllCrimeTypeStats(crimeTypeRanges) {
  const stats = Object.entries(crimeTypeRanges).map(([crimeType, range]) => ({
    crimeType,
    minCases: range.min === Infinity ? 0 : range.min,
    maxCases: range.max,
    avgCases: range.count > 0 ? Math.round(range.total / range.count) : 0,
    totalCases: range.total
  }));
  
  return stats.sort((a, b) => b.totalCases - a.totalCases);
}
