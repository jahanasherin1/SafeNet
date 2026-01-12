import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGuardianLoggedIn, setIsGuardianLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const parsed = JSON.parse(userData);
          // Check if this is a guardian session
          if (parsed.isGuardian && parsed.guardianEmail) {
            setIsGuardianLoggedIn(true);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6A5ACD" />
      </View>
    );
  }

  // If guardian is logged in, go to dashboard. Otherwise, go to main (login page)
  return isGuardianLoggedIn ? (
    <Redirect href="/guardian-dashboard/home" />
  ) : (
    <Redirect href="/main" />
  );
}