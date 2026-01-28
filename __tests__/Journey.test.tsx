import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StartJourneyScreen from '../app/dashboard/start-journey';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

jest.spyOn(Alert, 'alert');

describe('Sprint 1 - Journey Module', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.setItem('user', JSON.stringify({ email: 'traveler@test.com' }));
    // Mock initial status check to return inactive journey
    (api.post as jest.Mock).mockImplementation((url) => {
        if(url === '/journey/status') return Promise.resolve({ data: { journey: { isActive: false } } });
        return Promise.resolve({ status: 200, data: { journey: { isActive: true } } });
    });
  });

  // TC-S1-10: Verify journey destination setup
  test('TC-S1-10: Journey should be saved successfully with destination', async () => {
    const { getByPlaceholderText, getByText } = render(<StartJourneyScreen />);

    // Wait for initial status check
    await waitFor(() => {});

    // Fill Destination
    fireEvent.changeText(getByPlaceholderText('Enter destination'), 'Home');
    
    // Press Start
    fireEvent.press(getByText('Start Journey'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/journey/start', expect.objectContaining({
        email: 'traveler@test.com',
        destination: 'Home'
      }));
      expect(Alert.alert).toHaveBeenCalledWith("Journey Started", expect.anything());
    });
  });

  // TC-S1-12: Verify journey completion before time
  test('TC-S1-12: User should be able to end journey safely', async () => {
    // Mock initial status to be ACTIVE
    (api.post as jest.Mock).mockImplementation((url) => {
        if(url === '/journey/status') {
            return Promise.resolve({ 
                data: { 
                    journey: { 
                        isActive: true, 
                        destination: 'Home', 
                        startTime: new Date().toISOString() 
                    } 
                } 
            });
        }
        if(url === '/journey/end') return Promise.resolve({ status: 200 });
        return Promise.resolve({});
    });

    const { getByText, findByText } = render(<StartJourneyScreen />);

    // Wait for screen to render Active state
    const endButton = await findByText("End Journey - I'm Safe");
    
    fireEvent.press(endButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/journey/end', { email: 'traveler@test.com' });
      expect(Alert.alert).toHaveBeenCalledWith("Journey Ended", expect.anything());
    });
  });
});