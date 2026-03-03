import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BottomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  
  // 1. Define screens that should NOT appear in the bottom bar
  const hiddenRoutes = ['edit-profile', 'start-journey','monitor-journey','fake-call','active-call','monitor','zone-activity','contact-authorities', 'app-about', '+not-found'];
  
  // 2. Check if current screen should hide the entire tab bar
  const currentRoute = state.routes[state.index];
  if (hiddenRoutes.includes(currentRoute.name)) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          if (hiddenRoutes.includes(route.name)) {
            return null;
          }

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
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={iconName} 
                size={22} 
                color={isFocused ? '#6A5ACD' : '#AAAAAA'} 
                style={{ marginBottom: 4 }}
              />
              <Text style={[
                styles.tabLabel, 
                { color: isFocused ? '#6A5ACD' : '#AAAAAA' }
              ]}>
                {label as string}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 18,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: '100%',
    elevation: 16,
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default BottomTabBar;