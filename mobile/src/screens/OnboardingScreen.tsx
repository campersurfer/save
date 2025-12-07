import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Geometry } from '../styles/BauhausDesign';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  shape: 'circle' | 'square' | 'triangle';
}

const slides: Slide[] = [
  {
    id: '1',
    title: 'Save Anywhere',
    subtitle: 'Capture articles, tweets, and posts from any app. Just share to Save.',
    icon: 'bookmark',
    color: Colors.primary.blue,
    shape: 'square',
  },
  {
    id: '2',
    title: 'Visual Mind',
    subtitle: 'Your content, organized by mood and color. A new way to explore your reading list.',
    icon: 'grid',
    color: Colors.primary.yellow,
    shape: 'triangle',
  },
  {
    id: '3',
    title: 'Listen on the Go',
    subtitle: 'Turn any article into audio. High-quality text-to-speech for your daily commute.',
    icon: 'headset',
    color: Colors.primary.red,
    shape: 'circle',
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onComplete();
    }
  };

  const renderShape = (shape: string, color: string) => {
    const size = 200;
    switch (shape) {
      case 'circle':
        return (
          <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: 0.2,
            position: 'absolute',
            top: '20%',
          }} />
        );
      case 'square':
        return (
          <View style={{
            width: size,
            height: size,
            backgroundColor: color,
            opacity: 0.2,
            position: 'absolute',
            top: '20%',
            transform: [{ rotate: '15deg' }],
          }} />
        );
      case 'triangle':
        return (
          <View style={{
            width: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderStyle: 'solid',
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: size,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
            opacity: 0.2,
            position: 'absolute',
            top: '20%',
          }} />
        );
      default:
        return null;
    }
  };

  const renderItem = ({ item }: { item: Slide }) => {
    return (
      <View style={styles.slide}>
        {renderShape(item.shape, item.color)}
        
        <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon} size={64} color={Colors.primary.white} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  const renderPaginator = () => {
    return (
      <View style={styles.paginator}>
        {slides.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [10, 20, 10],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={i.toString()}
              style={[
                styles.dot,
                { width: dotWidth, opacity },
                { backgroundColor: i === currentIndex ? Colors.primary.blue : Colors.text.tertiary }
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={slides}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />

      <View style={styles.footer}>
        {renderPaginator()}
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={scrollToNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons 
            name={currentIndex === slides.length - 1 ? "rocket-outline" : "arrow-forward"} 
            size={20} 
            color={Colors.primary.white} 
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    alignItems: 'center',
    maxWidth: '80%',
  },
  title: {
    fontSize: Typography.fontSize.h1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.heading,
  },
  subtitle: {
    fontSize: Typography.fontSize.h4,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: Typography.fontFamily.body,
  },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paginator: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: Colors.primary.blue,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: Geometry.borderRadius.medium,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.primary.white,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
  },
});
