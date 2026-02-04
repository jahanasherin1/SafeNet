// backend/routes/crimeChance.js
import express from 'express';
import {
    getAllCrimeTypeStats,
    getCrimeChancesAtLocation,
    parseCrimeChanceData
} from '../utils/crimeChanceAnalytics.js';

const router = express.Router();

// Cache crime data in memory
let crimeDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

function getCrimeData() {
  const now = Date.now();
  if (!crimeDataCache || !cacheTimestamp || (now - cacheTimestamp > CACHE_DURATION)) {
    console.log('Loading crime chance data from crime-data-coordinates.csv...');
    crimeDataCache = parseCrimeChanceData();
    cacheTimestamp = now;
  }
  return crimeDataCache;
}

// Force reload cache (for development/testing)
router.post('/reload-cache', async (req, res) => {
  try {
    console.log('Force reloading crime data cache...');
    crimeDataCache = null;
    cacheTimestamp = null;
    const newData = getCrimeData();
    res.status(200).json({
      success: true,
      message: 'Cache reloaded successfully',
      locationCount: Object.keys(newData.locationData).length,
      crimeTypeCount: Object.keys(newData.crimeTypeRanges).length
    });
  } catch (error) {
    console.error('Error reloading cache:', error);
    res.status(500).json({
      success: false,
      message: 'Error reloading cache',
      error: error.message
    });
  }
});

// POST - Get crime chances at specific location
router.post('/at-location', async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and longitude are required' 
      });
    }
    
    const { locationData, crimeTypeRanges } = getCrimeData();
    const radiusKm = radius || 3; // Default 3km radius
    
    const crimeChances = getCrimeChancesAtLocation(
      parseFloat(latitude), 
      parseFloat(longitude), 
      locationData,
      crimeTypeRanges,
      radiusKm
    );
    
    res.status(200).json(crimeChances);
  } catch (error) {
    console.error('Error getting crime chances:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting crime chances', 
      error: error.message 
    });
  }
});

// GET - Get all crime type statistics
router.get('/stats', async (req, res) => {
  try {
    const { crimeTypeRanges } = getCrimeData();
    const stats = getAllCrimeTypeStats(crimeTypeRanges);
    
    res.status(200).json({
      success: true,
      totalCrimeTypes: stats.length,
      crimeTypes: stats
    });
  } catch (error) {
    console.error('Error getting crime type stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting crime type stats', 
      error: error.message 
    });
  }
});

export default router;
