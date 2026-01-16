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
});