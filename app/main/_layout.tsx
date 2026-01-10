import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false, // We hide the default header to use our custom ones
        drawerActiveTintColor: '#6A5ACD',
        drawerLabelStyle: { marginLeft: -20 },
      }}
    >
      {/* Option 1: Home */}
      <Drawer.Screen
        name="index" // This links to app/main/index.tsx
        options={{
          drawerLabel: 'Home',
          drawerIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />

      {/* Option 2: About Us */}
      <Drawer.Screen
        name="about" // This links to app/main/about.tsx
        options={{
          drawerLabel: 'About Us',
          drawerIcon: ({ color }) => <Ionicons name="information-circle-outline" size={22} color={color} />,
        }}
      />
    </Drawer>
  );
}