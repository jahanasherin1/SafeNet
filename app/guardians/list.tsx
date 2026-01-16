import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import PrimaryButton from '../../components/PrimaryButton'; 

export default function GuardianListScreen() {
  const router = useRouter();
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);

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
        // FIX: Route path updated to match backend
        const response = await api.post('/guardian/all', {
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

  // Helper to get initials
  const getInitials = (name: string) => {
    const names = name.split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
  };

  const renderGuardianItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      
      <View style={styles.initialsContainer}>
        <Text style={styles.initialsText}>{getInitials(item.name || "Guardian")}</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
        {item.relationship ? <Text style={styles.relation}>{item.relationship}</Text> : null}
      </View>

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

        <View style={styles.addButtonContainer}>
          <PrimaryButton 
            title="Add Guardian"
            onPress={() => router.push('/guardians/add')}
          />
        </View>

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
    borderRadius: 15,
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#FFFFFF', 
    elevation: 1, 
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }
  },
  
  initialsContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFEAD1', 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  initialsText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E65100', 
  },

  infoContainer: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1A1B4B' },
  phone: { fontSize: 14, color: '#6A5ACD', marginTop: 2 },
  relation: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
  editIcon: { padding: 10 },

  footerNote: {
    textAlign: 'center',
    color: '#7A7A7A',
    fontSize: 13,
    marginBottom: 10,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
  addButtonContainer: {
    alignSelf: 'center',
    width: '60%',
    marginBottom: 20,
  },
  emptyText: { textAlign: 'center', color: '#7A7A7A', marginTop: 20, fontStyle: 'italic' }
});