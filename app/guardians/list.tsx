import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

export default function GuardianListScreen() {
  const router = useRouter();
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Guardians when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchGuardians();
    }, [])
  );

  const fetchGuardians = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        
        const response = await api.post('/guardians/all', {
          userEmail: user.email
        });

        if (response.status === 200) {
          setGuardians(response.data.guardians);
        }
      }
    } catch (error) {
      console.error("Error fetching guardians", error);
    } finally {
      setLoading(false);
    }
  };

  const renderGuardianItem = ({ item, index }: { item: any, index: number }) => (
    <View style={styles.card}>
      {/* Dynamic Avatar based on index to show different faces */}
      <Image 
        source={{ uri: `https://i.pravatar.cc/150?u=${item._id || index}` }} 
        style={styles.avatar} 
      />
      
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
        {item.relationship && <Text style={styles.relation}>{item.relationship}</Text>}
      </View>

      {/* UPDATED: Navigate to Edit Screen with Params */}
      <TouchableOpacity 
        style={styles.editIcon}
        onPress={() => router.push({
            pathname: '/guardians/edit',
            params: { 
                _id: item._id, 
                name: item.name, 
                phone: item.phone, 
                email: item.email || '', 
                relationship: item.relationship || '' 
            }
        })}
      >
        <Ionicons name="pencil" size={20} color="#1A1B4B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trusted Guardians</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Guardian List</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#6A5ACD" style={{marginTop: 20}} />
        ) : (
          <FlatList
            data={guardians}
            renderItem={renderGuardianItem}
            keyExtractor={(item: any) => item._id || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No guardians added yet.</Text>
            }
          />
        )}

        <Text style={styles.footerNote}>
          SOS alerts and live location are shared only with your trusted guardians
        </Text>

        {/* Add Guardian Button */}
        <TouchableOpacity 
          style={styles.addButtonContainer}
          onPress={() => router.push('/guardians/add')}
        >
          <LinearGradient
            colors={['#7E68B8', '#6A5ACD']}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>Add Guardian</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1B4B' },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1B4B', marginBottom: 15 },
  
  listContainer: { paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEAD1', // Light orange background from screenshot
    borderRadius: 15, // Circle-ish background isn't standard in list, assuming card style or transparent
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'transparent' // Resetting to match screenshot specific look (User avatars have bg)
  },
  
  // To match screenshot exactly: The entire row isn't colored, just the layout
  avatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#FFD8B1', // Fallback color matching screenshot avatar bg
    borderWidth: 2,
    borderColor: '#FFF'
  },
  infoContainer: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  phone: { fontSize: 14, color: '#6A5ACD', marginTop: 2 },
  relation: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
  
  editIcon: { padding: 10 },

  footerNote: {
    textAlign: 'center',
    color: '#2D2D2D',
    fontSize: 14,
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  addButtonContainer: {
    alignSelf: 'center',
    width: '60%',
    marginBottom: 30,
  },
  addButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#7A7A7A', marginTop: 20, fontStyle: 'italic' }
});