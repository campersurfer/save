import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { StorageService, Article } from '../services/StorageService';

interface AudioContextType {
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  currentArticle: Article | null;
  currentPosition: number;
  totalDuration: number;
  playbackSpeed: number;
  voices: Speech.Voice[];
  selectedVoice: string | null;
  
  // Queue management
  playQueue: Article[];
  currentIndex: number;
  
  // Control functions
  playArticle: (article: Article) => Promise<void>;
  startPlayQueue: (articles: Article[]) => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  setVoice: (identifier: string) => Promise<void>;
  
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
  isPaused: false,
  currentArticle: null,
  currentPosition: 0,
  totalDuration: 0,
  playbackSpeed: 1.0,
  voices: [],
  selectedVoice: null,
  playQueue: [],
  currentIndex: -1,
  playArticle: async () => {},
  startPlayQueue: async () => {},
  pausePlayback: async () => {},
  resumePlayback: async () => {},
  stopPlayback: async () => {},
  skipToNext: async () => {},
  skipToPrevious: async () => {},
  setPlaybackSpeed: async () => {},
  setVoice: async () => {},
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
  const [isPaused, setIsPaused] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [queue, setQueue] = useState<Article[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  // Refs
  const sleepTimer = useRef<NodeJS.Timeout | null>(null);
  const currentSpeechId = useRef<string | null>(null);
  const speechSettings = useRef<{
    rate: number;
    pitch: number;
    language: string;
    voice?: string;
  }>({
    rate: 1.0,
    pitch: 1.0,
    language: 'en-US',
  });

  // Load voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const available = await Speech.getAvailableVoicesAsync();
        setVoices(available);
      } catch (error) {
        console.error('Error loading voices:', error);
      }
    };
    loadVoices();
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await StorageService.getSettings();
      speechSettings.current = {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        language: settings.speechLanguage,
        voice: settings.speechVoice,
      };
      setPlaybackSpeedState(settings.speechRate);
      setSelectedVoice(settings.speechVoice || null);
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
  };

  // Sleep timer effect
  useEffect(() => {
    if (sleepTimerMinutes !== null) {
      sleepTimer.current = setTimeout(async () => {
        await stopPlayback();
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

  const prepareTextForSpeech = useCallback((article: Article): string => {
    let textContent = '';
    
    // Add title
    textContent += `Article: ${article.title}. `;
    
    // Add author if available
    if (article.author) {
      textContent += `By ${article.author}. `;
    }
    
    // Add content
    textContent += article.content;
    
    // Clean up text for better speech
    textContent = textContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '. ')
      .replace(/([.!?])\s*([.!?])/g, '$1 ')
      .trim();
    
    return textContent;
  }, []);

  const estimateReadingTime = useCallback((text: string): number => {
    // Average speech rate is about 150-200 words per minute
    // We'll use 180 WPM as a middle ground
    const words = text.split(/\s+/).length;
    const minutes = words / 180;
    return Math.max(minutes * 60, 10); // Minimum 10 seconds
  }, []);

  const playArticle = useCallback(async (article: Article) => {
    try {
      await stopPlayback();
      
      setCurrentArticle(article);
      setQueue([article]);
      setCurrentIndex(0);
      setCurrentPosition(0);
      
      const textToSpeak = prepareTextForSpeech(article);
      const estimatedDuration = estimateReadingTime(textToSpeak);
      setTotalDuration(estimatedDuration);
      
      // Create unique speech ID for tracking
      const speechId = `speech_${Date.now()}`;
      currentSpeechId.current = speechId;
      
      // Start speech
      await Speech.speak(textToSpeak, {
        language: speechSettings.current.language,
        pitch: speechSettings.current.pitch,
        rate: speechSettings.current.rate,
        voice: speechSettings.current.voice,
        onStart: () => {
          if (currentSpeechId.current === speechId) {
            setIsPlaying(true);
            setIsPaused(false);
          }
        },
        onDone: () => {
          if (currentSpeechId.current === speechId) {
            skipToNext();
          }
        },
        onStopped: () => {
          if (currentSpeechId.current === speechId) {
            setIsPlaying(false);
            setIsPaused(false);
          }
        },
        onError: (error) => {
          console.error('Speech synthesis error:', error);
          if (currentSpeechId.current === speechId) {
            setIsPlaying(false);
            setIsPaused(false);
          }
        }
      });
      
    } catch (error) {
      console.error('Error playing article:', error);
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [prepareTextForSpeech, estimateReadingTime]);

  const startPlayQueue = useCallback(async (articles: Article[]) => {
    if (articles.length === 0) return;
    
    setQueue(articles);
    setCurrentIndex(0);
    await playArticle(articles[0]);
  }, [playArticle]);

  const pausePlayback = useCallback(async () => {
    try {
      await Speech.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  }, []);

  const resumePlayback = useCallback(async () => {
    try {
      await Speech.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    try {
      await Speech.stop();
      currentSpeechId.current = null;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentPosition(0);
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }, []);

  const skipToNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      await playArticle(queue[nextIndex]);
    } else {
      // End of queue
      await stopPlayback();
      setCurrentArticle(null);
      setCurrentIndex(-1);
    }
  }, [currentIndex, queue, playArticle, stopPlayback]);

  const skipToPrevious = useCallback(async () => {
    const previousIndex = currentIndex - 1;
    if (previousIndex >= 0) {
      setCurrentIndex(previousIndex);
      await playArticle(queue[previousIndex]);
    } else {
      // Restart current article
      if (currentArticle) {
        await playArticle(currentArticle);
      }
    }
  }, [currentIndex, queue, playArticle, currentArticle]);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    try {
      speechSettings.current.rate = speed;
      setPlaybackSpeedState(speed);
      
      // Save setting to storage
      await StorageService.updateSettings({ speechRate: speed });
      
      // If currently playing, we need to restart with new speed
      // Note: Expo Speech doesn't support changing speed mid-playback
      if (isPlaying && currentArticle) {
        await playArticle(currentArticle);
      }
    } catch (error) {
      console.error('Error setting playback speed:', error);
    }
  }, [isPlaying, currentArticle, playArticle]);

  const setVoice = useCallback(async (identifier: string) => {
    try {
      speechSettings.current.voice = identifier;
      setSelectedVoice(identifier);
      await StorageService.updateSettings({ speechVoice: identifier });
      
      // If currently playing, restart with new voice
      if (isPlaying && currentArticle) {
        // Save current position
        const position = currentPosition;
        await playArticle(currentArticle);
        // Note: Expo Speech doesn't support seeking, so we restart from beginning
        // In a more advanced implementation, we could try to estimate text offset
      }
    } catch (error) {
      console.error('Error setting voice:', error);
    }
  }, [isPlaying, currentArticle, playArticle, currentPosition]);

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

  const clearQueue = useCallback(async () => {
    await stopPlayback();
    setQueue([]);
    setCurrentIndex(-1);
    setCurrentArticle(null);
  }, [stopPlayback]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
  }, []);

  // Track position for currently playing speech
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && !isPaused && totalDuration > 0) {
      interval = setInterval(() => {
        setCurrentPosition(prev => {
          const newPosition = prev + 1;
          return newPosition >= totalDuration ? totalDuration : newPosition;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, isPaused, totalDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      if (sleepTimer.current) {
        clearTimeout(sleepTimer.current);
      }
    };
  }, []);

  const contextValue: AudioContextType = {
    isPlaying,
    isPaused,
    currentArticle,
    currentPosition,
    totalDuration,
    playbackSpeed,
    voices,
    selectedVoice,
    playQueue: queue,
    currentIndex,
    playArticle,
    startPlayQueue,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    skipToNext,
    skipToPrevious,
    setPlaybackSpeed,
    setVoice,
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