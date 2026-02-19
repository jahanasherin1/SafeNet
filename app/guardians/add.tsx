import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function AddGuardianScreen() {
  const router = useRouter();

  // State for Inputs
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); 
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation Error States
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

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

  // Validation Functions
  const validateName = (text: string) => {
    if (!text.trim()) {
      setNameError('Guardian name is required');
      return false;
    } else if (text.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    } else {
      setNameError('');
      return true;
    }
  };

  const validatePhone = (text: string) => {
    if (!text.trim()) {
      setPhoneError('Phone number is required');
      return false;
    } else if (text.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return false;
    } else if (text[0] === '0' || text[0] === '1') {
      setPhoneError('Phone number cannot start with 0 or 1');
      return false;
    } else {
      setPhoneError('');
      return true;
    }
  };

  const validateEmail = (text: string) => {
    if (!text.trim()) {
      setEmailError('Email is required for guardian access');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  // Input Handlers with Validation
  const handleNameChange = (text: string) => {
    setName(text);
    if (text.trim()) {
      validateName(text);
    } else {
      setNameError('');
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.trim()) {
      validateEmail(text);
    } else {
      setEmailError('');
    }
  };

  const handleAddGuardian = async () => {
    // Trigger validation on all fields
    const isNameValid = validateName(name);
    const isPhoneValid = validatePhone(phone);
    const isEmailValid = validateEmail(email);

    if (!isNameValid || !isPhoneValid || !isEmailValid) {
      showAlert("Error", "Please fix the errors before adding guardian.");
      return;
    }

    setLoading(true);

    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        showAlert("Error", "User session not found.");
        router.replace('/auth/login');
        return;
      }
      
      const user = JSON.parse(userData);

      // --- FIX: Changed path to SINGULAR '/guardian/add' ---
      const response = await api.post('/guardian/add', {
        userEmail: user.email, 
        name,
        phone,
        guardianEmail: email, 
        relationship
      });

      if (response.status === 200) {
        // Success: Alert then navigate to Dashboard
        showAlert(
          "Success", 
          "Guardian added! An email with the login code has been sent to them.", 
          () => router.replace('/dashboard/home')
        );
      }

    } catch (error: any) {
      console.error("Add Guardian Error:", error);
      const msg = error.response?.data?.message || "Failed to add guardian";
      showAlert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue.length <= 10) {
      setPhone(numericValue);
      if (numericValue) {
        validatePhone(numericValue);
      } else {
        setPhoneError('');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Guardian</Text>
          <View style={{ width: 24 }} /> 
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          
          <Text style={styles.label}>Guardian Name</Text>
          <CustomInput 
            placeholder="Enter guardian's full name" 
            value={name}
            onChangeText={handleNameChange}
            onBlur={() => validateName(name)}
          />
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

          <Text style={styles.label}>Phone Number</Text>
          <CustomInput 
            placeholder="Enter phone number" 
            iconName="call-outline"
            keyboardType="numeric"
            value={phone}
            onChangeText={handlePhoneChange}
            onBlur={() => validatePhone(phone)}
          />
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          {/* NEW EMAIL INPUT */}
          <Text style={styles.label}>Email Address</Text>
          <CustomInput 
            placeholder="Enter guardian's email" 
            iconName="mail-outline"
            keyboardType="email-address"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={() => validateEmail(email)}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <Text style={styles.label}>Relationship (Optional)</Text>
          <CustomInput 
            placeholder="e.g., Parent, Friend" 
            value={relationship}
            onChangeText={setRelationship}
          />

          <Text style={styles.helperText}>
            They will receive a code via email to log in.
          </Text>

          {/* Add Button */}
          <View style={styles.buttonContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#6A5ACD" />
            ) : (
              <PrimaryButton 
                title="Add Guardian" 
                onPress={handleAddGuardian} 
              />
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    padding: 5,
    marginLeft: -5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1B4B',
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: '#1A1B4B',
    marginBottom: 10,
    fontWeight: '500',
  },
  helperText: {
    textAlign: 'center',
    color: '#2D2D2D',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 10,
    alignSelf: 'center',
    width: '60%',
  },
  errorText: { 
    fontSize: 13, 
    color: '#FF4B4B', 
    marginTop: 4, 
    marginBottom: 8,
    marginLeft: 4 
  },
});