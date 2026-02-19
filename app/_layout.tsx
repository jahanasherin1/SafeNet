import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GlobalAlertModal from '../components/GlobalAlertModal';
import '../services/BackgroundLocationService'; // Initialize background location task on app start
import { SessionProvider } from '../services/SessionContext';
import SOSTileService from '../services/SOSTileService'; // Initialize SOS Quick Settings Tile listener

function RootLayoutContent() {
  useEffect(() => {
    // Initialize SOS Tile Service on app startup
    console.log('📱 Initializing SOS Tile Service...');
    const sosTileService = SOSTileService.getInstance();
    
    return () => {
      // Cleanup on unmount
      sosTileService?.destroy();
    };
  }, []);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* We changed (drawer) to main */}
      <Stack.Screen name="main" />
      <Stack.Screen name="auth/signup" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/forgot-password" />
      <Stack.Screen name="guardians/add" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <RootLayoutContent />
        <GlobalAlertModal />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}