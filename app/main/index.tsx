import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const handleRoleSelect = (role: 'user' | 'guardian') => {
    if (role === 'user') {
      router.push('/auth/login'); 
    } else {
      router.push('/auth/guardian-login');
    }
  };

  const openMenu = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Changed ScrollView to View to force fit on screen */}
      <View style={styles.content}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={openMenu}>
            <Ionicons name="menu" size={28} color="#4748a3ff" />
          </TouchableOpacity>
          <Text style={styles.logoText}>SafeNet</Text>
          <View style={{ width: 28 }} /> 
        </View>

        {/* Hero Image Section */}
        <LinearGradient
          colors={['#F3F0FA', '#E6E1F5']}
          style={styles.heroCard}
        >
          <View style={styles.shieldIconContainer}>
             <Ionicons name="shield" size={40} color="#FF4B4B" />
             <View style={styles.lockIconOverlay}>
                <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
             </View>
          </View>
        </LinearGradient>

        {/* Text Section */}
        <View style={styles.textSection}>
          <Text style={styles.title}>Stay Safe,</Text>
          <Text style={styles.title}>Stay Connected.</Text>
          <Text style={styles.subtitle}>
            Instant emergency response and community support when you need it most.
          </Text>
        </View>

        {/* Role Selection */}
        <View style={styles.roleSection}>
          <View style={styles.dividerContainer}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>SELECT YOUR ROLE</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.cardsContainer}>
            <TouchableOpacity 
              style={styles.roleCard} 
              onPress={() => handleRoleSelect('user')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="person" size={28} color="#2196F3" />
              </View>
              <Text style={styles.roleText}>User</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.roleCard} 
              onPress={() => handleRoleSelect('guardian')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="shield-checkmark" size={28} color="#6A5ACD" />
              </View>
              <Text style={styles.roleText}>Guardian</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footerText}>
          Instant alerts. Trusted support. Real-time safety.
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  content: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'space-between' // This creates equal space between elements to fit the screen
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center'
    // Removed marginBottom to let flexbox handle spacing
  },
  logoText: { fontSize: 24, fontWeight: 'bold', color: '#4748a3ff' },
  
  // Hero Card
  heroCard: { 
    height: '30%', // Changed fixed height to percentage for responsiveness
    maxHeight: 220,
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#6A5ACD', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 20, 
    elevation: 5 
  },
  shieldIconContainer: { width: 70, height: 80, justifyContent: 'center', alignItems: 'center' },
  lockIconOverlay: { position: 'absolute', top: 28 },
  
  // Text Section
  textSection: { alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#4748a3ff', textAlign: 'center', lineHeight: 36 },
  subtitle: { marginTop: 10, fontSize: 14, color: '#4b4949ff', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  
  // Role Section
  roleSection: { width: '100%' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' },
  line: { height: 1, backgroundColor: '#E0E0E0', width: 60 },
  dividerText: { marginHorizontal: 10, color: '#393a3dff', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  
  cardsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  roleCard: { 
    backgroundColor: '#FFFFFF', 
    width: '47%', 
    paddingVertical: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  roleText: { fontSize: 16, fontWeight: '700', color: '#1A1B4B' },
  
  footerText: { textAlign: 'center', color: '#6d6a6aff', fontSize: 12 },
});