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
import { Colors, Typography, Spacing } from '../styles/BauhausDesign';

interface Article {
  id: string;
  title: string;
  author?: string;
  content: string;
  url: string;
  imageUrl?: string;
  readTime?: number;
  savedAt: Date;
  readAt?: Date;
  dominantColor?: string;
  mood?: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
  type: 'article' | 'tweet' | 'instagram' | 'tiktok';
  tags?: string[];
}

type RootStackParamList = {
  ArticleDetail: {
    article: Article;
  };
};

type ArticleDetailRouteProp = RouteProp<RootStackParamList, 'ArticleDetail'>;

export default function ArticleDetailScreen() {
  const route = useRoute<ArticleDetailRouteProp>();
  const navigation = useNavigation();
  const { article } = route.params;
  
  const { isPlaying, currentArticle, playArticle, pausePlayback, resumePlayback } = useContext(AudioContext);
  const { markAsRead, deleteArticle } = useContext(ContentContext);
  
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(false);

  useEffect(() => {
    // Mark article as read when screen is opened
    if (!article.readAt) {
      markAsRead(article.id);
    }
  }, [article.id, article.readAt, markAsRead]);

  useEffect(() => {
    setIsCurrentlyPlaying(isPlaying && currentArticle?.id === article.id);
  }, [isPlaying, currentArticle, article.id]);

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
      case 'light': return Colors.primary.yellow;
      case 'dark': return '#4A4A4A';
      case 'warm': return '#FF6B6B';
      case 'cool': return '#4ECDC4';
      case 'neutral':
      default: return Colors.primary.blue;
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color={Colors.semantic.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Article Image */}
        {article.imageUrl && (
          <Image source={{ uri: article.imageUrl }} style={styles.articleImage} />
        )}

        {/* Article Header Info */}
        <View style={styles.articleHeader}>
          <View style={styles.articleMeta}>
            <View style={styles.typeContainer}>
              <Ionicons name={getTypeIcon()} size={16} color={getMoodColor()} />
              <Text style={[styles.typeText, { color: getMoodColor() }]}>
                {article.type.toUpperCase()}
              </Text>
            </View>
            
            <Text style={styles.dateText}>{formatDate(article.savedAt)}</Text>
          </View>

          {/* Article Title */}
          <Text style={styles.articleTitle}>{article.title}</Text>

          {/* Author & Reading Time */}
          <View style={styles.articleSubMeta}>
            {article.author && (
              <Text style={styles.authorText}>By {article.author}</Text>
            )}
            
            {article.readTime && (
              <Text style={styles.readTimeText}>
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
          <Text style={styles.articleContent}>{article.content}</Text>
        </View>

        {/* Source Link */}
        <TouchableOpacity style={styles.sourceButton} onPress={handleOpenOriginal}>
          <Ionicons name="open-outline" size={20} color={Colors.primary.blue} />
          <Text style={styles.sourceButtonText}>Read Original Article</Text>
        </TouchableOpacity>

        {/* Bottom padding for audio player */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Audio Control */}
      <View style={styles.audioControl}>
        <TouchableOpacity 
          style={[styles.playButton, { backgroundColor: getMoodColor() }]} 
          onPress={handlePlayPause}
        >
          <Ionicons 
            name={isCurrentlyPlaying ? "pause" : "play"} 
            size={24} 
            color={Colors.primary.white} 
          />
        </TouchableOpacity>
        
        <View style={styles.audioInfo}>
          <Text style={styles.audioTitle} numberOfLines={1}>
            {isCurrentlyPlaying ? 'Now Playing' : 'Listen to Article'}
          </Text>
          <Text style={styles.audioSubtitle} numberOfLines={1}>
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
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surface,
  },
  headerButton: {
    padding: Spacing.sm,
    borderRadius: 8,
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
    backgroundColor: Colors.dark.surface,
  },
  articleHeader: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surface,
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
    color: Colors.text.tertiary,
  },
  articleTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    lineHeight: Typography.fontSize.h2 * 1.3,
    marginBottom: Spacing.sm,
  },
  articleSubMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  authorText: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  readTimeText: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.tertiary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 16,
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
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.body * Typography.lineHeight.relaxed,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary.blue,
  },
  sourceButtonText: {
    fontSize: Typography.fontSize.body,
    color: Colors.primary.blue,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: Spacing.md,
    elevation: 8,
    shadowColor: Colors.dark.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.medium,
  },
  audioSubtitle: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 2,
  },
});