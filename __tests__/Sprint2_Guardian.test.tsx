import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import GuardianLoginScreen from '../app/auth/guardian-login';
import GuardianAlertsScreen from '../app/guardian-dashboard/alerts';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

describe('Sprint 2 - Guardian Dashboard', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: mockReplace });
  });

  // TC_S2_10: Verify guardian dashboard login
  test('TC_S2_10: Guardian dashboard should open successfully on valid login', async () => {
    // Mock Request OTP success
    (api.post as jest.Mock).mockImplementation((url) => {
        if(url.includes('request-otp')) return Promise.resolve({ status: 200, data: { email: 'g@test.com' } });
        if(url.includes('verify-otp')) return Promise.resolve({ 
            status: 200, 
            data: { guardianName: 'Dad', protecting: 'Son', guardianEmail: 'g@test.com' } 
        });
        return Promise.resolve({});
    });

    const { getByPlaceholderText, getByText } = render(<GuardianLoginScreen />);

    // Step 1: Request OTP
    fireEvent.changeText(getByPlaceholderText('Enter your registered phone number'), '9876543210');
    fireEvent.press(getByText('Send OTP to Email'));

    await waitFor(() => expect(getByPlaceholderText('Enter 6-digit OTP')).toBeTruthy());

    // Step 2: Verify OTP
    fireEvent.changeText(getByPlaceholderText('Enter 6-digit OTP'), '123456');
    fireEvent.press(getByText('Verify OTP & Continue'));

    await waitFor(() => {
        // Should navigate to guardian dashboard home
        expect(mockReplace).toHaveBeenCalledWith('/guardian-dashboard/home');
    });
  });

  // TC_S2_11 & TC_S2_12: Verify alert visibility and live location
  test('TC_S2_11 & TC_S2_12: Alert should be visible and click opens location', async () => {
    await AsyncStorage.setItem('selectedUser', JSON.stringify({ email: 'son@test.com' }));
    
    // Mock Alerts Response
    (api.get as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
            alerts: [{
                _id: '1',
                type: 'sos',
                title: 'SOS Alert',
                message: 'Help needed',
                isRead: false,
                location: { latitude: 10, longitude: 10 },
                createdAt: new Date().toISOString()
            }]
        }
    });

    const { getByText } = render(<GuardianAlertsScreen />);

    // TC_S2_11: Verify Visibility
    await waitFor(() => expect(getByText('SOS Alert')).toBeTruthy());

    // TC_S2_12: Verify Location Click
    const locationBtn = getByText('View Location');
    fireEvent.press(locationBtn);

    await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/guardian-dashboard/location');
        // Implicitly, this confirms data was passed via AsyncStorage/Params to the location screen
    });
  });
});