import ColorThief from 'colorthief';
import sharp from 'sharp';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

interface ColorPalette {
  dominant: string;
  vibrant: string;
  muted: string;
  light: string;
  dark: string;
}

interface VisualData {
  colors: ColorPalette;
  mood: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
  temperature: number; // 0-100, 0 = cold, 100 = warm
  contrast: number; // 0-100
  saturation: number; // 0-100
}

class VisualExtractor {
  private colorThief: ColorThief;

  constructor() {
    this.colorThief = new ColorThief();
  }

  /**
   * Extract visual data from image URL or buffer
   */
  async extractVisualData(source: string | Buffer): Promise<VisualData> {
    try {
      const imageBuffer = await this.getImageBuffer(source);
      const metadata = await sharp(imageBuffer).metadata();
      
      // Ensure image is in a format ColorThief can handle
      const processedBuffer = await sharp(imageBuffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      const colors = await this.extractColors(processedBuffer);
      const mood = this.detectMood(colors);
      const temperature = this.detectTemperature(colors);
      const contrast = await this.calculateContrast(processedBuffer);
      const saturation = this.calculateSaturation(colors);

      return {
        colors,
        mood,
        temperature,
        contrast,
        saturation
      };
    } catch (error) {
      logger.error('Visual extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get image buffer from URL or existing buffer
   */
  private async getImageBuffer(source: string | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(source)) {
      return source;
    }

    const response = await fetch(source);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Extract color palette from image
   */
  private async extractColors(imageBuffer: Buffer): Promise<ColorPalette> {
    // Get dominant colors using ColorThief
    const dominant = await this.colorThief.getColor(imageBuffer);
    const palette = await this.colorThief.getPalette(imageBuffer, 5);

    // Sort palette by brightness and saturation
    const sortedColors = palette.sort((a: number[], b: number[]) => {
      const brightnessA = this.calculateBrightness(a);
      const brightnessB = this.calculateBrightness(b);
      return brightnessB - brightnessA;
    });

    return {
      dominant: this.rgbToHex(dominant),
      vibrant: this.findVibrantColor(palette),
      muted: this.findMutedColor(palette),
      light: this.rgbToHex(sortedColors[0]),
      dark: this.rgbToHex(sortedColors[sortedColors.length - 1])
    };
  }

  /**
   * Detect mood based on colors
   */
  private detectMood(colors: ColorPalette): 'light' | 'dark' | 'warm' | 'cool' | 'neutral' {
    const rgb = this.hexToRgb(colors.dominant);
    const brightness = this.calculateBrightness([rgb.r, rgb.g, rgb.b]);
    const warmth = this.calculateWarmth([rgb.r, rgb.g, rgb.b]);

    if (brightness > 200) return 'light';
    if (brightness < 50) return 'dark';
    if (warmth > 60) return 'warm';
    if (warmth < 40) return 'cool';
    return 'neutral';
  }

  /**
   * Calculate color temperature (0-100, cold to warm)
   */
  private detectTemperature(colors: ColorPalette): number {
    const rgb = this.hexToRgb(colors.dominant);
    return this.calculateWarmth([rgb.r, rgb.g, rgb.b]);
  }

  /**
   * Calculate warmth of a color (0-100)
   */
  private calculateWarmth(rgb: number[]): number {
    const [r, g, b] = rgb;
    // Warm colors have higher red values, cool colors have higher blue
    const warmth = ((r - b) + 255) / 5.1; // Normalize to 0-100
    return Math.max(0, Math.min(100, warmth));
  }

  /**
   * Calculate brightness using YIQ formula
   */
  private calculateBrightness(rgb: number[]): number {
    const [r, g, b] = rgb;
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  /**
   * Calculate saturation of colors
   */
  private calculateSaturation(colors: ColorPalette): number {
    const rgb = this.hexToRgb(colors.dominant);
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    
    if (max === 0) return 0;
    
    const saturation = ((max - min) / max) * 100;
    return Math.round(saturation);
  }

  /**
   * Calculate image contrast
   */
  private async calculateContrast(imageBuffer: Buffer): Promise<number> {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    let minBrightness = 255;
    let maxBrightness = 0;

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += info.channels * 10) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const brightness = this.calculateBrightness([r, g, b]);
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    const contrast = ((maxBrightness - minBrightness) / 255) * 100;
    return Math.round(contrast);
  }

  /**
   * Find the most vibrant color in palette
   */
  private findVibrantColor(palette: number[][]): string {
    let maxSaturation = 0;
    let vibrantColor = palette[0];

    for (const color of palette) {
      const [r, g, b] = color;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      if (saturation > maxSaturation) {
        maxSaturation = saturation;
        vibrantColor = color;
      }
    }

    return this.rgbToHex(vibrantColor);
  }

  /**
   * Find the most muted color in palette
   */
  private findMutedColor(palette: number[][]): string {
    let minSaturation = 1;
    let mutedColor = palette[0];

    for (const color of palette) {
      const [r, g, b] = color;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      if (saturation < minSaturation && this.calculateBrightness(color) > 30) {
        minSaturation = saturation;
        mutedColor = color;
      }
    }

    return this.rgbToHex(mutedColor);
  }

  /**
   * Convert RGB array to hex color
   */
  private rgbToHex(rgb: number[]): string {
    const [r, g, b] = rgb;
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Analyze image composition and generate tags
   */
  async analyzeComposition(imageBuffer: Buffer): Promise<{
    aspectRatio: string;
    orientation: 'landscape' | 'portrait' | 'square';
    dominantQuadrant: string;
    visualWeight: 'balanced' | 'top-heavy' | 'bottom-heavy' | 'left-heavy' | 'right-heavy';
  }> {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const aspectRatio = (width / height).toFixed(2);

    let orientation: 'landscape' | 'portrait' | 'square';
    if (width > height * 1.2) {
      orientation = 'landscape';
    } else if (height > width * 1.2) {
      orientation = 'portrait';
    } else {
      orientation = 'square';
    }

    // Analyze visual weight by dividing image into quadrants
    const stats = await sharp(imageBuffer)
      .grayscale()
      .stats();

    // Simplified visual weight calculation
    const visualWeight = 'balanced'; // This would need more complex analysis

    return {
      aspectRatio,
      orientation,
      dominantQuadrant: 'center', // Simplified for now
      visualWeight
    };
  }

  /**
   * Generate color-based search tags
   */
  generateColorTags(visualData: VisualData): string[] {
    const tags: string[] = [];

    // Mood tags
    tags.push(visualData.mood);
    
    // Temperature tags
    if (visualData.temperature > 70) {
      tags.push('warm', 'cozy');
    } else if (visualData.temperature < 30) {
      tags.push('cool', 'cold');
    }

    // Contrast tags
    if (visualData.contrast > 70) {
      tags.push('high-contrast', 'bold');
    } else if (visualData.contrast < 30) {
      tags.push('low-contrast', 'subtle');
    }

    // Saturation tags
    if (visualData.saturation > 70) {
      tags.push('vibrant', 'colorful');
    } else if (visualData.saturation < 30) {
      tags.push('muted', 'desaturated');
      if (visualData.saturation < 10) {
        tags.push('monochrome');
      }
    }

    return tags;
  }
}

export default new VisualExtractor();
export { VisualExtractor, VisualData, ColorPalette };