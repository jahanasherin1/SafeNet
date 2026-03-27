import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function EditGuardianScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // State
  const [name, setName] = useState(params.name as string || '');
  const [phone, setPhone] = useState(params.phone as string || '');
  const [email, setEmail] = useState(params.email as string || '');
  const [relationship, setRelationship] = useState(params.relationship as string || '');
  const [loading, setLoading] = useState(false);

  // Validation Error States
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

  // Helper: Get Initials
  const getInitials = (fullName: string) => {
    const names = fullName.trim().split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials || "G";
  };

  // Helper for Cross-Platform Alerts
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
      setNameError('Name is required');
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

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.trim()) {
      validateEmail(text);
    } else {
      setEmailError('');
    }
  };

  const handleUpdate = async () => {
    // 1. Validation - Force validation on all fields
    const isNameValid = validateName(name);
    const isPhoneValid = validatePhone(phone);
    const isEmailValid = validateEmail(email);

    if (!isNameValid || !isPhoneValid || !isEmailValid) {
      showAlert("Error", "Please fix the errors before saving.");
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) return;
      const user = JSON.parse(userData);

      // --- FIX: Changed path to SINGULAR '/guardian/update' ---
      const response = await api.put('/guardian/update', {
        userEmail: user.email,
        guardianId: params._id,
        name,
        phone,
        email,
        relationship
      });

      if (response.status === 200) {
        showAlert("Success", "Guardian details updated", () => router.back());
      }
    } catch (error: any) {
      console.error("Update Error:", error.response?.data || error.message);
      showAlert("Error", "Failed to update guardian");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const performDelete = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (!userData) return;
        const user = JSON.parse(userData);

        // --- FIX: Changed path to SINGULAR '/guardian/delete' ---
        await api.delete('/guardian/delete', {
            data: { userEmail: user.email, guardianId: params._id }
        });
        
        router.back(); 
      } catch (error) {
        console.error("Delete Error:", error);
        showAlert("Error", "Could not delete guardian");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to remove this guardian?")) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Guardian", "Are you sure you want to remove this guardian?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Guardian</Text>
        <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#FF4B4B" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* --- PROFILE SECTION (Initials) --- */}
        <View style={styles.avatarSection}>
          <View style={styles.initialsContainer}>
            <Text style={styles.initialsText}>{getInitials(name)}</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <CustomInput 
            placeholder="Name" 
            value={name} 
            onChangeText={handleNameChange}
            onBlur={() => validateName(name)}
          />
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

          <CustomInput 
            placeholder="Phone number" 
            value={phone} 
            onChangeText={handlePhoneChange}
            onBlur={() => validatePhone(phone)}
            keyboardType="numeric" 
            iconName="call-outline"
          />
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          <CustomInput 
            placeholder="Email" 
            value={email} 
            onChangeText={handleEmailChange}
            onBlur={() => validateEmail(email)}
            keyboardType="email-address" 
            iconName="mail-outline"
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <CustomInput 
            placeholder="Relation" 
            value={relationship} 
            onChangeText={setRelationship} 
          />

          <View style={{ marginTop: 20 }}>
            {loading ? (
                <ActivityIndicator size="large" color="#6A5ACD" />
            ) : (
                <PrimaryButton title="Save Changes" onPress={handleUpdate} />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  backButton: { padding: 5 },
  scrollContent: { padding: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  
  initialsContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFEAD1', 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FAF9FF',
    marginBottom: 10
  },
  initialsText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#E65100', 
  },

  form: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: '#1A1B4B', marginBottom: 8, marginTop: 10 },
  errorText: { 
    fontSize: 13, 
    color: '#FF4B4B', 
    marginTop: 4, 
    marginBottom: 8,
    marginLeft: 4 
  },
});