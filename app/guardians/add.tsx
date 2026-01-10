import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api'; 

export default function AddGuardianScreen() {
  const router = useRouter();

  // State for Inputs
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); // Added Email State
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddGuardian = async () => {
    // Basic Validation
    if (!name.trim()) {
      Alert.alert("Error", "Guardian Name is required");
      return;
    }
    if (phone.length !== 10) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }
    // Simple Email Regex
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Alert.alert("Error", "Please enter a valid email address");
        return;
    }

    setLoading(true);

    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        Alert.alert("Error", "User session not found.");
        router.replace('/auth/login');
        return;
      }
      
      const user = JSON.parse(userData);

      // Send Request to Backend including Email
      const response = await api.post('/guardians/add', {
        userEmail: user.email, 
        name,
        phone,
        guardianEmail: email, // Sending email
        relationship
      });

      if (response.status === 200) {
        Alert.alert("Success", "Guardian added! An email with the login code has been sent to them.", [
          { text: "OK", onPress: () => router.back() } 
        ]);
      }

    } catch (error: any) {
      const msg = error.response?.data?.message || "Failed to add guardian";
      Alert.alert("Error", msg);
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