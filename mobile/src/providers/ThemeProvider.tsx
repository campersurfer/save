import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Light mode colors
export const LightColors = {
  primary: {
    blue: '#0066FF',
    yellow: '#FFD700',
    red: '#FF3B30',
    black: '#000000',
    white: '#FFFFFF',
  },
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceHigh: '#E8E8ED',
  border: '#D1D1D6',
  text: {
    primary: '#1C1C1E',
    secondary: '#3C3C43',
    tertiary: '#8E8E93',
    inverse: '#FFFFFF',
  },
  semantic: {
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#0066FF',
  },
  mood: {
    light: '#FFD700',
    dark: '#8E8E93',
    warm: '#FF6B6B',
    cool: '#4ECDC4',
    neutral: '#0066FF',
  },
};

// Dark mode colors (existing)
export const DarkColors = {
  primary: {
    blue: '#0066FF',
    yellow: '#FFD700',
    red: '#FF3B30',
    black: '#000000',
    white: '#FFFFFF',
  },
  background: '#0A0A0B',
  surface: '#1A1A1C',
  surfaceHigh: '#2A2A2C',
  border: '#3A3A3C',
  text: {
    primary: '#FFFFFF',
    secondary: '#CCCCCC',
    tertiary: '#6B6B70',
    inverse: '#0A0A0B',
  },
  semantic: {
    success: '#4CAF50',
    warning: '#FFD700',
    error: '#FF3B30',
    info: '#0066FF',
  },
  mood: {
    light: '#FFD700',
    dark: '#4A4A4A',
    warm: '#FF6B6B',
    cool: '#4ECDC4',
    neutral: '#0066FF',
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  colors: typeof DarkColors;
}

const THEME_STORAGE_KEY = 'save_app_theme';

export const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  themeMode: 'dark',
  setThemeMode: async () => {},
  colors: DarkColors,
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, []);

  // Determine if dark mode should be active
  const isDark = themeMode === 'dark' || 
    (themeMode === 'system' && systemColorScheme === 'dark');

  // Get the appropriate color set
  const colors = isDark ? DarkColors : LightColors;

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, setThemeMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for easy access
export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
