# Weather-Based Safety Alerts Implementation Guide

## Overview

The SafeNet app now includes **real-time weather-based safety alerts** to help users avoid travel during hazardous conditions. The system analyzes current weather data and provides personalized recommendations based on multiple factors including temperature, wind speed, visibility, precipitation, and UV index.

## Features

### ✅ Real-Time Weather Monitoring
- **Live weather data** from Open-Meteo API (free, no authentication required)
- **Automatic weather fetching** when users check weather alerts
- **10-minute cache** to optimize API calls and battery usage
- **Current conditions display** with detailed metrics

### ✅ Intelligent Hazard Detection
The system detects and alerts users to multiple hazards:

| Hazard | Condition | Safety Level |
|--------|-----------|--------------|
| **Extreme Cold** | < -10°C | 🚫 Danger |
| **Cold** | 0°C to -10°C | 🔶 Warning |
| **Extreme Heat** | > 40°C | 🚫 Danger |
| **High Temperature** | 35-40°C | 🔶 Warning |
| **Dangerous Wind** | > 60 km/h | 🚫 Danger |
| **Severe Wind** | 50-60 km/h | 🔶 Warning |
| **Strong Wind** | 40-50 km/h | ⚠️ Caution |
| **Poor Visibility** | < 500 meters | 🔶 Warning |
| **Hazardous Visibility** | < 100 meters | 🚫 Danger |
| **Heavy Precipitation** | > 10 mm | 🔶 Warning |
| **Thunderstorms** | Weather code 95-99 | 🚫 Danger |
| **High UV Index** | > 8 | ⚠️ Caution |
| **Extreme UV** | > 11 | 🔶 Warning |

### ✅ Safety Levels
- **✅ Safe** - Conditions suitable for normal travel
- **⚠️ Caution** - Exercise care during travel
- **🔶 Warning** - Travel with extra care and precautions
- **🚫 Danger** - Not safe to travel; avoid if possible

### ✅ Travel Safety Indicator
Each alert includes a clear indicator:
- **Green**: Travel is generally safe
- **Red**: Travel is NOT recommended

### ✅ Personalized Recommendations
The system provides specific, actionable safety recommendations based on detected hazards:
- Temperature-specific advice (hydration, protective gear)
- Wind safety instructions
- Visibility precautions
- Precipitation handling
- UV protection tips
- Humidity considerations

## Architecture

### Services

#### **WeatherService.ts**
Handles all weather data fetching and caching.

```typescript
// Get current weather for specific coordinates
const weather = await WeatherService.getCurrentWeather(latitude, longitude);

// Get weather for current user location
const weather = await WeatherService.getWeatherForCurrentLocation();

// Get hourly forecast for 24 hours
const forecast = await WeatherService.getHourlyForecast(lat, lon, 24);

// Get cached weather (10-minute cache)
const weather = await WeatherService.getWeatherCached(lat, lon);
```

**Weather Data Structure:**
```typescript
interface WeatherData {
  temperature: number;           // Current temperature (°C)
  feelsLike: number;            // Apparent temperature (°C)
  humidity: number;              // Relative humidity (%)
  windSpeed: number;             // Wind speed (km/h)
  windGust?: number;             // Wind gust speed (km/h)
  weatherCondition: string;      // Description (e.g., "Heavy rain")
  weatherCode: string;           // WMO weather code
  visibility: number;            // Visibility (meters)
  pressure: number;              // Atmospheric pressure (hPa)
  uvIndex?: number;              // UV index (0-11+)
  precipitation?: number;        // Precipitation amount (mm)
  lastUpdated: Date;             // Data timestamp
}
```

#### **WeatherAlertService.ts**
Analyzes weather conditions and generates safety alerts.

```typescript
// Analyze weather and get safety alert
const alert = WeatherAlertService.analyzeWeather(weatherData);

// Returns WeatherAlert with:
// - level: 'safe' | 'caution' | 'warning' | 'danger'
// - title: User-friendly alert title
// - message: Description of conditions
// - recommendations: Array of safety recommendations
// - hazards: Array of detected hazards
// - isSafeToTravel: Boolean indicator
// - conditions: Current weather metrics
```

### Components

#### **WeatherAlertModal.tsx**
Full-screen modal displaying comprehensive weather alert information.

**Features:**
- Automatic location detection
- Real-time weather data fetching
- Hazard and recommendation lists
- Travel safety status indicator
- Safety tips section
- Refresh button to update data

**Usage:**
```typescript
import WeatherAlertModal from '../../components/WeatherAlertModal';

<WeatherAlertModal
  visible={visible}
  onDismiss={() => setVisible(false)}
  latitude={userLocation?.latitude}
  longitude={userLocation?.longitude}
/>
```

