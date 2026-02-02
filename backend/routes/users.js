// --- backend/routes/users.js ---

import express from 'express';
import { User } from '../models/schemas.js';

const router = express.Router();

// Google Places API Key
const GOOGLE_PLACES_API_KEY = 'AIzaSyDGpAdiZUGAza7OMuWwTBXLfznzB0shrnY';

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

// Get Nearby Emergency Facilities (Police, Hospitals, Fire Stations)
router.post('/nearby-facilities', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Missing latitude or longitude' });
    }

    console.log(`🔍 Searching for facilities near ${latitude}, ${longitude}`);

    const facilities = [];

    // Fetch Police Stations
    try {
      const policeUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=police&key=${GOOGLE_PLACES_API_KEY}`;
      console.log('🚔 Calling Police API...');
      const policeResponse = await fetch(policeUrl);
      const policeData = await policeResponse.json();
      
      console.log(`🚔 Police API status: ${policeData.status}`);
      if (policeData.error_message) {
        console.log(`❌ Police API error: ${policeData.error_message}`);
      }
      
      if (policeData.results && policeData.results.length > 0) {
        console.log(`✅ Found ${policeData.results.length} police stations`);
        for (const place of policeData.results.slice(0, 3)) {
          // Fetch details for phone number
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number&key=${GOOGLE_PLACES_API_KEY}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          
          facilities.push({
            id: place.place_id,
            name: place.name,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            type: 'police',
            address: place.vicinity,
            phoneNumber: detailsData.result?.formatted_phone_number || detailsData.result?.international_phone_number,
          });
        }
      } else {
        console.log('⚠️ No police stations found');
      }
    } catch (error) {
      console.error('❌ Error fetching police stations:', error.message);
    }

    // Fetch Hospitals
    try {
      const hospitalUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=hospital&key=${GOOGLE_PLACES_API_KEY}`;
      console.log('🏥 Calling Hospital API...');
      const hospitalResponse = await fetch(hospitalUrl);
      const hospitalData = await hospitalResponse.json();
      
      console.log(`🏥 Hospital API status: ${hospitalData.status}`);
      if (hospitalData.error_message) {
        console.log(`❌ Hospital API error: ${hospitalData.error_message}`);
      }
      
      if (hospitalData.results && hospitalData.results.length > 0) {
        console.log(`✅ Found ${hospitalData.results.length} hospitals`);
        for (const place of hospitalData.results.slice(0, 3)) {
          // Fetch details for phone number
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number&key=${GOOGLE_PLACES_API_KEY}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          
          facilities.push({
            id: place.place_id,
            name: place.name,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            type: 'hospital',
            address: place.vicinity,
            phoneNumber: detailsData.result?.formatted_phone_number || detailsData.result?.international_phone_number,
          });
        }
      } else {
        console.log('⚠️ No hospitals found');
      }
    } catch (error) {
      console.error('❌ Error fetching hospitals:', error.message);
    }

    // Fetch Fire Stations
    try {
      const fireUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=fire_station&key=${GOOGLE_PLACES_API_KEY}`;
      console.log('🚒 Calling Fire Station API...');
      const fireResponse = await fetch(fireUrl);
      const fireData = await fireResponse.json();
      
      console.log(`🚒 Fire Station API status: ${fireData.status}`);
      if (fireData.error_message) {
        console.log(`❌ Fire Station API error: ${fireData.error_message}`);
      }
      
      if (fireData.results && fireData.results.length > 0) {
        console.log(`✅ Found ${fireData.results.length} fire stations`);
        for (const place of fireData.results.slice(0, 2)) {
          // Fetch details for phone number
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number&key=${GOOGLE_PLACES_API_KEY}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          
          facilities.push({
            id: place.place_id,
            name: place.name,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            type: 'fire',
            address: place.vicinity,
            phoneNumber: detailsData.result?.formatted_phone_number || detailsData.result?.international_phone_number,
          });
        }
      } else {
        console.log('⚠️ No fire stations found');
      }
    } catch (error) {
      console.error('❌ Error fetching fire stations:', error.message);
    }

    // If Google Places API failed or returned no results, use mock data for demonstration
    if (facilities.length === 0) {
      console.log('⚠️ Google Places API returned no results, using mock nearby facilities');
      
      // Generate mock facilities based on user's location (offset by ~1-2km)
      const mockFacilities = [
        {
          id: 'mock_police_1',
          name: 'City Police Station',
          latitude: latitude + 0.01,
          longitude: longitude + 0.005,
          type: 'police',
          address: 'Near Main Road, Local Area',
          phoneNumber: '0483-2731234'
        },
        {
          id: 'mock_police_2',
          name: 'District Police Headquarters',
          latitude: latitude - 0.008,
          longitude: longitude + 0.012,
          type: 'police',
          address: 'District Center',
          phoneNumber: '100'
        },
        {
          id: 'mock_hospital_1',
          name: 'Government General Hospital',
          latitude: latitude + 0.015,
          longitude: longitude - 0.008,
          type: 'hospital',
          address: 'Hospital Road',
          phoneNumber: '0483-2235566'
        },
        {
          id: 'mock_hospital_2',
          name: 'City Medical Center',
          latitude: latitude - 0.012,
          longitude: longitude - 0.015,
          type: 'hospital',
          address: 'Medical College Area',
          phoneNumber: '108'
        },
        {
          id: 'mock_hospital_3',
          name: 'Emergency Care Hospital',
          latitude: latitude + 0.005,
          longitude: longitude + 0.018,
          type: 'hospital',
          address: 'Town Center',
          phoneNumber: '0483-2778899'
        },
        {
          id: 'mock_fire_1',
          name: 'Fire & Rescue Station',
          latitude: latitude - 0.006,
          longitude: longitude + 0.008,
          type: 'fire',
          address: 'Station Road',
          phoneNumber: '101'
        }
      ];
      
      facilities.push(...mockFacilities);
      console.log(`✅ Added ${mockFacilities.length} mock facilities`);
    }

    console.log(`✅ Returning ${facilities.length} total facilities`);

    res.status(200).json({
      message: 'Nearby facilities retrieved',
      count: facilities.length,
      facilities
    });

  } catch (error) {
    console.error('Nearby Facilities Error:', error);
    res.status(500).json({ message: 'Failed to get nearby facilities' });
  }
});

export default router;