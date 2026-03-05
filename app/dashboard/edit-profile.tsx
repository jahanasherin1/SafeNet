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
import { useSession } from '../../services/SessionContext';

// Helper to get full image URL
const getImageUrl = (path: string | undefined) => {
  if (!path) {
    return null;
  }
  
  // If it's a Vercel Blob URL, use proxy and pass the FULL URL
  if (path.includes('.blob.vercel-storage.com') || path.includes('.private.blob.vercel-storage.com')) {
    console.log('🖼️ Detected Vercel Blob URL - using proxy endpoint');
    const encodedUrl = encodeURIComponent(path);
    const baseUrl = api.defaults.baseURL?.replace('/api', '');
    // Pass the full URL to the proxy endpoint
    const proxyUrl = `${baseUrl}/api/blob/proxy/image?url=${encodedUrl}`;
    console.log('🖼️ Using blob proxy URL with full URL:', proxyUrl);
    return proxyUrl;
  }
  
  // If it's already a full HTTP URL (not blob storage), return it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log('🖼️ Full HTTP/HTTPS URL provided, using directly');
    return path;
  }
  
  // Otherwise treat as relative path and prepend baseURL
  const baseUrl = api.defaults.baseURL?.replace('/api', '');
  const finalUrl = `${baseUrl}/${path}`;
  return finalUrl;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { updateUser } = useSession();
  const [loading, setLoading] = useState(false);

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [originalImagePath, setOriginalImagePath] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);

  // Load data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          console.log('📋 EditProfile: Loaded user from storage');
          setName(user.name || '');
          setPhone(user.phone || '');
          setEmail(user.email || '');
          if (user.profileImage) {
            setOriginalImagePath(user.profileImage);
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
        quality: 0.5, // Reduce quality to 50% for smaller file size
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        
        // Check file size (approximate - React Native doesn't give exact size before upload)
        // If image quality is 0.5, typical sizes should be under 1MB
        console.log("📸 Image selected:", { uri, width: result.assets[0].width, height: result.assets[0].height });
        
        setProfileImage(uri);
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

      console.log("🔄 Sending profile update:", { email, name, phone, hasPassword: !!password });

      // Append Image if it's a new local file
      if (profileImage && !profileImage.startsWith('http')) {
        const uri = profileImage;
        const fileType = uri.substring(uri.lastIndexOf('.') + 1);
        
        formData.append('profileImage', {
          uri: uri,
          name: `photo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
        
        console.log("📸 Adding profile image:", { fileType, uri });
        console.log("⏳ Uploading... This may take a moment for large images.");
      } else if (profileImage && profileImage.startsWith('http')) {
        console.log("ℹ️ Keeping existing profile image:", profileImage);
      }

      const response = await api.post('/auth/update-profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data, // Prevent axios from JSON-serializing FormData
        timeout: 60000, // 60 second timeout for image upload
      });

      console.log("✅ Profile update response:", response.data);
      console.log('📋 Response user object:', { 
        name: response.data.user?.name, 
        phone: response.data.user?.phone, 
        profileImage: response.data.user?.profileImage 
      });

      if (response.status === 200) {
        console.log('💾 Saving user to AsyncStorage:', response.data.user);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        
        console.log('🔄 Calling updateUser():', response.data.user);
        await updateUser(response.data.user);
        
        Alert.alert("Success", "Profile updated successfully!", [
          { text: "OK", onPress: () => router.back() } 
        ]);
      }
    } catch (error: any) {
      console.error("❌ Update profile error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config?.url
      });
      
      // Parse error message with improved handling
      let msg = "Update Failed";
      
      if (error.response?.data?.error?.message) {
        msg = error.response.data.error.message;
      } else if (error.response?.data?.error?.detail) {
        msg = error.response.data.error.detail;
      } else if (error.response?.data?.detail) {
        msg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message === 'Network Error') {
        msg = "Network error. Please check your connection and try again.";
      } else if (error.code === 'ECONNABORTED') {
        msg = "Request timeout. Please try with a smaller image or check your connection.";
      } else if (error.message) {
        msg = error.message;
      }
      
      Alert.alert("Error", msg);
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
            {profileImage ? (
              <Image 
                source={{ uri: profileImage }} 
                style={styles.avatar}
                onError={(error) => {
                  console.log('⚠️ Failed to load image from:', profileImage);
                  // Try to use the original blob URL if we have one and haven't already tried it
                  if (originalImagePath && profileImage !== originalImagePath && originalImagePath.includes('.blob.vercel-storage.com')) {
                    console.log('🔄 Attempting to use direct blob URL');
                    setProfileImage(originalImagePath);
                  } else {
                    // Fall back to default image
                    console.log('ℹ️ Using default profile picture');
                    setProfileImage(null);
                  }
                }}
                onLoad={() => {
                  console.log('✅ Avatar image loaded successfully');
                }}
              />
            ) : (
              <Image source={require('../../assets/images/profile.jpg')} style={styles.avatar} />
            )}
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
          <CustomInput placeholder="Full Name" value={name} onChangeText={setName} labelBg="#FAF9FF" />

          <CustomInput 
            placeholder="Phone Number" 
            value={phone} 
            onChangeText={setPhone} 
            iconName="call-outline"
            keyboardType="numeric"
            labelBg="#FAF9FF"
          />

          <CustomInput 
            placeholder="Email Address" 
            value={email} 
            iconName="mail-outline"
            onChangeText={() => {}} // Read-only field
            editable={false} // Disable editing
            labelBg="#FAF9FF"
          />

          <View style={styles.divider} />

          <CustomInput 
            placeholder="Change password (min 6 chars)" 
            value={password} 
            onChangeText={setPassword} 
            isPassword={!showPassword}
            iconName={showPassword ? "eye-off-outline" : "eye-outline"}
            onIconPress={() => setShowPassword(!showPassword)}
            labelBg="#FAF9FF"
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
  avatarPlaceholder: { backgroundColor: '#F0EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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