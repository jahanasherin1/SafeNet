// backend/utils/crimeAnalytics.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load city coordinates
let cityCoordinates = null;
function loadCityCoordinates() {
  if (!cityCoordinates) {
    try {
      const coordPath = path.join(__dirname, '../city-coordinates.json');
      const coordData = fs.readFileSync(coordPath, 'utf-8');
      cityCoordinates = JSON.parse(coordData);
    } catch (error) {
      console.error('Error loading city coordinates:', error);
      cityCoordinates = {};
    }
  }
  return cityCoordinates;
}

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

// Parse CSV file and calculate crime statistics
export function parseCrimeData() {
  try {
    const csvPath = path.join(__dirname, '../crime-data-coordinates.csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    const crimeByCity = {};
    
    dataLines.forEach(line => {
      const [city, crimeType, year, count] = line.split(',').map(s => s.trim());
      
      if (!city || !crimeType || !year || !count) return;
      
      // Initialize city data
      if (!crimeByCity[city]) {
        crimeByCity[city] = {
          totalCrimes: 0,
          recentYearCrimes: 0,
          crimeTypes: {},
          years: {}
        };
      }
      
      const crimeCount = parseInt(count) || 0;
      const yearNum = parseInt(year);
      
      // Aggregate total crimes
      crimeByCity[city].totalCrimes += crimeCount;
      
      // Track recent years (2024-2025)
      if (yearNum >= 2024) {
        crimeByCity[city].recentYearCrimes += crimeCount;
      }
      
      // Track by crime type
      if (!crimeByCity[city].crimeTypes[crimeType]) {
        crimeByCity[city].crimeTypes[crimeType] = 0;
      }
      crimeByCity[city].crimeTypes[crimeType] += crimeCount;
      
      // Track by year
      if (!crimeByCity[city].years[year]) {
        crimeByCity[city].years[year] = 0;
      }
      crimeByCity[city].years[year] += crimeCount;
    });
    
    return crimeByCity;
  } catch (error) {
    console.error('Error parsing crime data:', error);
    return {};
  }
}

// Calculate risk level for a city (dynamic based on data range)
export function calculateRiskLevel(cityData, allCrimeData = null) {
  if (!cityData || !cityData.recentYearCrimes) {
    return { level: 'unknown', score: 0, color: '#808080', priority: 6 };
  }
  
  const recentCrimes = cityData.recentYearCrimes;
  
  // If we have all crime data, calculate dynamic thresholds
  if (allCrimeData) {
    const allRecentCrimes = Object.values(allCrimeData)
      .map(city => city.recentYearCrimes)
      .filter(count => count > 0)
      .sort((a, b) => a - b);
    
    if (allRecentCrimes.length === 0) {
      return { level: 'unknown', score: 0, color: '#808080', priority: 6 };
    }
    
    const min = allRecentCrimes[0];
    const max = allRecentCrimes[allRecentCrimes.length - 1];
    const range = max - min;
    
    // Calculate normalized score (0-100)
    const normalizedScore = range > 0 ? Math.round(((recentCrimes - min) / range) * 100) : 50;
    
    // Determine risk level based on quintiles
    let level, color, priority;
    if (normalizedScore >= 80) {
      level = 'critical';
      color = '#DC2626';
      priority = 1;
    } else if (normalizedScore >= 60) {
      level = 'high';
      color = '#EA580C';
      priority = 2;
    } else if (normalizedScore >= 40) {
      level = 'moderate';
      color = '#F59E0B';
      priority = 3;
    } else if (normalizedScore >= 20) {
      level = 'low';
      color = '#10B981';
      priority = 4;
    } else {
      level = 'very low';
      color = '#059669';
      priority = 5;
    }
    
    return { level, score: normalizedScore, color, priority };
  }
  
  // Fallback to static thresholds if no comparison data available
  if (recentCrimes > 1500) {
    return { level: 'critical', score: 90, color: '#DC2626', priority: 1 };
  } else if (recentCrimes > 1000) {
    return { level: 'high', score: 70, color: '#EA580C', priority: 2 };
  } else if (recentCrimes > 500) {
    return { level: 'moderate', score: 50, color: '#F59E0B', priority: 3 };
  } else if (recentCrimes > 200) {
    return { level: 'low', score: 30, color: '#10B981', priority: 4 };
  } else {
    return { level: 'very low', score: 10, color: '#059669', priority: 5 };
  }
}

// Get top crime types for a city
export function getTopCrimeTypes(cityData, limit = 5) {
  if (!cityData || !cityData.crimeTypes) return [];
  
  const crimeTypes = Object.entries(cityData.crimeTypes)
    .filter(([type]) => type !== 'Total cognizable crimes')
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  return crimeTypes;
}

// Calculate crime trend (increasing/decreasing)
export function calculateTrend(cityData) {
  if (!cityData || !cityData.years) return { direction: 'stable', percentage: 0 };
  
  const years = Object.keys(cityData.years).map(Number).sort();
  if (years.length < 2) return { direction: 'stable', percentage: 0 };
  
  const recentYear = years[years.length - 1];
  const previousYear = years[years.length - 2];
  
  const recentCount = cityData.years[recentYear];
  const previousCount = cityData.years[previousYear];
  
  if (!previousCount || previousCount === 0) return { direction: 'stable', percentage: 0 };
  
  const percentage = ((recentCount - previousCount) / previousCount) * 100;
  
  let direction = 'stable';
  if (percentage > 5) direction = 'increasing';
  else if (percentage < -5) direction = 'decreasing';
  
  return { direction, percentage: Math.abs(percentage).toFixed(1) };
}

// Find matching city from location coordinates (more accurate)
export function findCityFromCoordinates(latitude, longitude) {
  const coordinates = loadCityCoordinates();
  
  if (!latitude || !longitude || !coordinates) return null;
  
  let closestCity = null;
  let minDistance = Infinity;
  
  // First try: Check if coordinates fall within city bounds
  for (const [city, data] of Object.entries(coordinates)) {
    if (data.bounds) {
      const { north, south, east, west } = data.bounds;
      if (latitude >= south && latitude <= north && 
          longitude >= west && longitude <= east) {
        return city; // Exact match within bounds
      }
    }
  }
  
  // Second try: Find closest city by distance
  for (const [city, data] of Object.entries(coordinates)) {
    const distance = calculateDistance(latitude, longitude, data.latitude, data.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  }
  
  // Only return if within reasonable distance (50km)
  return minDistance < 50 ? closestCity : null;
}

// Find matching city from location string (fallback)
export function findCityFromLocation(locationString, crimeData) {
  if (!locationString || !crimeData) return null;
  
  const locationLower = locationString.toLowerCase();
  const cities = Object.keys(crimeData);
  
  // Direct match
  for (const city of cities) {
    if (locationLower.includes(city.toLowerCase())) {
      return city;
    }
  }
  
  // Partial match
  for (const city of cities) {
    const cityWords = city.toLowerCase().split(' ');
    for (const word of cityWords) {
      if (word.length > 3 && locationLower.includes(word)) {
        return city;
      }
    }
  }
  
  return null;
}

// Get zone alert for a specific location
export function getZoneAlert(latitude, longitude, address, crimeData) {
  // Try coordinate-based matching first (more accurate)
  let city = findCityFromCoordinates(latitude, longitude);
  
  // Fallback to address string matching
  if (!city) {
    city = findCityFromLocation(address, crimeData);
  }
  
  if (!city || !crimeData[city]) {
    return {
      success: false,
      message: 'No crime data available for this location',
      detectedCity: city
    };
  }
  
  const cityData = crimeData[city];
  const coordinates = loadCityCoordinates();
  const cityCoords = coordinates[city] || { latitude: null, longitude: null };
  const riskLevel = calculateRiskLevel(cityData, crimeData); // Pass all data for dynamic calculation
  const topCrimes = getTopCrimeTypes(cityData, 3);
  const trend = calculateTrend(cityData);
  
  return {
    success: true,
    city,
    location: {
      latitude,
      longitude,
      address,
      cityCenter: {
        latitude: cityCoords.latitude,
        longitude: cityCoords.longitude
      }
    },
    risk: riskLevel,
    statistics: {
      totalCrimes: cityData.totalCrimes,
      recentCrimes: cityData.recentYearCrimes,
      topCrimes,
      trend
    },
    alert: generateAlertMessage(city, riskLevel, topCrimes, trend)
  };
}

// Generate alert message
function generateAlertMessage(city, riskLevel, topCrimes, trend) {
  let message = `${city} has ${riskLevel.level.toUpperCase()} crime risk. `;
  
  if (topCrimes.length > 0) {
    const topCrimeTypes = topCrimes.map(c => c.type).slice(0, 2).join(' and ');
    message += `Most common: ${topCrimeTypes}. `;
  }
  
  if (trend.direction === 'increasing') {
    message += `⚠️ Crimes are increasing by ${trend.percentage}%.`;
  } else if (trend.direction === 'decreasing') {
    message += `✓ Crimes are decreasing by ${trend.percentage}%.`;
  }
  
  return message;
}

// Get all city risk levels (for overview)
export function getAllCityRiskLevels(crimeData) {
  // First pass: collect all data for dynamic risk calculation
  const cities = Object.entries(crimeData).map(([city, data]) => ({
    city,
    data,
    recentCrimes: data.recentYearCrimes,
    trend: calculateTrend(data)
  }));
  
  // Second pass: calculate risk levels with full context
  return cities.map(({ city, data, recentCrimes, trend }) => ({
    city,
    risk: calculateRiskLevel(data, crimeData), // Pass all data for dynamic calculation
    recentCrimes,
    trend
  })).sort((a, b) => a.risk.priority - b.risk.priority);
}
