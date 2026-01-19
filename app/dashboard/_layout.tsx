import { Tabs } from 'expo-router';
import React from 'react';
import BottomTabBar from '../../components/BottomTabBar';

export default function DashboardLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />} 
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="location"
        options={{ title: 'Location' }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Alerts' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />

      <Tabs.Screen
        name="edit-profile"
        options={{
          title: 'Edit Profile',
          href: null,
        }}
      />
      
      <Tabs.Screen
        name="start-journey"
        options={{ title: 'Start Journey', href: null ,}}
      />
      <Tabs.Screen 
        name="fake-call" 
        options={{ 
          href: null
        }} 
      />
      <Tabs.Screen 
        name="active-call" 
        options={{ 
          href: null
        }} 
      />
    
    </Tabs>
  );
}