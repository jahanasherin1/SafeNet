import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const BottomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  
  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

        // --- ADD THIS LOGIC HERE ---
        // If href is set to null in _layout.tsx, do not render this button
        if ((options as any).href === null) return null;
        // ---------------------------

        const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        // Icon Mapping
        let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
        if (route.name === 'home') iconName = isFocused ? 'home' : 'home-outline';
        if (route.name === 'location') iconName = isFocused ? 'location' : 'location-outline';
        if (route.name === 'alerts') iconName = isFocused ? 'notifications' : 'notifications-outline';
        if (route.name === 'profile') iconName = isFocused ? 'person' : 'person-outline';

        return (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={styles.tabButton}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={iconName} 
              size={24} 
              color={isFocused ? '#6A5ACD' : '#7A7A7A'} 
              style={{ marginBottom: 4 }}
            />
            <Text style={[
              styles.tabLabel, 
              { color: isFocused ? '#6A5ACD' : '#7A7A7A' }
            ]}>
              {label as string}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E6F0',
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  }
});

export default BottomTabBar;