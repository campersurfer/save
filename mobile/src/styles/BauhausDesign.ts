/**
 * Bauhaus Design System for Save App
 * Based on Bauhaus principles: Geometric forms, primary colors, functional beauty
 */

// ============================================
// COLOR SYSTEM
// ============================================

export const Colors = {
  // Primary Bauhaus Colors
  primary: {
    blue: '#0066FF',      // Bauhaus Blue - Primary brand color
    yellow: '#FFD700',    // Bauhaus Yellow - Accent color
    red: '#FF3B30',       // Bauhaus Red - Alert/Important
    black: '#000000',     // Pure Black
    white: '#FFFFFF',     // Pure White
  },
  
  // Dark Mode Optimized (OLED)
  dark: {
    background: '#0A0A0B',    // OLED Black - Battery efficient
    surface: '#1A1A1C',       // Elevated surfaces
    surfaceHigh: '#2A2A2C',   // Higher elevation
    border: '#3A3A3C',        // Subtle borders
  },
  
  // Semantic Colors
  semantic: {
    success: '#4CAF50',
    warning: '#FFD700',
    error: '#FF3B30',
    info: '#0066FF',
  },
  
  // Text Colors
  text: {
    primary: '#FFFFFF',
    secondary: '#CCCCCC',
    tertiary: '#6B6B70',
    inverse: '#0A0A0B',
  },
  
  // Mood Colors (for Mind Mode)
  mood: {
    light: '#FFD700',     // Yellow
    dark: '#4A4A4A',      // Dark Gray
    warm: '#FF6B6B',      // Warm Red
    cool: '#4ECDC4',      // Cool Cyan
    neutral: '#0066FF',   // Blue
  },
};

// ============================================
// TYPOGRAPHY SYSTEM
// ============================================

export const Typography = {
  // Font Families (Bauhaus-inspired)
  fontFamily: {
    heading: 'DIN Next, Futura PT, -apple-system, sans-serif',
    body: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'JetBrains Mono, Courier, monospace',
  },
  
  // Font Sizes (8pt grid system)
  fontSize: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    body: 16,
    caption: 14,
    small: 12,
    tiny: 10,
  },
  
  // Font Weights
  fontWeight: {
    regular: '400' as '400',
    medium: '500' as '500',
    semibold: '600' as '600',
    bold: '700' as '700',
    black: '900' as '900',
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ============================================
// SPACING SYSTEM (8pt Grid)
// ============================================

export const Spacing = {
  xs: 4,   // 0.5 grid unit
  sm: 8,   // 1 grid unit
  md: 16,  // 2 grid units
  lg: 24,  // 3 grid units
  xl: 32,  // 4 grid units
  xxl: 40, // 5 grid units
  xxxl: 48, // 6 grid units
};

// ============================================
// GEOMETRIC SHAPES
// ============================================

export const Geometry = {
  // Border Radius (Sharp Bauhaus edges)
  borderRadius: {
    none: 0,      // Pure geometric
    minimal: 2,   // Slight softening
    small: 4,     // Subtle rounding
    medium: 8,    // Moderate rounding
    large: 12,    // Card rounding
    circle: 999,  // Perfect circle
  },
  
  // Icon Sizes
  iconSize: {
    small: 16,
    medium: 24,
    large: 32,
    xlarge: 40,
  },
  
  // Touch Targets (Accessibility: min 44px)
  touchTarget: {
    minimum: 44,
    comfortable: 48,
    large: 56,
  },
};

// ============================================
// SHADOWS & ELEVATION
// ============================================

export const Shadows = {
  none: 'none',
  
  // Subtle elevation for dark mode
  small: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
  },
  
  large: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ============================================
// ANIMATION & TRANSITIONS
// ============================================

export const Animation = {
  // Durations (ms)
  duration: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
    verySlow: 1000,
  },
  
  // Easing functions
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
};

// ============================================
// COMPONENT STYLES
// ============================================

export const Components = {
  // Navigation Tab Bar
  tabBar: {
    height: 90,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.dark.background,
    borderTopColor: Colors.dark.surface,
    borderTopWidth: 1,
  },
  
  // Cards
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: Geometry.borderRadius.none, // Sharp Bauhaus edges
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
  },
  
  // Buttons
  button: {
    primary: {
      backgroundColor: Colors.primary.blue,
      borderRadius: Geometry.borderRadius.none,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: Colors.primary.blue,
      borderRadius: Geometry.borderRadius.none,
      paddingVertical: Spacing.md - 2,
      paddingHorizontal: Spacing.lg - 2,
    },
  },
  
  // Audio Player
  audioPlayer: {
    waveform: {
      primaryColor: Colors.primary.blue,
      secondaryColor: Colors.primary.yellow,
      backgroundColor: Colors.dark.surface,
    },
    controls: {
      playButton: {
        size: 56,
        backgroundColor: Colors.primary.blue,
        iconColor: Colors.primary.white,
      },
      skipButton: {
        size: 40,
        iconColor: Colors.text.primary,
      },
    },
  },
};

// ============================================
// GEOMETRIC ICONS (Tab Bar)
// ============================================

export const GeometricIcons = {
  feed: 'square',      // Square for Feed
  mind: 'triangle',    // Triangle for Mind  
  add: 'circle',       // Circle for Add
  settings: 'hexagon', // Hexagon for Settings
};

// ============================================
// LAYOUT GRID
// ============================================

export const Grid = {
  // 8pt grid system
  unit: 8,
  
  // Responsive breakpoints
  breakpoints: {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
  },
  
  // Container widths
  container: {
    mobile: '100%',
    tablet: 720,
    desktop: 960,
    wide: 1200,
  },
  
  // Sidebar (Web)
  sidebar: {
    width: 240,
    collapsed: 64,
  },
};

// ============================================
// ACCESSIBILITY
// ============================================

export const Accessibility = {
  // WCAG 2.1 AA Compliance
  contrast: {
    minimum: 4.5,  // Normal text
    large: 3,      // Large text
  },
  
  // Touch targets
  touchTarget: {
    minimum: 44,
    recommended: 48,
  },
  
  // Focus indicators
  focus: {
    color: Colors.primary.blue,
    width: 2,
    offset: 2,
  },
};

// ============================================
// HAPTIC FEEDBACK
// ============================================

export const Haptics = {
  impact: {
    light: 'impactLight',
    medium: 'impactMedium',
    heavy: 'impactHeavy',
  },
  
  notification: {
    success: 'notificationSuccess',
    warning: 'notificationWarning',
    error: 'notificationError',
  },
  
  selection: 'selection',
};

// Export all as default
export default {
  Colors,
  Typography,
  Spacing,
  Geometry,
  Shadows,
  Animation,
  Components,
  GeometricIcons,
  Grid,
  Accessibility,
  Haptics,
};