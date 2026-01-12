import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Request code, Step 2: Reset password

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

  const handleSendCode = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      showAlert("Missing Field", "Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', {
        email: cleanEmail
      });

      if (response.status === 200) {
        setStep(2);
        showAlert(
          "Code Sent",
          `Reset code sent to ${response.data.email}. Check your email.`
        );
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Failed to send reset code. Please try again.";
      showAlert("Request Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const cleanCode = resetCode.trim();
    const cleanPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanCode || !cleanPassword || !cleanConfirm) {
      showAlert("Missing Fields", "Please fill in all fields.");
      return;
    }

    if (cleanCode.length !== 6) {
      showAlert("Invalid Code", "Reset code must be 6 digits.");
      return;
    }

    if (cleanPassword.length < 6) {
      showAlert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      showAlert("Password Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email: email.trim(),
        resetCode: cleanCode,
        newPassword: cleanPassword
      });

      if (response.status === 200) {
        showAlert(
          "Success",
          "Your password has been reset successfully. Please login with your new password.",
          () => router.replace('/auth/login')
        );
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Failed to reset password. Please try again.";
      showAlert("Reset Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep(1);
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Header Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
        </TouchableOpacity>

        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {step === 1 
              ? "Enter your email to receive a reset code" 
              : "Enter the code and your new password"}
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.form}>
          {step === 1 ? (
            // STEP 1: REQUEST CODE
            <>
              <Text style={styles.label}>Email Address</Text>
              <CustomInput 
                placeholder="Enter your registered email" 
                value={email}
                onChangeText={setEmail}
              />
              
              <View style={{ marginTop: 30 }}>
                {loading ? (
                  <ActivityIndicator size="large" color="#6A5ACD" />
                ) : (
                  <PrimaryButton 
                    title="Send Reset Code" 
                    onPress={handleSendCode} 
                  />
                )}
              </View>
            </>
          ) : (
            // STEP 2: RESET PASSWORD
            <>
              <Text style={styles.label}>Reset Code</Text>
              <CustomInput 
                placeholder="Enter 6-digit code from email" 
                value={resetCode}
                onChangeText={(text) => setResetCode(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />

              <Text style={[styles.label, { marginTop: 20 }]}>New Password</Text>
              <CustomInput 
                placeholder="Enter new password" 
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword={true}
              />

              <Text style={[styles.label, { marginTop: 20 }]}>Confirm Password</Text>
              <CustomInput 
                placeholder="Confirm your password" 
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword={true}
              />

              <View style={{ marginTop: 30 }}>
                {loading ? (
                  <ActivityIndicator size="large" color="#6A5ACD" />
                ) : (
                  <PrimaryButton 
                    title="Reset Password" 
                    onPress={handleResetPassword} 
                  />
                )}
              </View>

              <TouchableOpacity 
                onPress={handleBackToEmail} 
                style={{ marginTop: 16 }}
                disabled={loading}
              >
                <Text style={styles.backLink}>← Use different email</Text>
              </TouchableOpacity>
            </>
          )}
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
    color: '#6A5ACD',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7A7A7A',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  form: {
    marginTop: 10,
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1A1B4B', 
    marginBottom: 10 
  },
  backLink: { 
    fontSize: 14, 
    color: '#6A5ACD', 
    textAlign: 'center', 
    fontWeight: '500', 
    textDecorationLine: 'underline' 
  },
});
