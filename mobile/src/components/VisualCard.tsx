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
import { LinearGradient } from 'expo-linear-gradient';

interface ContentItem {
  id: string;
  title: string;
  author?: string;
  content: string;
  url: string;
  imageUrl?: string;
  dominantColor?: string;
  mood?: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
  type: 'article' | 'tweet' | 'instagram' | 'tiktok';
  savedAt: Date;
  tags?: string[];
}

interface VisualCardProps {
  item: ContentItem;
  width: number;
  onPress: () => void;
}

export const VisualCard: React.FC<VisualCardProps> = ({ item, width, onPress }) => {
  const getTypeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (item.type) {
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

  const getMoodColor = (): string => {
    if (item.dominantColor) {
      return item.dominantColor;
    }
    
    switch (item.mood) {
      case 'light':
        return '#FFD700';
      case 'dark':
        return '#4A4A4A';
      case 'warm':
        return '#FF6B6B';
      case 'cool':
        return '#4ECDC4';
      case 'neutral':
      default:
        return '#0066FF';
    }
  };

  const getGradientColors = (): [string, string, ...string[]] => {
    const baseColor = getMoodColor();
    return [`${baseColor}20`, `${baseColor}40`];
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
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

  // Calculate dynamic height based on content
  const baseHeight = 120;
  const titleLines = Math.ceil(item.title.length / 25);
  const contentLines = item.content ? Math.ceil(item.content.length / 40) : 0;
  const dynamicHeight = Math.max(baseHeight, baseHeight + (titleLines + contentLines) * 16);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { width, height: dynamicHeight },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Background gradient based on mood/color */}
      <LinearGradient
        colors={getGradientColors()}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Image or color block */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.colorBlock,
            { backgroundColor: getMoodColor() },
          ]}
        >
          <Ionicons
            name={getTypeIcon()}
            size={32}
            color="#FFFFFF"
            style={styles.typeIcon}
          />
        </View>
      )}

      {/* Content overlay */}
      <View style={styles.contentOverlay}>
        {/* Header with type and date */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Ionicons name={getTypeIcon()} size={12} color="#FFFFFF" />
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.savedAt)}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={3}>
          {item.title}
        </Text>

        {/* Author if available */}
        {item.author && (
          <Text style={styles.author} numberOfLines={1}>
            {truncateText(item.author, 20)}
          </Text>
        )}

        {/* Content preview for text-heavy items */}
        {item.type === 'article' && item.content && (
          <Text style={styles.contentPreview} numberOfLines={2}>
            {truncateText(item.content, 80)}
          </Text>
        )}

        {/* Tags if available */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.tags.length > 2 && (
              <Text style={styles.moreTagsText}>+{item.tags.length - 2}</Text>
            )}
          </View>
        )}

        {/* Mood indicator */}
        {item.mood && (
          <View style={styles.moodIndicator}>
            <View
              style={[
                styles.moodDot,
                { backgroundColor: getMoodColor() },
              ]}
            />
            <Text style={styles.moodText}>{item.mood}</Text>
          </View>
        )}
      </View>

      {/* Subtle border based on dominant color */}
      <View
        style={[
          styles.border,
          { borderColor: `${getMoodColor()}40` },
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1C',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  image: {
    width: '100%',
    height: 80,
    backgroundColor: '#2A2A2C',
  },
  colorBlock: {
    width: '100%',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIcon: {
    opacity: 0.8,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 28, 0.95)',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    color: '#CCCCCC',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  dateText: {
    color: '#6B6B70',
    fontSize: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 4,
  },
  author: {
    color: '#CCCCCC',
    fontSize: 11,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  contentPreview: {
    color: '#CCCCCC',
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 6,
    opacity: 0.8,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tag: {
    backgroundColor: 'rgba(0, 102, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  tagText: {
    color: '#0066FF',
    fontSize: 9,
    fontWeight: '500',
  },
  moreTagsText: {
    color: '#6B6B70',
    fontSize: 9,
  },
  moodIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  moodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  moodText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'capitalize',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 12,
    pointerEvents: 'none',
  },
});