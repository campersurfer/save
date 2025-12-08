import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
// BarCodeScanner may not work in Expo Go - handled gracefully
let BarCodeScanner: any = null;
try {
  BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner;
} catch (e) {
  console.log('expo-barcode-scanner not available');
}
import { ContentContext } from '../providers/ContentProvider';
import { Colors, Typography, Spacing, Geometry } from '../styles/BauhausDesign';
import { useTheme } from '../providers/ThemeProvider';

export default function AddScreen() {
  const { colors, isDark } = useTheme();
  const { addArticle, isLoading } = useContext(ContentContext);
  const [url, setUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  
  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  const validateUrl = (inputUrl: string): boolean => {
    try {
      const urlPattern = /^https?:\/\/.+/i;
      return urlPattern.test(inputUrl);
    } catch {
      return false;
    }
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    setIsValidUrl(validateUrl(text));
  };

  const handleAddArticle = async () => {
    if (!isValidUrl) {
      Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    try {
      await addArticle(url);
      setUrl('');
      setIsValidUrl(false);
      Alert.alert('Success', 'Article saved successfully!', [
        { text: 'OK' }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save article. Please try again.');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      
      // Check if clipboard contains a URL
      const urlPattern = /^https?:\/\/.+/i;
      if (urlPattern.test(clipboardContent.trim())) {
        handleUrlChange(clipboardContent.trim());
      } else {
        Alert.alert('No URL Found', 'The clipboard doesn\'t contain a valid URL.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to read from clipboard.');
    }
  };

  // QR Scanner functions
  const handleOpenScanner = async () => {
    if (!BarCodeScanner) {
      Alert.alert(
        'Development Build Required',
        'QR code scanning requires a development build. This feature is not available in Expo Go.\n\nYou can still paste URLs from your clipboard!',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status === 'granted') {
        setScanned(false);
        setShowScanner(true);
      } else {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to scan QR codes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error opening scanner:', error);
      // Handle case where native module isn't available (Expo Go)
      if (error.message?.includes('Cannot find native module')) {
        Alert.alert(
          'Development Build Required',
          'QR code scanning requires a development build. This feature is not available in Expo Go.\n\nYou can still paste URLs from your clipboard!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to open camera');
      }
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowScanner(false);
    
    // Check if scanned data is a URL
    const urlPattern = /^https?:\/\/.+/i;
    if (urlPattern.test(data.trim())) {
      handleUrlChange(data.trim());
      Alert.alert('URL Found!', `Scanned: ${data}`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setUrl('') },
        { text: 'Save Article', onPress: handleAddArticle }
      ]);
    } else {
      Alert.alert('Not a URL', 'The QR code does not contain a valid URL.');
    }
  };

  const handleShowShareExtensionInfo = () => {
    Alert.alert(
      'iOS Share Extension',
      'To save articles from Safari or other apps:\n\n' +
      '1. Open any article in Safari\n' +
      '2. Tap the Share button\n' +
      '3. Scroll and tap "Save"\n\n' +
      'Note: The Share Extension requires a production build. It\'s not available in Expo Go.',
      [{ text: 'Got it!' }]
    );
  };

  // Render QR Scanner Modal
  const renderScannerModal = () => {
    if (!BarCodeScanner) return null;
    
    return (
      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={[styles.scannerContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.scannerHeader, { backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.scannerTitle, { color: colors.text.primary }]}>Scan QR Code</Text>
            <View style={{ width: 28 }} />
          </View>
          
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
          />
          
          <View style={styles.scannerOverlay}>
            <View style={[styles.scannerFrame, { borderColor: colors.primary.blue }]} />
          </View>
          
          <Text style={[styles.scannerHint, { color: colors.text.primary, backgroundColor: colors.background }]}>
            Point your camera at a QR code containing a URL
          </Text>
        </View>
      </Modal>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Quick Actions</Text>
      
      <TouchableOpacity
        style={[
          styles.quickActionButton, 
          styles.quickActionHighlighted,
          { backgroundColor: colors.primary.blue, borderColor: colors.primary.blue }
        ]}
        onPress={handlePasteFromClipboard}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name="clipboard-outline" size={24} color={colors.primary.white} />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={[styles.quickActionTitle, { color: colors.primary.white }]}>Paste from Clipboard</Text>
          <Text style={[styles.quickActionDescription, { color: 'rgba(255,255,255,0.8)' }]}>
            Tap to paste URL from your clipboard
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.quickActionButton, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}
        onPress={handleOpenScanner}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="qr-code-outline" size={24} color={colors.primary.blue} />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={[styles.quickActionTitle, { color: colors.text.primary }]}>Scan QR Code</Text>
          <Text style={[styles.quickActionDescription, { color: colors.text.tertiary }]}>
            Scan QR code containing article URL
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.quickActionButton, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}
        onPress={handleShowShareExtensionInfo}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="share-outline" size={24} color={colors.primary.blue} />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={[styles.quickActionTitle, { color: colors.text.primary }]}>Share Extension</Text>
          <Text style={[styles.quickActionDescription, { color: colors.text.tertiary }]}>
            Save articles from other apps using iOS Share Sheet
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderSupportedSites = () => (
    <View style={styles.supportedSitesContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Supported Sites</Text>
      <Text style={[styles.sectionDescription, { color: colors.text.tertiary }]}>
        Nook app works with most websites and social media platforms
      </Text>

      <View style={styles.sitesGrid}>
        <View style={[styles.siteItem, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
          <Ionicons name="reader-outline" size={20} color={colors.text.tertiary} />
          <Text style={[styles.siteText, { color: colors.text.primary }]}>News Sites</Text>
        </View>
        <View style={[styles.siteItem, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
          <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
          <Text style={[styles.siteText, { color: colors.text.primary }]}>Twitter/X</Text>
        </View>
        <View style={[styles.siteItem, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
          <Ionicons name="logo-instagram" size={20} color="#E4405F" />
          <Text style={[styles.siteText, { color: colors.text.primary }]}>Instagram</Text>
        </View>
        <View style={[styles.siteItem, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
          <Ionicons name="musical-notes-outline" size={20} color={isDark ? "#FFFFFF" : "#000000"} />
          <Text style={[styles.siteText, { color: colors.text.primary }]}>TikTok</Text>
        </View>
        <View style={[styles.siteItem, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
          <Ionicons name="document-text-outline" size={20} color={colors.text.tertiary} />
          <Text style={[styles.siteText, { color: colors.text.primary }]}>Blogs</Text>
        </View>
        <View style={[styles.siteItem, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
          <Ionicons name="library-outline" size={20} color={colors.text.tertiary} />
          <Text style={[styles.siteText, { color: colors.text.primary }]}>Articles</Text>
        </View>
      </View>

      <View style={[styles.featuresContainer, { backgroundColor: colors.surface, borderColor: colors.surfaceHigh }]}>
        <Text style={[styles.featuresTitle, { color: colors.text.primary }]}>Powerful Extraction Features</Text>
        <View style={styles.featureItem}>
          <Ionicons name="shield-checkmark" size={16} color={colors.semantic.success} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>Paywall bypass for most sites</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="image" size={16} color={colors.semantic.success} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>Image and media preservation</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="color-palette" size={16} color={colors.semantic.success} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>Color extraction and mood detection</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="volume-high" size={16} color={colors.semantic.success} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>Text-to-speech ready content</Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Save Content</Text>
          <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
            Add articles, tweets, posts, PDF's, blogs and links to your reading list
          </Text>
        </View>

        {/* URL Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.text.primary }]}>Article URL</Text>
          <View style={[
            styles.inputWrapper,
            { backgroundColor: colors.surface, borderColor: colors.surfaceHigh },
            isValidUrl && styles.inputValid,
            url.length > 0 && !isValidUrl && styles.inputInvalid,
          ]}>
            <Ionicons 
              name="link-outline" 
              size={20} 
              color={isValidUrl ? colors.semantic.success : colors.text.tertiary} 
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: colors.text.primary }]}
              placeholder="https://example.com/article"
              placeholderTextColor={colors.text.tertiary}
              value={url}
              onChangeText={handleUrlChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleAddArticle}
              editable={!isLoading}
            />
            {url.length > 0 && (
              <TouchableOpacity
                onPress={() => handleUrlChange('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
          
          {url.length > 0 && !isValidUrl && (
            <Text style={styles.errorText}>
              Please enter a valid URL starting with http:// or https://
            </Text>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.surfaceHigh },
            isValidUrl && { backgroundColor: colors.primary.blue },
            isLoading && styles.saveButtonLoading,
          ]}
          onPress={handleAddArticle}
          disabled={!isValidUrl || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary.white} />
          ) : (
            <Ionicons name="bookmark" size={20} color={colors.text.primary} />
          )}
          <Text style={[styles.saveButtonText, { color: colors.text.primary }]}>
            {isLoading ? 'Saving...' : 'Save Article'}
          </Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Supported Sites */}
        {renderSupportedSites()}
      </ScrollView>
      
      {/* QR Scanner Modal */}
      {renderScannerModal()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: Typography.fontSize.h1,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.fontSize.body,
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: Typography.fontSize.body,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputValid: {
    borderColor: Colors.semantic.success,
  },
  inputInvalid: {
    borderColor: Colors.semantic.error,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    color: Colors.semantic.error,
    fontSize: 14,
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  saveButtonLoading: {
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickActionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  quickActionHighlighted: {
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 102, 255, 0.15)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  supportedSitesContainer: {
    paddingHorizontal: 24,
  },
  sitesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  siteText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  featuresContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 8,
  },
  // QR Scanner Styles
  scannerContainer: {
    flex: 1,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
});