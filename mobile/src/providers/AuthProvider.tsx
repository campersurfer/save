import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';

// Types
export interface User {
  id: string;
  email: string | null;
  fullName: string | null;
  authProvider: 'apple' | 'email';
  createdAt: string;
  isPremium: boolean;
  subscriptionExpiresAt: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  
  // Auth methods
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  
  // Biometrics
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  authenticateWithBiometrics: () => Promise<boolean>;
  
  // Account management
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  biometricsAvailable: false,
  biometricsEnabled: false,
  signInWithApple: async () => {},
  signInWithEmail: async () => {},
  verifyEmailCode: async () => {},
  signOut: async () => {},
  enableBiometrics: async () => false,
  disableBiometrics: async () => {},
  authenticateWithBiometrics: async () => false,
  deleteAccount: async () => {},
});

// Storage keys
const STORAGE_KEYS = {
  USER: '@nook_user',
  AUTH_TOKEN: 'nook_auth_token',
  BIOMETRICS_ENABLED: '@nook_biometrics_enabled',
  PENDING_EMAIL: '@nook_pending_email',
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
    checkBiometricsAvailability();
  }, []);

  const checkAuthState = async () => {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (userJson) {
        const savedUser = JSON.parse(userJson) as User;
        setUser(savedUser);
        
        // Check if biometrics is enabled and prompt
        const biometricsEnabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
        if (biometricsEnabled === 'true') {
          setBiometricsEnabled(true);
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkBiometricsAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(compatible && enrolled);
    } catch (error) {
      console.error('Error checking biometrics:', error);
      setBiometricsAvailable(false);
    }
  };

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    try {
      // Check if Apple Auth is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Sign in with Apple is not available on this device.');
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Create user from Apple credential
      const newUser: User = {
        id: credential.user,
        email: credential.email,
        fullName: credential.fullName 
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() || null
          : null,
        authProvider: 'apple',
        createdAt: new Date().toISOString(),
        isPremium: false,
        subscriptionExpiresAt: null,
      };

      // Save user
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      
      // Save auth token securely (in production, this would be a JWT from your backend)
      if (credential.identityToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, credential.identityToken);
      }

      setUser(newUser);
      
      // Mark onboarding as complete
      await AsyncStorage.setItem('@has_onboarded', 'true');
      
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled - do nothing
        return;
      }
      console.error('Apple Sign In Error:', error);
      Alert.alert('Sign In Failed', 'Unable to sign in with Apple. Please try again.');
    }
  }, []);

  // Sign in with Email (Magic Link / OTP)
  const signInWithEmail = useCallback(async (email: string) => {
    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }

      // In production, this would call your backend to send a verification code
      // For now, we'll simulate it
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_EMAIL, email);
      
      // Simulate sending code (in production, call your API)
      console.log(`Verification code sent to ${email}`);
      
      // For demo purposes, show the code
      Alert.alert(
        'Verification Code Sent',
        `A 6-digit code has been sent to ${email}.\n\nFor demo: use code 123456`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Email Sign In Error:', error);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    }
  }, []);

  // Verify email code
  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    try {
      // In production, verify the code with your backend
      // For demo, accept "123456"
      if (code !== '123456') {
        Alert.alert('Invalid Code', 'The verification code is incorrect. Please try again.');
        return;
      }

      // Create user from email
      const newUser: User = {
        id: `email_${Date.now()}`,
        email: email,
        fullName: null,
        authProvider: 'email',
        createdAt: new Date().toISOString(),
        isPremium: false,
        subscriptionExpiresAt: null,
      };

      // Save user
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
      
      setUser(newUser);
      
      // Mark onboarding as complete
      await AsyncStorage.setItem('@has_onboarded', 'true');
      
    } catch (error) {
      console.error('Verify Code Error:', error);
      Alert.alert('Error', 'Failed to verify code. Please try again.');
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
      setUser(null);
      setBiometricsEnabled(false);
    } catch (error) {
      console.error('Sign Out Error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  }, []);

  // Enable biometrics
  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      if (!biometricsAvailable) {
        Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRICS_ENABLED, 'true');
        setBiometricsEnabled(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Enable Biometrics Error:', error);
      return false;
    }
  }, [biometricsAvailable]);

  // Disable biometrics
  const disableBiometrics = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
      setBiometricsEnabled(false);
    } catch (error) {
      console.error('Disable Biometrics Error:', error);
    }
  }, []);

  // Authenticate with biometrics
  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      if (!biometricsAvailable || !biometricsEnabled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Nook',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Biometric Auth Error:', error);
      return false;
    }
  }, [biometricsAvailable, biometricsEnabled]);

  // Delete account
  const deleteAccount = useCallback(async () => {
    try {
      // In production, call your backend to delete user data
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRICS_ENABLED);
      await AsyncStorage.removeItem('@has_onboarded');
      
      // Clear all app data
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      
      setUser(null);
      setBiometricsEnabled(false);
      
      Alert.alert('Account Deleted', 'Your account and all data have been deleted.');
    } catch (error) {
      console.error('Delete Account Error:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    }
  }, []);

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    biometricsAvailable,
    biometricsEnabled,
    signInWithApple,
    signInWithEmail,
    verifyEmailCode,
    signOut,
    enableBiometrics,
    disableBiometrics,
    authenticateWithBiometrics,
    deleteAccount,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
