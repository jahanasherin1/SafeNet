# Quick Start - Maps Implementation

## Platform-Specific Maps

| Platform | Technology | API Key | Features |
|----------|-----------|---------|----------|
| **iOS** | Google Maps | ❌ Not required | Interactive map, zoom, pan, markers |
| **Android** | Leaflet List | ❌ Not required | Distance-sorted list, coordinates |

## Run the App

```bash
# Install dependencies
npm install

# Android
npm run android

# iOS
npm run ios
```

## Test Maps

1. Open app → Dashboard → Location
2. Grant location permission
3. See your location and nearby safe places

### iOS
- Pinch to zoom
- Drag to pan
- Tap locate button to center
- Tap markers for details

### Android
- Scroll to see all locations
- Sorted by distance (nearest first)
- Tap any location for details
- Shows coordinates and distance

## How It Works

### MapComponent.tsx
```typescript
// Automatically detects platform
if (Platform.OS === 'ios') {
  // Render Google Maps
} else {
  // Render Leaflet List View
}
```

### Usage in location.tsx
```tsx
<MapComponent
  initialLatitude={userLocation.latitude}
  initialLongitude={userLocation.longitude}
  markers={[...]}
  onMarkerPress={(marker) => {...}}
/>
```

## Markers

Each marker has:
- `id` - Unique identifier
- `latitude` - Latitude coordinate
- `longitude` - Longitude coordinate
- `title` - Display name
- `description` - Additional info
- `color` - Marker color (hex)

## Safe Places

Pre-configured locations in Kochi:
1. **Police Station** - 9.9816°N, 76.2856°E
2. **Hospital** - 9.9689°N, 76.2532°E
3. **Safe Zone** - 9.9901°N, 76.3247°E

## Distance Calculation

Uses Haversine formula:
```
Distance = 2 * R * arcsin(√(sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)))
```
- R = 6371 km (Earth's radius)
- Result in kilometers

## No API Key Setup Needed

✅ Works out of the box
✅ No configuration required
✅ No API key needed
✅ No backend setup needed

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Map not showing | Check location permissions |
| Markers missing | Verify location data |
| Wrong distance | Check coordinate format |
| App crashes | Check console for errors |

## Files

- `components/MapComponent.tsx` - Main map component
- `app/dashboard/location.tsx` - Location screen
- `package.json` - Dependencies

## Dependencies

```json
{
  "react-native-maps": "1.20.1",
  "expo-location": "~19.0.8"
}
```

## That's It!

The maps are ready to use. No additional setup required.
