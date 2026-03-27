import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function AboutUsScreen() {
  const navigation = useNavigation();
  
  // State to handle which SPECIFIC popup is open
  const [activePopup, setActivePopup] = useState<string | null>(null);

  const closePopup = () => setActivePopup(null);

  // --- SPECIFIC CONTENT RENDERERS ---

  // 1. SOS Feature
  const renderSOSPopup = () => (
    <View style={styles.centerPopup}>
      <View style={[styles.largeIconBox, { backgroundColor: '#FFF0F0' }]}>
        <Ionicons name="warning" size={40} color="#FF4B4B" />
      </View>
      <Text style={styles.popupTitle}>SOS Alerts</Text>
      <Text style={styles.popupBodyText}>
        "In an emergency, every second counts. With a single tap, SafeNet sends a distress signal containing your live GPS coordinates to all your trusted guardians and local emergency services."
      </Text>
      <View style={styles.bulletPoint}>
         <Ionicons name="checkmark-circle" size={16} color="green" />
         <Text style={styles.bulletText}>Instant Notification</Text>
      </View>
      <View style={styles.bulletPoint}>
         <Ionicons name="checkmark-circle" size={16} color="green" />
         <Text style={styles.bulletText}>Works with Voice Command</Text>
      </View>
    </View>
  );

  // 2. Live Location Feature
  const renderLocationPopup = () => (
    <View style={styles.centerPopup}>
      <View style={[styles.largeIconBox, { backgroundColor: '#E3F2FD' }]}>
        <Ionicons name="locate" size={40} color="#2196F3" />
      </View>
      <Text style={styles.popupTitle}>Live Location</Text>
      <Text style={styles.popupBodyText}>
        "Share your real-time movements with guardians. Whether you are walking home alone or taking a cab, your loved ones can watch over you on a live map."
      </Text>
    </View>
  );

  // 3. Guardian Notify Feature
  const renderGuardianPopup = () => (
    <View style={styles.centerPopup}>
      <View style={[styles.largeIconBox, { backgroundColor: '#F3E5F5' }]}>
        <Ionicons name="shield" size={40} color="#6A5ACD" />
      </View>
      <Text style={styles.popupTitle}>Guardian Notify</Text>
      <Text style={styles.popupBodyText}>
        "Set up safe and risky zones. SafeNet automatically alerts your guardians when you enter or leave these designated areas, ensuring you don't have to text constantly."
      </Text>
    </View>
  );



  // Mission
  const renderMissionPopup = () => (
    <View style={styles.centerPopup}>
      <Ionicons name="ribbon" size={60} color="#0D47A1" />
      <Text style={[styles.popupTitle, {marginTop: 10}]}>Our Mission</Text>
      <Text style={styles.popupBodyText}>
        "Building a safer world through trusted communication and rapid response. We believe safety is a fundamental right, not a privilege."
      </Text>
    </View>
  );

  // Helper to choose what to render
  const renderContent = () => {
    switch(activePopup) {
        case 'sos': return renderSOSPopup();
        case 'location': return renderLocationPopup();
        case 'guardian': return renderGuardianPopup();
        case 'mission': return renderMissionPopup();
        default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
            <Ionicons name="menu" size={28} color="#2D2D2D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About Us</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <LinearGradient colors={['#1A2A3A', '#2C3E50']} style={styles.heroCard}>
             <View style={styles.badge}>
                <Ionicons name="shield-checkmark" size={14} color="#FFF" />
                <Text style={styles.badgeText}>Verified Safety</Text>
             </View>
             <Text style={styles.heroTitle}>Your Personal Safety Companion</Text>
          </LinearGradient>
          <Text style={styles.heroDescription}>
            We provide real-time emergency response solutions designed to keep you and your loved ones safe.
          </Text>
          <View style={styles.heroFooter}>
             <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#00C851" />
                <Text style={styles.featureText}>24/7 Monitoring</Text>
             </View>
             <View style={styles.featureRow}>
                <Ionicons name="flash" size={18} color="#6A5ACD" />
                <Text style={styles.featureText}>Instant Alert</Text>
             </View>
          </View>
        </View>

        {/* Key Features (Specific OnPress) */}
        <Text style={styles.sectionHeader}>KEY FEATURES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          
          <TouchableOpacity activeOpacity={0.8} onPress={() => setActivePopup('sos')} style={styles.featureCard}>
             <View style={[styles.iconBox, { backgroundColor: '#FFF0F0' }]}>
                <Ionicons name="warning" size={24} color="#FF4B4B" />
             </View>
             <Text style={styles.cardTitle}>SOS Alerts</Text>
             <Text style={styles.cardDesc}>One-tap instant distress signal to all contacts.</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setActivePopup('location')} style={styles.featureCard}>
             <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="locate" size={24} color="#2196F3" />
             </View>
             <Text style={styles.cardTitle}>Live Location</Text>
             <Text style={styles.cardDesc}>Real-time tracking for guardians.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity activeOpacity={0.8} onPress={() => setActivePopup('guardian')} style={styles.featureCard}>
             <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="shield" size={24} color="#6A5ACD" />
             </View>
             <Text style={styles.cardTitle}>Guardian Notify</Text>
             <Text style={styles.cardDesc}>Automatic alerts to your loved ones.</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* How It Works (Static) */}
        <Text style={styles.sectionHeader}>HOW IT WORKS</Text>
        <View style={styles.processContainer}>
            <View style={styles.processItem}>
                <View style={[styles.processIcon, { backgroundColor: '#FF4B4B' }]}>
                    <Ionicons name="hand-left" size={20} color="#FFF" />
                </View>
                <View style={styles.processTextContainer}>
                    <Text style={styles.processTitle}>Trigger Alert</Text>
                    <Text style={styles.processDesc}>Tap the SOS button.</Text>
                </View>
            </View>
            <View style={styles.connectorLine} />
            <View style={styles.processItem}>
                <View style={[styles.processIcon, { backgroundColor: '#2D3E90' }]}>
                    <Ionicons name="notifications" size={20} color="#FFF" />
                </View>
                <View style={styles.processTextContainer}>
                    <Text style={styles.processTitle}>Notify Guardians</Text>
                    <Text style={styles.processDesc}>Contacts receive your location instantly.</Text>
                </View>
            </View>
        </View>

        {/* Mission Footer (Specific OnPress) */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => setActivePopup('mission')} style={styles.missionCard}>
             <Ionicons name="ribbon" size={40} color="#0D47A1" />
             <Text style={styles.missionTitle}>Our Mission</Text>
             <Text style={styles.missionText}>
                "Building a safer world through trusted communication and rapid response."
             </Text>
        </TouchableOpacity>

        <View style={{height: 20}} />

      </ScrollView>

      {/* --- POPUP MODAL --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activePopup !== null}
        onRequestClose={closePopup}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closePopup}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
             {/* Close Button */}
             <TouchableOpacity style={styles.closeButton} onPress={closePopup}>
                <Ionicons name="close" size={24} color="#555" />
             </TouchableOpacity>

             {/* Dynamic Content */}
             {renderContent()}

          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1B4B' },
  
  heroContainer: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, marginBottom: 30, elevation: 2 },
  heroCard: { height: 150, borderRadius: 15, padding: 20, justifyContent: 'flex-end', marginBottom: 15 },
  badge: { position: 'absolute', top: 15, left: 15, flexDirection: 'row', backgroundColor: '#2196F3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignItems: 'center' },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginLeft: 5 },
  heroTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  heroDescription: { color: '#555', fontSize: 14, lineHeight: 22, marginBottom: 15 },
  heroFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 15 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  featureText: { marginLeft: 5, color: '#555', fontSize: 12, fontWeight: '600' },

  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#0D47A1', marginBottom: 15, letterSpacing: 1 },
  
  horizontalScroll: { marginBottom: 30, flexDirection: 'row' },
  featureCard: { backgroundColor: '#FFF', width: 140, padding: 15, borderRadius: 15, marginRight: 15, elevation: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontWeight: 'bold', marginBottom: 5, color: '#333' },
  cardDesc: { fontSize: 11, color: '#777', lineHeight: 16 },

  processContainer: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 30 },
  processItem: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 10 },
  processIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  connectorLine: { position: 'absolute', left: 40, top: 40, width: 2, height: 40, backgroundColor: '#EEE', zIndex: 1 },
  processTextContainer: { marginLeft: 15, flex: 1 },
  processTitle: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  processDesc: { color: '#777', fontSize: 13, marginTop: 4 },

  missionCard: { backgroundColor: '#E3F2FD', padding: 30, borderRadius: 20, alignItems: 'center', marginBottom: 20 },
  missionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10, color: '#0D47A1' },
  missionText: { textAlign: 'center', color: '#555', fontStyle: 'italic' },

  // --- NEW POPUP STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: width * 0.85,
    borderRadius: 20,
    padding: 25,
    elevation: 5,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  centerPopup: {
    alignItems: 'center',
  },
  largeIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  popupTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1B4B',
    marginBottom: 10,
    textAlign: 'center',
  },
  popupBodyText: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    lineHeight: 24,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
    marginLeft: 10
  },
  bulletText: {
    marginLeft: 8,
    color: '#555',
    fontSize: 14,
    fontWeight: '500'
  },
  popupStoryCard: {
    backgroundColor: '#F3F0FA',
    padding: 15,
    borderRadius: 12,
  },
  popupStoryText: {
    fontSize: 15,
    color: '#333',
    fontStyle: 'italic',
    marginBottom: 15,
    lineHeight: 22,
  },
  popupAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5
  },
});