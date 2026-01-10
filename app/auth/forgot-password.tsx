import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleSendCode = () => {
    console.log("Reset code sent to:", email);
    // Logic to send API request goes here
    // router.back(); // Optional: Go back to login after sending
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* Header Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>

        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Don’t worry, we’ll help you reset it safely
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.form}>
          <CustomInput 
            placeholder="Enter your registered email" 
            value={email}
            onChangeText={setEmail}
          />
          
          <PrimaryButton 
            title="Send Reset Code" 
            onPress={handleSendCode} 
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
    paddingTop: 40,
  },
  backButton: {
    marginBottom: 40,
  },
  headerSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6A5ACD', // SafeNet Purple
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7A7A7A', // Grey text
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  form: {
    marginTop: 10,
  },
});