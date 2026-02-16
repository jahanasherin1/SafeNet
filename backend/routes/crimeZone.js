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
    console.log('Loading crime data from CSV...');
    crimeDataCache = parseCrimeData();
    cacheTimestamp = now;
  }
  return crimeDataCache;
}

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
      // Try to get coordinates from city coordinates file or use average
      let lat = 11.2588; // Default: approx center of Kerala
      let lng = 75.7139;
      
      // Parse from city name if multiple entries, use the last known coordinates
      // We'll extract coordinates from the original CSV data differently
      // For now, we'll use the city's data to calculate intensity
      
      const riskLevel = calculateRiskLevel(data);
      
      // Calculate intensity (0-1) based on recent crimes
      const intensity = Math.min(data.recentYearCrimes / maxCrimes, 1);
      
      // Map intensity to color (green -> orange -> red)
      let color;
      if (intensity < 0.33) {
        color = '#00AA00'; // Green
      } else if (intensity < 0.66) {
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
    // Parse raw CSV to get actual coordinates
    const fs = await import('fs').then(m => m.default);
    const path = await import('path').then(m => m.default);
    const { fileURLToPath } = await import('url').then(m => m.default);
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const csvPath = path.join(__dirname, '../crime-data-coordinates.csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Collect unique locations with crime counts
    const locationMap = {};
    const dataLines = lines.slice(1); // Skip header
    
    dataLines.forEach(line => {
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!values || values.length < 6) return;
      
      const [city, lat, lng, crimeType, year, count] = values.map(v => v.replace(/^"|"$/g, '').trim());
      
      if (!lat || !lng) return;
      
      const key = `${lat},${lng}`;
      if (!locationMap[key]) {
        locationMap[key] = {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          city,
          totalCrimes: 0,
          recentCrimes: 0
        };
      }
      
      const crimeCount = parseInt(count) || 0;
      const yearNum = parseInt(year);
      
      locationMap[key].totalCrimes += crimeCount;
      if (yearNum >= 2024) {
        locationMap[key].recentCrimes += crimeCount;
      }
    });
    
    // Convert to array and calculate intensity
    const points = Object.values(locationMap);
    
    let maxCrimes = Math.max(...points.map(p => p.recentCrimes));
    maxCrimes = Math.max(maxCrimes, 1);
    
    const heatmapPoints = points.map(point => {
      const intensity = Math.min(point.recentCrimes / maxCrimes, 1);
      
      let color;
      if (intensity <= 0.33) {
        color = '#00AA00'; // Green
      } else if (intensity <= 0.66) {
        color = '#FFAA00'; // Orange
      } else {
        color = '#FF0000'; // Red
      }
      
      return {
        ...point,
        intensity,
        color
      };
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
