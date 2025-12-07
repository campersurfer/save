import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Article {
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
  type: 'article' | 'tweet' | 'instagram' | 'tiktok' | 'note';
  tags?: string[];
  isNote?: boolean; // Quick notes created directly in the app
  isFavorite?: boolean;
}

export class StorageService {
  private static readonly ARTICLES_KEY = 'save_articles';
  private static readonly SETTINGS_KEY = 'save_settings';

  static async getAllArticles(): Promise<Article[]> {
    try {
      const articlesJson = await AsyncStorage.getItem(this.ARTICLES_KEY);
      if (!articlesJson) return [];

      const articles = JSON.parse(articlesJson);
      
      // Convert date strings back to Date objects
      return articles.map((article: any) => ({
        ...article,
        savedAt: new Date(article.savedAt),
        readAt: article.readAt ? new Date(article.readAt) : undefined,
      }));
    } catch (error) {
      console.error('Failed to load articles:', error);
      return [];
    }
  }

  static async saveArticle(article: Article): Promise<void> {
    try {
      const articles = await this.getAllArticles();
      const updatedArticles = [article, ...articles];
      
      await AsyncStorage.setItem(this.ARTICLES_KEY, JSON.stringify(updatedArticles));
    } catch (error) {
      console.error('Failed to save article:', error);
      throw new Error('Failed to save article to storage');
    }
  }

  static async updateArticle(articleId: string, updates: Partial<Article>): Promise<void> {
    try {
      const articles = await this.getAllArticles();
      const articleIndex = articles.findIndex(article => article.id === articleId);
      
      if (articleIndex === -1) {
        throw new Error('Article not found');
      }

      articles[articleIndex] = { ...articles[articleIndex], ...updates };
      
      await AsyncStorage.setItem(this.ARTICLES_KEY, JSON.stringify(articles));
    } catch (error) {
      console.error('Failed to update article:', error);
      throw new Error('Failed to update article');
    }
  }

  static async deleteArticle(articleId: string): Promise<void> {
    try {
      const articles = await this.getAllArticles();
      const filteredArticles = articles.filter(article => article.id !== articleId);
      
      await AsyncStorage.setItem(this.ARTICLES_KEY, JSON.stringify(filteredArticles));
    } catch (error) {
      console.error('Failed to delete article:', error);
      throw new Error('Failed to delete article');
    }
  }

  static async markAsRead(articleId: string): Promise<void> {
    await this.updateArticle(articleId, { readAt: new Date() });
  }

  static async getUnreadArticles(): Promise<Article[]> {
    const articles = await this.getAllArticles();
    return articles.filter(article => !article.readAt);
  }

  static async getReadArticles(): Promise<Article[]> {
    const articles = await this.getAllArticles();
    return articles.filter(article => article.readAt);
  }

  static async searchArticles(query: string): Promise<Article[]> {
    const articles = await this.getAllArticles();
    const searchQuery = query.toLowerCase();
    
    return articles.filter(article => 
      article.title.toLowerCase().includes(searchQuery) ||
      article.content.toLowerCase().includes(searchQuery) ||
      article.author?.toLowerCase().includes(searchQuery) ||
      article.tags?.some(tag => tag.toLowerCase().includes(searchQuery))
    );
  }

  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.ARTICLES_KEY, this.SETTINGS_KEY]);
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Failed to clear application data');
    }
  }

  static async getStatistics(): Promise<{
    totalArticles: number;
    unreadCount: number;
    readCount: number;
    totalReadTime: number;
    averageReadTime: number;
    tagDistribution: Record<string, number>;
    typeDistribution: Record<string, number>;
  }> {
    const articles = await this.getAllArticles();
    
    const unreadArticles = articles.filter(article => !article.readAt);
    const readArticles = articles.filter(article => article.readAt);
    
    const totalReadTime = articles.reduce((total, article) => total + (article.readTime || 0), 0);
    const averageReadTime = articles.length > 0 ? totalReadTime / articles.length : 0;
    
    const tagDistribution: Record<string, number> = {};
    const typeDistribution: Record<string, number> = {};
    
    articles.forEach(article => {
      // Count tags
      if (article.tags) {
        article.tags.forEach(tag => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      }
      
      // Count types
      typeDistribution[article.type] = (typeDistribution[article.type] || 0) + 1;
    });
    
    return {
      totalArticles: articles.length,
      unreadCount: unreadArticles.length,
      readCount: readArticles.length,
      totalReadTime,
      averageReadTime,
      tagDistribution,
      typeDistribution,
    };
  }

  // Settings management
  static async getSettings(): Promise<{
    speechRate: number;
    speechPitch: number;
    speechLanguage: string;
    speechVoice?: string;
    autoPlay: boolean;
    skipReadArticles: boolean;
  }> {
    try {
      const settingsJson = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (!settingsJson) {
        // Return default settings
        return {
          speechRate: 1.0,
          speechPitch: 1.0,
          speechLanguage: 'en-US',
          autoPlay: false,
          skipReadArticles: true,
        };
      }
      
      return JSON.parse(settingsJson);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Return defaults on error
      return {
        speechRate: 1.0,
        speechPitch: 1.0,
        speechLanguage: 'en-US',
        autoPlay: false,
        skipReadArticles: true,
      };
    }
  }

  static async updateSettings(settings: Partial<{
    speechRate: number;
    speechPitch: number;
    speechLanguage: string;
    speechVoice?: string;
    autoPlay: boolean;
    skipReadArticles: boolean;
  }>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error('Failed to save settings');
    }
  }
}