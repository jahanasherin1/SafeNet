import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddGuardianScreen from '../app/guardians/add';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

jest.spyOn(Alert, 'alert');

describe('Sprint 1 - Guardian Module', () => {

  beforeEach(async () => {
    jest.clearAllMocks();
    // Simulate logged in user
    await AsyncStorage.setItem('user', JSON.stringify({ email: 'user@test.com' }));
  });

  // TC-S1-04: Verify adding guardian contact with valid details
  test('TC-S1-04: Guardian should be added successfully with valid details', async () => {
    (api.post as jest.Mock).mockResolvedValue({ status: 200 });

    const { getByPlaceholderText, getByText } = render(<AddGuardianScreen />);

    fireEvent.changeText(getByPlaceholderText("Enter guardian's full name"), 'Dad');
    fireEvent.changeText(getByPlaceholderText('Enter phone number'), '9876543210');
    fireEvent.changeText(getByPlaceholderText("Enter guardian's email"), 'dad@test.com');

    fireEvent.press(getByText('Add Guardian'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/guardian/add', expect.objectContaining({
        name: 'Dad',
        phone: '9876543210'
      }));
      expect(Alert.alert).toHaveBeenCalledWith("Success", expect.stringContaining("Guardian added"), expect.any(Array));
    });
  });

  // TC-S1-05: Verify adding guardian with invalid phone number
  test('TC-S1-05: System should show validation error for invalid phone number', async () => {
    const { getByPlaceholderText, getByText } = render(<AddGuardianScreen />);

    fireEvent.changeText(getByPlaceholderText("Enter guardian's full name"), 'Mom');
    fireEvent.changeText(getByPlaceholderText('Enter phone number'), '123'); // Invalid (too short)
    
    fireEvent.press(getByText('Add Guardian'));

    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled();
      // Based on your code logic in app/guardians/add.tsx:
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter a valid 10-digit phone number", expect.any(Array));
    });
  });
});