import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ColorFilterProps {
  colors: string[];
  selectedColors: string[];
  onColorsChange: (colors: string[]) => void;
}

export const ColorFilter: React.FC<ColorFilterProps> = ({
  colors,
  selectedColors,
  onColorsChange,
}) => {
  const toggleColor = (color: string) => {
    if (selectedColors.includes(color)) {
      onColorsChange(selectedColors.filter(c => c !== color));
    } else {
      onColorsChange([...selectedColors, color]);
    }
  };

  const clearAllColors = () => {
    onColorsChange([]);
  };

  const getColorName = (hexColor: string): string => {
    // Simple color name mapping
    const colorMap: Record<string, string> = {
      '#FF0000': 'Red',
      '#FF6B6B': 'Light Red',
      '#FF8C00': 'Orange',
      '#FFD700': 'Gold',
      '#FFFF00': 'Yellow',
      '#ADFF2F': 'Light Green',
      '#00FF00': 'Green',
      '#00CED1': 'Turquoise',
      '#0066FF': 'Blue',
      '#4169E1': 'Royal Blue',
      '#8A2BE2': 'Purple',
      '#FF1493': 'Pink',
      '#2F2F2F': 'Dark Gray',
      '#808080': 'Gray',
      '#C0C0C0': 'Light Gray',
      '#FFFFFF': 'White',
    };

    // Check for exact matches first
    if (colorMap[hexColor.toUpperCase()]) {
      return colorMap[hexColor.toUpperCase()];
    }

    // Try to match based on RGB values for approximate color naming
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Simple heuristic for color naming
    if (r > 200 && g < 100 && b < 100) return 'Red';
    if (r > 200 && g > 150 && b < 100) return 'Orange';
    if (r > 200 && g > 200 && b < 100) return 'Yellow';
    if (r < 100 && g > 200 && b < 100) return 'Green';
    if (r < 100 && g > 100 && b > 200) return 'Blue';
    if (r > 150 && g < 100 && b > 150) return 'Purple';
    if (r > 200 && g < 150 && b > 150) return 'Pink';
    if (r < 100 && g < 100 && b < 100) return 'Dark';
    if (r > 200 && g > 200 && b > 200) return 'Light';
    
    return 'Mixed';
  };

  const normalizeColor = (color: string): string => {
    // Ensure color starts with # and is valid hex
    if (!color.startsWith('#')) {
      color = '#' + color;
    }
    return color.length === 7 ? color : '#888888';
  };

  if (colors.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filter by Color</Text>
        {selectedColors.length > 0 && (
          <TouchableOpacity onPress={clearAllColors} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorsContainer}
      >
        {colors.map((color, index) => {
          const normalizedColor = normalizeColor(color);
          const isSelected = selectedColors.includes(color);
          const colorName = getColorName(normalizedColor);

          return (
            <TouchableOpacity
              key={`${color}-${index}`}
              style={[
                styles.colorItem,
                isSelected && styles.selectedColorItem,
              ]}
              onPress={() => toggleColor(color)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.colorCircle,
                  { backgroundColor: normalizedColor },
                  isSelected && styles.selectedColorCircle,
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={[styles.colorName, isSelected && styles.selectedColorName]}>
                {colorName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedColors.length > 0 && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedText}>
            {selectedColors.length} color{selectedColors.length > 1 ? 's' : ''} selected
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '500',
  },
  colorsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  colorItem: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 8,
  },
  selectedColorItem: {
    transform: [{ scale: 1.05 }],
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2C',
    marginBottom: 6,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedColorCircle: {
    borderColor: '#0066FF',
    borderWidth: 3,
    shadowColor: '#0066FF',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  colorName: {
    color: '#6B6B70',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 60,
  },
  selectedColorName: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedInfo: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  selectedText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});