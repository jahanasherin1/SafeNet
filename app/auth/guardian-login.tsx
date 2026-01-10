import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function GuardianLoginScreen() {
  const router = useRouter();
  
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    // --- 1. VALIDATION LOGIC ---
    
    // Check if empty
    if (!contact.trim() || !otp.trim()) {
      Alert.alert("Missing Fields", "Please fill in both Phone Number and Verification Code.");
      return;
    }

    // Phone Validation
    if (contact.length !== 10) {
      Alert.alert("Invalid Phone", "Phone number must be exactly 10 digits.");
      return;
    }

    // OTP Validation (Backend generates 6 digits)
    if (otp.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the valid 6-digit verification code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      // --- 2. API CALL ---
      const response = await api.post('/auth/guardian-login', {
        phone: contact,
        otp: otp
      });

      if (response.status === 200) {
        // --- 3. SUCCESS & STORAGE ---
        const guardianData = {
          ...response.data,
          isGuardian: true
        };
        await AsyncStorage.setItem('user', JSON.stringify(guardianData));

        Alert.alert(
          "Access Granted", 
          `Welcome, ${response.data.guardianName}. You are now connected to protect ${response.data.protecting}.`, 
          [
            { 
              text: "Go to Dashboard", 
              // UPDATED: Navigates to the Guardian Dashboard
              onPress: () => router.replace('/guardian-dashboard/home') 
            }
          ]
        );
      }
    } catch (error: any) {
      // --- 4. ERROR HANDLING ---
      const msg = error.response?.data?.message || "Verification failed. Please check your internet or credentials.";
      Alert.alert("Access Denied", msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    // Only numbers allowed
    const numericValue = text.replace(/[^0-9]/g, '');
    setContact(numericValue);
  };

  const handleOtpChange = (text: string) => {
    // Only numbers allowed
    const numericValue = text.replace(/[^0-9]/g, '');
    setOtp(numericValue);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guardian Access</Text>
          <View style={{ width: 24 }} /> 
        </View>

        <Text style={styles.heroTitle}>
          Secure access to protect your loved one
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <CustomInput 
            placeholder="Enter your registered phone number" 
            value={contact}
            onChangeText={handlePhoneChange}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>
            This should match the contact shared by the user.
          </Text>

          <Text style={[styles.label, { marginTop: 20 }]}>Verification Code</Text>
          <CustomInput 
            placeholder="Enter 6-digit code" 
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>
            Enter the code sent to your email address.
          </Text>

          <View style={{ marginTop: 30 }}>
            {loading ? (
              <ActivityIndicator size="large" color="#6A5ACD" />
            ) : (
              <PrimaryButton 
                  title="Verify & Continue" 
                  onPress={handleVerify} 
              />
            )}
          </View>
        </View>

        <View style={styles.footer}>
            <Text style={styles.footerText}>You are trusted to protect.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf7fc' },
  scrollContainer: { padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#6A5ACD' },
  heroTitle: { fontSize: 24, fontWeight: 'bold', color: '#6A5ACD', textAlign: 'center', marginBottom: 40, lineHeight: 32 },
  form: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1B4B', marginBottom: 10 },
  helperText: { fontSize: 13, color: '#7A7A7A', textAlign: 'center', marginTop: -5, marginBottom: 5, lineHeight: 18 },
  footer: { alignItems: 'center', marginTop: 20 },
  footerText: { color: '#7A7A7A', fontSize: 14 },
});