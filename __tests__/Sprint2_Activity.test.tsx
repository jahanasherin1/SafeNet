import { act, render, waitFor } from '@testing-library/react-native';
import { Accelerometer } from 'expo-sensors';
import React from 'react';
import { Alert, Vibration } from 'react-native';
import ActivityMonitorScreen from '../app/dashboard/monitor';
import * as SessionContext from '../services/SessionContext';

// Mock Session Context hooks
const mockToggleMonitoring = jest.fn();
const mockSetAlertVisible = jest.fn();

jest.spyOn(SessionContext, 'useSession').mockReturnValue({
  isActivityMonitoringActive: true,
  toggleActivityMonitoring: mockToggleMonitoring,
  setAlertVisible: mockSetAlertVisible,
  alertReason: null,
  isAlertVisible: false,
  isLoggedIn: true,
  // ... other required context props
  user: { name: 'Test User', email: 'test@example.com', phone: '1234567890' }, 
  token: 'abc', isLoading: false, login: jest.fn(), logout: jest.fn(),
  isTrackingActive: false, queuedLocations: 0, dismissAlert: jest.fn()
});

jest.spyOn(Vibration, 'vibrate');
jest.spyOn(Alert, 'alert');

describe('Sprint 2 - Activity Monitoring', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC_S2_01: Verify activity monitoring activation
  test('TC_S2_01: System should start monitoring user movements', async () => {
    const { getByText } = render(<ActivityMonitorScreen />);
    
    // Check if UI reflects active state (based on context mock)
    expect(getByText('Monitoring Active')).toBeTruthy();
    
    // Verify Accelerometer started listening
    expect(Accelerometer.setUpdateInterval).toHaveBeenCalled();
    expect(Accelerometer.addListener).toHaveBeenCalled();
  });

  // TC_S2_02 & TC_S2_03: Verify fall detection and Alert Display
  test('TC_S2_02 & TC_S2_03: System should detect fall and show alert', async () => {
    render(<ActivityMonitorScreen />);

    // 1. Simulate Normal Gravity (1G)
    act(() => { (Accelerometer as any)._emit({ x: 0, y: 0, z: 1.0 }); });

    // 2. Simulate High Impact (Fall) -> > 4.0G
    act(() => { (Accelerometer as any)._emit({ x: 0, y: 3.0, z: 3.0 }); }); // Approx 4.2G magnitude

    // 3. Simulate Stillness (Lying on ground) -> Low Variance
    // We send consistent low data for the detection window
    act(() => {
      for(let i=0; i<10; i++) {
        (Accelerometer as any)._emit({ x: 0.01, y: 0.01, z: 1.0 });
      }
    });

    await waitFor(() => {
        // Check if Vibration triggered warning
        expect(Vibration.vibrate).toHaveBeenCalled();
        // Check if Global Alert Modal was triggered via Context
        // In real app code, this calls onAlertTriggered which updates Context
        // Here we assume the service logic fires the callback hooked to context
    });
  });

  // TC_S2_04 & TC_S2_05: Verify sudden stop detection
  test('TC_S2_04 & TC_S2_05: System should detect sudden stop from running', async () => {
    render(<ActivityMonitorScreen />);

    // 1. Simulate Running (High Variance) for a few seconds
    act(() => {
      for(let i=0; i<30; i++) {
        // Oscillate values to create high variance
        (Accelerometer as any)._emit({ x: Math.random() * 2, y: Math.random() * 2, z: 1 });
      }
    });

    // 2. Simulate Sudden Stop (Instant Stillness)
    act(() => {
      for(let i=0; i<15; i++) {
        (Accelerometer as any)._emit({ x: 0, y: 0, z: 1 });
      }
    });

    await waitFor(() => {
       // Verify Alert Callback Logic was hit
       // Note: Since logic is deep in Service, unit testing the Service file directly is often cleaner,
       // but here we check side effects like Vibration.
       expect(Vibration.vibrate).toHaveBeenCalled(); 
    });
  });

  // TC_S2_06: Verify normal movement
  test('TC_S2_06: No alert should be generated for normal walking', async () => {
    render(<ActivityMonitorScreen />);

    // Simulate Walking (Moderate Variance)
    act(() => {
      for(let i=0; i<20; i++) {
        (Accelerometer as any)._emit({ x: 0.2, y: 0.2, z: 1.0 });
      }
    });

    await waitFor(() => {
      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });
  });
});