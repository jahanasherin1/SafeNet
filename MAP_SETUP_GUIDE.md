# SafeNet Map Implementation - Platform-Specific Setup

## Overview

The app now uses platform-specific map implementations:
- **iOS**: Google Maps (via react-native-maps with PROVIDER_GOOGLE)
- **Android**: Leaflet-style list view (no API key required)

## Architecture

### MapComponent.tsx
Located in `components/MapComponent.tsx`, this component automatically detects the platform and renders the appropriate map interface.

```
MapComponent
├── iOS: Google Maps (Native)
│   ├── Interactive map with markers
│   ├── Pinch to zoom
│   ├── Pan and drag
│   └── Locate button
└── Android: Leaflet List View
    ├── Location coordinates display
    ├── Sorted marker list by distance
    ├── No API key required
    └── Touch-friendly interface
```

## iOS Setup (Google Maps)

### Requirements
- `react-native-maps` (already in package.json)
- Google Maps API key (optional for basic functionality)

### Features
- Full interactive map
- Real-time marker updates
- Smooth animations
- Native iOS Maps integration

### How to Add Google Maps API Key (Optional)
If you want advanced features, add to `app.json`:

```json
"ios": {
  "config": {
    "googleMapsApiKey": "YOUR_API_KEY_HERE"
  }
}
```

## Android Setup (Leaflet List View)

### Why Leaflet List View?
- ✅ No API key required
- ✅ Works offline
- ✅ Lightweight
- ✅ Fast performance
- ✅ User-friendly interface

### Features
- Displays coordinates in decimal format
- Shows distance from user location
- Sorted by proximity
- Tap to view details
- Color-coded markers

### Distance Calculation
Uses Haversine formula for accurate distance calculation:
```
Distance = 2 * R * arcsin(√(sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)))
```
Where R = Earth's radius (6371 km)

## Usage

### In location.tsx
```tsx
<MapComponent
  initialLatitude={userLocation.latitude}
  initialLongitude={userLocation.longitude}
  markers={[
    {
      id: 'user',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      title: userName,
      description: 'Your current location',
      color: '#6A5ACD',
    },
    ...SAFE_PLACES.map((place) => ({
      id: place.id,
      latitude: place.coords.latitude,
      longitude: place.coords.longitude,
      title: place.name,
      description: place.address,
      color: '#FF6B6B',
    })),
  ]}
  onMarkerPress={(marker) => {
    const place = SAFE_PLACES.find((p) => p.id === marker.id);
    if (place) {
      handleDirections(place);
    }
  }}
  zoom={15}
/>
```

## Testing

### Android Testing
```bash
npm run android
```
- Navigate to Dashboard → Location
- Grant location permission
- See list of locations sorted by distance
- Tap any location to view details

### iOS Testing
```bash
npm run ios
```
- Navigate to Dashboard → Location
- Grant location permission
- See interactive Google Map
- Pinch to zoom, drag to pan
- Tap locate button to center on user

## Marker Interface

```typescript
interface MapMarker {
  id: string;              // Unique identifier
  latitude: number;        // Latitude coordinate
  longitude: number;       // Longitude coordinate
  title: string;          // Display name
  description?: string;   // Additional info
  color?: string;         // Marker color (hex)
}
```

## Styling

### iOS Map Styling
- Purple (#6A5ACD) for user location
- Red (#FF6B6B) for safe places
- White pin markers
- Smooth animations

### Android List Styling
- Coordinate display in decimal format
- Distance in kilometers
- Color-coded icons
- Sorted by proximity

## Performance Optimization

### iOS
- Markers are efficiently rendered
- Map animations use native drivers
- Clustering available for 100+ markers

### Android
- List virtualization for smooth scrolling
- Efficient distance calculations
- Minimal re-renders

## Troubleshooting

### iOS Issues

**Map not showing:**
- Check location permissions in Settings
- Verify Google Maps API key (if using advanced features)
- Restart the app

**Markers not appearing:**
- Ensure coordinates are valid
- Check console for errors
- Verify marker data structure

### Android Issues

**List not showing:**
- Check location permissions
- Verify marker data
- Check console for errors

**Distance calculation wrong:**
- Verify latitude/longitude format
- Check for NaN values
- Ensure coordinates are within valid ranges

## Dependencies

```json
{
  "react-native-maps": "1.20.1",
  "expo-location": "~19.0.8",
  "@expo/vector-icons": "^15.0.3"
}
```

## Future Enhancements

### iOS
- [ ] Custom marker icons
- [ ] Polyline for journey tracking
- [ ] Heatmap overlay
- [ ] Geofencing alerts
- [ ] Route optimization

### Android
- [ ] Leaflet web map integration
- [ ] Offline map caching
- [ ] Custom marker clustering
- [ ] Advanced filtering

## Platform Detection

The component uses `Platform.OS` to detect the platform:

```typescript
if (Platform.OS === 'ios') {
  // Render Google Maps
} else {
  // Render Leaflet List View
}
```

## Notes

- No API key required for Android
- iOS can work without API key for basic features
- Both platforms support real-time location updates
- Markers are automatically sorted by distance on Android
- iOS supports full map interactions

## Support

For issues or questions:
1. Check the console for error messages
2. Verify location permissions
3. Ensure marker data is valid
4. Test on actual device (not emulator for best results)
