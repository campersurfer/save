import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Geometry, Components } from '../styles/BauhausDesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
        isSelected && styles.selected,
        isCurrentlyPlaying && styles.playing,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Selection indicator */}
      {isSelectionMode && (
        <View style={styles.selectionIndicator}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
            size={24}
            color={isSelected ? Colors.primary.blue : Colors.text.tertiary}
          />
        </View>
      )}

      {/* Article image */}
      {article.imageUrl && (
        <Image
          source={{ uri: article.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Content container */}
      <View style={styles.content}>
        {/* Header with type icon and metadata */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Ionicons name={getTypeIcon()} size={Geometry.iconSize.small} color={Colors.text.tertiary} />
            <Text style={styles.typeText}>{article.type}</Text>
          </View>
          <Text style={styles.timeText}>{formatDate(article.savedAt)}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>

        {/* Author */}
        {article.author && (
          <Text style={styles.author}>by {article.author}</Text>
        )}

        {/* Content preview */}
        <Text style={styles.contentPreview} numberOfLines={2}>
          {truncateContent(article.content)}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.metaInfo}>
            {article.readTime && (
              <Text style={styles.readTime}>{article.readTime} min read</Text>
            )}
            {article.readAt && (
              <View style={styles.readIndicator}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.semantic.success} />
                <Text style={styles.readText}>Read</Text>
              </View>
            )}
          </View>
          
          {/* Playing indicator */}
          {isCurrentlyPlaying && (
            <View style={styles.playingIndicator}>
              <Ionicons name="volume-high" size={Geometry.iconSize.small} color={Colors.primary.blue} />
              <Text style={styles.playingText}>Playing</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    ...Components.card,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
  },
  selected: {
    borderColor: Colors.primary.blue,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
  },
  playing: {
    borderColor: Colors.primary.blue,
    borderWidth: 2,
  },
  selectionIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: Geometry.borderRadius.none,
    padding: 2,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.dark.border,
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
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  timeText: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.small,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.heading,
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.body,
    marginBottom: 4,
  },
  author: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.caption,
    marginBottom: Spacing.sm,
  },
  contentPreview: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.caption,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.caption,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  readTime: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.small,
    marginRight: Spacing.sm,
  },
  readIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readText: {
    color: Colors.semantic.success,
    fontSize: Typography.fontSize.small,
    marginLeft: 4,
    fontWeight: Typography.fontWeight.medium,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Geometry.borderRadius.none,
  },
  playingText: {
    color: Colors.primary.blue,
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: 4,
  },
});