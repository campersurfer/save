import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ContentContext } from '../providers/ContentProvider';
import { VisualCard } from '../components/VisualCard';
import { ColorFilter } from '../components/ColorFilter';
import { MasonryGrid } from '../components/MasonryGrid';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 8;
const COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - (COLUMNS + 1) * CARD_MARGIN) / COLUMNS;

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

type MoodFilter = 'all' | 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
type TypeFilter = 'all' | 'article' | 'tweet' | 'instagram' | 'tiktok';

export default function MindScreen() {
  const { articles, isLoading, refreshArticles } = useContext(ContentContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState<MoodFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const filteredItems = articles.filter(item => {
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(query) &&
          !item.content.toLowerCase().includes(query) &&
          !(item.author?.toLowerCase().includes(query))) {
        return false;
      }
    }

    // Mood filter
    if (moodFilter !== 'all' && item.mood !== moodFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all' && item.type !== typeFilter) {
      return false;
    }

    // Color filter
    if (selectedColors.length > 0 && item.dominantColor) {
      const itemColor = item.dominantColor.toLowerCase();
      const colorMatch = selectedColors.some(color => 
        itemColor.includes(color.toLowerCase()) ||
        isColorSimilar(itemColor, color)
      );
      if (!colorMatch) return false;
    }

    return true;
  });

  const isColorSimilar = (color1: string, color2: string): boolean => {
    // Simple color similarity check (can be enhanced)
    return Math.abs(color1.length - color2.length) <= 1;
  };

  const getMoodStats = () => {
    const stats = articles.reduce((acc, item) => {
      const mood = item.mood || 'neutral';
      acc[mood] = (acc[mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return stats;
  };

  const getUniqueColors = (): string[] => {
    const colors = new Set<string>();
    articles.forEach(item => {
      if (item.dominantColor) {
        colors.add(item.dominantColor);
      }
    });
    return Array.from(colors).slice(0, 12); // Limit to 12 colors
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="grid-outline" size={80} color="#6B6B70" />
      <Text style={styles.emptyTitle}>Your Visual Mind</Text>
      <Text style={styles.emptyText}>
        Save visual content to see it organized by color and mood
      </Text>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B6B70" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your mind..."
          placeholderTextColor="#6B6B70"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6B6B70" />
          </TouchableOpacity>
        )}
      </View>

      {/* Mood Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
      >
        {(['all', 'light', 'dark', 'warm', 'cool', 'neutral'] as MoodFilter[]).map(mood => (
          <TouchableOpacity
            key={mood}
            style={[
              styles.filterChip,
              moodFilter === mood && styles.filterChipActive
            ]}
            onPress={() => setMoodFilter(mood)}
          >
            <Text style={[
              styles.filterText,
              moodFilter === mood && styles.filterTextActive
            ]}>
              {mood === 'all' ? 'All Moods' : mood.charAt(0).toUpperCase() + mood.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Type Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
      >
        {(['all', 'article', 'tweet', 'instagram', 'tiktok'] as TypeFilter[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              typeFilter === type && styles.filterChipActive
            ]}
            onPress={() => setTypeFilter(type)}
          >
            <Text style={[
              styles.filterText,
              typeFilter === type && styles.filterTextActive
            ]}>
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Color Filter */}
      <ColorFilter
        colors={getUniqueColors()}
        selectedColors={selectedColors}
        onColorsChange={setSelectedColors}
      />
    </View>
  );

  const renderStats = () => {
    const moodStats = getMoodStats();
    
    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>
          {filteredItems.length} items • Your Mind Map
        </Text>
        <View style={styles.moodStats}>
          {Object.entries(moodStats).map(([mood, count]) => (
            <View key={mood} style={styles.moodStat}>
              <View style={[styles.moodDot, { backgroundColor: getMoodColor(mood) }]} />
              <Text style={styles.moodStatText}>{count}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const getMoodColor = (mood: string): string => {
    switch (mood) {
      case 'light': return '#FFD700';
      case 'dark': return '#4A4A4A';
      case 'warm': return '#FF6B6B';
      case 'cool': return '#4ECDC4';
      default: return '#0066FF';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshArticles}
            tintColor="#0066FF"
            colors={['#0066FF']}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
  },
  filtersContainer: {
    backgroundColor: '#0A0A0B',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1C',
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
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
    color: '#FFFFFF',
    fontSize: 16,
  },
  filterRow: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#1A1A1C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  filterChipActive: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  filterText: {
    color: '#6B6B70',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1C',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  statsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  moodStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  moodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  moodStatText: {
    color: '#6B6B70',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B6B70',
    textAlign: 'center',
    lineHeight: 24,
  },
});