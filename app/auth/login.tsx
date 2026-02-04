import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';
import { useSession } from '../../services/SessionContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useSession();
  
  // State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  // Real-time validation functions
  const validateEmail = (text: string) => {
    setEmail(text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!text) {
      setErrors(prev => ({...prev, email: 'Email is required'}));
    } else if (!emailRegex.test(text)) {
      setErrors(prev => ({...prev, email: 'Please enter a valid email address'}));
    } else {
      setErrors(prev => ({...prev, email: ''}));
    }
  };

  const validatePassword = (text: string) => {
    setPassword(text);
    if (!text) {
      setErrors(prev => ({...prev, password: 'Password is required'}));
    } else if (text.length < 6) {
      setErrors(prev => ({...prev, password: 'Password must be at least 6 characters'}));
    } else {
      setErrors(prev => ({...prev, password: ''}));
    }
  };

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
      setLoading(true); 
      try {
        // --- BACKEND API CALL ---
        const response = await api.post('/auth/login', {
          email,
          password
        });

        if (response.status === 200) {
          // Use session context to save user data
          await login(response.data.user, response.data.token || '');

          console.log("Login Successful");
          
          // Navigate to Dashboard
          router.replace('/dashboard/home');
        }
      } catch (error: any) {
        // Handle Error using Cross-Platform Alert
        const errorMessage = error.response?.data?.message || "Invalid email or password";
        showAlert("Login Failed", errorMessage);
      } finally {
        setLoading(false); 
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
            <Text style={styles.inputLabel}>Email Address</Text>
            <CustomInput 
              placeholder="Enter your email" 
              value={email}
              onChangeText={validateEmail}
              keyboardType="email-address"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>
          
          <View>
            <Text style={styles.inputLabel}>Password</Text>
            <CustomInput 
              placeholder="Enter your password" 
              value={password}
              onChangeText={validatePassword}
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
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#2D2D2D', marginBottom: 8, marginLeft: 5 },
  errorText: { color: '#FF4B4B', fontSize: 12, marginLeft: 5, marginTop: -10, marginBottom: 10 },
  footer: { alignItems: 'center', marginTop: 10 },
  forgotPassword: { color: '#6A5ACD', fontSize: 14, marginBottom: 24 },
  signupContainer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#7A7A7A', fontSize: 14 },
  linkText: { color: '#5648A5', fontSize: 14, fontWeight: '600' },
});