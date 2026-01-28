// jest.setup.js
import 'react-native-gesture-handler/jestSetup';

// Mock Async Storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

// Mock API (Axios)
jest.mock('./app/services/api', () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: { baseURL: 'http://localhost' },
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
}));

// Mock Expo Location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 10.0, longitude: 76.0 }
  })),
}));

// Mock Expo Task Manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

// Mock Expo Sensors
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    addListener: jest.fn(),
    setUpdateInterval: jest.fn(),
  },
  Pedometer: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    watchStepCount: jest.fn(),
  },
}));

// Silence warning messages in console during tests
global.console = {
  ...console,
  error: jest.fn(), 
  warn: jest.fn(), 
};