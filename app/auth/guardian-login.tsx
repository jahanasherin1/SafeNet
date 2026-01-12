import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Added Platform
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function GuardianLoginScreen() {
  const router = useRouter();
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Request OTP, Step 2: Verify OTP
  const [guardianName, setGuardianName] = useState('');
  const [protecting, setProtecting] = useState('');

  // --- HELPER FOR WEB & MOBILE ALERTS ---
  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      // Web: Standard browser alert
      window.alert(`${title}: ${message}`);
      if (onOk) onOk();
    } else {
      // Mobile: Native Alert
      Alert.alert(title, message, [
        { text: "OK", onPress: onOk }
      ]);
    }
  };

  const handleRequestOTP = async () => {
    // --- 1. VALIDATION ---
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      showAlert("Missing Field", "Please enter your phone number.");
      return;
    }

    if (cleanPhone.length !== 10) {
      showAlert("Invalid Phone", "Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);
    try {
      // --- 2. API CALL TO REQUEST OTP ---
      const response = await api.post('/auth/guardian-request-otp', {
        phone: cleanPhone
      });

      if (response.status === 200) {
        // --- 3. SAVE DATA FOR VERIFICATION STEP ---
        setGuardianName(response.data.guardianName);
        setProtecting(response.data.protecting);
        setStep(2); // Move to OTP verification step

        showAlert(
          "OTP Sent",
          `OTP sent to ${response.data.email}. Please check your email.`
        );
      }
    } catch (error: any) {
      // --- 4. ERROR HANDLING ---
      const msg = error.response?.data?.message || "Failed to request OTP. Please check your phone number.";
      showAlert("Request Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    // --- 1. VALIDATION ---
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      showAlert("Missing Field", "Please enter the OTP.");
      return;
    }

    if (cleanOtp.length !== 6) {
      showAlert("Invalid OTP", "Please enter the valid 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      // --- 2. API CALL TO VERIFY OTP ---
      const response = await api.post('/auth/guardian-verify-otp', {
        phone: phone.trim(),
        otp: cleanOtp
      });

      if (response.status === 200) {
        // --- 2B. FETCH USER LOCATION ---
        let userLocation = null;
        try {
          const locationResponse = await api.post('/guardian/sos-status', {
            protectingEmail: response.data.protectingEmail
          });
          if (locationResponse.status === 200) {
            userLocation = locationResponse.data.currentLocation;
          }
        } catch (locationError) {
          console.error("Location fetch error:", locationError);
          // Continue even if location fetch fails
        }

        // --- 3. SAVE SESSION ---
        const guardianData = {
          ...response.data,
          isGuardian: true,
          userLocation: userLocation,
          loginTime: new Date().toISOString(),
          sessionToken: response.data.guardianEmail // Use email as session identifier
        };
        await AsyncStorage.setItem('user', JSON.stringify(guardianData));
        await AsyncStorage.setItem('guardianSessionToken', response.data.guardianEmail);

        // --- 4. NAVIGATION ---
        showAlert(
          "Access Granted", 
          `Welcome, ${response.data.guardianName}. You are now connected to protect ${response.data.protecting}.`, 
          () => router.replace('/guardian-dashboard/home') 
        );
      }
    } catch (error: any) {
      // --- 5. ERROR HANDLING ---
      const msg = error.response?.data?.message || "OTP verification failed. Please try again.";
      showAlert("Verification Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setPhone(numericValue);
  };

  const handleOtpChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setOtp(numericValue);
  };

  const handleBackToPhone = () => {
    setStep(1);
    setOtp('');
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
          {step === 1 ? (
            // STEP 1: REQUEST OTP
            <>
              <Text style={styles.label}>Phone Number</Text>
              <CustomInput 
                placeholder="Enter your registered phone number" 
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>
                This should match the contact you registered with.
              </Text>

              <View style={{ marginTop: 30 }}>
                {loading ? (
                  <ActivityIndicator size="large" color="#6A5ACD" />
                ) : (
                  <PrimaryButton 
                    title="Send OTP to Email" 
                    onPress={handleRequestOTP} 
                  />
                )}
              </View>
            </>
          ) : (
            // STEP 2: VERIFY OTP
            <>
               

              <Text style={styles.label}>One-Time Password (OTP)</Text>
              <CustomInput 
                placeholder="Enter 6-digit OTP" 
                value={otp}
                onChangeText={handleOtpChange}
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>
                Check your email for the 6-digit code. It expires in 10 minutes.
              </Text>

              <View style={{ marginTop: 30 }}>
                {loading ? (
                  <ActivityIndicator size="large" color="#6A5ACD" />
                ) : (
                  <PrimaryButton 
                    title="Verify OTP & Continue" 
                    onPress={handleVerifyOTP} 
                  />
                )}
              </View>

              <TouchableOpacity 
                onPress={handleBackToPhone} 
                style={{ marginTop: 16 }}
                disabled={loading}
              >
                <Text style={styles.backLink}>← Use different phone number</Text>
              </TouchableOpacity>
            </>
          )}
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
  stepInfo: { backgroundColor: '#E8E4F3', padding: 16, borderRadius: 8, marginBottom: 24 },
  stepInfoText: { fontSize: 14, color: '#4A4A4A', marginVertical: 4 },
  bold: { fontWeight: '600', color: '#6A5ACD' },
  backLink: { fontSize: 14, color: '#6A5ACD', textAlign: 'center', fontWeight: '500', textDecorationLine: 'underline' },
  footer: { alignItems: 'center', marginTop: 20 },
  footerText: { color: '#7A7A7A', fontSize: 14 },
});