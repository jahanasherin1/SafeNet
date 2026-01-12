import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomInput from '../../components/CustomInput';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';

// Helper to get full image URL
const getImageUrl = (path: string | undefined) => {
  if (!path) return 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg';
  if (path.startsWith('http')) return path;
  return `${api.defaults.baseURL?.replace('/api', '')}/${path}`;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);

  // Load data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setName(user.name || '');
          setPhone(user.phone || '');
          setEmail(user.email || '');
          if (user.profileImage) {
            setProfileImage(getImageUrl(user.profileImage));
          }
        }
      } catch (error) {
        console.error("Load error:", error);
      }
    };
    loadUserData();
  }, []);

  // --- 2. PICK IMAGE FUNCTION (FIXED) ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        // --- FIX: Reverted to MediaTypeOptions to prevent crash ---
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Alert.alert("Error", "Could not open image library.");
    }
  };

  const handleSave = async () => {
    if (!name || !phone || !email) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('currentEmail', email);
      formData.append('name', name);
      formData.append('phone', phone);
      if (password) formData.append('password', password);

      // Append Image if it's a new local file
      if (profileImage && !profileImage.startsWith('http')) {
        const uri = profileImage;
        const fileType = uri.substring(uri.lastIndexOf('.') + 1);
        
        formData.append('profileImage', {
          uri: uri,
          name: `photo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }

      const response = await api.post('/auth/update-profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        
        Alert.alert("Success", "Profile updated successfully!", [
          { text: "OK", onPress: () => router.back() } 
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Update Failed";
      Alert.alert("Error", msg);
      console.error(error);
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
          <TouchableOpacity onPress={pickImage}>
            <Image 
              source={{ uri: profileImage || 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg' }} 
              style={styles.avatar} 
            />
            <View style={styles.cameraIconBg}>
                <Ionicons name="camera" size={18} color="#FFF" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.avatarName}>{name || 'User'}</Text>
          
          <TouchableOpacity onPress={pickImage}>
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
            onChangeText={setPhone} 
            iconName="call-outline"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Email Address</Text>
          <CustomInput 
            placeholder="Email Address" 
            value={email} 
            iconName="mail-outline"
            onChangeText={() => {}} 
          />

          <View style={styles.divider} />

          <Text style={styles.label}>New Password (Optional)</Text>
          <CustomInput 
            placeholder="Change password (min 6 chars)" 
            value={password} 
            onChangeText={setPassword} 
            isPassword={!showPassword}
            iconName={showPassword ? "eye-off-outline" : "eye-outline"}
            onIconPress={() => setShowPassword(!showPassword)}
          />

          <Text style={styles.privacyNote}>
            Your information is securely stored.
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
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FFF' },
  cameraIconBg: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#6A5ACD', padding: 8, borderRadius: 20,
    borderWidth: 2, borderColor: '#FFF'
  },
  avatarName: { fontSize: 20, fontWeight: 'bold', color: '#1A1B4B', marginTop: 10 },
  changePhotoText: { color: '#7E68B8', fontSize: 14, fontWeight: '500', marginTop: 5 },
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