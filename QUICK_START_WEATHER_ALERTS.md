# Weather-Based Safety Alerts - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Run the App
```bash
npm start
```

### Step 2: Navigate to Location Screen
1. Login to SafeNet
2. Go to **Dashboard** → **Live Location**

### Step 3: Check Weather Safety
1. Look for the **☁️ weather icon** in the top-right header
2. Tap the icon to open the weather alert modal

### Step 4: View Your Alert
- See current weather conditions
- Read hazards (if any)
- Review safety recommendations
- Check if it's safe to travel

## 🎯 Key Features At a Glance

### Real-Time Weather
- **Temperature** (Current and "feels like")
- **Wind Speed** and gusts
- **Humidity** level
- **Visibility** distance
- **Precipitation** amount
- **UV Index** level

### Safety Levels
```
✅ Safe - Normal conditions, suitable for travel
⚠️ Caution - Exercise care while traveling
🔶 Warning - Travel with extra precautions
🚫 Danger - Do not travel unless necessary
```

### What It Monitors
- 🌡️ Extreme temperatures (cold/heat)
- 💨 High wind speeds
- 👁️ Poor visibility (fog, heavy rain)
- 🌧️ Heavy precipitation
- ⛈️ Thunderstorms
- ☀️ High UV index
- 💧 Humidity levels

## 📱 Using the Modal

### Layout
```
┌─────────────────────────────┐
│ Weather Safety Alert    [X] │  ← Header with close button
├─────────────────────────────┤
│ ✅ Safe to Travel          │  ← Safety level & title
├─────────────────────────────┤
│ 📊 Current Conditions       │  ← Live weather data
│ 🌡️ Temperature: 25°C        │
│ 💨 Wind Speed: 15 km/h      │
│ 👁️ Visibility: 10 km        │
├─────────────────────────────┤
│ ⚠️ Hazards (if any)        │  ← Issues detected
├─────────────────────────────┤
│ 💡 Recommendations          │  ← Safety tips
│ • Wear appropriate clothing │
│ • Stay hydrated            │
├─────────────────────────────┤
│ 🛡️ General Safety Tips      │  ← Always shown
├─────────────────────────────┤
│ [Refresh] [Dismiss]         │  ← Action buttons
└─────────────────────────────┘
```

## 🔧 For Developers

### Import and Use
```typescript
import WeatherAlertModal from '../../components/WeatherAlertModal';
import { useSession } from '../../services/SessionContext';

export default function MyScreen() {
  const { weatherAlertVisible, setWeatherAlertVisible } = useSession();

  return (
    <>
      <TouchableOpacity onPress={() => setWeatherAlertVisible(true)}>
        <Text>Check Weather</Text>
      </TouchableOpacity>

      <WeatherAlertModal
        visible={weatherAlertVisible}
        onDismiss={() => setWeatherAlertVisible(false)}
      />
    </>
  );
}
```

### Get Weather Data Programmatically
```typescript
import { WeatherService } from '../../services/WeatherService';
import { WeatherAlertService } from '../../services/WeatherAlertService';

// Get current weather
const weather = await WeatherService.getWeatherCached(
  latitude,
  longitude
);

// Analyze it
const alert = WeatherAlertService.analyzeWeather(weather);

// Use the alert
if (alert.level === 'danger') {
  console.warn('Dangerous weather!');
  console.warn('Hazards:', alert.hazards);
  console.warn('Travel safe:', alert.isSafeToTravel);
}
```

## 📊 Understanding the Data

### Weather Data Available
```typescript
{
  temperature: 25,              // °C
  feelsLike: 23,                // °C
  humidity: 65,                 // %
  windSpeed: 15,                // km/h
  windGust: 25,                 // km/h
  weatherCondition: "Partly cloudy",
  weatherCode: "2",             // WMO code
  visibility: 10000,            // meters
  pressure: 1013,               // hPa
  uvIndex: 5,                   // 0-11+
  precipitation: 0,             // mm
  lastUpdated: Date             // timestamp
}
```

### Alert Information
```typescript
{
  level: "safe",                // safe|caution|warning|danger
  title: "✅ Safe to Travel",
  message: "Current conditions...",
  isSafeToTravel: true,
  hazards: [                    // Array of issues detected
    "Moderate wind",
    "High humidity"
  ],
  recommendations: [            // Specific advice
    "Drink plenty of water",
    "Use caution in high wind areas"
  ],
  conditions: {                 // Formatted conditions
    temperature: "25°C",
    windSpeed: "15 km/h",
    visibility: "10 km",
    precipitation: "0 mm",
    uvIndex: "5 (Moderate)"
  }
}
```

