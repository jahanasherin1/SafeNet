import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../services/BackgroundLocationService'; // Initialize background location task on app start
import { SessionProvider } from '../services/SessionContext';

function RootLayoutContent() {
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
      </SessionProvider>
    </GestureHandlerRootView>
  );
}