import React, { createContext, useState, useEffect, useCallback } from 'react';

interface Article {
  id: string;
  title: string;
  author?: string;
  content: string;
  url: string;
  imageUrl?: string;
  readTime?: number;
  savedAt: Date;
  readAt?: Date;
  dominantColor?: string;
  mood?: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
  type: 'article' | 'tweet' | 'instagram' | 'tiktok';
  tags?: string[];
}

interface ContentContextType {
  articles: Article[];
  isLoading: boolean;
  error: string | null;
  refreshArticles: () => Promise<void>;
  markAsRead: (articleId: string) => void;
  deleteArticle: (articleId: string) => void;
  addArticle: (url: string) => Promise<void>;
  searchArticles: (query: string) => Article[];
  getUnreadCount: () => number;
  getReadCount: () => number;
}

export const ContentContext = createContext<ContentContextType>({
  articles: [],
  isLoading: false,
  error: null,
  refreshArticles: async () => {},
  markAsRead: () => {},
  deleteArticle: () => {},
  addArticle: async () => {},
  searchArticles: () => [],
  getUnreadCount: () => 0,
  getReadCount: () => 0,
});

interface ContentProviderProps {
  children: React.ReactNode;
}

export const ContentProvider: React.FC<ContentProviderProps> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for development/testing
  const generateMockArticles = useCallback((): Article[] => {
    const mockArticles: Article[] = [
      {
        id: '1',
        title: 'The Future of React Native Development',
        author: 'Sarah Chen',
        content: 'React Native continues to evolve with new features and improvements. This comprehensive guide explores the latest developments in mobile app development using React Native, including new APIs, performance optimizations, and best practices for 2024.',
        url: 'https://example.com/react-native-future',
        imageUrl: 'https://picsum.photos/400/250?random=1',
        readTime: 8,
        savedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        dominantColor: '#61DAFB',
        mood: 'cool',
        type: 'article',
        tags: ['react-native', 'mobile', 'development'],
      },
      {
        id: '2',
        title: 'Thread on mobile app accessibility best practices',
        author: '@a11y_expert',
        content: '1/12 🧵 Mobile accessibility is crucial but often overlooked. Here are the key principles every developer should know...',
        url: 'https://twitter.com/a11y_expert/status/123',
        readTime: 3,
        savedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        dominantColor: '#1DA1F2',
        mood: 'light',
        type: 'tweet',
        tags: ['accessibility', 'mobile', 'ux'],
      },
      {
        id: '3',
        title: 'Beautiful UI design inspiration',
        author: 'design_studio',
        content: 'Clean, minimalist interface design for a productivity app. Love the use of white space and subtle shadows.',
        url: 'https://instagram.com/p/abc123',
        imageUrl: 'https://picsum.photos/400/400?random=3',
        savedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        readAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Read 1 hour ago
        dominantColor: '#E4405F',
        mood: 'warm',
        type: 'instagram',
        tags: ['design', 'ui', 'inspiration'],
      },
      {
        id: '4',
        title: 'Understanding JavaScript Closures',
        author: 'Dev Academy',
        content: 'Closures are one of the most important concepts in JavaScript. They enable powerful patterns and are essential for understanding how JavaScript works under the hood.',
        url: 'https://example.com/js-closures',
        imageUrl: 'https://picsum.photos/400/250?random=4',
        readTime: 12,
        savedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        dominantColor: '#F7DF1E',
        mood: 'warm',
        type: 'article',
        tags: ['javascript', 'programming', 'concepts'],
      },
      {
        id: '5',
        title: 'Quick TikTok on coding productivity tips',
        author: 'coder_life',
        content: 'POV: You just discovered these 5 coding productivity hacks that changed everything! 🚀',
        url: 'https://tiktok.com/@coder_life/video/123',
        savedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        dominantColor: '#000000',
        mood: 'dark',
        type: 'tiktok',
        tags: ['productivity', 'coding', 'tips'],
      },
      {
        id: '6',
        title: 'The Psychology of Color in App Design',
        author: 'UX Research Lab',
        content: 'Color psychology plays a crucial role in user experience design. This study examines how different color palettes affect user behavior and app engagement.',
        url: 'https://example.com/color-psychology',
        imageUrl: 'https://picsum.photos/400/300?random=6',
        readTime: 15,
        savedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Read 1 day ago
        dominantColor: '#9B59B6',
        mood: 'cool',
        type: 'article',
        tags: ['design', 'psychology', 'ux'],
      },
      {
        id: '7',
        title: 'TypeScript 5.0 New Features Thread',
        author: '@typescript_dev',
        content: '🎉 TypeScript 5.0 is here! Major improvements include better type inference, new decorators, and performance enhancements.',
        url: 'https://twitter.com/typescript_dev/status/456',
        readTime: 5,
        savedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        dominantColor: '#3178C6',
        mood: 'cool',
        type: 'tweet',
        tags: ['typescript', 'javascript', 'updates'],
      },
    ];

    return mockArticles;
  }, []);

  // Initialize with mock data
  useEffect(() => {
    setArticles(generateMockArticles());
  }, [generateMockArticles]);

  const refreshArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, this would fetch from your backend API
      // const response = await fetch('/api/articles');
      // const data = await response.json();
      
      // For now, regenerate mock data with some variations
      const refreshedArticles = generateMockArticles().map(article => ({
        ...article,
        savedAt: new Date(article.savedAt.getTime() + Math.random() * 60000), // Slight time variations
      }));
      
      setArticles(refreshedArticles);
    } catch (err) {
      setError('Failed to refresh articles');
      console.error('Error refreshing articles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [generateMockArticles]);

  const markAsRead = useCallback((articleId: string) => {
    setArticles(prevArticles =>
      prevArticles.map(article =>
        article.id === articleId
          ? { ...article, readAt: new Date() }
          : article
      )
    );
  }, []);

  const deleteArticle = useCallback((articleId: string) => {
    setArticles(prevArticles =>
      prevArticles.filter(article => article.id !== articleId)
    );
  }, []);

  const addArticle = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call to extract article content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real app, this would send the URL to your backend for extraction
      // const response = await fetch('/api/extract', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ url })
      // });
      
      // Mock extracted article
      const newArticle: Article = {
        id: Date.now().toString(),
        title: 'New Article from URL',
        content: 'This article was extracted from the provided URL...',
        url,
        savedAt: new Date(),
        type: 'article',
        readTime: 5,
      };
      
      setArticles(prevArticles => [newArticle, ...prevArticles]);
    } catch (err) {
      setError('Failed to add article');
      console.error('Error adding article:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchArticles = useCallback((query: string): Article[] => {
    if (!query.trim()) return articles;
    
    const lowerQuery = query.toLowerCase();
    return articles.filter(article =>
      article.title.toLowerCase().includes(lowerQuery) ||
      article.content.toLowerCase().includes(lowerQuery) ||
      article.author?.toLowerCase().includes(lowerQuery) ||
      article.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [articles]);

  const getUnreadCount = useCallback(() => {
    return articles.filter(article => !article.readAt).length;
  }, [articles]);

  const getReadCount = useCallback(() => {
    return articles.filter(article => article.readAt).length;
  }, [articles]);

  const contextValue: ContentContextType = {
    articles,
    isLoading,
    error,
    refreshArticles,
    markAsRead,
    deleteArticle,
    addArticle,
    searchArticles,
    getUnreadCount,
    getReadCount,
  };

  return (
    <ContentContext.Provider value={contextValue}>
      {children}
    </ContentContext.Provider>
  );
};