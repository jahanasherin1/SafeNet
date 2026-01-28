import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignupScreen from '../app/auth/signup';
import LoginScreen from '../app/auth/login';
import api from '../services/api';
import { Alert } from 'react-native';

// Mock Alert for React Native
jest.spyOn(Alert, 'alert');

describe('Sprint 1 - Authentication Module', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-S1-01: Verify user registration with valid details
  test('TC-S1-01: User should be registered successfully with valid details', async () => {
    (api.post as jest.Mock).mockResolvedValue({ status: 201, data: { user: { id: '123' } } });

    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    fireEvent.changeText(getByPlaceholderText('Enter Name'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('Enter Phone Number'), '9876543210');
    fireEvent.changeText(getByPlaceholderText('Enter Email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');

    const button = getByText('Create Account');
    fireEvent.press(button);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/signup', expect.objectContaining({
        email: 'john@test.com',
        phone: '9876543210'
      }));
    });
  });

  // TC-S1-02: Verify registration with existing email
  test('TC-S1-02: System should show error message for existing email', async () => {
    // Mock backend returning 400 error
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { message: 'User already exists' } }
    });

    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    fireEvent.changeText(getByPlaceholderText('Enter Name'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('Enter Phone Number'), '9876543210');
    fireEvent.changeText(getByPlaceholderText('Enter Email'), 'existing@test.com'); // Existing
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');

    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
       // Check if Alert was called with error message (Checking Native Alert or Web Alert)
       // Note: In your code you use a helper showAlert, we assume it triggers Alert.alert on native
       expect(Alert.alert).toHaveBeenCalledWith("Registration Error", "User already exists", expect.any(Array));
    });
  });

  // TC-S1-03: Verify registration with blank fields
  test('TC-S1-03: System should prompt to fill mandatory fields (Blank Inputs)', async () => {
    const { getByText } = render(<SignupScreen />);
    
    // Press without filling anything
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      // API should NOT be called
      expect(api.post).not.toHaveBeenCalled();
      // Check for validation error messages rendered on screen (from your code: errors.name, etc.)
      expect(getByText('Name must be at least 2 characters')).toBeTruthy();
    });
  });

  // TC-S1-13: Verify logout and re-login functionality
  test('TC-S1-13: User should login successfully with valid credentials', async () => {
    (api.post as jest.Mock).mockResolvedValue({ 
      status: 200, 
      data: { user: { name: 'John' }, token: 'abc-123' } 
    });

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'password123');
    
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'john@test.com',
        password: 'password123'
      });
    });
  });
});