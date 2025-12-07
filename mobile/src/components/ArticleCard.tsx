import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, Geometry, Components } from '../styles/BauhausDesign';
import { Article } from '../services/StorageService';
import { useTheme } from '../providers/ThemeProvider';
import { ContentContext } from '../providers/ContentProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ArticleCardProps {
  article: Article;
  onPress: () => void;
  onLongPress: () => void;
  isSelected: boolean;
  isSelectionMode: boolean;
  isCurrentlyPlaying: boolean;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onPress,
  onLongPress,
  isSelected,
  isSelectionMode,
  isCurrentlyPlaying,
}) => {
  const { colors } = useTheme();
  const { toggleFavorite, archiveArticle, deleteArticle } = useContext(ContentContext);

  const handleShare = async () => {
    try {
      await Share.share({
        message: article.url,
        title: article.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleFavorite = () => {
    toggleFavorite(article.id);
  };

  const handleMoreOptions = () => {
    Alert.alert(
      'Article Options',
      article.title,
      [
        { 
          text: 'Add tags', 
          onPress: () => Alert.alert('Add Tags', 'Tagging interface coming soon') 
        },
        { 
          text: 'Archive', 
          onPress: () => archiveArticle(article.id) 
        },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => Alert.alert(
            'Delete Article',
            'Are you sure you want to delete this article?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteArticle(article.id) }
            ]
          )
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const getTypeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (article.type) {
      case 'article':
        return 'reader-outline';
      case 'tweet':
        return 'logo-twitter';
      case 'instagram':
        return 'logo-instagram';
      case 'tiktok':
        return 'musical-notes-outline';
      default:
        return 'document-outline';
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const truncateContent = (text: string, maxLength: number = 120): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { 
          backgroundColor: colors.surface,
          borderColor: isSelected || isCurrentlyPlaying ? colors.primary.blue : colors.border,
          borderWidth: isCurrentlyPlaying ? 2 : 1,
        },
        isSelected && { backgroundColor: `${colors.primary.blue}1A` }, // 10% opacity
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Selection indicator */}
      {isSelectionMode && (
        <View style={[styles.selectionIndicator, { backgroundColor: colors.surface }]}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
            size={24}
            color={isSelected ? colors.primary.blue : colors.text.tertiary}
          />
        </View>
      )}

      {/* Article image */}
      {article.imageUrl && (
        <Image
          source={{ uri: article.imageUrl }}
          style={[styles.image, { backgroundColor: colors.border }]}
          resizeMode="cover"
        />
      )}

      {/* Content container */}
      <View style={styles.content}>
        {/* Header with type icon and metadata */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Ionicons name={getTypeIcon()} size={Geometry.iconSize.small} color={colors.text.tertiary} />
            <Text style={[styles.typeText, { color: colors.text.tertiary }]}>{article.type}</Text>
          </View>
          <Text style={[styles.timeText, { color: colors.text.tertiary }]}>{formatDate(article.savedAt)}</Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>
          {article.title}
        </Text>

        {/* Author */}
        {article.author && (
          <Text style={[styles.author, { color: colors.text.tertiary }]}>by {article.author}</Text>
        )}

        {/* Content preview */}
        <Text style={[styles.contentPreview, { color: colors.text.secondary }]} numberOfLines={2}>
          {truncateContent(article.content)}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.metaInfo}>
            {article.readTime && (
              <Text style={[styles.readTime, { color: colors.text.tertiary }]}>{article.readTime} min read</Text>
            )}
            {/* Playing indicator */}
            {isCurrentlyPlaying && (
              <View style={[styles.playingIndicator, { backgroundColor: `${colors.primary.blue}26` }]}>
                <Ionicons name="volume-high" size={Geometry.iconSize.small} color={colors.primary.blue} />
                <Text style={[styles.playingText, { color: colors.primary.blue }]}>Playing</Text>
              </View>
            )}
          </View>
          
          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleFavorite}>
              <Ionicons 
                name={article.isFavorite ? "star" : "star-outline"} 
                size={20} 
                color={article.isFavorite ? colors.primary.blue : colors.text.tertiary} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleMoreOptions}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Geometry.borderRadius.none, // Sharp Bauhaus edges
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
  },
  selectionIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10,
    borderRadius: Geometry.borderRadius.none,
    padding: 2,
  },
  image: {
    width: '100%',
    height: 120,
  },
  content: {
    padding: Spacing.md,
  },
  header: {
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
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: Typography.fontSize.small,
  },
  title: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.heading,
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.body,
    marginBottom: 4,
  },
  author: {
    fontSize: Typography.fontSize.caption,
    marginBottom: Spacing.sm,
  },
  contentPreview: {
    fontSize: Typography.fontSize.caption,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.caption,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  readTime: {
    fontSize: Typography.fontSize.small,
    marginRight: Spacing.sm,
  },
  readIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readText: {
    fontSize: Typography.fontSize.small,
    marginLeft: 4,
    fontWeight: Typography.fontWeight.medium,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Geometry.borderRadius.none,
  },
  playingText: {
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: Spacing.md,
    padding: 4,
  },
});