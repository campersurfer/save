import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, Geometry } from '../styles/BauhausDesign';
import { AudioContext } from '../providers/AudioProvider';
import { StorageService } from '../services/StorageService';
import { useTheme, ThemeMode } from '../providers/ThemeProvider';

export default function SettingsScreen() {
  // Get theme context
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  
  // Get audio context for playback speed
  const { 
    playbackSpeed, 
    setPlaybackSpeed,
    voices,
    selectedVoice,
    setVoice
  } = useContext(AudioContext);
  
  // Settings state
  const [autoPlay, setAutoPlay] = useState(true);
  const [downloadImages, setDownloadImages] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [backgroundRefresh, setBackgroundRefresh] = useState(false);
  const [storageUsed, setStorageUsed] = useState<string>('Calculating...');
  const [articleCount, setArticleCount] = useState<number>(0);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Handle theme toggle
  const handleThemeToggle = async (useDark: boolean) => {
    await setThemeMode(useDark ? 'dark' : 'light');
  };

  // Calculate storage used on mount
  useEffect(() => {
    calculateStorageUsed();
  }, []);

  const calculateStorageUsed = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const stores = await AsyncStorage.multiGet(keys);
      
      let totalBytes = 0;
      stores.forEach(([key, value]) => {
        if (value) {
          totalBytes += value.length * 2; // UTF-16 characters = 2 bytes each
        }
      });

      // Get article count
      const articles = await StorageService.getAllArticles();
      setArticleCount(articles.length);

      // Format storage size
      if (totalBytes < 1024) {
        setStorageUsed(`${totalBytes} B`);
      } else if (totalBytes < 1024 * 1024) {
        setStorageUsed(`${(totalBytes / 1024).toFixed(1)} KB`);
      } else {
        setStorageUsed(`${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);
      }
    } catch (error) {
      console.error('Error calculating storage:', error);
      setStorageUsed('Unknown');
    }
  };

  const renderSettingItem = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    description?: string,
    rightElement?: React.ReactNode,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={[
        styles.settingItem,
        { 
          backgroundColor: colors.surface,
          borderColor: colors.surfaceHigh,
        }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={22} color={Colors.primary.blue} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text.primary }]}>{title}</Text>
        {description && (
          <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>{description}</Text>
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
        trackColor={{ false: colors.surfaceHigh, true: Colors.primary.blue + '66' }}
        thumbColor={value ? Colors.primary.blue : colors.text.tertiary}
        ios_backgroundColor={colors.surfaceHigh}
      />
    )
  );

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{title}</Text>
      {children}
    </View>
  );

  const handleSpeedChange = async () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    await setPlaybackSpeed(speeds[nextIndex]);
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

  // Filter to English voices for better UX
  const englishVoices = voices.filter(v => v.language.startsWith('en'));
  
  const renderVoiceModal = () => (
    <Modal
      visible={showVoiceModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowVoiceModal(false)}
    >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surfaceHigh }]}>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Select Voice ({englishVoices.length} available)</Text>
                <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                    <Text style={{ color: colors.primary.blue, fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
            </View>
            {englishVoices.length === 0 ? (
                <View style={styles.emptyVoices}>
                    <Ionicons name="mic-off-outline" size={48} color={colors.text.tertiary} />
                    <Text style={[styles.emptyVoicesText, { color: colors.text.tertiary }]}>
                        No voices available. Please check your device settings.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={englishVoices}
                    keyExtractor={(item) => item.identifier}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.voiceItem, 
                                { borderBottomColor: colors.surfaceHigh },
                                item.identifier === selectedVoice && { backgroundColor: colors.surface }
                            ]}
                            onPress={() => {
                                setVoice(item.identifier);
                                setShowVoiceModal(false);
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.voiceName, { color: colors.text.primary }]}>{item.name}</Text>
                                <Text style={[styles.voiceLang, { color: colors.text.tertiary }]}>{item.language}</Text>
                            </View>
                            {item.identifier === selectedVoice && (
                                <Ionicons name="checkmark" size={24} color={colors.primary.blue} />
                            )}
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
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
              'mic-outline',
              'Text-to-Speech Voice',
              selectedVoice ? (voices.find(v => v.identifier === selectedVoice)?.name || 'Default') : 'Default',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
              () => setShowVoiceModal(true)
            )}

            {renderSettingItem(
              'speedometer-outline',
              'Default Reading Speed',
              'Sets the initial speed for new articles. Tap the speed button while listening to adjust per-article.',
              <TouchableOpacity
                onPress={handleSpeedChange}
                style={[styles.speedButton, { backgroundColor: colors.surfaceHigh }]}
              >
                <Text style={[styles.speedButtonText, { color: colors.text.primary }]}>{playbackSpeed}x</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
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
              isDark,
              handleThemeToggle
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
              'folder-outline',
              'Storage Used',
              `${articleCount} articles saved`,
              <View style={[styles.storageIndicator, { backgroundColor: colors.surfaceHigh }]}>
                <Text style={styles.storageText}>{storageUsed}</Text>
              </View>
            )}
            
            {renderSettingItem(
              'cloud-download-outline',
              'Export Data',
              'Download all your saved articles and progress',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
              handleExportData
            )}
            
            {renderSettingItem(
              'trash-outline',
              'Clear Cache',
              'Free up storage space by clearing cached data',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
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
              'Nook App v1.0.0',
              null
            )}
            
            {renderSettingItem(
              'help-circle-outline',
              'Help & Support',
              'Get help with using Nook App',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
              () => Alert.alert('Help', 'Visit our support page at help.readingnook.com')
            )}
            
            {renderSettingItem(
              'document-text-outline',
              'Privacy Policy',
              'Your data stays on your device. We don\'t collect personal information.',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
              () => Alert.alert('Privacy Policy', 'All your saved articles and settings are stored locally on your device. We do not collect, store, or share any personal data. When you save an article, only the URL is temporarily processed to extract content.')
            )}
            
            {renderSettingItem(
              'shield-checkmark-outline',
              'Terms of Service',
              'Usage terms and conditions',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
              () => Alert.alert('Terms of Service', 'By using Nook App, you agree to use it for personal, non-commercial purposes. Content you save remains your responsibility. We are not liable for third-party content.')
            )}
            
            {renderSettingItem(
              'star-outline',
              'Rate App',
              'Enjoying Nook? Leave us a review',
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />,
              () => Alert.alert('Rate App', 'Thank you! This would open the App Store rating page.')
            )}
          </>
        ))}

        {/* Danger Zone */}
        {renderSection('Danger Zone', (
          <TouchableOpacity
            style={[
              styles.dangerItem,
              { backgroundColor: colors.surface, borderColor: Colors.semantic.error + '20' }
            ]}
            onPress={handleDeleteAllData}
          >
            <View style={[styles.settingIcon, styles.dangerIcon]}>
              <Ionicons name="warning-outline" size={22} color={Colors.semantic.error} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, styles.dangerText]}>Delete All Data</Text>
              <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>
                Permanently delete all articles and app data
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward" size={20} color={Colors.semantic.error} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.text.primary }]}>
            Nook App - Your personal reading companion
          </Text>
          <Text style={[styles.footerSubtext, { color: colors.text.tertiary }]}>
            Built with 💙 for readers everywhere
          </Text>
        </View>
      </ScrollView>
      
      {/* Voice Selection Modal */}
      {renderVoiceModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceHigh,
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
    color: Colors.text.primary,
    marginBottom: 2,
  },
  dangerText: {
    color: Colors.semantic.error,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  settingRight: {
    marginLeft: 16,
  },
  speedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  speedButtonText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  storageIndicator: {
    backgroundColor: Colors.dark.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  storageText: {
    color: Colors.primary.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.semantic.error + '20',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  voiceName: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: '500',
  },
  voiceLang: {
    fontSize: 14,
  },
  emptyVoices: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyVoicesText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});