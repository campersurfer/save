import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

interface Article {
  id: string;
  title: string;
  author?: string;
  content: string;
  url: string;
  readTime?: number;
  type: 'article' | 'tweet' | 'instagram' | 'tiktok';
}

interface AudioContextType {
  // Playback state
  isPlaying: boolean;
  currentArticle: Article | null;
  currentPosition: number;
  totalDuration: number;
  playbackSpeed: number;
  
  // Queue management
  playQueue: Article[];
  currentIndex: number;
  
  // Control functions
  playArticle: (article: Article) => Promise<void>;
  playQueue: (articles: Article[]) => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  
  // Queue controls
  addToQueue: (article: Article) => void;
  removeFromQueue: (articleId: string) => void;
  clearQueue: () => void;
  
  // Sleep timer
  sleepTimerMinutes: number | null;
  setSleepTimer: (minutes: number | null) => void;
}

export const AudioContext = createContext<AudioContextType>({
  isPlaying: false,
  currentArticle: null,
  currentPosition: 0,
  totalDuration: 0,
  playbackSpeed: 1.0,
  playQueue: [],
  currentIndex: -1,
  playArticle: async () => {},
  playQueue: async () => {},
  pausePlayback: async () => {},
  resumePlayback: async () => {},
  stopPlayback: async () => {},
  skipToNext: async () => {},
  skipToPrevious: async () => {},
  seekTo: async () => {},
  setPlaybackSpeed: async () => {},
  addToQueue: () => {},
  removeFromQueue: () => {},
  clearQueue: () => {},
  sleepTimerMinutes: null,
  setSleepTimer: () => {},
});

