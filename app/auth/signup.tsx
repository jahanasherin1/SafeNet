import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added for Auto-Login
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Added Platform
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function SignupScreen() {
  const router = useRouter();
  
  // State for Inputs
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [errors, setErrors] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- HELPER FOR WEB & MOBILE ALERTS ---
  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [
        { text: "OK", onPress: onOk }
      ]);
    }
  };

  const validateAndSignup = async () => {
    let isValid = true;
    let currentErrors = { name: '', phone: '', email: '', password: '', confirmPassword: '' };

    if (name.trim().length < 2) {
      currentErrors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      currentErrors.phone = 'Phone number must be exactly 10 digits';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      currentErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (password.length < 6) {
      currentErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (password !== confirmPassword) {
      currentErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(currentErrors);

    if (isValid) {
      setLoading(true); 
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        let userLocation = { latitude: 0, longitude: 0 };

        if (status === 'granted') {
          try {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced
            });
            userLocation = {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude
            };
          } catch (locError) {
            console.warn('Location fetch failed, using default:', locError);
          }
        }

        // --- BACKEND API CALL ---
        const response = await api.post('/auth/signup', {
          name,
          phone,
          email,
          password,
          location: userLocation
        });

        if (response.status === 201 || response.status === 200) {
          // 1. Save User Data locally (Auto-Login)
          const userData = JSON.stringify(response.data.user);
          await AsyncStorage.setItem('user', userData);

          // 2. Alert and Navigate
          showAlert(
            "Success", 
            "Account created successfully!", 
            () => router.replace('/dashboard/home')
          );
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || "Registration failed. Please try again.";
        showAlert("Registration Error", errorMessage);
        console.error(error);
      } finally {
        setLoading(false); 
      }
    }
  };

  const handlePhoneChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue.length <= 10) {
      setPhone(numericValue);
      if (errors.phone) setErrors({...errors, phone: ''});
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/main')}>
          <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>

        <Text style={styles.title}>Create Your Safety ID</Text>
        <Text style={styles.subtitle}>
          Join the safety network to protect yourself and your loved ones.
        </Text>

        <View style={styles.form}>
          <View>
            <CustomInput 
              placeholder="Enter Name" 
              value={name}
              onChangeText={(text) => { setName(text); if(errors.name) setErrors({...errors, name:''}); }}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>
          
          <View>
            <CustomInput 
              placeholder="Enter Phone Number" 
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="numeric"
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>
          
          <View>
            <CustomInput 
              placeholder="Enter Email" 
              value={email}
              onChangeText={(text) => { setEmail(text); if(errors.email) setErrors({...errors, email:''}); }}
              keyboardType="email-address"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>
          
          <View>
            <CustomInput 
              placeholder="Password" 
              value={password}
              onChangeText={(text) => { setPassword(text); if(errors.password) setErrors({...errors, password:''}); }}
              isPassword={!showPassword} 
              iconName={showPassword ? "eye-off-outline" : "eye-outline"}
              onIconPress={() => setShowPassword(!showPassword)}
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>
          
          <View>
            <CustomInput 
              placeholder="Confirm Password" 
              value={confirmPassword}
              onChangeText={(text) => { setConfirmPassword(text); if(errors.confirmPassword) setErrors({...errors, confirmPassword:''}); }}
              isPassword={!showConfirmPassword}
              iconName={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
              onIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
            />
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          {/* Conditional Rendering for Loading Spinner */}
          {loading ? (
            <ActivityIndicator size="large" color="#6A5ACD" style={{marginTop: 10, marginBottom: 20}} />
          ) : (
            <PrimaryButton title="Create Account" onPress={validateAndSignup} />
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.linkText}>Log in</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf7fc' },
  scrollContainer: { padding: 20, paddingTop: 40 },
  backButton: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#6A5ACD', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#7A7A7A', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20, lineHeight: 20 },
  form: { marginBottom: 20 },
  errorText: { color: '#FF4B4B', fontSize: 12, marginLeft: 5, marginTop: -10, marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  footerText: { color: '#7A7A7A', fontSize: 14 },
  linkText: { color: '#5648A5', fontSize: 14, fontWeight: '600' },
});