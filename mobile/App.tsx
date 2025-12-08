import React, { useState, useEffect, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import design system
import { Typography, Components } from './src/styles/BauhausDesign';

// Import screens
import FeedScreen from './src/screens/FeedScreen';
import MindScreen from './src/screens/MindScreen';
import AddScreen from './src/screens/AddScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ArticleDetailScreen from './src/screens/ArticleDetailScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';

// Import providers
import { AudioProvider } from './src/providers/AudioProvider';
import { ContentProvider } from './src/providers/ContentProvider';
import { ThemeProvider, ThemeContext, useTheme } from './src/providers/ThemeProvider';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { PaymentProvider } from './src/providers/PaymentProvider';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabNavigator() {
  const { colors, isDark } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Feed') {
            iconName = focused ? 'reader' : 'reader-outline';
          } else if (route.name === 'Mind') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Add') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.blue,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          height: 90,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.background,
          borderTopColor: colors.surface,
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomColor: colors.surface,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontFamily: Typography.fontFamily.heading,
          fontWeight: Typography.fontWeight.semibold,
          fontSize: Typography.fontSize.h4,
        },
      })}
    >
      <Tab.Screen 
        name="Feed" 
        component={FeedScreen}
        options={{
          title: 'Feed',
          headerTitle: 'Nook Feed',
        }}
      />
      <Tab.Screen 
        name="Mind" 
        component={MindScreen}
        options={{
          title: 'Mind',
          headerTitle: 'Visual Mind',
        }}
      />
      <Tab.Screen 
        name="Add" 
        component={AddScreen}
        options={{
          title: 'Add',
          headerTitle: 'Save Content',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

// Inner app component that can use theme and auth context
function AppContent() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasOnboarded = await AsyncStorage.getItem('@has_onboarded');
      setShowOnboarding(hasOnboarded !== 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    // Don't mark as complete - auth screen will do that after sign in
    setShowOnboarding(false);
  };

  // Create custom navigation theme
  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: colors.primary.blue,
      background: colors.background,
      card: colors.surface,
      text: colors.text.primary,
      border: colors.border,
      notification: colors.primary.blue,
    },
    fonts: isDark ? DarkTheme.fonts : DefaultTheme.fonts,
  };

  if (isLoading || authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
      </View>
    );
  }

  // Determine which screen to show
  const renderContent = () => {
    // Show onboarding first for new users
    if (showOnboarding) {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }
    
    // Show auth screen if not authenticated
    if (!isAuthenticated) {
      return <AuthScreen />;
    }
    
    // Show main app
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen 
          name="ArticleDetail" 
          component={ArticleDetailScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navigationTheme}>
        {renderContent()}
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PaymentProvider>
            <ContentProvider>
              <AudioProvider>
                <AppContent />
              </AudioProvider>
            </ContentProvider>
          </PaymentProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});