#### **WeatherAlertCard.tsx**
Reusable card component for displaying weather alerts in scrollable views.

**Features:**
- Color-coded by safety level
- Conditions grid display
- Hazards section
- Recommendations section
- Travel safety indicator
- Action buttons

**Usage:**
```typescript
<WeatherAlertCard
  alert={weatherAlert}
  onDismiss={() => { /* handle */ }}
  onLearnMore={() => { /* handle */ }}
/>
```

### Context Integration

The `SessionContext` now includes weather alert management:

```typescript
// Get weather alert state
const { 
  weatherAlertVisible, 
  setWeatherAlertVisible,
  enableWeatherAlerts,
  setEnableWeatherAlerts 
} = useSession();

// Show weather alert modal
setWeatherAlertVisible(true);

// Enable/disable weather alerts globally
await setEnableWeatherAlerts(true);

// Check if enabled
if (enableWeatherAlerts) {
  // Show weather alerts
}
```

## Usage Guide

### For Users

#### Checking Weather Safety
1. Go to **Live Location** screen
2. Tap the **☁️ weather icon** in the top-right corner
3. View current weather conditions and safety alert
4. Read hazards and recommendations
5. Check the travel safety indicator
6. Tap **Refresh** to update data

#### Understanding Safety Levels
- **✅ Safe**: Safe to travel under normal precautions
- **⚠️ Caution**: Use extra care; conditions require attention
- **🔶 Warning**: Travel only if necessary; high risk
- **🚫 Danger**: Avoid travel; conditions are hazardous

### For Developers

#### Integrating Weather Alerts into Your Screen

1. **Import the modal:**
```typescript
import WeatherAlertModal from '../../components/WeatherAlertModal';
import { useSession } from '../../services/SessionContext';
```

2. **Use the modal in your screen:**
```typescript
export default function MyScreen() {
  const { weatherAlertVisible, setWeatherAlertVisible } = useSession();
  const [userLocation, setUserLocation] = useState(null);

  return (
    <View>
      {/* Your screen content */}
      
      {/* Weather Alert Button */}
      <TouchableOpacity onPress={() => setWeatherAlertVisible(true)}>
        <Text>Check Weather Safety</Text>
      </TouchableOpacity>

      {/* Weather Alert Modal */}
      <WeatherAlertModal
        visible={weatherAlertVisible}
        onDismiss={() => setWeatherAlertVisible(false)}
        latitude={userLocation?.latitude}
        longitude={userLocation?.longitude}
      />
    </View>
  );
}
```

3. **Using WeatherAlertCard for inline display:**
```typescript
import WeatherAlertCard from '../../components/WeatherAlertCard';
import { WeatherService } from '../../services/WeatherService';
import { WeatherAlertService } from '../../services/WeatherAlertService';

// In your component
const [alert, setAlert] = useState(null);

useEffect(() => {
  const fetchAlert = async () => {
    const weather = await WeatherService.getWeatherCached(lat, lon);
    const weatherAlert = WeatherAlertService.analyzeWeather(weather);
    setAlert(weatherAlert);
  };
  fetchAlert();
}, []);

// In your JSX
{alert && (
  <WeatherAlertCard
    alert={alert}
    onDismiss={() => setAlert(null)}
    onLearnMore={() => { /* handle */ }}
  />
)}
```

#### Custom Weather Analysis

```typescript
import { WeatherService } from '../../services/WeatherService';
import { WeatherAlertService } from '../../services/WeatherAlertService';

// Get weather data
const weather = await WeatherService.getWeatherCached(latitude, longitude);

// Analyze weather
const alert = WeatherAlertService.analyzeWeather(weather);

// Use alert information
console.log(alert.level);           // 'safe' | 'caution' | 'warning' | 'danger'
console.log(alert.isSafeToTravel);  // true/false
console.log(alert.hazards);         // Array of hazard descriptions
console.log(alert.recommendations); // Array of recommendations
```

## Safety Thresholds Reference

### Temperature (Celsius)
- Extreme Cold: < -10°C
- Very Hot: > 40°C
- Hot: 35-40°C
- Cold: 0°C to -10°C

### Wind Speed (km/h)
- Dangerous: ≥ 60 km/h
- Severe: 50-60 km/h
- Strong: 40-50 km/h
- Moderate: 25-40 km/h

### Visibility (meters)
- Hazardous: < 100 meters
- Poor: 100-500 meters
- Moderate: 500-1000 meters

### Precipitation (mm)
- Heavy: ≥ 10 mm
- Moderate: 5-10 mm
- Light: < 5 mm

