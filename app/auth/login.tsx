import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Save Session
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api'; // Ensure you have this file created

export default function LoginScreen() {
  const router = useRouter();
  
  // State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // New Loading State
  
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    let isValid = true;
    let currentErrors = { email: '', password: '' };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      currentErrors.email = 'Email is required';
      isValid = false;
    } else if (!emailRegex.test(email)) {
      currentErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      currentErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      currentErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setErrors(currentErrors);

    if (isValid) {
      setLoading(true); // Start Loading
      try {
        // --- BACKEND API CALL ---
        const response = await api.post('/auth/login', {
          email,
          password
        });

        if (response.status === 200) {
          // 1. Save User Data locally (for "Welcome, Name" feature)
          const userData = JSON.stringify(response.data.user);
          await AsyncStorage.setItem('user', userData);
          await AsyncStorage.setItem('token', response.data.token || ''); // If your API sends a token

          console.log("Login Successful");
          
          // 2. Navigate to Dashboard
          router.replace('/dashboard/home');
        }
      } catch (error: any) {
        // Handle Error
        const errorMessage = error.response?.data?.message || "Invalid email or password";
        Alert.alert("Login Failed", errorMessage);
      } finally {
        setLoading(false); // Stop Loading
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/main')}>
          <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Your safety, just one step away
          </Text>
        </View>

        <View style={styles.form}>
          
          <View>
            <CustomInput 
              placeholder="Enter your email" 
              value={email}
              onChangeText={(text) => { setEmail(text); if(errors.email) setErrors({...errors, email:''}); }}
              keyboardType="email-address"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>
          
          <View>
            <CustomInput 
              placeholder="Enter your password" 
              value={password}
              onChangeText={(text) => { setPassword(text); if(errors.password) setErrors({...errors, password:''}); }}
              isPassword={!showPassword} 
              iconName={showPassword ? "eye-off-outline" : "eye-outline"}
              onIconPress={() => setShowPassword(!showPassword)}
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Conditional Rendering for Loading Spinner */}
          {loading ? (
            <ActivityIndicator size="large" color="#6A5ACD" style={{marginTop: 10, marginBottom: 20}} />
          ) : (
            <PrimaryButton title="Login" onPress={handleLogin} />
          )}
        </View>

        <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.signupContainer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                    <Text style={styles.linkText}>Sign Up</Text>
                </TouchableOpacity>
            </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf7fc' },
  scrollContainer: { padding: 24, paddingTop: 40 },
  backButton: { marginBottom: 40 },
  headerSection: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#6A5ACD', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#7A7A7A', textAlign: 'center' },
  form: { marginBottom: 20 },
  errorText: { color: '#FF4B4B', fontSize: 12, marginLeft: 5, marginTop: -10, marginBottom: 10 },
  footer: { alignItems: 'center', marginTop: 10 },
  forgotPassword: { color: '#6A5ACD', fontSize: 14, marginBottom: 24 },
  signupContainer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#7A7A7A', fontSize: 14 },
  linkText: { color: '#5648A5', fontSize: 14, fontWeight: '600' },
});