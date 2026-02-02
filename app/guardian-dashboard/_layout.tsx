import { Tabs } from 'expo-router';
import React from 'react';
import BottomTabBar from '../../components/BottomTabBar';

export default function GuardianDashboardLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />} 
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Dashboard' }} // In bottom bar it will show Icon + Label
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Alerts' }}
      />
      <Tabs.Screen
        name="location"
        options={{ title: 'Location' }}
      />
      <Tabs.Screen
        name="monitor-journey"
        options={{ title: 'Monitor Journey',href:null, }}
      />
      <Tabs.Screen
        name="contact-authorities"
        options={{ title: 'Contact Authorities', href: null }}
      />
    </Tabs>
  );
}