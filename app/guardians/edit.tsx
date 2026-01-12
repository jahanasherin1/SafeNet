import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Platform } from 'react-native'; // Added Platform
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // Helper function for Cross-Platform Alerts
  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      // WEB: Standard browser alert
      window.alert(`${title}: ${message}`);
      if (onOk) onOk();
    } else {
      // MOBILE: Native Alert
      Alert.alert(title, message, [
        { text: "OK", onPress: onOk }
      ]);
    }
  };

  const handlePhoneChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue.length <= 10) {
      setPhone(numericValue);
    }
  };

  const handleUpdate = async () => {
    // 1. Validation
    if (!name.trim() || !phone.trim()) {
      showAlert("Error", "Name and Phone are required.");
      return;
    }
    if (phone.length !== 10) {
      showAlert("Error", "Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) return;
      const user = JSON.parse(userData);

      // 2. API Call
      const response = await api.put('/guardians/update', {
        userEmail: user.email,
        guardianId: params._id,
        name,
        phone,
        email,
        relationship
      });

      if (response.status === 200) {
        // 3. Success -> Navigate Back (Works on Web & Mobile)
        showAlert("Success", "Guardian details updated", () => router.back());
      }
    } catch (error) {
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

        await api.delete('/guardians/delete', {
            data: { userEmail: user.email, guardianId: params._id }
        });
        
        router.back(); 
      } catch (error) {
        showAlert("Error", "Could not delete guardian");
      }
    };

    // WEB: Use confirm()
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to remove this guardian?")) {
        performDelete();
      }
    } 
    // MOBILE: Use Alert.alert with buttons
    else {
      Alert.alert("Delete Guardian", "Are you sure you want to remove this guardian?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDelete
        }
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
        
        {/* Photo Section */}
        <View style={styles.avatarSection}>
          <Image 
            source={{ uri: `https://i.pravatar.cc/150?u=${params._id}` }} 
            style={styles.avatar} 
          />
          <TouchableOpacity>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Guardian Name</Text>
          <CustomInput 
            placeholder="Name" 
            value={name} 
            onChangeText={setName} 
          />

          <Text style={styles.label}>Phone Number</Text>
          <CustomInput 
            placeholder="Phone" 
            value={phone} 
            onChangeText={handlePhoneChange} 
            keyboardType="numeric" 
            iconName="call-outline"
          />

          <Text style={styles.label}>Email Address</Text>
          <CustomInput 
            placeholder="Email" 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            iconName="mail-outline"
          />

          <Text style={styles.label}>Relationship</Text>
          <CustomInput 
            placeholder="e.g. Father" 
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
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, borderWidth: 3, borderColor: '#FAF9FF' },
  changePhotoText: { color: '#6A5ACD', fontWeight: '600' },
  form: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: '#1A1B4B', marginBottom: 8, marginTop: 10 },
});