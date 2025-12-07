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

// Import providers
import { AudioProvider } from './src/providers/AudioProvider';
import { ContentProvider } from './src/providers/ContentProvider';
import { ThemeProvider, ThemeContext, useTheme } from './src/providers/ThemeProvider';

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

// Inner app component that can use theme context
function AppContent() {
  const { colors, isDark } = useTheme();
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
    try {
      await AsyncStorage.setItem('@has_onboarded', 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
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

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navigationTheme}>
        {showOnboarding ? (
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        ) : (
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
        )}
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ContentProvider>
          <AudioProvider>
            <AppContent />
          </AudioProvider>
        </ContentProvider>
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