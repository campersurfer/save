const { test, expect } = require('@playwright/test');
const { chromium } = require('playwright');

/**
 * End-to-End Tests for Extraction Pipeline
 * Tests the core extraction functionality that makes Save App unique
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 60000; // 60 seconds for extraction tests

test.describe('Extraction Pipeline E2E Tests', () => {
  let browser, context, page;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.CI === 'true' ? 0 : 50
    });
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Save-App-E2E-Test/1.0'
    });
    page = await context.newPage();
    
    // Enable request interception for testing
    await page.route('**/*', route => route.continue());
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.describe('Archive.is Paywall Bypass', () => {
    test('should extract paywalled article via Archive.is', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      // Navigate to app
      await page.goto(`${BASE_URL}/`);
      await expect(page).toHaveTitle(/Save App/);
      
      // Enter a paywalled URL (use a test URL that we know works)
      const testUrl = 'https://www.wsj.com/articles/sample-article';
      await page.fill('[data-testid="url-input"]', testUrl);
      await page.click('[data-testid="extract-button"]');
      
      // Wait for extraction to start
      await expect(page.locator('[data-testid="extraction-status"]')).toContainText('Extracting...');
      
      // Wait for extraction to complete
      await page.waitForSelector('[data-testid="extraction-complete"]', { timeout: TEST_TIMEOUT });
      
      // Verify extraction results
      const extractedContent = await page.locator('[data-testid="extracted-content"]');
      await expect(extractedContent).toBeVisible();
      
      const contentText = await extractedContent.textContent();
      expect(contentText.length).toBeGreaterThan(500); // Should have substantial content
      
      // Verify metadata extraction
      await expect(page.locator('[data-testid="article-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="article-author"]')).toBeVisible();
      await expect(page.locator('[data-testid="article-date"]')).toBeVisible();
    });

    test('should handle already archived content', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: 'https://www.example.com/already-archived',
          type: 'article'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('source');
      expect(result.source).toBe('archive_cached');
    });

    test('should fallback gracefully when Archive.is fails', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      // Mock Archive.is failure
      await page.route('**/archive.is/**', route => {
        route.fulfill({ status: 503, body: 'Service Unavailable' });
      });
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: 'https://www.example.com/test-article',
          type: 'article'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result).toHaveProperty('fallbackMethod');
      expect(['direct', 'google_cache', 'bing_cache']).toContain(result.fallbackMethod);
    });
  });

  test.describe('Cookie Manipulation System', () => {
    test('should bypass cookie-based paywalls', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      const testSites = [
        { domain: 'nytimes.com', strategy: 'cookie_clear' },
        { domain: 'wsj.com', strategy: 'localStorage_clear' },
        { domain: 'medium.com', strategy: 'incognito_mode' }
      ];
      
      for (const site of testSites) {
        const response = await page.request.post(`${BASE_URL}/api/extract`, {
          data: {
            url: `https://${site.domain}/sample-article`,
            type: 'article',
            bypassMethod: 'cookie_manipulation'
          }
        });
        
        expect(response.ok()).toBeTruthy();
        const result = await response.json();
        
        expect(result).toHaveProperty('bypassStrategy');
        expect(result.bypassStrategy).toBe(site.strategy);
        expect(result.success).toBeTruthy();
      }
    });
  });

  test.describe('Social Media Extraction', () => {
    test('should extract Twitter/X posts with media', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      const twitterUrl = 'https://twitter.com/test_user/status/1234567890';
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: twitterUrl,
          type: 'tweet'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('media');
      
      if (result.media && result.media.length > 0) {
        expect(result.media[0]).toHaveProperty('type');
        expect(result.media[0]).toHaveProperty('url');
        expect(['image', 'video']).toContain(result.media[0].type);
      }
    });

    test('should extract Instagram posts', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      const instagramUrl = 'https://instagram.com/p/ABC123DEF456/';
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: instagramUrl,
          type: 'instagram'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result).toHaveProperty('caption');
      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('media');
      expect(result.media).toBeInstanceOf(Array);
    });

    test('should extract TikTok videos without watermark', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      const tiktokUrl = 'https://tiktok.com/@user/video/1234567890123456789';
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: tiktokUrl,
          type: 'tiktok'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result).toHaveProperty('videoUrl');
      expect(result).toHaveProperty('thumbnailUrl');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('author');
      expect(result.watermarkRemoved).toBeTruthy();
    });
  });

  test.describe('Fallback Systems', () => {
    test('should use Nitter fallback for Twitter', async () => {
      test.setTimeout(TEST_TIMEOUT);
      
      // Mock Twitter API failure
      await page.route('**/api.twitter.com/**', route => {
        route.fulfill({ status: 429, body: 'Rate Limited' });
      });
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: 'https://twitter.com/test/status/123',
          type: 'tweet'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result.extractionMethod).toBe('nitter_fallback');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('author');
    });

    test('should use OCR fallback for complete failures', async () => {
      test.setTimeout(TEST_TIMEOUT * 2); // OCR takes longer
      
      // Mock all other extraction methods failing
      await page.route('**/archive.is/**', route => route.fulfill({ status: 503 }));
      await page.route('**/webcache.googleusercontent.com/**', route => route.fulfill({ status: 404 }));
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: 'https://difficult-paywall-site.com/article',
          type: 'article',
          enableOcr: true
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result.extractionMethod).toBe('ocr_fallback');
      expect(result).toHaveProperty('content');
      expect(result.content.length).toBeGreaterThan(100);
    });
  });

  test.describe('Quality and Performance', () => {
    test('should complete extraction within performance targets', async () => {
      const startTime = Date.now();
      
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: 'https://www.example.com/fast-article',
          type: 'article'
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.ok()).toBeTruthy();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const result = await response.json();
      expect(result).toHaveProperty('extractionTime');
      expect(result.extractionTime).toBeLessThan(3000); // Internal time should be < 3s
    });

    test('should maintain extraction success rate', async () => {
      const testUrls = [
        'https://www.example1.com/article1',
        'https://www.example2.com/article2',
        'https://www.example3.com/article3',
        'https://www.example4.com/article4',
        'https://www.example5.com/article5'
      ];
      
      let successCount = 0;
      
      for (const url of testUrls) {
        try {
          const response = await page.request.post(`${BASE_URL}/api/extract`, {
            data: { url, type: 'article' }
          });
          
          if (response.ok()) {
            const result = await response.json();
            if (result.success) {
              successCount++;
            }
          }
        } catch (error) {
          console.warn(`Extraction failed for ${url}:`, error.message);
        }
      }
      
      const successRate = successCount / testUrls.length;
      expect(successRate).toBeGreaterThan(0.8); // 80% success rate minimum
    });

    test('should handle concurrent extractions', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        page.request.post(`${BASE_URL}/api/extract`, {
          data: {
            url: `https://www.example.com/article-${i}`,
            type: 'article'
          }
        })
      );
      
      const responses = await Promise.all(promises);
      const successfulResponses = responses.filter(r => r.ok());
      
      expect(successfulResponses.length).toBeGreaterThan(concurrentRequests * 0.8);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid URLs gracefully', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid.com',
        'https://does-not-exist-12345.com',
        ''
      ];
      
      for (const url of invalidUrls) {
        const response = await page.request.post(`${BASE_URL}/api/extract`, {
          data: { url, type: 'article' }
        });
        
        expect(response.status()).toBeLessThan(500); // Should not cause server error
        
        const result = await response.json();
        expect(result.success).toBeFalsy();
        expect(result).toHaveProperty('error');
      }
    });

    test('should provide meaningful error messages', async () => {
      const response = await page.request.post(`${BASE_URL}/api/extract`, {
        data: {
          url: 'https://site-that-blocks-bots.com/article',
          type: 'article'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.length).toBeGreaterThan(10);
        expect(result).toHaveProperty('retryable');
        expect(result).toHaveProperty('suggestedAction');
      }
    });
  });
});