import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ContentContext } from '../providers/ContentProvider';
import { AudioContext } from '../providers/AudioProvider';
import { ArticleCard } from '../components/ArticleCard';
import { AudioPlayer } from '../components/AudioPlayer';
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
  type: 'article' | 'tweet' | 'instagram' | 'tiktok';
}

export default function FeedScreen() {
  const navigation = useNavigation();
  const { articles, isLoading, refreshArticles, markAsRead } = useContext(ContentContext);
  const { 
    isPlaying, 
    currentArticle, 
    startPlayQueue, 
    pausePlayback, 
    resumePlayback,
    skipToNext,
    skipToPrevious,
  } = useContext(AudioContext);
  
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const unreadArticles = articles.filter(article => !article.readAt);

  const handleArticlePress = (article: Article) => {
    if (isSelectionMode) {
      toggleSelection(article.id);
    } else {
      // Navigate to article detail screen
      (navigation as any).navigate('ArticleDetail', { article });
    }
  };

  const handleArticleLongPress = (article: Article) => {
    setIsSelectionMode(true);
    setSelectedArticles([article.id]);
  };

  const toggleSelection = (articleId: string) => {
    setSelectedArticles(prev => 
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  const startContinuousPlayback = () => {
    if (unreadArticles.length === 0) {
      Alert.alert('No Articles', 'No unread articles to play');
      return;
    }
    startPlayQueue(unreadArticles);
  };

  const playSelectedArticles = () => {
    const articlesToPlay = articles.filter(article => 
      selectedArticles.includes(article.id)
    );
    if (articlesToPlay.length === 0) return;
    
    startPlayQueue(articlesToPlay);
    setIsSelectionMode(false);
    setSelectedArticles([]);
  };

  const archiveSelected = () => {
    selectedArticles.forEach(articleId => {
      markAsRead(articleId);
    });
    setIsSelectionMode(false);
    setSelectedArticles([]);
  };

  const renderArticle = ({ item }: { item: Article }) => (
    <ArticleCard
      article={item}
      onPress={() => handleArticlePress(item)}
      onLongPress={() => handleArticleLongPress(item)}
      isSelected={selectedArticles.includes(item.id)}
      isSelectionMode={isSelectionMode}
      isCurrentlyPlaying={currentArticle?.id === item.id}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="reader-outline" size={80} color="#6B6B70" />
      <Text style={styles.emptyTitle}>No Articles Yet</Text>
      <Text style={styles.emptyText}>
        Save your first article using the Add tab or Share Extension
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.queueCount}>
          {unreadArticles.length} articles in queue
        </Text>
        <Text style={styles.readTime}>
          ~{Math.round(unreadArticles.reduce((total, article) => 
            total + (article.readTime || 3), 0))} min read
        </Text>
      </View>
      
      {unreadArticles.length > 0 && (
        <TouchableOpacity 
          style={styles.playAllButton}
          onPress={startContinuousPlayback}
        >
          <Ionicons name="play-circle" size={24} color="#0066FF" />
          <Text style={styles.playAllText}>Play All</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshArticles}
            tintColor={Colors.primary.blue}
            colors={[Colors.primary.blue]}
          />
        }
        contentContainerStyle={articles.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
      />

      {/* Selection Mode Actions */}
      {isSelectionMode && (
        <View style={styles.selectionActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={playSelectedArticles}
          >
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.actionText}>Play</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={archiveSelected}
          >
            <Ionicons name="archive" size={20} color="#FFFFFF" />
            <Text style={styles.actionText}>Archive</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => {
              setIsSelectionMode(false);
              setSelectedArticles([]);
            }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Continuous TTS Audio Player */}
      <AudioPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    padding: Spacing.md,
    backgroundColor: Colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surface,
  },
  headerContent: {
    marginBottom: 12,
  },
  queueCount: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  readTime: {
    fontSize: Typography.fontSize.caption,
    color: Colors.text.tertiary,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary.blue,
  },
  playAllText: {
    color: Colors.primary.blue,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.body,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  selectionActions: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceHigh,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.blue,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    marginRight: 12,
  },
  cancelButton: {
    backgroundColor: Colors.text.tertiary,
  },
  actionText: {
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 6,
    fontSize: Typography.fontSize.caption,
  },
});