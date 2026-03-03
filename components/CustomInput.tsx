import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface InputProps {
  placeholder: string;
  value?: string;
  onChangeText?: (text: string) => void;
  isPassword?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  onIconPress?: () => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  onBlur?: () => void;
  /** Background color of the parent screen — used to make the floating label cut the border cleanly */
  labelBg?: string;
}

const CustomInput = ({
  placeholder,
  value,
  onChangeText,
  isPassword,
  iconName,
  onIconPress,
  keyboardType = 'default',
  onBlur,
  labelBg = '#FFFFFF',
}: InputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  // Animate: 0 = resting inside field, 1 = floating above border
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(labelAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(labelAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
    onBlur?.();
  };

  const labelTop = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [18, -10] });
  const labelSize = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] });
  const labelColor = isFocused ? '#6A5ACD' : '#7A7A7A';
  const borderColor = isFocused ? '#6A5ACD' : '#BDBDBD';
  const borderWidth = isFocused ? 2 : 1.5;

  return (
    <View style={[styles.container, { borderColor, borderWidth }]}>
      {/* Floating label */}
      <Animated.Text
        style={[
          styles.label,
          {
            top: labelTop,
            fontSize: labelSize,
            color: labelColor,
            backgroundColor: labelBg,
          },
        ]}
        pointerEvents="none"
      >
        {placeholder}
      </Animated.Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword}
        keyboardType={keyboardType}
        autoCapitalize="none"
        multiline={false}
        numberOfLines={1}
        onFocus={handleFocus}
        onBlur={handleBlur}
        // Native Android
        cursorColor="#6A5ACD"
        selectionColor="#6A5ACD"
        underlineColorAndroid="transparent"
        {...(Platform.OS === 'web' ? ({ style: [styles.input, { outlineStyle: 'none' }] } as any) : {})}
      />

      {iconName && (
        <TouchableOpacity onPress={onIconPress} style={styles.iconContainer}>
          <Ionicons name={iconName} size={22} color={isFocused ? '#6A5ACD' : '#7A7A7A'} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    height: 58,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    position: 'relative',
  },
  label: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#2D2D2D',
    fontSize: 16,
    textAlignVertical: 'center',
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  iconContainer: {
    padding: 5,
    marginLeft: 5,
  },
});

export default CustomInput;