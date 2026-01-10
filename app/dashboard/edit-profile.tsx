import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton'; 
import api from '../../services/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Load current data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setName(user.name || '');
          setPhone(user.phone || '');
          setEmail(user.email || '');
        }
      } catch (error) {
        console.error("Load error:", error);
      }
    };
    loadUserData();
  }, []);

  const handlePhoneChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue.length <= 10) {
      setPhone(numericValue);
    }
  };

  const handleSave = async () => {
    // 1. Basic Validation
    if (!name || !phone || !email) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    // 2. Current Password Validation (Mandatory for security check)
    if (!currentPassword) {
      Alert.alert("Security Check", "Please enter your current password to save changes.");
      return;
    }

    // 3. New Password Validation (If user entered something)
    if (newPassword && newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/update-profile', {
        currentEmail: email, 
        name,
        phone,
        currentPassword, // Backend will use this to verify the user
        newPassword      // Backend will update to this if provided
      });

      if (response.status === 200) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        Alert.alert("Success", "Profile updated successfully!", [
          { text: "OK", onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Invalid current password or update failed.";
      Alert.alert("Update Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Image 
            source={{ uri: 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg' }} 
            style={styles.avatar} 
          />
          <Text style={styles.avatarName}>{name || 'User'}</Text>
          <TouchableOpacity>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <CustomInput placeholder="Full Name" value={name} onChangeText={setName} />

          <Text style={styles.label}>Phone Number</Text>
          <CustomInput 
            placeholder="Phone Number" 
            value={phone} 
            onChangeText={handlePhoneChange} 
            iconName="call-outline"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Email Address</Text>
          <CustomInput 
            placeholder="Email Address" 
            value={email} 
            iconName="mail-outline"
            onChangeText={() => {}} // Prevent editing
          />

          <View style={styles.divider} />

          {/* CURRENT PASSWORD */}
          <Text style={styles.label}>Current Password</Text>
          <CustomInput 
            placeholder="Enter current password" 
            value={currentPassword} 
            onChangeText={setCurrentPassword} 
            isPassword={!showCurrentPassword}
            iconName={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
            onIconPress={() => setShowCurrentPassword(!showCurrentPassword)}
          />

          {/* NEW PASSWORD */}
          <Text style={styles.label}>New Password</Text>
          <CustomInput 
            placeholder="Change password " 
            value={newPassword} 
            onChangeText={setNewPassword} 
            isPassword={!showNewPassword}
            iconName={showNewPassword ? "eye-off-outline" : "eye-outline"}
            onIconPress={() => setShowNewPassword(!showNewPassword)}
          />

          <Text style={styles.privacyNote}>
            Your information is securely stored and will only be used for safety purposes.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#6A5ACD" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <PrimaryButton title="Save Changes" onPress={handleSave} />
              <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  avatarName: { fontSize: 20, fontWeight: 'bold', color: '#1A1B4B' },
  changePhotoText: { color: '#7E68B8', fontSize: 14, fontWeight: '500' },
  form: { marginTop: 10 },
  label: { fontSize: 15, fontWeight: '600', color: '#1A1B4B', marginBottom: 8, marginTop: 10 },
  divider: { height: 1, backgroundColor: '#E8E6F0', marginVertical: 20 },
  privacyNote: { fontSize: 13, color: '#7E68B8', textAlign: 'center', lineHeight: 18, marginTop: 10, marginBottom: 20 },
  buttonContainer: { marginTop: 5 },
  cancelButton: { 
    backgroundColor: '#E8E6F0', 
    paddingVertical: 15, 
    borderRadius: 12, 
    alignItems: 'center',
    height: 55,
    justifyContent: 'center'
  },
  cancelButtonText: { color: '#1A1B4B', fontSize: 16, fontWeight: '600' },
});