import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  title: string;
  onPress: () => void;
  width?: any; // Optional width if you want smaller buttons
}

const PrimaryButton = ({ title, onPress, width = '100%' }: Props) => {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.8} 
      style={[styles.container, { width }]}
    >
      <LinearGradient
        colors={['#C18FFF', '#6A5ACD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 55,
    marginTop: 10,
    marginBottom: 20,
    // Shadow for the button
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PrimaryButton;