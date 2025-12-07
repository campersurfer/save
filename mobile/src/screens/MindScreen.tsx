import React, { useState, useContext, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
// ImagePicker is imported but may not work in Expo Go - handled gracefully in handlePickImage
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.log('expo-image-picker not available');
}
import { ContentContext } from '../providers/ContentProvider';
import { VisualCard } from '../components/VisualCard';
import { MasonryGrid } from '../components/MasonryGrid';
import { Typography, Spacing, Geometry } from '../styles/BauhausDesign';
import { useTheme } from '../providers/ThemeProvider';
import { Article } from '../services/StorageService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 8;
const COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - (COLUMNS + 1) * CARD_MARGIN) / COLUMNS;

type TypeFilter = 'all' | 'article' | 'tweet' | 'instagram' | 'tiktok' | 'note';

export default function MindScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { articles, isLoading, refreshArticles, addNote } = useContext(ContentContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  
  // Note creation modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => setShowNoteModal(true)} 
          style={{ marginRight: 16 }}
        >
          <Ionicons name="add" size={28} color={colors.primary.blue} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // Extract all unique tags
  const getAllTags = () => {
    const tags = new Set<string>();
    articles.forEach(item => {
      item.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  };

  const allTags = getAllTags();

  const filteredItems = articles.filter(item => {
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(query) &&
          !item.content.toLowerCase().includes(query) &&
          !(item.author?.toLowerCase().includes(query)) &&
          !(item.tags?.some(tag => tag.toLowerCase().includes(query)))) {
        return false;
      }
    }

    // Tag filter
    if (selectedTag && (!item.tags || !item.tags.includes(selectedTag))) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all' && item.type !== typeFilter) {
      return false;
    }

    return true;
  });

  // Note creation functions
  const handlePickImage = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'Development Build Required',
        'Image picking requires a development build. This feature is not available in Expo Go.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setNoteImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      // Handle case where native module isn't available (Expo Go)
      if (error.message?.includes('Cannot find native module')) {
        Alert.alert(
          'Development Build Required',
          'Image picking requires a development build. This feature is not available in Expo Go.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to pick image');
      }
    }
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !noteImage) {
      Alert.alert('Empty Note', 'Please add some text or an image to your note.');
      return;
    }

    setIsSavingNote(true);
    try {
      await addNote(
        noteTitle.trim() || 'Quick Note',
        noteContent.trim(),
        noteImage || undefined
      );
      
      // Reset form and close modal
      setNoteTitle('');
      setNoteContent('');
      setNoteImage(null);
      setShowNoteModal(false);
      
      Alert.alert('Success', 'Note saved to your Mind!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleCloseNoteModal = () => {
    if (noteContent.trim() || noteImage) {
      Alert.alert(
        'Discard Note?',
        'You have unsaved changes. Are you sure you want to discard this note?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              setNoteTitle('');
              setNoteContent('');
              setNoteImage(null);
              setShowNoteModal(false);
            }
          }
        ]
      );
    } else {
      setShowNoteModal(false);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="grid-outline" size={80} color={colors.text.tertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Your Visual Mind</Text>
      <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
        Save visual content to see your AI-generated tags and organization
      </Text>
    </View>
  );

  const renderFilters = () => (
    <View style={[styles.filtersContainer, { backgroundColor: colors.background, borderBottomColor: colors.surface }]}>
      {/* AI Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="sparkles" size={20} color={colors.primary.blue} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text.primary }]}
          placeholder="Ask your AI Mind..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* AI Tags */}
      {allTags.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedTag === null && { backgroundColor: colors.primary.blue, borderColor: colors.primary.blue }
            ]}
            onPress={() => setSelectedTag(null)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.text.tertiary },
              selectedTag === null && { color: colors.text.inverse }
            ]}>
              All Tags
            </Text>
          </TouchableOpacity>
          
          {allTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedTag === tag && { backgroundColor: colors.primary.blue, borderColor: colors.primary.blue }
              ]}
              onPress={() => setSelectedTag(tag === selectedTag ? null : tag)}
            >
              <Text style={[
                styles.filterText,
                { color: colors.text.tertiary },
                selectedTag === tag && { color: colors.text.inverse }
              ]}>
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Type Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {(['all', 'article', 'tweet', 'instagram', 'tiktok', 'note'] as TypeFilter[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              typeFilter === type && { backgroundColor: colors.primary.blue, borderColor: colors.primary.blue }
            ]}
            onPress={() => setTypeFilter(type)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.text.tertiary },
              typeFilter === type && { color: colors.text.inverse }
            ]}>
              {type === 'all' ? 'All Types' : type === 'note' ? 'Notes' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStats = () => (
    <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
      <Text style={[styles.statsTitle, { color: colors.text.primary }]}>
        {filteredItems.length} items • AI Knowledge Graph
      </Text>
    </View>
  );

  // Render note creation modal
  const renderNoteModal = () => (
    <Modal
      visible={showNoteModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseNoteModal}
    >
      <KeyboardAvoidingView 
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
          <TouchableOpacity onPress={handleCloseNoteModal}>
            <Text style={[styles.modalCancelText, { color: colors.text.tertiary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text.primary }]}>New Note</Text>
          <TouchableOpacity 
            onPress={handleSaveNote}
            disabled={isSavingNote || (!noteContent.trim() && !noteImage)}
          >
            <Text style={[
              styles.modalSaveText,
              { color: colors.primary.blue },
              (isSavingNote || (!noteContent.trim() && !noteImage)) && styles.modalSaveTextDisabled
            ]}>
              {isSavingNote ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          {/* Title Input */}
          <TextInput
            style={[styles.noteTitleInput, { backgroundColor: colors.surface, color: colors.text.primary }]}
            placeholder="Title (optional)"
            placeholderTextColor={colors.text.tertiary}
            value={noteTitle}
            onChangeText={setNoteTitle}
            maxLength={100}
          />

          {/* Content Input */}
          <TextInput
            style={[styles.noteContentInput, { backgroundColor: colors.surface, color: colors.text.primary }]}
            placeholder="What's on your mind? Type a note, paste text, or add an image..."
            placeholderTextColor={colors.text.tertiary}
            value={noteContent}
            onChangeText={setNoteContent}
            multiline
            textAlignVertical="top"
          />

          {/* Image Preview */}
          {noteImage && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: noteImage }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={[styles.removeImageButton, { backgroundColor: colors.background }]}
                onPress={() => setNoteImage(null)}
              >
                <Ionicons name="close-circle" size={28} color={colors.semantic.error} />
              </TouchableOpacity>
            </View>
          )}

          {/* Add Image Button */}
          <TouchableOpacity 
            style={[styles.addImageButton, { backgroundColor: colors.surface, borderColor: colors.border }]} 
            onPress={handlePickImage}
          >
            <Ionicons name="image-outline" size={24} color={colors.primary.blue} />
            <Text style={[styles.addImageText, { color: colors.primary.blue }]}>
              {noteImage ? 'Change Image' : 'Add Image'}
            </Text>
          </TouchableOpacity>

          {/* Tips */}
          <View style={[styles.noteTips, { backgroundColor: colors.surface }]}>
            <Text style={[styles.noteTipTitle, { color: colors.text.primary }]}>Tips:</Text>
            <Text style={[styles.noteTipText, { color: colors.text.tertiary }]}>• Use #hashtags to add tags</Text>
            <Text style={[styles.noteTipText, { color: colors.text.tertiary }]}>• Notes appear in your Visual Mind</Text>
            <Text style={[styles.noteTipText, { color: colors.text.tertiary }]}>• Add images to make visual cards</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshArticles}
            tintColor={colors.primary.blue}
            colors={[colors.primary.blue]}
          />
        }
      >
        {renderFilters()}
        {renderStats()}
        
        {filteredItems.length === 0 ? (
          renderEmptyState()
        ) : (
          <MasonryGrid
            data={filteredItems}
            cardWidth={CARD_WIDTH}
            margin={CARD_MARGIN}
            renderItem={(item, index, itemWidth) => (
              <VisualCard
                key={item.id}
                item={item}
                width={itemWidth}
                onPress={() => {
                  // Handle item press - could navigate to detail or expand
                }}
              />
            )}
          />
        )}
      </ScrollView>

      {/* Note Creation Modal */}
      {renderNoteModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersContainer: {
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveTextDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  noteTitleInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  noteContentInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    marginBottom: 16,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 14,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addImageText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  noteTips: {
    borderRadius: 12,
    padding: 16,
  },
  noteTipTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteTipText: {
    fontSize: 14,
    lineHeight: 22,
  },
});