## ⚡ Performance Tips

### Caching
- First request fetches from API
- Subsequent requests within 10 minutes use cache
- Tap **Refresh** to force new API call
- Cache saves battery and data

### Efficient Usage
- Check weather before long trips
- Don't spam refresh button
- Let app use cached data when possible
- Cache automatically expires after 10 minutes

## 🐛 Troubleshooting

### Weather Data Not Loading
**Check:**
- ✅ Internet connection active
- ✅ Location permissions granted
- ✅ GPS has acquired signal
- ✅ Check device time is correct

**Try:**
- Tap **Refresh** button
- Move outside for better GPS signal
- Wait a few seconds for data

### Showing "Loading..." Forever
**Try:**
- Check internet connection
- Allow location permission if prompted
- Tap **Retry** button
- Close and reopen modal

### Incorrect Weather Data
**Note:**
- API data is live from weather stations
- May differ from your exact location
- Coordinates rounded to 2 decimal places
- Usually accurate within 5-10 km

## 🌍 Location Notes

The system uses your GPS coordinates:
- **Accuracy:** Balanced (±50-500 meters)
- **Update:** When you open the modal
- **Fallback:** Nearest weather station data

For best results:
- Grant location permissions
- Be outdoors with clear sky view
- Wait for GPS lock (may take 30 seconds)

## 🛡️ Safety Reminder

This app provides weather information to help you make safe decisions. Always:
- Use common sense with your travel plans
- Consider local conditions you can observe
- Consult local authorities for severe weather
- Don't rely solely on this app for critical decisions
- Update weather before traveling

## 📞 Support Resources

### Documentation
- Full guide: [WEATHER_SAFETY_ALERTS.md](./WEATHER_SAFETY_ALERTS.md)
- Testing guide: [WEATHER_TESTING_CHECKLIST.md](./WEATHER_TESTING_CHECKLIST.md)

### In-App Features
- Tap **Refresh** for latest data
- Read **Recommendations** for action items
- Check **Hazards** for specific concerns
- Trust the **Safety Indicator** color

### Common Questions

**Q: Why is the weather different from my phone's weather app?**
A: Different apps use different data sources. This app uses Open-Meteo API which is very accurate.

**Q: How often does the data update?**
A: Data caches for 10 minutes. Tap Refresh for latest.

**Q: Does it work without internet?**
A: Initial data needs internet. Cached data works offline.

**Q: How accurate is the location?**
A: Usually within 100-500 meters. GPS signal affects accuracy.

**Q: Can I use it for my area?**
A: Works globally with Open-Meteo API coverage (most areas).

## 📈 Data Sources

- **Weather Data:** Open-Meteo API (Free, no key needed)
- **Location:** Device GPS (Expo Location)
- **Caching:** Device storage (AsyncStorage)

## ✨ Tips & Tricks

### Get Accurate Location
1. Open outside on clear day
2. Wait 30 seconds for GPS lock
3. Tap Refresh for latest weather
4. View current conditions displayed

### Check Before Trips
1. Use before leaving for safety
2. Check hourly if conditions changing
3. Update if you move to new location
4. Trust the safety indicator color

### Share Information
1. Screenshot the alert
2. Send to guardians
3. Note the timestamp
4. Reference specific hazards

## 🎓 Learning More

### Understand Weather Codes
The app uses WMO (World Meteorological Organization) weather codes:
- **0-3:** Clear to overcast
- **45-48:** Fog
- **51-67:** Drizzle to rain
- **71-77:** Snow
- **80-82:** Rain showers
- **85-86:** Snow showers
- **95-99:** Thunderstorms

### Safety Level Colors
- 🟢 **Green (Safe)** - Proceed normally
- 🟡 **Yellow (Caution)** - Take extra care
- 🟠 **Orange (Warning)** - Use precautions
- 🔴 **Red (Danger)** - Avoid if possible

## 🚀 Next Steps

1. **Try It Out**
   - Open the app
   - Navigate to Location
   - Check the weather

2. **Explore Features**
   - View different sections
   - Read recommendations
   - Check multiple locations

3. **Test Scenarios**
   - Check in different weather
   - Test refresh function
   - Try different locations

4. **Provide Feedback**
   - Report issues
   - Suggest improvements
   - Share experiences

---

**Version:** 1.0
**Last Updated:** 2026-02-04
**Status:** Ready to Use ✅

For detailed information, see [WEATHER_SAFETY_ALERTS.md](./WEATHER_SAFETY_ALERTS.md)
