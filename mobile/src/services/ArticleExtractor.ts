import { parse } from 'node-html-parser';

export interface ExtractedArticle {
  title: string;
  content: string;
  author?: string;
  imageUrl?: string;
  readTime?: number;
  publishedAt?: Date;
}

export class ArticleExtractor {
  private static readonly USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  
  static async extractFromUrl(url: string): Promise<ExtractedArticle> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const root = parse(html);

      return this.extractContentFromHTML(root, url);
    } catch (error) {
      console.error('Article extraction failed:', error);
      throw new Error(`Failed to extract article: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static extractContentFromHTML(root: any, url: string): ExtractedArticle {
    // Extract title
    const title = this.extractTitle(root);
    
    // Extract main content
    const content = this.extractContent(root);
    
    // Extract author
    const author = this.extractAuthor(root);
    
    // Extract main image
    const imageUrl = this.extractImage(root, url);
    
    // Calculate read time (average 200 words per minute)
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.max(1, Math.round(wordCount / 200));

    // Extract publication date
    const publishedAt = this.extractPublishDate(root);

    return {
      title: title || 'Article',
      content,
      author,
      imageUrl,
      readTime,
      publishedAt,
    };
  }

  private static extractTitle(root: any): string {
    // Try multiple selectors for title
    const titleSelectors = [
      'h1[class*="title"]',
      'h1[class*="headline"]',
      'h1',
      '[class*="article-title"]',
      '[class*="post-title"]',
      'title',
    ];

    for (const selector of titleSelectors) {
      const element = root.querySelector(selector);
      if (element) {
        const text = element.text?.trim();
        if (text && text.length > 5) {
          return text;
        }
      }
    }

    // Fallback to meta tags
    const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const twitterTitle = root.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
    
    return ogTitle || twitterTitle || 'Untitled Article';
  }

  private static extractContent(root: any): string {
    // Try to find main content area
    const contentSelectors = [
      'article[class*="content"]',
      '[class*="article-body"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      'main article',
      '[role="main"] article',
      '.content article',
      'article',
    ];

    for (const selector of contentSelectors) {
      const contentArea = root.querySelector(selector);
      if (contentArea) {
        // Try to extract paragraphs from this specific area first
        const paragraphs = contentArea.querySelectorAll('p');
        if (paragraphs.length > 0) {
          return this.formatParagraphs(paragraphs);
        }
        // Fallback to text content if no P tags (cleaned less aggressively)
        return this.cleanContent(contentArea);
      }
    }

    // Fallback: extract all paragraphs from root
    const paragraphs = root.querySelectorAll('p');
    if (paragraphs.length > 0) {
      return this.formatParagraphs(paragraphs);
    }

    return 'Content could not be extracted from this article.';
  }

  private static formatParagraphs(paragraphs: any[]): string {
    return paragraphs
      .map((p: any) => p.text?.trim())
      .filter((text: string) => text && text.length > 20) // Filter very short lines/empty paragraphs
      .join('\n\n');
  }

  private static extractAuthor(root: any): string | undefined {
    const authorSelectors = [
      '[rel="author"]',
      '[class*="author"]',
      '[class*="byline"]',
      'meta[name="author"]',
      'meta[property="article:author"]',
    ];

    for (const selector of authorSelectors) {
      const element = root.querySelector(selector);
      if (element) {
        const author = element.text?.trim() || element.getAttribute('content')?.trim();
        if (author && author.length > 1 && author.length < 100) {
          return author;
        }
      }
    }

    return undefined;
  }

  private static extractImage(root: any, baseUrl: string): string | undefined {
    const imageSelectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'article img[src*="featured"]',
      'article img:first-of-type',
      '.featured-image img',
    ];

    for (const selector of imageSelectors) {
      const element = root.querySelector(selector);
      if (element) {
        const src = element.getAttribute('content') || element.getAttribute('src');
        if (src) {
          return this.resolveUrl(src, baseUrl);
        }
      }
    }

    return undefined;
  }

  private static extractPublishDate(root: any): Date | undefined {
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publication_date"]',
      'time[datetime]',
      '[class*="publish"]',
      '[class*="date"]',
    ];

    for (const selector of dateSelectors) {
      const element = root.querySelector(selector);
      if (element) {
        const dateStr = element.getAttribute('content') || 
                       element.getAttribute('datetime') || 
                       element.text?.trim();
        
        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    return undefined;
  }

  private static cleanContent(contentArea: any): string {
    // Remove unwanted elements
    const unwantedSelectors = [
      'script',
      'style',
      '.advertisement',
      '.ads',
      '.social-share',
      '.related-articles',
      '.comments',
      'nav',
      'footer',
      'aside',
    ];

    unwantedSelectors.forEach(selector => {
      contentArea.querySelectorAll(selector).forEach((el: any) => el.remove());
    });

    // Extract text content and clean it
    const textContent = contentArea.text || '';
    
    return textContent
      .replace(/[ \t]+/g, ' ') // Collapse spaces/tabs but not newlines
      .replace(/(\n\s*){3,}/g, '\n\n') // Limit consecutive newlines
      .trim();
  }

  private static resolveUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith('http')) {
        return url;
      }
      
      const base = new URL(baseUrl);
      
      if (url.startsWith('//')) {
        return `${base.protocol}${url}`;
      }
      
      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }
      
      return `${base.protocol}//${base.host}${base.pathname}/${url}`;
    } catch {
      return url;
    }
  }

  static determineArticleType(url: string): 'article' | 'tweet' | 'instagram' | 'tiktok' {
    const domain = this.extractDomain(url);
    
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return 'tweet';
    }
    
    if (domain.includes('instagram.com')) {
      return 'instagram';
    }
    
    if (domain.includes('tiktok.com')) {
      return 'tiktok';
    }
    
    return 'article';
  }

  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  static generateMood(content: string, title: string): 'light' | 'dark' | 'warm' | 'cool' | 'neutral' {
    const text = `${title} ${content}`.toLowerCase();
    
    const lightWords = ['happy', 'joy', 'success', 'positive', 'bright', 'celebration', 'good news'];
    const darkWords = ['crisis', 'problem', 'death', 'failure', 'war', 'disaster', 'negative'];
    const warmWords = ['love', 'family', 'home', 'comfort', 'cozy', 'friendship', 'community'];
    const coolWords = ['technology', 'science', 'digital', 'innovation', 'future', 'analysis'];
    
    const lightScore = lightWords.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
    const darkScore = darkWords.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
    const warmScore = warmWords.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
    const coolScore = coolWords.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
    
    const maxScore = Math.max(lightScore, darkScore, warmScore, coolScore);
    
    if (maxScore === 0) return 'neutral';
    if (lightScore === maxScore) return 'light';
    if (darkScore === maxScore) return 'dark';
    if (warmScore === maxScore) return 'warm';
    if (coolScore === maxScore) return 'cool';
    
    return 'neutral';
  }

  static extractTags(content: string, title: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    
    const tagMap: Record<string, string[]> = {
      technology: ['tech', 'technology', 'digital', 'software', 'app', 'computer', 'ai', 'machine learning'],
      business: ['business', 'startup', 'entrepreneur', 'market', 'finance', 'investment', 'economy'],
      health: ['health', 'medical', 'doctor', 'medicine', 'fitness', 'wellness', 'mental health'],
      design: ['design', 'ui', 'ux', 'creative', 'art', 'visual', 'interface', 'aesthetic'],
      programming: ['code', 'programming', 'developer', 'javascript', 'python', 'react', 'development'],
      science: ['science', 'research', 'study', 'discovery', 'experiment', 'scientific'],
      lifestyle: ['lifestyle', 'travel', 'food', 'culture', 'fashion', 'entertainment'],
      education: ['education', 'learning', 'school', 'university', 'student', 'teach'],
      productivity: ['productivity', 'efficiency', 'workflow', 'organization', 'time management'],
      news: ['news', 'breaking', 'report', 'announcement', 'update', 'current events'],
    };
    
    const foundTags: string[] = [];
    
    for (const [tag, keywords] of Object.entries(tagMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        foundTags.push(tag);
      }
    }
    
    return foundTags.slice(0, 3);
  }
}