### UV Index
- Extreme: ≥ 11
- Very High: 8-11
- High: 6-8
- Moderate: 3-6
- Low: 0-3

## API Reference

### Open-Meteo Weather API
**Endpoint:** `https://api.open-meteo.com/v1/forecast`

**Features:**
- ✅ Free (no API key required)
- ✅ No rate limits for most use cases
- ✅ Accurate global coverage
- ✅ No authentication needed
- ✅ HTTPS/secure

**Data Available:**
- Current weather conditions
- Hourly forecasts (7+ days)
- Daily forecasts
- Temperature, wind, precipitation, humidity
- Visibility, pressure, UV index
- Multiple weather variables

**Location Parameters:**
- Latitude/Longitude (required)
- Timezone (auto-detected from coordinates)

## Testing

### Manual Testing Steps

1. **Test Weather Fetching:**
```typescript
import { WeatherService } from './services/WeatherService';

// Get current location weather
const weather = await WeatherService.getWeatherForCurrentLocation();
console.log('Weather:', weather);
```

2. **Test Alert Generation:**
```typescript
import { WeatherAlertService } from './services/WeatherAlertService';

const alert = WeatherAlertService.analyzeWeather(weather);
console.log('Alert Level:', alert.level);
console.log('Safe to Travel:', alert.isSafeToTravel);
console.log('Hazards:', alert.hazards);
```

3. **Test Modal Display:**
- Open Live Location screen
- Tap weather icon
- Verify modal appears
- Verify weather data loads
- Verify alert displays correctly

4. **Test Different Conditions:**
- Test in different locations
- Test with cached data (within 10 minutes)
- Test refresh button
- Test error handling (no internet)

## Performance Optimization

### Caching Strategy
- **Cache Duration:** 10 minutes
- **Cache Key:** Location coordinates (2 decimal places)
- **Cache Size:** Automatic (in-memory Map)

### API Call Optimization
- Automatic caching prevents redundant calls
- Coordinates rounded to 2 decimal places for consistency
- Batch forecast requests for hourly data

### Battery Usage
- Balanced location accuracy (not high-precision)
- Efficient data transfer (minimal API payloads)
- Background task-friendly

## Error Handling

### Network Errors
If weather data cannot be fetched:
- Error message displayed in modal
- Retry button available
- Graceful degradation

### Permission Errors
- Handled by expo-location
- Permission request shown to user
- Alternative: Allow manual coordinate entry

### Data Validation
- All weather values validated
- Fallback values for missing data
- Safe type checking throughout

## Future Enhancements

### Potential Features
1. **Hourly Forecasts** - Show next 24 hours of weather
2. **Alerts Configuration** - Custom threshold settings
3. **Push Notifications** - Alert users to severe conditions
4. **Historical Data** - Track weather patterns
5. **Location Presets** - Save favorite locations
6. **Multi-language Support** - Localized recommendations
7. **Air Quality Data** - Pollution level alerts
8. **Weather Trends** - Charts and graphs
9. **Community Alerts** - User-reported hazards
10. **Integration with Routes** - Warn about dangerous routes

## Troubleshooting

### Weather Data Not Loading
**Solution:**
1. Check internet connection
2. Verify location permissions granted
3. Check if coordinates are valid
4. Try manual refresh button

### Inaccurate Location
**Solution:**
1. Enable High Accuracy location mode
2. Wait for GPS lock (may take 30 seconds)
3. Move outdoors (GPS needs sky view)
4. Try again in different location

### Stale Cached Data
**Solution:**
1. Tap Refresh button to force update
2. Wait 10 minutes for cache to expire
3. Check timestamp in modal ("Last Updated")

### False Safety Alerts
**Solution:**
1. Review hazard list for context
2. Check actual weather conditions
3. Read recommendations carefully
4. Report feedback for improvement

## Files Summary

| File | Purpose |
|------|---------|
| `services/WeatherService.ts` | Weather data fetching & caching |
| `services/WeatherAlertService.ts` | Alert analysis & generation |
| `components/WeatherAlertModal.tsx` | Full-screen alert display |
| `components/WeatherAlertCard.tsx` | Reusable alert card component |
| `services/SessionContext.tsx` | State management for alerts |
| `app/dashboard/location.tsx` | Integration into location screen |

## Support

For issues or questions:
1. Check logs in console
2. Review error messages in modal
3. Verify internet connection
4. Test with different locations
5. Check API status at openmeteo.com

## Version History

- **v1.0** - Initial implementation
  - Real-time weather monitoring
  - Multi-hazard detection
  - Safety-level categorization
  - Personalized recommendations
  - Integration with location screen
  - Caching and optimization
