import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  Linking,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { AudioContext } from '../providers/AudioProvider';
import { ContentContext } from '../providers/ContentProvider';
import { Typography, Spacing, Geometry, Shadows } from '../styles/BauhausDesign';
import { useTheme } from '../providers/ThemeProvider';

type RootStackParamList = {
  ArticleDetail: {
    articleId?: string;
    article?: any; // Legacy support for old navigation
  };
};

type ArticleDetailRouteProp = RouteProp<RootStackParamList, 'ArticleDetail'>;

export default function ArticleDetailScreen() {
  const route = useRoute<ArticleDetailRouteProp>();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  
  // Support both new (articleId) and legacy (article) params
  const articleId = route.params?.articleId || route.params?.article?.id;
  
  const { isPlaying, currentArticle, playArticle, pausePlayback, resumePlayback } = useContext(AudioContext);
  const { articles, markAsRead, deleteArticle } = useContext(ContentContext);
  
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(false);

  // Look up article from context by ID
  const article = articleId ? articles.find(a => a.id === articleId) : null;

  useEffect(() => {
    // Mark article as read when screen is opened
    if (article && !article.readAt) {
      markAsRead(article.id);
    }
  }, [article, markAsRead]);

  useEffect(() => {
    if (article) {
      setIsCurrentlyPlaying(isPlaying && currentArticle?.id === article.id);
    }
  }, [isPlaying, currentArticle, article]);

  // Handle case where article is not found
  if (!article) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.text.tertiary} />
          <Text style={[styles.errorText, { color: colors.text.tertiary }]}>Article not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.errorButton, { backgroundColor: colors.primary.blue }]}>
            <Text style={[styles.errorButtonText, { color: colors.text.inverse }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handlePlayPause = async () => {
    try {
      if (isCurrentlyPlaying) {
        await pausePlayback();
      } else if (currentArticle?.id === article.id) {
        await resumePlayback();
      } else {
        await playArticle(article);
      }
    } catch (error) {
      Alert.alert('Audio Error', 'Failed to play article');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${article.title}\n\n${article.url}`,
        url: article.url,
        title: article.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleOpenOriginal = () => {
    Linking.openURL(article.url);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Article',
      'Are you sure you want to delete this article?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteArticle(article.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete article');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  const getMoodColor = (): string => {
    if (article.dominantColor) return article.dominantColor;
    
    switch (article.mood) {
      case 'light': return colors.mood.light;
      case 'dark': return colors.mood.dark;
      case 'warm': return colors.mood.warm;
      case 'cool': return colors.mood.cool;
      case 'neutral':
      default: return colors.mood.neutral;
    }
  };

  const getTypeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (article.type) {
      case 'article': return 'reader-outline';
      case 'tweet': return 'logo-twitter';
      case 'instagram': return 'logo-instagram';
      case 'tiktok': return 'musical-notes-outline';
      default: return 'document-outline';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surface }]}>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color={colors.semantic.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Article Image */}
        {article.imageUrl && (
          <Image source={{ uri: article.imageUrl }} style={[styles.articleImage, { backgroundColor: colors.surface }]} />
        )}

        {/* Article Header Info */}
        <View style={[styles.articleHeader, { borderBottomColor: colors.surface }]}>
          <View style={styles.articleMeta}>
            <View style={styles.typeContainer}>
              <Ionicons name={getTypeIcon()} size={16} color={getMoodColor()} />
              <Text style={[styles.typeText, { color: getMoodColor() }]}>
                {article.type.toUpperCase()}
              </Text>
            </View>
            
            <Text style={[styles.dateText, { color: colors.text.tertiary }]}>{formatDate(article.savedAt)}</Text>
          </View>

          {/* Article Title */}
          <Text style={[styles.articleTitle, { color: colors.text.primary }]}>{article.title}</Text>

          {/* Author & Reading Time */}
          <View style={styles.articleSubMeta}>
            {article.author && (
              <Text style={[styles.authorText, { color: colors.text.secondary }]}>By {article.author}</Text>
            )}
            
            {article.readTime && (
              <Text style={[styles.readTimeText, { color: colors.text.tertiary }]}>
                {article.readTime} min read
              </Text>
            )}
          </View>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {article.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { borderColor: getMoodColor() }]}>
                  <Text style={[styles.tagText, { color: getMoodColor() }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Article Content */}
        <View style={styles.contentContainer}>
          <Text style={[styles.articleContent, { color: colors.text.secondary }]}>
            {article.content || 'No content available to read.'}
          </Text>
        </View>

        {/* Source Link */}
        <TouchableOpacity 
          style={[styles.sourceButton, { backgroundColor: colors.surface, borderColor: colors.primary.blue }]} 
          onPress={handleOpenOriginal}
        >
          <Ionicons name="open-outline" size={20} color={colors.primary.blue} />
          <Text style={[styles.sourceButtonText, { color: colors.primary.blue }]}>Read Original Article</Text>
        </TouchableOpacity>

        {/* Bottom padding for audio player */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Audio Control */}
      <View style={[
        styles.audioControl, 
        { 
          backgroundColor: colors.surface, 
          borderColor: colors.surfaceHigh,
          shadowColor: colors.text.primary
        }
      ]}>
        <TouchableOpacity 
          style={[styles.playButton, { backgroundColor: getMoodColor() }]} 
          onPress={handlePlayPause}
        >
          <Ionicons 
            name={isCurrentlyPlaying ? "pause" : "play"} 
            size={24} 
            color={colors.primary.white} 
          />
        </TouchableOpacity>
        
        <View style={styles.audioInfo}>
          <Text style={[styles.audioTitle, { color: colors.text.tertiary }]} numberOfLines={1}>
            {isCurrentlyPlaying ? 'Now Playing' : 'Listen to Article'}
          </Text>
          <Text style={[styles.audioSubtitle, { color: colors.text.primary }]} numberOfLines={1}>
            {article.title}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: Spacing.sm,
    borderRadius: Geometry.borderRadius.medium,
  },
  headerActions: {
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
  },
  articleImage: {
    width: '100%',
    height: 200,
  },
  articleHeader: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: 4,
  },
  dateText: {
    fontSize: Typography.fontSize.small,
  },
  articleTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: Typography.fontSize.h2 * 1.3,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamily.heading,
  },
  articleSubMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  authorText: {
    fontSize: Typography.fontSize.caption,
    fontStyle: 'italic',
  },
  readTimeText: {
    fontSize: Typography.fontSize.caption,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  tag: {
    borderWidth: 1,
    borderRadius: Geometry.borderRadius.large,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tagText: {
    fontSize: Typography.fontSize.tiny,
    fontWeight: Typography.fontWeight.medium,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  articleContent: {
    fontSize: Typography.fontSize.body,
    lineHeight: Typography.fontSize.body * Typography.lineHeight.relaxed,
    fontFamily: Typography.fontFamily.body,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Geometry.borderRadius.medium,
    borderWidth: 1,
  },
  sourceButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: Spacing.sm,
  },
  bottomPadding: {
    height: 100, // Space for floating audio control
  },
  audioControl: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: Spacing.md,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.medium,
  },
  audioSubtitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 2,
  },
  backButton: {
    padding: Spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.h3,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Geometry.borderRadius.medium,
  },
  errorButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
  },
});