// backend/routes/crimeZone.js
import express from 'express';
import {
    calculateRiskLevel,
    calculateTrend,
    getAllCityRiskLevels,
    getTopCrimeTypes,
    getZoneAlert,
    parseCrimeData
} from '../utils/crimeAnalytics.js';

const router = express.Router();

// Cache crime data in memory
let crimeDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

function getCrimeData() {
  const now = Date.now();
  if (!crimeDataCache || !cacheTimestamp || (now - cacheTimestamp > CACHE_DURATION)) {
    console.log('🔄 Loading crime data from CSV...');
    crimeDataCache = parseCrimeData();
    cacheTimestamp = now;
    console.log(`✅ Loaded ${Object.keys(crimeDataCache).length} crime locations`);
  }
  return crimeDataCache;
}

// Clear cache endpoint (for development/testing)
router.post('/clear-cache', (req, res) => {
  crimeDataCache = null;
  cacheTimestamp = null;
  console.log('🗑️ Crime data cache cleared');
  res.json({ success: true, message: 'Cache cleared successfully' });
});

// GET zone alert for specific location
router.post('/zone-alert', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and longitude are required' 
      });
    }
    
    const crimeData = getCrimeData();
    const zoneAlert = getZoneAlert(latitude, longitude, address || '', crimeData);
    
    res.status(200).json(zoneAlert);
  } catch (error) {
    console.error('Error generating zone alert:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating zone alert', 
      error: error.message 
    });
  }
});

// GET all city risk levels
router.get('/city-risks', async (req, res) => {
  try {
    const crimeData = getCrimeData();
    const cityRisks = getAllCityRiskLevels(crimeData);
    
    // Add top crimes for each city
    const citiesWithDetails = cityRisks.map(city => ({
      ...city,
      topCrimes: getTopCrimeTypes(crimeData[city.city], 3)
    }));
    
    res.status(200).json({
      success: true,
      cities: citiesWithDetails,
      totalCities: citiesWithDetails.length
    });
  } catch (error) {
    console.error('Error fetching city risks:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching city risks', 
      error: error.message 
    });
  }
});

// GET detailed stats for a specific city
router.get('/city/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    const crimeData = getCrimeData();
    
    const cityData = crimeData[cityName];
    if (!cityData) {
      return res.status(404).json({
        success: false,
        message: `No crime data found for ${cityName}`
      });
    }
    
    const riskLevel = calculateRiskLevel(cityData);
    const topCrimes = getTopCrimeTypes(cityData, 10);
    const trend = calculateTrend(cityData);
    
    res.status(200).json({
      success: true,
      city: cityName,
      risk: riskLevel,
      statistics: {
        totalCrimes: cityData.totalCrimes,
        recentCrimes: cityData.recentYearCrimes,
        topCrimes,
        trend,
        yearlyData: cityData.years,
        crimeTypes: cityData.crimeTypes
      }
    });
  } catch (error) {
    console.error('Error fetching city details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching city details', 
      error: error.message 
    });
  }
});

// GET available cities
router.get('/cities', async (req, res) => {
  try {
    const crimeData = getCrimeData();
    const cities = Object.keys(crimeData).sort();
    
    res.status(200).json({
      success: true,
      cities,
      totalCities: cities.length
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching cities', 
      error: error.message 
    });
  }
});

// GET heatmap data for visualization
router.get('/heatmap', async (req, res) => {
  try {
    const crimeData = getCrimeData();
    
    // Convert crime data to array of points with intensity
    const heatmapPoints = [];
    
    // Get max crime count for normalization
    let maxCrimes = 0;
    Object.entries(crimeData).forEach(([city, data]) => {
      if (data.recentYearCrimes > maxCrimes) {
        maxCrimes = data.recentYearCrimes;
      }
    });
    
    // Ensure maxCrimes is at least 1 to avoid division by zero
    maxCrimes = Math.max(maxCrimes, 1);
    
    // Process each city and create heatmap points
    Object.entries(crimeData).forEach(([city, data]) => {
      // Use actual coordinates from parsed crime data
      const lat = data.latitude || 11.2588; // Fallback to Kerala default if missing
      const lng = data.longitude || 75.7139;
      
      // Skip if no valid coordinates
      if (!lat || !lng) return;
      
      const riskLevel = calculateRiskLevel(data);
      
      // Calculate intensity (0-1) based on recent crimes
      const intensity = Math.min(data.recentYearCrimes / maxCrimes, 1);
      
      // Map intensity to color (green -> orange -> red)
      let color;
      if (intensity <= 0.33) {
        color = '#00AA00'; // Green
      } else if (intensity <= 0.66) {
        color = '#FFAA00'; // Orange
      } else {
        color = '#FF0000'; // Red
      }
      
      heatmapPoints.push({
        city,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        intensity, // 0-1 normalized value
        color,
        recentCrimes: data.recentYearCrimes,
        totalCrimes: data.totalCrimes,
        riskLevel
      });
    });
    
    res.status(200).json({
      success: true,
      points: heatmapPoints,
      maxIntensity: 1,
      colorScale: {
        low: '#00AA00',     // Green
        medium: '#FFAA00',  // Orange
        high: '#FF0000'     // Red
      }
    });
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching heatmap data', 
      error: error.message 
    });
  }
});

// GET heatmap data with actual coordinates from crime CSV
router.get('/heatmap-coordinates', async (req, res) => {
  try {
    // Use the parsed crime data which now includes coordinates
    const crimeData = getCrimeData();
    
    // Convert crime data to array of points with intensity
    const heatmapPoints = [];
    
    // Get max crime count for normalization
    let maxCrimes = 0;
    Object.entries(crimeData).forEach(([city, data]) => {
      if (data.recentYearCrimes > maxCrimes) {
        maxCrimes = data.recentYearCrimes;
      }
    });
    
    // Ensure maxCrimes is at least 1 to avoid division by zero
    maxCrimes = Math.max(maxCrimes, 1);
    
    // Convert to array and calculate intensity with actual coordinates
    Object.entries(crimeData).forEach(([city, data]) => {
      // Use coordinates from parsed crime data
      if (!data.latitude || !data.longitude) return;
      
      const intensity = Math.min(data.recentYearCrimes / maxCrimes, 1);
      
      // Map intensity to color (green -> orange -> red)
      let color;
      if (intensity <= 0.33) {
        color = '#00AA00'; // Green
      } else if (intensity <= 0.66) {
        color = '#FFAA00'; // Orange
      } else {
        color = '#FF0000'; // Red
      }
      
      heatmapPoints.push({
        city,
        latitude: data.latitude,
        longitude: data.longitude,
        intensity,
        color,
        recentCrimes: data.recentYearCrimes,
        totalCrimes: data.totalCrimes
      });
    });
    
    res.status(200).json({
      success: true,
      points: heatmapPoints,
      totalPoints: heatmapPoints.length,
      colorScale: {
        low: '#00AA00',
        medium: '#FFAA00',
        high: '#FF0000'
      }
    });
  } catch (error) {
    console.error('Error fetching heatmap coordinates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching heatmap coordinates', 
      error: error.message 
    });
  }
});

export default router;
