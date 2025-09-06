import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import design system
import { Colors, Typography, Components } from './src/styles/BauhausDesign';

// Import screens
import FeedScreen from './src/screens/FeedScreen';
import MindScreen from './src/screens/MindScreen';
import AddScreen from './src/screens/AddScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ArticleDetailScreen from './src/screens/ArticleDetailScreen';

// Import providers
import { AudioProvider } from './src/providers/AudioProvider';
import { ContentProvider } from './src/providers/ContentProvider';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabNavigator() {
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
        tabBarActiveTintColor: Colors.primary.blue,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          ...Components.tabBar,
        },
        headerStyle: {
          backgroundColor: Colors.dark.background,
          borderBottomColor: Colors.dark.surface,
          borderBottomWidth: 1,
        },
        headerTintColor: Colors.text.primary,
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
          headerTitle: 'Save Feed',
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

export default function App() {
  return (
    <SafeAreaProvider>
      <ContentProvider>
        <AudioProvider>
          <NavigationContainer>
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
          </NavigationContainer>
          <StatusBar style="light" backgroundColor={Colors.dark.background} />
        </AudioProvider>
      </ContentProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
});