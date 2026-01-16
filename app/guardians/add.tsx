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

  const handleAddGuardian = async () => {
    // Basic Validation
    if (!name.trim()) {
      showAlert("Error", "Guardian Name is required");
      return;
    }
    if (phone.length !== 10) {
      showAlert("Error", "Please enter a valid 10-digit phone number");
      return;
    }
    // Simple Email Regex
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert("Error", "Please enter a valid email address");
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
    if (numericValue.length <= 10) setPhone(numericValue);
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
            onChangeText={setName}
          />

          <Text style={styles.label}>Phone Number</Text>
          <CustomInput 
            placeholder="Enter phone number" 
            iconName="call-outline"
            keyboardType="numeric"
            value={phone}
            onChangeText={handlePhoneChange}
          />

          {/* NEW EMAIL INPUT */}
          <Text style={styles.label}>Email Address</Text>
          <CustomInput 
            placeholder="Enter guardian's email" 
            iconName="mail-outline"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

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
});