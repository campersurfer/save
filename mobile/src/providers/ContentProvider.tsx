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
  addNote: (title: string, content: string, imageUrl?: string) => Promise<void>;
  toggleFavorite: (articleId: string) => Promise<void>;
  archiveArticle: (articleId: string) => Promise<void>;
  refreshArticleContent: (articleId: string) => Promise<void>;
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
  addNote: async () => {},
  toggleFavorite: async () => {},
  archiveArticle: async () => {},
  refreshArticleContent: async () => {},
  searchArticles: () => [],
  getUnreadCount: () => 0,
  getReadCount: () => 0,
});

interface ContentProviderProps {
  children: React.ReactNode;
}

// Helper function to determine mood from text (outside component to avoid hooks issues)
const determineMoodFromText = (text: string): 'light' | 'dark' | 'warm' | 'cool' | 'neutral' => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('happy') || lowerText.includes('joy') || lowerText.includes('excited') || lowerText.includes('!')) {
    return 'warm';
  }
  if (lowerText.includes('sad') || lowerText.includes('worry') || lowerText.includes('concern')) {
    return 'cool';
  }
  if (lowerText.includes('idea') || lowerText.includes('thought') || lowerText.includes('remember')) {
    return 'light';
  }
  return 'neutral';
};

// Helper function to extract tags from text (outside component to avoid hooks issues)
const extractTagsFromText = (text: string): string[] => {
  const tags: string[] = [];
  // Extract hashtags
  const hashtagMatches = text.match(/#\w+/g);
  if (hashtagMatches) {
    tags.push(...hashtagMatches.map(tag => tag.slice(1)));
  }
  // Add 'note' tag
  if (!tags.includes('note')) {
    tags.push('note');
  }
  return tags.slice(0, 5); // Limit to 5 tags
};

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

  const addNote = useCallback(async (title: string, content: string, imageUrl?: string) => {
    try {
      // Determine mood based on content length and keywords
      const mood = determineMoodFromText(content);
      
      // Create new note object
      const newNote: Article = {
        id: Date.now().toString(),
        title: title || 'Quick Note',
        content,
        url: '', // Notes don't have URLs
        imageUrl,
        savedAt: new Date(),
        type: 'note',
        isNote: true,
        mood,
        tags: extractTagsFromText(content),
      };

      // Save to storage
      await StorageService.saveArticle(newNote);
      
      // Update local state
      setArticles(prevArticles => [newNote, ...prevArticles]);
      
    } catch (err) {
      console.error('Failed to add note:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save note';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const toggleFavorite = useCallback(async (articleId: string) => {
    try {
      const article = articles.find(a => a.id === articleId);
      if (!article) return;
      
      const newStatus = !article.isFavorite;
      await StorageService.updateArticle(articleId, { isFavorite: newStatus });
      
      setArticles(prevArticles =>
        prevArticles.map(a =>
          a.id === articleId
            ? { ...a, isFavorite: newStatus }
            : a
        )
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      setError('Failed to update article');
    }
  }, [articles]);

  const archiveArticle = useCallback(async (articleId: string) => {
    try {
      const article = articles.find(a => a.id === articleId);
      if (!article) return;
      
      const currentTags = article.tags || [];
      if (!currentTags.includes('archive')) {
        const newTags = [...currentTags, 'archive'];
        await StorageService.updateArticle(articleId, { tags: newTags });
        
        setArticles(prevArticles =>
          prevArticles.map(a =>
            a.id === articleId
              ? { ...a, tags: newTags }
              : a
          )
        );
      }
    } catch (err) {
      console.error('Failed to archive article:', err);
      setError('Failed to update article');
    }
  }, [articles]);

  const refreshArticleContent = useCallback(async (articleId: string) => {
    setIsLoading(true);
    try {
      const article = articles.find(a => a.id === articleId);
      if (!article || !article.url) return;

      const extractedContent = await ArticleExtractor.extractFromUrl(article.url);
      
      const updatedArticle: Partial<Article> = {
        title: extractedContent.title,
        content: extractedContent.content,
        author: extractedContent.author,
        imageUrl: extractedContent.imageUrl,
        readTime: extractedContent.readTime,
        mood: ArticleExtractor.generateMood(extractedContent.content, extractedContent.title),
        tags: [...new Set([...(article.tags || []), ...ArticleExtractor.extractTags(extractedContent.content, extractedContent.title)])],
      };

      await StorageService.updateArticle(articleId, updatedArticle);
      
      setArticles(prevArticles =>
        prevArticles.map(a =>
          a.id === articleId
            ? { ...a, ...updatedArticle }
            : a
        )
      );
    } catch (err) {
      console.error('Failed to refresh article:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [articles]);

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
    addNote,
    toggleFavorite,
    archiveArticle,
    refreshArticleContent,
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