import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  // Settings state
  const [autoPlay, setAutoPlay] = useState(true);
  const [downloadImages, setDownloadImages] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [backgroundRefresh, setBackgroundRefresh] = useState(false);
  const [defaultSpeed, setDefaultSpeed] = useState(1.0);

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderSettingItem = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    description?: string,
    rightElement?: React.ReactNode,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={22} color="#0066FF" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <View style={styles.settingRight}>
        {rightElement}
      </View>
    </TouchableOpacity>
  );

  const renderSwitchItem = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void
  ) => (
    renderSettingItem(
      icon,
      title,
      description,
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#2A2A2C', true: '#0066FF40' }}
        thumbColor={value ? '#0066FF' : '#6B6B70'}
      />
    )
  );

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(defaultSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setDefaultSpeed(speeds[nextIndex]);
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Export all your saved articles and reading progress?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          // Implement data export
          Alert.alert('Export Started', 'Your data export will be ready shortly.');
        }}
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached images and data to free up space.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          Alert.alert('Cache Cleared', 'App cache has been cleared successfully.');
        }}
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your saved articles and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Data Deleted', 'All your data has been permanently deleted.');
        }}
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Reading Settings */}
        {renderSection('Reading', (
          <>
            {renderSwitchItem(
              'play-circle-outline',
              'Auto-play TTS',
              'Automatically start text-to-speech when opening articles',
              autoPlay,
              setAutoPlay
            )}
            
            {renderSettingItem(
              'speedometer-outline',
              'Default Reading Speed',
              `Current speed: ${defaultSpeed}x`,
              <TouchableOpacity
                onPress={handleSpeedChange}
                style={styles.speedButton}
              >
                <Text style={styles.speedButtonText}>{defaultSpeed}x</Text>
                <Ionicons name="chevron-forward" size={16} color="#6B6B70" />
              </TouchableOpacity>,
              handleSpeedChange
            )}
          </>
        ))}

        {/* Content Settings */}
        {renderSection('Content', (
          <>
            {renderSwitchItem(
              'image-outline',
              'Download Images',
              'Save images locally for offline viewing',
              downloadImages,
              setDownloadImages
            )}
            
            {renderSwitchItem(
              'refresh-outline',
              'Background Refresh',
              'Check for new content when app is in background',
              backgroundRefresh,
              setBackgroundRefresh
            )}
          </>
        ))}

        {/* App Settings */}
        {renderSection('App', (
          <>
            {renderSwitchItem(
              'moon-outline',
              'Dark Mode',
              'Use dark theme throughout the app',
              darkMode,
              setDarkMode
            )}
            
            {renderSwitchItem(
              'notifications-outline',
              'Notifications',
              'Receive notifications for new articles and updates',
              notifications,
              setNotifications
            )}
          </>
        ))}

        {/* Account & Data */}
        {renderSection('Account & Data', (
          <>
            {renderSettingItem(
              'cloud-download-outline',
              'Export Data',
              'Download all your saved articles and progress',
              <Ionicons name="chevron-forward" size={20} color="#6B6B70" />,
              handleExportData
            )}
            
            {renderSettingItem(
              'trash-outline',
              'Clear Cache',
              'Free up storage space by clearing cached data',
              <Ionicons name="chevron-forward" size={20} color="#6B6B70" />,
              handleClearCache
            )}
          </>
        ))}

        {/* About */}
        {renderSection('About', (
          <>
            {renderSettingItem(
              'information-circle-outline',
              'App Version',
              'Save App v1.0.0',
              null
            )}
            
            {renderSettingItem(
              'help-circle-outline',
              'Help & Support',
              'Get help with using Save App',
              <Ionicons name="chevron-forward" size={20} color="#6B6B70" />,
              () => Alert.alert('Help', 'Visit our support page at help.saveapp.com')
            )}
            
            {renderSettingItem(
              'document-text-outline',
              'Privacy Policy',
              'Learn how we protect your data',
              <Ionicons name="chevron-forward" size={20} color="#6B6B70" />,
              () => Alert.alert('Privacy', 'View our privacy policy at saveapp.com/privacy')
            )}
            
            {renderSettingItem(
              'star-outline',
              'Rate App',
              'Enjoying Save? Leave us a review',
              <Ionicons name="chevron-forward" size={20} color="#6B6B70" />,
              () => Alert.alert('Rate App', 'Thank you! This would open the App Store rating page.')
            )}
          </>
        ))}

        {/* Danger Zone */}
        {renderSection('Danger Zone', (
          <TouchableOpacity
            style={styles.dangerItem}
            onPress={handleDeleteAllData}
          >
            <View style={[styles.settingIcon, styles.dangerIcon]}>
              <Ionicons name="warning-outline" size={22} color="#F44336" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, styles.dangerText]}>Delete All Data</Text>
              <Text style={styles.settingDescription}>
                Permanently delete all articles and app data
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward" size={20} color="#F44336" />
            </View>
          </TouchableOpacity>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Save App - Your personal reading companion
          </Text>
          <Text style={styles.footerSubtext}>
            Built with 💙 for readers everywhere
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    marginHorizontal: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
    marginHorizontal: 16,
    marginBottom: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  settingIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0, 102, 255, 0.15)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dangerIcon: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  dangerText: {
    color: '#F44336',
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B6B70',
    lineHeight: 18,
  },
  settingRight: {
    marginLeft: 16,
  },
  speedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  speedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
    marginHorizontal: 16,
    marginBottom: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F4433620',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#6B6B70',
    textAlign: 'center',
  },
});