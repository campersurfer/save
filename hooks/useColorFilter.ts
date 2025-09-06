import { useState, useCallback, useMemo } from 'react';

interface ColorFilterOptions {
  threshold?: number; // Color similarity threshold (0-100)
  includeComplementary?: boolean;
  includeAnalogous?: boolean;
  includeTriadic?: boolean;
}

interface FilterState {
  selectedColors: string[];
  selectedMoods: ('light' | 'dark' | 'warm' | 'cool' | 'neutral')[];
  temperatureRange: [number, number];
  contrastRange: [number, number];
  saturationRange: [number, number];
}

const useColorFilter = (options: ColorFilterOptions = {}) => {
  const {
    threshold = 30,
    includeComplementary = false,
    includeAnalogous = true,
    includeTriadic = false
  } = options;

  const [filterState, setFilterState] = useState<FilterState>({
    selectedColors: [],
    selectedMoods: [],
    temperatureRange: [0, 100],
    contrastRange: [0, 100],
    saturationRange: [0, 100]
  });

  /**
   * Convert hex to HSL
   */
  const hexToHSL = useCallback((hex: string): { h: number; s: number; l: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }, []);

  /**
   * Calculate color similarity
   */
  const calculateColorSimilarity = useCallback((color1: string, color2: string): number => {
    const hsl1 = hexToHSL(color1);
    const hsl2 = hexToHSL(color2);

    // Weight hue difference more heavily
    const hueDiff = Math.min(Math.abs(hsl1.h - hsl2.h), 360 - Math.abs(hsl1.h - hsl2.h));
    const satDiff = Math.abs(hsl1.s - hsl2.s);
    const lightDiff = Math.abs(hsl1.l - hsl2.l);

    const similarity = 100 - (hueDiff * 0.5 + satDiff * 0.3 + lightDiff * 0.2);
    return Math.max(0, similarity);
  }, [hexToHSL]);

  /**
   * Get complementary color
   */
  const getComplementaryColor = useCallback((hex: string): string => {
    const hsl = hexToHSL(hex);
    const complementaryHue = (hsl.h + 180) % 360;
    return hslToHex(complementaryHue, hsl.s, hsl.l);
  }, [hexToHSL]);

  /**
   * Get analogous colors
   */
  const getAnalogousColors = useCallback((hex: string): string[] => {
    const hsl = hexToHSL(hex);
    const analogous1 = (hsl.h + 30) % 360;
    const analogous2 = (hsl.h - 30 + 360) % 360;
    return [
      hslToHex(analogous1, hsl.s, hsl.l),
      hslToHex(analogous2, hsl.s, hsl.l)
    ];
  }, [hexToHSL]);

  /**
   * Get triadic colors
   */
  const getTriadicColors = useCallback((hex: string): string[] => {
    const hsl = hexToHSL(hex);
    const triadic1 = (hsl.h + 120) % 360;
    const triadic2 = (hsl.h + 240) % 360;
    return [
      hslToHex(triadic1, hsl.s, hsl.l),
      hslToHex(triadic2, hsl.s, hsl.l)
    ];
  }, [hexToHSL]);

  /**
   * Convert HSL to hex
   */
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  /**
   * Build the expanded color palette based on selected colors
   */
  const expandedColorPalette = useMemo(() => {
    const palette = new Set<string>(filterState.selectedColors);

    filterState.selectedColors.forEach(color => {
      if (includeComplementary) {
        palette.add(getComplementaryColor(color));
      }
      if (includeAnalogous) {
        getAnalogousColors(color).forEach(c => palette.add(c));
      }
      if (includeTriadic) {
        getTriadicColors(color).forEach(c => palette.add(c));
      }
    });

    return Array.from(palette);
  }, [
    filterState.selectedColors,
    includeComplementary,
    includeAnalogous,
    includeTriadic,
    getComplementaryColor,
    getAnalogousColors,
    getTriadicColors
  ]);

  /**
   * Filter items based on color and visual properties
   */
  const filterItems = useCallback(<T extends {
    dominantColor?: string;
    mood?: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
    temperature?: number;
    contrast?: number;
    saturation?: number;
  }>(items: T[]): T[] => {
    return items.filter(item => {
      // Filter by mood
      if (filterState.selectedMoods.length > 0 && item.mood) {
        if (!filterState.selectedMoods.includes(item.mood)) {
          return false;
        }
      }

      // Filter by color similarity
      if (filterState.selectedColors.length > 0 && item.dominantColor) {
        const matches = expandedColorPalette.some(paletteColor => {
          const similarity = calculateColorSimilarity(item.dominantColor!, paletteColor);
          return similarity >= threshold;
        });
        if (!matches) return false;
      }

      // Filter by temperature range
      if (item.temperature !== undefined) {
        if (item.temperature < filterState.temperatureRange[0] || 
            item.temperature > filterState.temperatureRange[1]) {
          return false;
        }
      }

      // Filter by contrast range
      if (item.contrast !== undefined) {
        if (item.contrast < filterState.contrastRange[0] || 
            item.contrast > filterState.contrastRange[1]) {
          return false;
        }
      }

      // Filter by saturation range
      if (item.saturation !== undefined) {
        if (item.saturation < filterState.saturationRange[0] || 
            item.saturation > filterState.saturationRange[1]) {
          return false;
        }
      }

      return true;
    });
  }, [filterState, expandedColorPalette, calculateColorSimilarity, threshold]);

  /**
   * Toggle color selection
   */
  const toggleColor = useCallback((color: string) => {
    setFilterState(prev => ({
      ...prev,
      selectedColors: prev.selectedColors.includes(color)
        ? prev.selectedColors.filter(c => c !== color)
        : [...prev.selectedColors, color]
    }));
  }, []);

  /**
   * Toggle mood selection
   */
  const toggleMood = useCallback((mood: 'light' | 'dark' | 'warm' | 'cool' | 'neutral') => {
    setFilterState(prev => ({
      ...prev,
      selectedMoods: prev.selectedMoods.includes(mood)
        ? prev.selectedMoods.filter(m => m !== mood)
        : [...prev.selectedMoods, mood]
    }));
  }, []);

  /**
   * Set temperature range
   */
  const setTemperatureRange = useCallback((range: [number, number]) => {
    setFilterState(prev => ({
      ...prev,
      temperatureRange: range
    }));
  }, []);

  /**
   * Set contrast range
   */
  const setContrastRange = useCallback((range: [number, number]) => {
    setFilterState(prev => ({
      ...prev,
      contrastRange: range
    }));
  }, []);

  /**
   * Set saturation range
   */
  const setSaturationRange = useCallback((range: [number, number]) => {
    setFilterState(prev => ({
      ...prev,
      saturationRange: range
    }));
  }, []);

  /**
   * Reset all filters
   */
  const resetFilters = useCallback(() => {
    setFilterState({
      selectedColors: [],
      selectedMoods: [],
      temperatureRange: [0, 100],
      contrastRange: [0, 100],
      saturationRange: [0, 100]
    });
  }, []);

  /**
   * Get color statistics from items
   */
  const getColorStatistics = useCallback(<T extends {
    dominantColor?: string;
    mood?: string;
  }>(items: T[]) => {
    const colorCounts = new Map<string, number>();
    const moodCounts = new Map<string, number>();

    items.forEach(item => {
      if (item.dominantColor) {
        colorCounts.set(item.dominantColor, (colorCounts.get(item.dominantColor) || 0) + 1);
      }
      if (item.mood) {
        moodCounts.set(item.mood, (moodCounts.get(item.mood) || 0) + 1);
      }
    });

    return {
      topColors: Array.from(colorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([color, count]) => ({ color, count })),
      moodDistribution: Array.from(moodCounts.entries())
        .map(([mood, count]) => ({ mood, count }))
    };
  }, []);

  return {
    filterState,
    filterItems,
    toggleColor,
    toggleMood,
    setTemperatureRange,
    setContrastRange,
    setSaturationRange,
    resetFilters,
    getColorStatistics,
    expandedColorPalette
  };
};

export default useColorFilter;