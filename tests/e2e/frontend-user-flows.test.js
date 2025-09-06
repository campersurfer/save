const { test, expect } = require('@playwright/test');

/**
 * Frontend User Flow E2E Tests
 * Tests critical user journeys through the Save App web interface
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Frontend User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Dashboard and Navigation', () => {
    test('should load dashboard with all key components', async ({ page }) => {
      // Verify page loads correctly
      await expect(page).toHaveTitle(/Save App/);
      
      // Check navigation elements
      await expect(page.locator('[data-testid="logo"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-transactions"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-budget"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-goals"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-analytics"]')).toBeVisible();
      
      // Check dashboard content
      await expect(page.locator('[data-testid="total-balance"]')).toBeVisible();
      await expect(page.locator('[data-testid="monthly-income"]')).toBeVisible();
      await expect(page.locator('[data-testid="monthly-expenses"]')).toBeVisible();
      await expect(page.locator('[data-testid="savings-goal"]')).toBeVisible();
      
      // Verify recent transactions section
      await expect(page.locator('[data-testid="recent-transactions"]')).toBeVisible();
    });

    test('should navigate between different pages', async ({ page }) => {
      // Test navigation to transactions page
      await page.click('[data-testid="nav-transactions"]');
      await expect(page).toHaveURL(/.*\/transactions/);
      await expect(page.locator('h1')).toContainText('Transactions');
      
      // Test navigation to budget page
      await page.click('[data-testid="nav-budget"]');
      await expect(page).toHaveURL(/.*\/budget/);
      await expect(page.locator('h1')).toContainText('Budget');
      
      // Test navigation back to dashboard
      await page.click('[data-testid="nav-dashboard"]');
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.locator('h1')).toContainText('Dashboard');
    });

    test('should maintain responsive design on mobile', async ({ page, browserName }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Check if navigation adapts for mobile
      const navigation = page.locator('[data-testid="navigation"]');
      await expect(navigation).toBeVisible();
      
      // Verify layout doesn't break
      await expect(page.locator('[data-testid="total-balance"]')).toBeVisible();
      
      // Test mobile menu if it exists
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      }
    });
  });

  test.describe('Content Saving Workflow', () => {
    test('should save content via URL input', async ({ page }) => {
      // Navigate to content saving interface
      await page.click('[data-testid="add-button"]');
      
      // Wait for save modal or page to appear
      await page.waitForSelector('[data-testid="save-modal"]', { timeout: 5000 });
      
      // Enter a test URL
      const testUrl = 'https://www.example.com/article';
      await page.fill('[data-testid="url-input"]', testUrl);
      
      // Select save options
      await page.click('[data-testid="save-to-feed"]');
      
      // Submit the save request
      await page.click('[data-testid="save-button"]');
      
      // Wait for success indication
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 10000 });
      
      // Verify the item appears in the feed
      await page.click('[data-testid="nav-dashboard"]');
      await expect(page.locator('[data-testid="saved-item"]').first()).toBeVisible();
    });

    test('should handle save errors gracefully', async ({ page }) => {
      await page.click('[data-testid="add-button"]');
      await page.waitForSelector('[data-testid="save-modal"]');
      
      // Enter an invalid URL
      await page.fill('[data-testid="url-input"]', 'not-a-valid-url');
      await page.click('[data-testid="save-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid URL');
    });

    test('should show progress during content extraction', async ({ page }) => {
      await page.click('[data-testid="add-button"]');
      await page.waitForSelector('[data-testid="save-modal"]');
      
      const testUrl = 'https://www.example.com/long-article';
      await page.fill('[data-testid="url-input"]', testUrl);
      await page.click('[data-testid="save-button"]');
      
      // Should show progress indicator
      await expect(page.locator('[data-testid="extraction-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="progress-text"]')).toContainText('Extracting...');
    });
  });

  test.describe('Content Management', () => {
    test('should display saved content correctly', async ({ page }) => {
      // Assuming we have some test data
      await page.goto(`${BASE_URL}/dashboard`);
      
      const savedItems = page.locator('[data-testid="saved-item"]');
      
      if (await savedItems.count() > 0) {
        const firstItem = savedItems.first();
        
        // Check item has required elements
        await expect(firstItem.locator('[data-testid="item-title"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="item-preview"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="item-date"]')).toBeVisible();
        
        // Test item interaction
        await firstItem.click();
        await expect(page.locator('[data-testid="content-viewer"]')).toBeVisible();
      }
    });

    test('should support content search and filtering', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Test search functionality
      const searchInput = page.locator('[data-testid="search-input"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search query');
        await page.keyboard.press('Enter');
        
        // Should show search results or empty state
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      }
      
      // Test category filtering
      const categoryFilter = page.locator('[data-testid="category-filter"]');
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click();
        await page.click('[data-testid="category-work"]');
        
        // Should filter results
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Audio Player Integration', () => {
    test('should control audio playback for continuous TTS', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Look for audio player controls
      const audioPlayer = page.locator('[data-testid="audio-player"]');
      if (await audioPlayer.isVisible()) {
        // Test play button
        await page.click('[data-testid="play-button"]');
        await expect(page.locator('[data-testid="pause-button"]')).toBeVisible();
        
        // Test volume control
        const volumeSlider = page.locator('[data-testid="volume-slider"]');
        if (await volumeSlider.isVisible()) {
          await volumeSlider.click();
        }
        
        // Test skip controls
        const nextButton = page.locator('[data-testid="next-button"]');
        if (await nextButton.isVisible()) {
          await nextButton.click();
        }
      }
    });

    test('should show current playing item', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      const audioPlayer = page.locator('[data-testid="audio-player"]');
      if (await audioPlayer.isVisible()) {
        await page.click('[data-testid="play-button"]');
        
        // Should show currently playing item
        await expect(page.locator('[data-testid="now-playing-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="now-playing-progress"]')).toBeVisible();
      }
    });
  });

  test.describe('Visual Mind Mode', () => {
    test('should switch to visual mind mode', async ({ page }) => {
      // Switch to mind mode
      const mindButton = page.locator('[data-testid="mind-mode-button"]');
      if (await mindButton.isVisible()) {
        await mindButton.click();
        
        // Should show masonry grid layout
        await expect(page.locator('[data-testid="masonry-grid"]')).toBeVisible();
        await expect(page.locator('[data-testid="visual-card"]').first()).toBeVisible();
      }
    });

    test('should display items with extracted colors', async ({ page }) => {
      const mindButton = page.locator('[data-testid="mind-mode-button"]');
      if (await mindButton.isVisible()) {
        await mindButton.click();
        
        const visualCards = page.locator('[data-testid="visual-card"]');
        if (await visualCards.count() > 0) {
          const firstCard = visualCards.first();
          
          // Should have color-based styling
          const backgroundColor = await firstCard.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
          );
          expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should meet performance benchmarks', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Check for performance markers
      const performanceEntries = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart
        };
      });
      
      expect(performanceEntries.domContentLoaded).toBeLessThan(2000);
      expect(performanceEntries.loadComplete).toBeLessThan(4000);
    });

    test('should be accessible to screen readers', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Check for proper ARIA labels and roles
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
      
      // Check navigation has proper accessibility attributes
      const navigation = page.locator('nav');
      await expect(navigation).toHaveAttribute('role', 'navigation');
      
      // Check buttons have accessible names
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const hasLabel = await button.evaluate(el => {
          return el.hasAttribute('aria-label') || 
                 el.hasAttribute('aria-labelledby') || 
                 el.textContent.trim().length > 0;
        });
        expect(hasLabel).toBeTruthy();
      }
    });

    test('should work with keyboard navigation', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Navigate through several focusable elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const currentFocus = page.locator(':focus');
        await expect(currentFocus).toBeVisible();
      }
      
      // Test Enter key activation
      const button = page.locator('button').first();
      await button.focus();
      // Note: Would test Enter key press but avoid side effects
    });
  });

  test.describe('Error States and Edge Cases', () => {
    test('should handle network failures gracefully', async ({ page, context }) => {
      // Simulate network failure
      await context.setOffline(true);
      
      await page.goto(BASE_URL);
      
      // Should show offline message or cached content
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      const cachedContent = page.locator('[data-testid="cached-content"]');
      
      const hasOfflineHandling = await offlineIndicator.isVisible() || await cachedContent.isVisible();
      expect(hasOfflineHandling).toBeTruthy();
      
      // Restore network
      await context.setOffline(false);
    });

    test('should handle empty states', async ({ page }) => {
      // Navigate to a potentially empty section
      await page.goto(`${BASE_URL}/dashboard`);
      
      // If no content exists, should show empty state
      const hasContent = await page.locator('[data-testid="saved-item"]').count() > 0;
      
      if (!hasContent) {
        await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
        await expect(page.locator('[data-testid="empty-state-message"]')).toContainText(/add some content/i);
      }
    });
  });
});