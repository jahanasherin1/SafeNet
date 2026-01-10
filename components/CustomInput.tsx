import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps {
  placeholder: string;
  value?: string;
  onChangeText?: (text: string) => void;
  isPassword?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  onIconPress?: () => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}

const CustomInput = ({ 
  placeholder, 
  value, 
  onChangeText, 
  isPassword, 
  iconName, 
  onIconPress,
  keyboardType = 'default' 
}: InputProps) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#7A7A7A"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword}
        keyboardType={keyboardType}
        autoCapitalize="none"
        multiline={false} 
        numberOfLines={1}
        
        // Native Android Colors
        cursorColor="#6A5ACD"       
        selectionColor="#6A5ACD"    
        underlineColorAndroid="transparent"
      />
      {iconName && (
        <TouchableOpacity onPress={onIconPress} style={styles.iconContainer}>
          <Ionicons name={iconName} size={22} color="#7A7A7A" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F0FA',
    borderRadius: 12,
    height: 60,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#2D2D2D',
    fontSize: 16,
    textAlignVertical: 'center',
    paddingVertical: 0,
    
    // --- WEB FIX START ---
    // This removes the yellow/blue outline on Web Browsers
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
    // --- WEB FIX END ---
  },
  iconContainer: {
    padding: 5,
    marginLeft: 5,
  },
});

export default CustomInput;