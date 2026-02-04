// backend/routes/proximityAlerts.js
import express from 'express';
import {
    checkProximityAlert,
    getAllLocationRisks,
    parseProximityCrimeData
} from '../utils/proximityAlerts.js';

const router = express.Router();

// Cache crime data in memory
let crimeDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

function getCrimeData() {
  const now = Date.now();
  if (!crimeDataCache || !cacheTimestamp || (now - cacheTimestamp > CACHE_DURATION)) {
    console.log('Loading proximity crime data from crime-data-coordinates.csv...');
    crimeDataCache = parseProximityCrimeData();
    cacheTimestamp = now;
  }
  return crimeDataCache;
}

// POST - Check proximity alert for user location
router.post('/check', async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and longitude are required' 
      });
    }
    
    const crimeData = getCrimeData();
    const radiusKm = radius || 5; // Default 5km radius
    
    const proximityAlert = checkProximityAlert(
      parseFloat(latitude), 
      parseFloat(longitude), 
      crimeData,
      radiusKm
    );
    
    res.status(200).json(proximityAlert);
  } catch (error) {
    console.error('Error checking proximity alert:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking proximity alert', 
      error: error.message 
    });
  }
});

// GET - Get all locations with risk levels
router.get('/locations', async (req, res) => {
  try {
    const crimeData = getCrimeData();
    const locations = getAllLocationRisks(crimeData);
    
    res.status(200).json({
      success: true,
      totalLocations: locations.length,
      locations
    });
  } catch (error) {
    console.error('Error getting location risks:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting location risks', 
      error: error.message 
    });
  }
});

// GET - Get specific location details
router.get('/location/:locationName', async (req, res) => {
  try {
    const { locationName } = req.params;
    const crimeData = getCrimeData();
    
    const location = crimeData[locationName];
    
    if (!location) {
      return res.status(404).json({
        success: false,
        message: `Location '${locationName}' not found`
      });
    }
    
    const allLocations = getAllLocationRisks(crimeData);
    const locationRisk = allLocations.find(loc => loc.name === locationName);
    
    res.status(200).json({
      success: true,
      location: locationRisk
    });
  } catch (error) {
    console.error('Error getting location details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting location details', 
      error: error.message 
    });
  }
});

export default router;
