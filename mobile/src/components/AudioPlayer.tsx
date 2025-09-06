import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioContext } from '../providers/AudioProvider';
import { Colors, Typography, Spacing, Geometry, Components } from '../styles/BauhausDesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AudioPlayer: React.FC = () => {
  const {
    isPlaying,
    currentArticle,
    playQueue,
    currentPosition,
    totalDuration,
    pausePlayback,
    resumePlayback,
    skipToNext,
    skipToPrevious,
    setPlaybackSpeed,
    playbackSpeed,
  } = useContext(AudioContext);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const progressAnimation = new Animated.Value(0);

  // Don't render if no article is loaded
  if (!currentArticle) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? currentPosition / totalDuration : 0;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setIsDragging(true);
    },
    onPanResponderMove: (evt) => {
      const seekPosition = Math.max(0, Math.min(1, evt.nativeEvent.locationX / (SCREEN_WIDTH - 32)));
      const newPosition = seekPosition * totalDuration;
      if (!isNaN(newPosition)) {
        // Seeking not currently supported with Expo Speech
        // Would need to implement with a different audio library for seek functionality
      }
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
    },
  });

  const renderCompactPlayer = () => (
    <TouchableOpacity
      style={styles.compactContainer}
      onPress={() => setIsExpanded(true)}
      activeOpacity={0.9}
    >
      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.compactContent}>
        {/* Article info */}
        <View style={styles.articleInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {currentArticle.title}
          </Text>
          <Text style={styles.compactAuthor} numberOfLines={1}>
            {currentArticle.author || 'Unknown Author'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.compactControls}>
          <TouchableOpacity onPress={skipToPrevious} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={isPlaying ? pausePlayback : resumePlayback}
            style={[styles.controlButton, styles.playButton]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={Colors.primary.white}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={skipToNext} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderExpandedPlayer = () => (
    <View style={styles.expandedContainer}>
      {/* Header */}
      <View style={styles.expandedHeader}>
        <TouchableOpacity
          onPress={() => setIsExpanded(false)}
          style={styles.collapseButton}
        >
          <Ionicons name="chevron-down" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.expandedHeaderText}>Now Playing</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Article details */}
      <View style={styles.articleDetails}>
        <Text style={styles.expandedTitle} numberOfLines={2}>
          {currentArticle.title}
        </Text>
        <Text style={styles.expandedAuthor}>
          {currentArticle.author || 'Unknown Author'}
        </Text>
        <Text style={styles.articleType}>
          {currentArticle.type.charAt(0).toUpperCase() + currentArticle.type.slice(1)}
        </Text>
      </View>

      {/* Progress section */}
      <View style={styles.progressSection}>
        <View style={styles.progressContainer} {...panResponder.panHandlers}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
          </View>
        </View>
        
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
          <Text style={styles.timeText}>{formatTime(totalDuration)}</Text>
        </View>
      </View>

      {/* Main controls */}
      <View style={styles.mainControls}>
        <TouchableOpacity onPress={skipToPrevious} style={styles.expandedControlButton}>
          <Ionicons name="play-skip-back" size={32} color={Colors.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={isPlaying ? pausePlayback : resumePlayback}
          style={[styles.expandedControlButton, styles.expandedPlayButton]}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={Components.audioPlayer.controls.playButton.size}
            color={Components.audioPlayer.controls.playButton.iconColor}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={skipToNext} style={styles.expandedControlButton}>
          <Ionicons name="play-skip-forward" size={32} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Speed control */}
      <View style={styles.speedControl}>
        <Text style={styles.speedLabel}>Speed</Text>
        <View style={styles.speedButtons}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
            <TouchableOpacity
              key={speed}
              onPress={() => setPlaybackSpeed(speed)}
              style={[
                styles.speedButton,
                playbackSpeed === speed && styles.activeSpeedButton,
              ]}
            >
              <Text
                style={[
                  styles.speedButtonText,
                  playbackSpeed === speed && styles.activeSpeedButtonText,
                ]}
              >
                {speed}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Queue info */}
      <View style={styles.queueInfo}>
        <Text style={styles.queueText}>
          {playQueue.length > 1 ? `${playQueue.length - 1} more articles in queue` : 'Last article in queue'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isExpanded ? renderExpandedPlayer() : renderCompactPlayer()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  // Compact player styles
  compactContainer: {
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: Colors.dark.border,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Components.audioPlayer.waveform.primaryColor,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  articleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  compactTitle: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.heading,
    marginBottom: 2,
  },
  compactAuthor: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.small,
  },
  compactControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: Spacing.sm,
    marginHorizontal: 4,
  },
  playButton: {
    backgroundColor: Components.audioPlayer.controls.playButton.backgroundColor,
    borderRadius: Geometry.borderRadius.none,
    padding: Spacing.sm,
    marginHorizontal: Spacing.sm,
  },
  // Expanded player styles
  expandedContainer: {
    backgroundColor: Colors.dark.background,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    minHeight: 400,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  collapseButton: {
    padding: 8,
  },
  expandedHeaderText: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.heading,
  },
  placeholder: {
    width: 40,
  },
  articleDetails: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  expandedTitle: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.heading,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.h3,
  },
  expandedAuthor: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.body,
    marginBottom: 4,
  },
  articleType: {
    color: Colors.primary.blue,
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  progressSection: {
    marginBottom: Spacing.xxl,
  },
  progressContainer: {
    paddingVertical: Spacing.md,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: Geometry.borderRadius.none,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Components.audioPlayer.waveform.primaryColor,
    borderRadius: Geometry.borderRadius.none,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    backgroundColor: Components.audioPlayer.waveform.primaryColor,
    borderRadius: Geometry.borderRadius.none,
    marginLeft: -8,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  timeText: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.caption,
    fontFamily: Typography.fontFamily.mono,
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  expandedControlButton: {
    padding: Spacing.md,
    marginHorizontal: 20,
  },
  expandedPlayButton: {
    backgroundColor: Components.audioPlayer.controls.playButton.backgroundColor,
    borderRadius: Geometry.borderRadius.none,
    width: Components.audioPlayer.controls.playButton.size,
    height: Components.audioPlayer.controls.playButton.size,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedControl: {
    marginBottom: Spacing.lg,
  },
  speedLabel: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.heading,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  speedButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  speedButton: {
    backgroundColor: Colors.dark.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Geometry.borderRadius.none,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  activeSpeedButton: {
    backgroundColor: Colors.primary.blue,
  },
  speedButtonText: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.mono,
  },
  activeSpeedButtonText: {
    color: Colors.text.primary,
  },
  queueInfo: {
    alignItems: 'center',
  },
  queueText: {
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.caption,
  },
});