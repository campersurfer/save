import React, { useState, useContext, useEffect, useLayoutEffect, useMemo } from 'react';
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
import { Typography, Spacing } from '../styles/BauhausDesign';
import { Article } from '../services/StorageService';
import { useTheme } from '../providers/ThemeProvider';

export default function FeedScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { articles, isLoading, refreshArticles, markAsRead, archiveArticle } = useContext(ContentContext);
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

  const displayArticles = useMemo(() => {
    return articles.filter(article => 
      !article.tags?.includes('archive') && 
      !article.isNote
    );
  }, [articles]);

  const unreadArticles = displayArticles.filter(article => !article.readAt);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Nook Feed',
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => (navigation as any).navigate('Add')} 
          style={{ marginRight: 16 }}
        >
          <Ionicons name="add" size={28} color={colors.primary.blue} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const handleArticlePress = (article: Article) => {
    if (isSelectionMode) {
      toggleSelection(article.id);
    } else {
      // Navigate to article detail screen - pass ID only to avoid serialization issues
      (navigation as any).navigate('ArticleDetail', { articleId: article.id });
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
      archiveArticle(articleId);
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
      <Ionicons name="reader-outline" size={80} color={colors.text.tertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No Articles Yet</Text>
      <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
        Save your first article using the Add tab or Share Extension
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.surface }]}>
      <View style={styles.headerContent}>
        <Text style={[styles.queueCount, { color: colors.text.primary }]}>
          {unreadArticles.length} articles in queue
        </Text>
        <Text style={[styles.readTime, { color: colors.text.tertiary }]}>
          ~{Math.round(unreadArticles.reduce((total, article) => 
            total + (article.readTime || 3), 0))} min read
        </Text>
      </View>
      
      {unreadArticles.length > 0 && (
        <TouchableOpacity 
          style={[styles.playAllButton, { 
            backgroundColor: colors.surface,
            borderColor: colors.primary.blue 
          }]}
          onPress={startContinuousPlayback}
        >
          <Ionicons name="play-circle" size={24} color={colors.primary.blue} />
          <Text style={[styles.playAllText, { color: colors.primary.blue }]}>Play All</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={displayArticles}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshArticles}
            tintColor={colors.primary.blue}
            colors={[colors.primary.blue]}
          />
        }
        contentContainerStyle={articles.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
        showsVerticalScrollIndicator={true}
      />

      {/* Selection Mode Actions */}
      {isSelectionMode && (
        <View style={[styles.selectionActions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary.blue }]}
            onPress={playSelectedArticles}
          >
            <Ionicons name="play" size={20} color={colors.text.inverse} />
            <Text style={[styles.actionText, { color: colors.text.inverse }]}>Play</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary.blue }]}
            onPress={archiveSelected}
          >
            <Ionicons name="archive" size={20} color={colors.text.inverse} />
            <Text style={[styles.actionText, { color: colors.text.inverse }]}>Archive</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton, { backgroundColor: colors.text.tertiary }]}
            onPress={() => {
              setIsSelectionMode(false);
              setSelectedArticles([]);
            }}
          >
            <Ionicons name="close" size={20} color={colors.text.inverse} />
            <Text style={[styles.actionText, { color: colors.text.inverse }]}>Cancel</Text>
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    marginBottom: 12,
  },
  queueCount: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 4,
  },
  readTime: {
    fontSize: Typography.fontSize.caption,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  playAllText: {
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
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  selectionActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    marginRight: 12,
  },
  cancelButton: {
    // Overridden in render
  },
  actionText: {
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 6,
    fontSize: Typography.fontSize.caption,
  },
});