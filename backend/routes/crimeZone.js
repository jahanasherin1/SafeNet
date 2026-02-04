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

export default router;