interface AudioProviderProps {
  children: React.ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [queue, setQueue] = useState<Article[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  // Refs
  const sound = useRef<Audio.Sound | null>(null);
  const positionTimer = useRef<NodeJS.Timeout | null>(null);
  const sleepTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio session
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    initializeAudio();
  }, []);

  // Position tracking
  useEffect(() => {
    if (isPlaying && sound.current) {
      positionTimer.current = setInterval(async () => {
        try {
          const status = await sound.current!.getStatusAsync();
          if (status.isLoaded) {
            setCurrentPosition(status.positionMillis / 1000);
            setTotalDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          }
        } catch (error) {
          console.error('Error getting playback status:', error);
        }
      }, 100);
    } else {
      if (positionTimer.current) {
        clearInterval(positionTimer.current);
        positionTimer.current = null;
      }
    }

    return () => {
      if (positionTimer.current) {
        clearInterval(positionTimer.current);
      }
    };
  }, [isPlaying]);

  // Sleep timer effect
  useEffect(() => {
    if (sleepTimerMinutes !== null) {
      sleepTimer.current = setTimeout(async () => {
        await fadeOutAndStop();
        setSleepTimerMinutes(null);
      }, sleepTimerMinutes * 60 * 1000);
    } else {
      if (sleepTimer.current) {
        clearTimeout(sleepTimer.current);
        sleepTimer.current = null;
      }
    }

    return () => {
      if (sleepTimer.current) {
        clearTimeout(sleepTimer.current);
      }
    };
  }, [sleepTimerMinutes]);

  // Text-to-Speech function (mock implementation)
  const generateTTSAudio = useCallback(async (text: string): Promise<string> => {
    // In a real implementation, this would:
    // 1. Send text to a TTS service (Google TTS, Azure Speech, etc.)
    // 2. Return the audio file URL or base64 data
    // 3. Handle different languages and voices
    
    // For now, return a mock audio URL
    // This would be replaced with actual TTS integration
    return 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
  }, []);

  const prepareAudioContent = useCallback(async (article: Article): Promise<string> => {
    // Prepare the text content for TTS
    let textContent = `${article.title}. `;
    
    if (article.author) {
      textContent += `By ${article.author}. `;
    }
    
    textContent += article.content;
    
    // Clean up text for better TTS
    textContent = textContent
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Generate TTS audio
    return await generateTTSAudio(textContent);
  }, [generateTTSAudio]);

  const loadAndPlayAudio = useCallback(async (audioUri: string) => {
    try {
      // Unload previous sound
      if (sound.current) {
        await sound.current.unloadAsync();
      }

      // Load new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: true,
          rate: playbackSpeed,
          volume: 1.0,
        }
      );

      sound.current = newSound;

      // Set up playback status update
      sound.current.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentPosition(status.positionMillis / 1000);
          setTotalDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          
          // Auto-advance to next article when current finishes
          if (status.didJustFinish) {
            skipToNext();
          }
        }
      });

      setIsPlaying(true);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  }, [playbackSpeed]);

  const playArticle = useCallback(async (article: Article) => {
    try {
      setCurrentArticle(article);
      setQueue([article]);
      setCurrentIndex(0);
      
      // For development, use a mock audio file
      // In production, this would generate TTS audio
      const audioUri = await prepareAudioContent(article);
      await loadAndPlayAudio(audioUri);
    } catch (error) {
      console.error('Error playing article:', error);
    }
  }, [prepareAudioContent, loadAndPlayAudio]);

  const playQueueHandler = useCallback(async (articles: Article[]) => {
    if (articles.length === 0) return;
    
    setQueue(articles);
    setCurrentIndex(0);
    setCurrentArticle(articles[0]);
    
    try {
      const audioUri = await prepareAudioContent(articles[0]);
      await loadAndPlayAudio(audioUri);
    } catch (error) {
      console.error('Error playing queue:', error);
    }
  }, [prepareAudioContent, loadAndPlayAudio]);

  const pausePlayback = useCallback(async () => {
    try {
      if (sound.current) {
        await sound.current.pauseAsync();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  }, []);

  const resumePlayback = useCallback(async () => {
    try {
      if (sound.current) {
        await sound.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    try {
      if (sound.current) {
        await sound.current.stopAsync();
        setIsPlaying(false);
        setCurrentPosition(0);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }, []);

  const skipToNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      setCurrentArticle(queue[nextIndex]);
      
      try {
        const audioUri = await prepareAudioContent(queue[nextIndex]);
        await loadAndPlayAudio(audioUri);
      } catch (error) {
        console.error('Error skipping to next:', error);
      }
    } else {
      // End of queue
      await stopPlayback();
      setCurrentArticle(null);
      setCurrentIndex(-1);
    }
  }, [currentIndex, queue, prepareAudioContent, loadAndPlayAudio, stopPlayback]);

  const skipToPrevious = useCallback(async () => {
    const previousIndex = currentIndex - 1;
    if (previousIndex >= 0) {
      setCurrentIndex(previousIndex);
      setCurrentArticle(queue[previousIndex]);
      
      try {
        const audioUri = await prepareAudioContent(queue[previousIndex]);
        await loadAndPlayAudio(audioUri);
      } catch (error) {
        console.error('Error skipping to previous:', error);
      }
    } else {
      // Restart current article
      try {
        if (sound.current) {
          await sound.current.setPositionAsync(0);
        }
      } catch (error) {
        console.error('Error restarting article:', error);
      }
    }
  }, [currentIndex, queue, prepareAudioContent, loadAndPlayAudio]);

  const seekTo = useCallback(async (position: number) => {
    try {
      if (sound.current) {
        await sound.current.setPositionAsync(position * 1000);
        setCurrentPosition(position);
      }
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, []);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    try {
      if (sound.current) {
        await sound.current.setRateAsync(speed, true);
        setPlaybackSpeedState(speed);
      }
    } catch (error) {
      console.error('Error setting playback speed:', error);
    }
  }, []);

  const addToQueue = useCallback((article: Article) => {
    setQueue(prevQueue => [...prevQueue, article]);
  }, []);

  const removeFromQueue = useCallback((articleId: string) => {
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter(article => article.id !== articleId);
      
      // Adjust current index if necessary
      const removedIndex = prevQueue.findIndex(article => article.id === articleId);
      if (removedIndex !== -1 && removedIndex <= currentIndex) {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
      
      return newQueue;
    });
  }, [currentIndex]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
    stopPlayback();
  }, [stopPlayback]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
  }, []);

  const fadeOutAndStop = useCallback(async () => {
    // Implement fade out effect
    if (sound.current) {
      try {
        // Gradually reduce volume over 3 seconds
        const fadeSteps = 30;
        const fadeInterval = 100; // 100ms intervals
        
        for (let i = fadeSteps; i >= 0; i--) {
          await sound.current.setVolumeAsync(i / fadeSteps);
          await new Promise(resolve => setTimeout(resolve, fadeInterval));
        }
        
        await stopPlayback();
        await sound.current.setVolumeAsync(1.0); // Reset volume for next play
      } catch (error) {
        console.error('Error during fade out:', error);
      }
    }
  }, [stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
      if (positionTimer.current) {
        clearInterval(positionTimer.current);
      }
      if (sleepTimer.current) {
        clearTimeout(sleepTimer.current);
      }
    };
  }, []);

  const contextValue: AudioContextType = {
    isPlaying,
    currentArticle,
    currentPosition,
    totalDuration,
    playbackSpeed,
    playQueue: queue,
    currentIndex,
    playArticle,
    playQueue: playQueueHandler,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    skipToNext,
    skipToPrevious,
    seekTo,
    setPlaybackSpeed,
    addToQueue,
    removeFromQueue,
    clearQueue,
    sleepTimerMinutes,
    setSleepTimer,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};