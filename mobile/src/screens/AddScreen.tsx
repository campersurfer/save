import React, { useState, useContext } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { ContentContext } from '../providers/ContentProvider';

export default function AddScreen() {
  const { addArticle, isLoading } = useContext(ContentContext);
  const [url, setUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);

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

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={handlePasteFromClipboard}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="clipboard-outline" size={24} color="#0066FF" />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={styles.quickActionTitle}>Paste from Clipboard</Text>
          <Text style={styles.quickActionDescription}>
            Automatically paste URL from your clipboard
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B6B70" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => Alert.alert('Coming Soon', 'Scan QR code feature will be available soon!')}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="qr-code-outline" size={24} color="#0066FF" />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={styles.quickActionTitle}>Scan QR Code</Text>
          <Text style={styles.quickActionDescription}>
            Scan QR code containing article URL
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B6B70" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => Alert.alert('Coming Soon', 'Share Extension is available in iOS Settings!')}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="share-outline" size={24} color="#0066FF" />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={styles.quickActionTitle}>Share Extension</Text>
          <Text style={styles.quickActionDescription}>
            Save articles from other apps using iOS Share Sheet
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B6B70" />
      </TouchableOpacity>
    </View>
  );

  const renderSupportedSites = () => (
    <View style={styles.supportedSitesContainer}>
      <Text style={styles.sectionTitle}>Supported Sites</Text>
      <Text style={styles.sectionDescription}>
        Save app works with most websites and social media platforms
      </Text>

      <View style={styles.sitesGrid}>
        <View style={styles.siteItem}>
          <Ionicons name="reader-outline" size={20} color="#6B6B70" />
          <Text style={styles.siteText}>News Sites</Text>
        </View>
        <View style={styles.siteItem}>
          <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
          <Text style={styles.siteText}>Twitter/X</Text>
        </View>
        <View style={styles.siteItem}>
          <Ionicons name="logo-instagram" size={20} color="#E4405F" />
          <Text style={styles.siteText}>Instagram</Text>
        </View>
        <View style={styles.siteItem}>
          <Ionicons name="musical-notes-outline" size={20} color="#000000" />
          <Text style={styles.siteText}>TikTok</Text>
        </View>
        <View style={styles.siteItem}>
          <Ionicons name="document-text-outline" size={20} color="#6B6B70" />
          <Text style={styles.siteText}>Blogs</Text>
        </View>
        <View style={styles.siteItem}>
          <Ionicons name="library-outline" size={20} color="#6B6B70" />
          <Text style={styles.siteText}>Articles</Text>
        </View>
      </View>

      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Powerful Extraction Features</Text>
        <View style={styles.featureItem}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.featureText}>Paywall bypass for most sites</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="image" size={16} color="#4CAF50" />
          <Text style={styles.featureText}>Image and media preservation</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="color-palette" size={16} color="#4CAF50" />
          <Text style={styles.featureText}>Color extraction and mood detection</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="volume-high" size={16} color="#4CAF50" />
          <Text style={styles.featureText}>Text-to-speech ready content</Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Save Content</Text>
          <Text style={styles.subtitle}>
            Add articles, tweets, and posts to your reading list
          </Text>
        </View>

        {/* URL Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Article URL</Text>
          <View style={[
            styles.inputWrapper,
            isValidUrl && styles.inputValid,
            url.length > 0 && !isValidUrl && styles.inputInvalid,
          ]}>
            <Ionicons 
              name="link-outline" 
              size={20} 
              color={isValidUrl ? '#4CAF50' : '#6B6B70'} 
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder="https://example.com/article"
              placeholderTextColor="#6B6B70"
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
                <Ionicons name="close-circle" size={20} color="#6B6B70" />
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
            isValidUrl && styles.saveButtonEnabled,
            isLoading && styles.saveButtonLoading,
          ]}
          onPress={handleAddArticle}
          disabled={!isValidUrl || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="bookmark" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Saving...' : 'Save Article'}
          </Text>
        </TouchableOpacity>

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Supported Sites */}
        {renderSupportedSites()}
      </ScrollView>
    </KeyboardAvoidingView>
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
  header: {
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B70',
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2A2A2C',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputValid: {
    borderColor: '#4CAF50',
  },
  inputInvalid: {
    borderColor: '#F44336',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2C',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  saveButtonEnabled: {
    backgroundColor: '#0066FF',
  },
  saveButtonLoading: {
    backgroundColor: '#0066FF80',
  },
  saveButtonText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B6B70',
    marginBottom: 16,
    lineHeight: 20,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
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
    color: '#FFFFFF',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 14,
    color: '#6B6B70',
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
    backgroundColor: '#1A1A1C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  siteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  featuresContainer: {
    backgroundColor: '#1A1A1C',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: '#CCCCCC',
    fontSize: 14,
    marginLeft: 8,
  },
});