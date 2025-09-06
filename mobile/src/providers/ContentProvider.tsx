import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ArticleExtractor } from '../services/ArticleExtractor';
import { StorageService, Article } from '../services/StorageService';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load articles from storage on mount
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const storedArticles = await StorageService.getAllArticles();
      setArticles(storedArticles);
    } catch (err) {
      console.error('Failed to load articles:', err);
      setError('Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshArticles = useCallback(async () => {
    await loadArticles();
  }, []);

  const markAsRead = useCallback(async (articleId: string) => {
    try {
      await StorageService.markAsRead(articleId);
      
      setArticles(prevArticles =>
        prevArticles.map(article =>
          article.id === articleId
            ? { ...article, readAt: new Date() }
            : article
        )
      );
    } catch (err) {
      console.error('Failed to mark article as read:', err);
      setError('Failed to update article');
    }
  }, []);

  const deleteArticle = useCallback(async (articleId: string) => {
    try {
      await StorageService.deleteArticle(articleId);
      
      setArticles(prevArticles =>
        prevArticles.filter(article => article.id !== articleId)
      );
    } catch (err) {
      console.error('Failed to delete article:', err);
      setError('Failed to delete article');
    }
  }, []);

  const addArticle = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Extract article content from URL
      const extractedContent = await ArticleExtractor.extractFromUrl(url);
      
      // Create new article object
      const newArticle: Article = {
        id: Date.now().toString(),
        title: extractedContent.title,
        author: extractedContent.author,
        content: extractedContent.content,
        url,
        imageUrl: extractedContent.imageUrl,
        readTime: extractedContent.readTime,
        savedAt: new Date(),
        type: ArticleExtractor.determineArticleType(url),
        mood: ArticleExtractor.generateMood(extractedContent.content, extractedContent.title),
        tags: ArticleExtractor.extractTags(extractedContent.content, extractedContent.title),
      };

      // Save to storage
      await StorageService.saveArticle(newArticle);
      
      // Update local state
      setArticles(prevArticles => [newArticle, ...prevArticles]);
      
    } catch (err) {
      console.error('Failed to add article:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract article content';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchArticles = useCallback((query: string): Article[] => {
    if (!query.trim()) return articles;
    
    const searchQuery = query.toLowerCase();
    return articles.filter(article => 
      article.title.toLowerCase().includes(searchQuery) ||
      article.content.toLowerCase().includes(searchQuery) ||
      article.author?.toLowerCase().includes(searchQuery) ||
      article.tags?.some(tag => tag.toLowerCase().includes(searchQuery))
    );
  }, [articles]);

  const getUnreadCount = useCallback((): number => {
    return articles.filter(article => !article.readAt).length;
  }, [articles]);

  const getReadCount = useCallback((): number => {
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