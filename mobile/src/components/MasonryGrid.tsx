import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MasonryGridProps<T> {
  data: T[];
  cardWidth: number;
  margin: number;
  renderItem: (item: T, index: number, itemWidth: number) => React.ReactElement;
  numColumns?: number;
}

interface GridItem<T> {
  item: T;
  index: number;
  height: number;
  measured: boolean;
}

interface Column {
  items: GridItem<any>[];
  height: number;
}

export function MasonryGrid<T>({
  data,
  cardWidth,
  margin,
  renderItem,
  numColumns = 2,
}: MasonryGridProps<T>) {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const [measuredItems, setMeasuredItems] = useState<Set<number>>(new Set());

  // Calculate actual card width based on screen size and margins
  const actualCardWidth = useMemo(() => {
    const availableWidth = SCREEN_WIDTH - (numColumns + 1) * margin;
    return Math.floor(availableWidth / numColumns);
  }, [numColumns, margin]);

  // Create columns distribution
  const columns = useMemo(() => {
    const cols: Column[] = Array(numColumns).fill(null).map(() => ({
      items: [],
      height: 0,
    }));

    data.forEach((item, index) => {
      const height = itemHeights.get(index) || 200; // Default height
      
      // Find the shortest column
      const shortestColumnIndex = cols.reduce((minIndex, col, colIndex) => 
        col.height < cols[minIndex].height ? colIndex : minIndex, 0);

      // Add item to shortest column
      cols[shortestColumnIndex].items.push({
        item,
        index,
        height,
        measured: measuredItems.has(index),
      });
      
      // Update column height
      cols[shortestColumnIndex].height += height + margin;
    });

    return cols;
  }, [data, itemHeights, measuredItems, numColumns, margin]);

  const handleItemLayout = (index: number, event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    
    if (!itemHeights.has(index) || itemHeights.get(index) !== height) {
      setItemHeights(prev => new Map(prev.set(index, height)));
      setMeasuredItems(prev => new Set(prev.add(index)));
    }
  };

  const renderColumn = (column: Column, columnIndex: number) => (
    <View key={columnIndex} style={[styles.column, { width: actualCardWidth }]}>
      {column.items.map(({ item, index }) => (
        <View
          key={index}
          style={[styles.itemContainer, { marginBottom: margin }]}
          onLayout={(event) => handleItemLayout(index, event)}
        >
          {renderItem(item, index, actualCardWidth)}
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      <View style={styles.grid}>
        {columns.map(renderColumn)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100, // Extra space for audio player
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8, // Half margin for grid padding
  },
  column: {
    flex: 1,
    marginHorizontal: 4, // Half margin for column spacing
  },
  itemContainer: {
    width: '100%',
  },
});