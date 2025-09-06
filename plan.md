# plan.md - Save App Implementation
*Detailed micro-steps for building Pocket + MyMind replacement*

## Phase 0: Setup & Validation (2 Days)

### Day 0.1: Environment Setup
- [ ] Create project directory structure:
  ```bash
  mkdir -p save/{backend,frontend,mobile,extensions,scripts,docs}
  mkdir -p save/backend/{services,workers,config,middleware}
  mkdir -p save/frontend/{components,pages,hooks,utils}
  ```
- [ ] Initialize Git repository
- [ ] Create `.env` file with placeholders
- [ ] Set up Docker Compose for local development
- [ ] Install core dependencies:
  ```bash
  npm init -y
  npm install express playwright bullmq redis ioredis
  npm install -D typescript @types/node nodemon
  ```

### Day 0.2: Quick Validation Tests
- [ ] Test Archive.is programmatically:
  ```javascript
  // test-archive.js
  const testArchive = async () => {
    const url = 'https://www.wsj.com/sample-article';
    const response = await fetch(`https://archive.is/latest/${url}`);
    console.log('Archive.is works:', response.ok);
  };
  ```
- [ ] Test Playwright with anti-detection:
  ```javascript
  // test-playwright.js
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    args: ['--disable-blink-features=AutomationControlled']
  });
  ```
- [ ] Test Twitter save sheet capture (iOS Simulator)
- [ ] Verify cookie manipulation works
- [ ] **Success Criteria**: Extract 1 paywalled article + 1 tweet

---

## Week 1: Core Extraction Infrastructure

### Day 1: Archive.is Paywall Bypass

#### Morning: Basic Implementation
- [ ] Create `services/archive-bypass.js`:
  ```javascript
  class ArchiveBypass {
    async checkExisting(url) {
      const checkUrl = `https://archive.is/latest/${encodeURIComponent(url)}`;
      const response = await fetch(checkUrl, { redirect: 'follow' });
      return response.ok ? response.url : null;
    }
    
    async submitForArchiving(url) {
      const formData = new FormData();
      formData.append('url', url);
      formData.append('anyway', '1');
      
      const response = await fetch('https://archive.is/submit/', {
        method: 'POST',
        body: formData
      });
      
      return this.extractArchiveUrl(response);
    }
  }
  ```
- [ ] Implement content extraction from archived page
- [ ] Add error handling for rate limits
- [ ] Create retry logic with exponential backoff

#### Afternoon: Testing & Optimization
- [ ] Test with 10 different paywalled sites
- [ ] Document success rates per site
- [ ] Create site-specific extraction rules
- [ ] Add caching layer for archived URLs
- [ ] Performance benchmark (target: <3 seconds)

### Day 2: Cookie Manipulation System

#### Morning: Cookie Bypass Implementation
- [ ] Create `services/cookie-bypass.js`:
  ```javascript
  class CookieBypass {
    constructor() {
      this.cookieStrategies = {
        'nytimes.com': this.nytStrategy,
        'wsj.com': this.wsjStrategy,
        'default': this.defaultStrategy
      };
    }
    
    async nytStrategy(page) {
      // Clear NYT-specific cookies
      await page.context().clearCookies({ domain: '.nytimes.com' });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
  }
  ```
- [ ] Implement domain-specific cookie strategies
- [ ] Add localStorage/sessionStorage clearing
- [ ] Create paywall element removal logic

#### Afternoon: Advanced Techniques
- [ ] Implement JavaScript blocker for paywall scripts:
  ```javascript
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('paywall') || url.includes('meter')) {
      route.abort();
    } else {
      route.continue();
    }
  });
  ```
- [ ] Add user agent rotation
- [ ] Implement referrer spoofing (Google/Facebook)
- [ ] Create fallback chain for failed attempts

### Day 3: Twitter/X Extraction

#### Morning: Browser Pool Setup
- [ ] Create `services/browser-pool.js`:
  ```javascript
  class BrowserPool {
    constructor(size = 5) {
      this.contexts = [];
      this.available = [];
      this.busy = new Set();
    }
    
    async initialize() {
      for (let i = 0; i < this.size; i++) {
        const context = await this.createContext();
        await this.loadTwitterCookies(context, i);
        this.contexts.push(context);
        this.available.push(context);
      }
    }
    
    async loadTwitterCookies(context, index) {
      // Load from cookie file or database
      const cookies = await this.getCookiesForAccount(index);
      await context.addCookies(cookies);
    }
  }
  ```
- [ ] Set up 5 Twitter test accounts
- [ ] Export cookies from authenticated sessions
- [ ] Implement cookie rotation logic
- [ ] Add health checking for sessions

#### Afternoon: Tweet Extraction Logic
- [ ] Create `services/twitter-extractor.js`:
  ```javascript
  class TwitterExtractor {
    async extractTweet(url) {
      const context = await browserPool.getAvailable();
      const page = await context.newPage();
      
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        await this.waitForTweet(page);
        
        const tweetData = await page.evaluate(() => {
          // Extract all tweet elements
          const text = document.querySelector('[data-testid="tweetText"]')?.innerText;
          const author = document.querySelector('[data-testid="User-Name"]')?.innerText;
          const images = Array.from(document.querySelectorAll('[data-testid="tweetPhoto"] img'))
            .map(img => img.src);
          
          return { text, author, images };
        });
        
        return tweetData;
      } finally {
        await page.close();
        browserPool.release(context);
      }
    }
  }
  ```
- [ ] Implement thread detection and extraction
- [ ] Add quote tweet handling
- [ ] Download and store media locally
- [ ] Add human-like delays between actions

### Day 4: Instagram & TikTok Extraction

#### Morning: Instagram Setup
- [ ] Install Python dependencies:
  ```bash
  pip install instaloader
  ```
- [ ] Create Node.js wrapper for Python script:
  ```javascript
  const { spawn } = require('child_process');
  
  class InstagramExtractor {
    async extract(url) {
      return new Promise((resolve, reject) => {
        const python = spawn('python', ['instagram_extract.py', url]);
        let data = '';
        
        python.stdout.on('data', chunk => data += chunk);
        python.on('close', code => {
          if (code === 0) resolve(JSON.parse(data));
          else reject(new Error('Extraction failed'));
        });
      });
    }
  }
  ```
- [ ] Set up Instagram test accounts
- [ ] Implement carousel handling
- [ ] Add story extraction support

#### Afternoon: TikTok Implementation
- [ ] Install yt-dlp:
  ```bash
  npm install yt-dlp-exec
  ```
- [ ] Create `services/tiktok-extractor.js`:
  ```javascript
  const ytdlp = require('yt-dlp-exec');
  
  class TikTokExtractor {
    async extract(url) {
      const output = await ytdlp(url, {
        dumpSingleJson: true,
        noWarnings: true,
        addHeader: [
          'referer:https://www.tiktok.com/',
          'user-agent:Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)'
        ]
      });
      
      // Download video without watermark
      const videoUrl = output.url;
      const videoBuffer = await this.downloadVideo(videoUrl);
      
      return {
        ...output,
        localVideoPath: await this.saveVideo(videoBuffer)
      };
    }
  }
  ```
- [ ] Implement watermark removal
- [ ] Add thumbnail extraction
- [ ] Store videos locally
- [ ] Create fallback to Playwright scraping

### Day 5: Fallback Systems

#### Morning: Alternative Extraction Methods
- [ ] Implement Nitter fallback for Twitter:
  ```javascript
  const nitterInstances = [
    'nitter.poast.org',
    'nitter.privacydev.net',
    'bird.trom.tf'
  ];
  
  async function tryNitter(tweetUrl) {
    for (const instance of nitterInstances) {
      try {
        const nitterUrl = tweetUrl.replace('twitter.com', instance);
        const response = await fetch(nitterUrl);
        if (response.ok) return parseNitterHTML(await response.text());
      } catch (e) {
        continue;
      }
    }
    return null;
  }
  ```
- [ ] Add Google Cache fallback
- [ ] Implement Bing Cache fallback
- [ ] Create web.archive.org fallback

#### Afternoon: OCR Fallback
- [ ] Install Tesseract:
  ```bash
  npm install tesseract.js
  ```
- [ ] Implement screenshot → OCR pipeline:
  ```javascript
  const Tesseract = require('tesseract.js');
  
  async function ocrFallback(page) {
    const screenshot = await page.screenshot({ fullPage: true });
    
    const { data: { text } } = await Tesseract.recognize(
      screenshot,
      'eng',
      { logger: m => console.log(m) }
    );
    
    return text;
  }
  ```
- [ ] Add image preprocessing for better OCR
- [ ] Implement layout detection
- [ ] Create manual input UI for complete failures

---

## Week 2: Mobile & User Features

### Day 6: iOS Save Extension

#### Morning: Xcode Setup
- [ ] Create Save Extension target in Xcode
- [ ] Configure `Info.plist`:
  ```xml
  <key>NSExtensionActivationRule</key>
  <dict>
    <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
    <integer>1</integer>
    <key>NSExtensionActivationSupportsText</key>
    <true/>
    <key>NSExtensionActivationSupportsImageWithMaxCount</key>
    <integer>10</integer>
  </dict>
  ```
- [ ] Set up App Groups for data sharing
- [ ] Configure entitlements

#### Afternoon: Swift Implementation
- [ ] Create `SaveViewController.swift`:
  ```swift
  override func didSelectPost() {
      guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return }
      
      for item in items {
          if let attachments = item.attachments {
              for attachment in attachments {
                  if attachment.hasItemConformingToTypeIdentifier("public.url") {
                      attachment.loadItem(forTypeIdentifier: "public.url") { (url, error) in
                          if let shareURL = url as? URL {
                              self.saveToApp(url: shareURL, text: self.contentText)
                          }
                      }
                  }
              }
          }
      }
      
      extensionContext?.completeRequest(returningItems: nil)
  }
  ```
- [ ] Implement App Group storage
- [ ] Add background task trigger
- [ ] Test with Twitter, Instagram, TikTok apps

### Day 7: React Native Mobile App

#### Morning: Project Setup
- [ ] Initialize React Native project:
  ```bash
  npx react-native init SaveApp --template react-native-template-typescript
  ```
- [ ] Install core dependencies:
  ```bash
  npm install @react-navigation/native @react-navigation/bottom-tabs
  npm install react-native-vector-icons react-native-sqlite-storage
  npm install react-native-tts react-native-background-task
  ```
- [ ] Configure iOS and Android projects
- [ ] Set up navigation structure

#### Afternoon: Core Screens
- [ ] Create Feed screen (Pocket-like):
  ```javascript
  const FeedScreen = () => {
    const [articles, setArticles] = useState([]);
    const [playing, setPlaying] = useState(false);
    
    return (
      <View>
        <TTSControls onPlay={startContinuousTTS} />
        <FlatList
          data={articles}
          renderItem={({ item }) => (
            <ArticleCard article={item} />
          )}
        />
      </View>
    );
  };
  ```
- [ ] Create Mind screen (MyMind-like):
  ```javascript
  const MindScreen = () => {
    return (
      <MasonryList
        data={items}
        renderItem={({ item }) => (
          <VisualCard item={item} color={item.dominantColor} />
        )}
        columns={2}
      />
    );
  };
  ```
- [ ] Implement bottom tab navigation
- [ ] Add pull-to-refresh

### Day 8: Continuous TTS Implementation

#### Morning: TTS Service
- [ ] Create `services/continuous-tts.js`:
  ```javascript
  import Tts from 'react-native-tts';
  
  class ContinuousTTS {
    constructor() {
      this.queue = [];
      this.currentIndex = 0;
      this.isPlaying = false;
      
      Tts.addEventListener('tts-finish', () => this.onFinish());
      Tts.addEventListener('tts-cancel', () => this.onCancel());
    }
    
    async playQueue(articles) {
      this.queue = articles;
      this.currentIndex = 0;
      this.isPlaying = true;
      
      await this.playNext();
    }
    
    async playNext() {
      if (!this.isPlaying || this.currentIndex >= this.queue.length) {
        this.stop();
        return;
      }
      
      const article = this.queue[this.currentIndex];
      const cleanText = this.cleanForTTS(article.content);
      
      // Add slight pause between articles
      setTimeout(() => {
        Tts.speak(cleanText, {
          iosVoiceId: 'com.apple.ttsbundle.Samantha-compact',
          rate: 0.5,
          pitch: 1.0
        });
      }, 100);
    }
    
    onFinish() {
      this.currentIndex++;
      if (this.isPlaying) {
        this.playNext();
      }
    }
  }
  ```
- [ ] Implement text cleaning for TTS
- [ ] Add voice selection
- [ ] Create speed controls

#### Afternoon: Advanced TTS Features
- [ ] Implement sleep timer:
  ```javascript
  setSleepTimer(minutes) {
    this.sleepTimerId = setTimeout(() => {
      this.fadeOutAndStop();
    }, minutes * 60 * 1000);
  }
  
  fadeOutAndStop() {
    let volume = 1.0;
    const fadeInterval = setInterval(() => {
      volume -= 0.1;
      Tts.setDefaultVolume(Math.max(0, volume));
      
      if (volume <= 0) {
        clearInterval(fadeInterval);
        this.stop();
      }
    }, 200);
  }
  ```
- [ ] Add background playback support
- [ ] Implement audio focus handling
- [ ] Create playback notifications
- [ ] Add skip forward/backward

### Day 9: Visual Features

#### Morning: Color Extraction
- [ ] Install color extraction library:
  ```bash
  npm install colorthief react-native-palette
  ```
- [ ] Create `services/visual-extractor.js`:
  ```javascript
  import { getColors } from 'react-native-palette';
  
  class VisualExtractor {
    async extractColors(imageUrl) {
      const colors = await getColors(imageUrl);
      
      return {
        dominant: colors.dominant,
        vibrant: colors.vibrant,
        muted: colors.muted,
        mood: this.detectMood(colors),
        temperature: this.detectTemperature(colors)
      };
    }
    
    detectMood(colors) {
      const rgb = this.hexToRgb(colors.dominant);
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      
      if (brightness > 200) return 'light';
      if (brightness < 50) return 'dark';
      if (rgb.r > rgb.g && rgb.r > rgb.b) return 'warm';
      if (rgb.b > rgb.r && rgb.b > rgb.g) return 'cool';
      return 'neutral';
    }
  }
  ```
- [ ] Extract colors from saved images
- [ ] Store color data with content
- [ ] Create color-based filtering

#### Afternoon: Masonry Gallery
- [ ] Install masonry layout:
  ```bash
  npm install react-native-super-grid
  ```
- [ ] Implement visual gallery:
  ```javascript
  import { FlatGrid } from 'react-native-super-grid';
  
  const VisualGallery = ({ items }) => {
    return (
      <FlatGrid
        itemDimension={150}
        data={items}
        style={styles.gridView}
        spacing={10}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.itemContainer,
              { backgroundColor: item.dominantColor }
            ]}
          >
            {item.type === 'image' && (
              <Image source={{ uri: item.url }} style={styles.image} />
            )}
            {item.type === 'tweet' && (
              <TweetCard tweet={item} compact />
            )}
            {item.type === 'article' && (
              <ArticlePreview article={item} />
            )}
          </TouchableOpacity>
        )}
      />
    );
  };
  ```
- [ ] Add dynamic item heights
- [ ] Implement mood-based sorting
- [ ] Create visual search

### Day 10: Database & Sync

#### Morning: SQLite Setup
- [ ] Create database schema:
  ```sql
  CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE,
    type TEXT,
    title TEXT,
    author TEXT,
    content TEXT,
    extracted_at INTEGER,
    read_at INTEGER,
    archived INTEGER DEFAULT 0,
    dominant_color TEXT,
    mood TEXT,
    duration_seconds INTEGER
  );
  
  CREATE VIRTUAL TABLE content_fts USING fts5(
    title, author, content, 
    content=content, 
    content_rowid=rowid
  );
  ```
- [ ] Implement database service:
  ```javascript
  import SQLite from 'react-native-sqlite-storage';
  
  class Database {
    async initialize() {
      this.db = await SQLite.openDatabase({
        name: 'save.db',
        location: 'default'
      });
      
      await this.createTables();
      await this.createIndexes();
    }
    
    async search(query) {
      const results = await this.db.executeSql(
        `SELECT * FROM content_fts WHERE content_fts MATCH ? 
         ORDER BY rank LIMIT 50`,
        [query]
      );
      
      return results[0].rows.raw();
    }
  }
  ```
- [ ] Add CRUD operations
- [ ] Implement full-text search
- [ ] Create backup/restore

#### Afternoon: Optional Sync
- [ ] Implement E2E encryption:
  ```javascript
  import { NaCl } from 'react-native-nacl';
  
  class SyncService {
    async encryptContent(content, key) {
      const nonce = await NaCl.randomBytes(24);
      const encrypted = await NaCl.secretbox(
        content,
        nonce,
        key
      );
      
      return { encrypted, nonce };
    }
    
    async sync() {
      const changes = await this.getLocalChanges();
      
      for (const change of changes) {
        const encrypted = await this.encryptContent(
          JSON.stringify(change),
          this.userKey
        );
        
        await this.uploadToServer(encrypted);
      }
    }
  }
  ```
- [ ] Add conflict resolution
- [ ] Implement incremental sync
- [ ] Create sync status UI

---

## Week 3: Backend & Infrastructure

### Day 11: Express Backend

#### Morning: API Setup
- [ ] Create `server/index.js`:
  ```javascript
  const express = require('express');
  const bullmq = require('bullmq');
  const app = express();
  
  // Extraction endpoint
  app.post('/api/extract', async (req, res) => {
    const { url, type, priority } = req.body;
    
    // Add to extraction queue
    const job = await extractionQueue.add('extract', {
      url,
      type,
      userId: req.user.id
    }, {
      priority: priority || 0
    });
    
    res.json({ jobId: job.id, status: 'queued' });
  });
  
  // WebSocket for real-time updates
  io.on('connection', (socket) => {
    socket.on('subscribe', (jobId) => {
      socket.join(`job:${jobId}`);
    });
  });
  ```
- [ ] Set up authentication middleware
- [ ] Add rate limiting
- [ ] Implement API versioning
- [ ] Create health check endpoints

#### Afternoon: Queue System
- [ ] Configure BullMQ:
  ```javascript
  const { Queue, Worker } = require('bullmq');
  
  const extractionQueue = new Queue('extraction', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  });
  
  const worker = new Worker('extraction', async job => {
    const { url, type } = job.data;
    
    // Route to appropriate extractor
    switch (type) {
      case 'article':
        return await extractArticle(url);
      case 'tweet':
        return await extractTweet(url);
      case 'instagram':
        return await extractInstagram(url);
      default:
        return await genericExtract(url);
    }
  }, {
    connection: redis,
    concurrency: 5
  });
  ```
- [ ] Add job progress reporting
- [ ] Implement priority queues
- [ ] Create dead letter queue
- [ ] Add job scheduling

### Day 12: Multi-tier Caching

#### Morning: Cache Implementation
- [ ] Create `services/cache.js`:
  ```javascript
  class MultiTierCache {
    constructor() {
      this.redis = new Redis();
      this.postgres = null; // Initialize with connection
      this.s3 = new S3Client();
    }
    
    async get(url) {
      // L1: Redis (hot cache)
      const cached = await this.redis.get(`cache:${url}`);
      if (cached) {
        await this.redis.expire(`cache:${url}`, 86400); // Refresh TTL
        return JSON.parse(cached);
      }
      
      // L2: PostgreSQL
      const result = await this.postgres.query(
        'SELECT * FROM cached_content WHERE url = $1',
        [url]
      );
      
      if (result.rows.length > 0) {
        // Warm Redis
        await this.redis.setex(
          `cache:${url}`,
          86400,
          JSON.stringify(result.rows[0])
        );
        
        // L3: S3 for full content
        if (result.rows[0].s3_key) {
          const content = await this.s3.getObject({
            Bucket: 'save-content',
            Key: result.rows[0].s3_key
          });
          
          result.rows[0].fullContent = content.Body.toString();
        }
        
        return result.rows[0];
      }
      
      return null;
    }
  }
  ```
- [ ] Implement content deduplication
- [ ] Add cache warming strategy
- [ ] Create cache invalidation
- [ ] Monitor cache hit rates

#### Afternoon: Storage Optimization
- [ ] Implement content compression:
  ```javascript
  const zlib = require('zlib');
  
  async function compressContent(content) {
    return new Promise((resolve, reject) => {
      zlib.gzip(content, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }
  ```
- [ ] Add image optimization
- [ ] Implement CDN integration
- [ ] Create storage tiering rules
- [ ] Add automatic cleanup

### Day 13: Proxy Management

#### Morning: Proxy Infrastructure
- [ ] Create `services/proxy-manager.js`:
  ```javascript
  class ProxyManager {
    constructor() {
      this.proxies = {
        residential: [],
        datacenter: [],
        mobile: []
      };
      
      this.stats = new Map();
    }
    
    async loadProxies() {
      // Load from providers
      this.proxies.residential = await this.loadBrightData();
      this.proxies.datacenter = await this.loadDatacenter();
    }
    
    async getProxy(domain, type = 'residential') {
      const pool = this.proxies[type];
      
      // Get least used proxy
      let bestProxy = null;
      let minUsage = Infinity;
      
      for (const proxy of pool) {
        const stats = this.stats.get(proxy.id) || { usage: 0, failures: 0 };
        
        if (stats.failures > 3) continue; // Skip failed proxies
        
        if (stats.usage < minUsage) {
          minUsage = stats.usage;
          bestProxy = proxy;
        }
      }
      
      // Update usage stats
      const stats = this.stats.get(bestProxy.id) || { usage: 0, failures: 0 };
      stats.usage++;
      this.stats.set(bestProxy.id, stats);
      
      return bestProxy;
    }
  }
  ```
- [ ] Implement health checking
- [ ] Add automatic rotation
- [ ] Create cost tracking
- [ ] Monitor proxy performance

#### Afternoon: Rate Limiting
- [ ] Implement domain-specific limits:
  ```javascript
  class RateLimiter {
    constructor() {
      this.limits = {
        'twitter.com': { requests: 30, window: 60000 },
        'instagram.com': { requests: 20, window: 60000 },
        'default': { requests: 60, window: 60000 }
      };
      
      this.buckets = new Map();
    }
    
    async canRequest(domain) {
      const limit = this.limits[domain] || this.limits.default;
      const bucket = this.buckets.get(domain) || {
        tokens: limit.requests,
        lastRefill: Date.now()
      };
      
      // Refill bucket
      const now = Date.now();
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = (timePassed / limit.window) * limit.requests;
      
      bucket.tokens = Math.min(
        limit.requests,
        bucket.tokens + tokensToAdd
      );
      bucket.lastRefill = now;
      
      if (bucket.tokens >= 1) {
        bucket.tokens--;
        this.buckets.set(domain, bucket);
        return true;
      }
      
      return false;
    }
  }
  ```
- [ ] Add request queuing
- [ ] Implement backpressure
- [ ] Create monitoring alerts
- [ ] Add manual override

### Day 14: Legal Compliance

#### Morning: DMCA System
- [ ] Create takedown system:
  ```javascript
  class DMCACompliance {
    async processTakedown(request) {
      const { contentId, claimant, reason } = request;
      
      // Validate request
      if (!this.isValidDMCA(request)) {
        return { status: 'invalid', reason: 'Missing required fields' };
      }
      
      // Remove content
      await this.removeContent(contentId);
      
      // Log for compliance
      await this.logTakedown({
        contentId,
        claimant,
        reason,
        timestamp: Date.now(),
        action: 'removed'
      });
      
      // Notify user
      await this.notifyUser(contentId);
      
      // Send confirmation
      await this.sendConfirmation(claimant);
      
      return { status: 'processed', removedAt: Date.now() };
    }
    
    async removeContent(contentId) {
      // Remove from all storage tiers
      await this.redis.del(`content:${contentId}`);
      await this.postgres.query(
        'UPDATE content SET removed = true WHERE id = $1',
        [contentId]
      );
      await this.s3.deleteObject({
        Bucket: 'save-content',
        Key: `content/${contentId}`
      });
    }
  }
  ```
- [ ] Create counter-notice system
- [ ] Add audit logging
- [ ] Implement 24-hour response
- [ ] Create legal contact page

#### Afternoon: Privacy & Terms
- [ ] Implement data export:
  ```javascript
  async function exportUserData(userId) {
    const data = {
      profile: await getProfile(userId),
      content: await getAllContent(userId),
      settings: await getSettings(userId),
      exportedAt: new Date().toISOString()
    };
    
    // Create zip file
    const zip = new JSZip();
    zip.file('profile.json', JSON.stringify(data.profile));
    zip.file('content.json', JSON.stringify(data.content));
    zip.file('settings.json', JSON.stringify(data.settings));
    
    return zip.generateAsync({ type: 'nodebuffer' });
  }
  ```
- [ ] Add account deletion
- [ ] Create privacy controls
- [ ] Implement consent management
- [ ] Add telemetry opt-out

### Day 15: Monitoring & Analytics

#### Morning: Metrics Collection
- [ ] Set up Prometheus:
  ```javascript
  const prometheus = require('prom-client');
  
  // Extraction metrics
  const extractionSuccess = new prometheus.Counter({
    name: 'extraction_success_total',
    help: 'Total successful extractions',
    labelNames: ['type', 'method']
  });
  
  const extractionDuration = new prometheus.Histogram({
    name: 'extraction_duration_seconds',
    help: 'Extraction duration',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });
  
  const paywallBypassRate = new prometheus.Gauge({
    name: 'paywall_bypass_rate',
    help: 'Paywall bypass success rate',
    labelNames: ['site', 'method']
  });
  ```
- [ ] Add custom metrics
- [ ] Create dashboards
- [ ] Set up alerts
- [ ] Monitor resource usage

#### Afternoon: Error Tracking
- [ ] Implement error reporting:
  ```javascript
  class ErrorTracker {
    logError(error, context) {
      const errorData = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now(),
        environment: process.env.NODE_ENV
      };
      
      // Log to file
      fs.appendFileSync('errors.log', JSON.stringify(errorData) + '\n');
      
      // Send to monitoring service
      if (this.shouldAlert(error)) {
        this.sendAlert(errorData);
      }
      
      // Track patterns
      this.trackPattern(error);
    }
    
    trackPattern(error) {
      const pattern = this.extractPattern(error);
      const count = this.patterns.get(pattern) || 0;
      this.patterns.set(pattern, count + 1);
      
      if (count > 10) {
        this.escalate(pattern);
      }
    }
  }
  ```
- [ ] Add user feedback system
- [ ] Create error recovery
- [ ] Implement retry strategies
- [ ] Monitor success rates

---

## Week 4: Production Deployment

### Day 16-17: Docker & Kubernetes + Web App

#### Docker Setup with Web Frontend
- [ ] Create multi-stage Dockerfile for web app:
  ```dockerfile
  # Frontend build stage
  FROM node:18-alpine AS frontend-builder
  WORKDIR /app/frontend
  COPY frontend/package*.json ./
  RUN npm ci
  COPY frontend/ ./
  RUN npm run build
  
  # Backend build stage
  FROM node:18-alpine AS backend-builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --only=production
  
  # Runtime stage
  FROM node:18-alpine
  RUN apk add --no-cache chromium
  WORKDIR /app
  
  # Copy backend
  COPY --from=backend-builder /app/node_modules ./node_modules
  COPY . .
  
  # Copy frontend build
  COPY --from=frontend-builder /app/frontend/build ./public
  
  ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
  
  EXPOSE 3000
  CMD ["node", "server.js"]
  ```
- [ ] Create Next.js web app with Bauhaus design:
  ```javascript
  // frontend/pages/index.tsx
  import { useState } from 'react';
  import styles from '../styles/Home.module.css';
  
  export default function Home() {
    const [mode, setMode] = useState<'feed' | 'mind'>('feed');
    
    return (
      <div className={styles.container}>
        {/* Fixed Header */}
        <header className={styles.header}>
          <div className={styles.logo}>
            <svg className={styles.logoSvg}>
              {/* Bauhaus logo */}
            </svg>
            <span className={styles.wordmark}>Save</span>
          </div>
          
          <nav className={styles.nav}>
            <button 
              className={`${styles.navButton} ${mode === 'feed' && styles.active}`}
              onClick={() => setMode('feed')}
            >
              <span className={styles.squareIcon} />
              Feed
            </button>
            
            <button 
              className={`${styles.navButton} ${mode === 'mind' && styles.active}`}
              onClick={() => setMode('mind')}
            >
              <span className={styles.triangleIcon} />
              Mind
            </button>
          </nav>
          
          <div className={styles.actions}>
            <input 
              className={styles.search}
              placeholder="Search..."
              style={{
                borderRadius: 0, // Bauhaus sharp edges
                borderBottom: '2px solid #0066FF'
              }}
            />
            <button className={styles.addButton}>
              <span className={styles.plusIcon}>+</span>
            </button>
            <div className={styles.userAvatar} />
          </div>
        </header>
        
        {/* Main Content */}
        <main className={styles.main}>
          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <h3>Queue</h3>
              <div className={styles.queueCount}>12 articles</div>
            </div>
            
            <div className={styles.sidebarSection}>
              <h3>Categories</h3>
              <div className={styles.categoryList}>
                <button className={styles.categoryChip}>
                  <span className={styles.colorDot} style={{ background: '#FFD700' }} />
                  Work
                </button>
                <button className={styles.categoryChip}>
                  <span className={styles.colorDot} style={{ background: '#0066FF' }} />
                  Personal
                </button>
              </div>
            </div>
          </aside>
          
          {/* Content Area */}
          <section className={styles.content}>
            {mode === 'feed' ? (
              <FeedView />
            ) : (
              <MindView />
            )}
          </section>
        </main>
        
        {/* Persistent Audio Player */}
        <div className={styles.audioPlayer}>
          <AudioPlayerWeb />
        </div>
      </div>
    );
  }
  ```
- [ ] Implement responsive CSS with Bauhaus grid:
  ```css
  /* styles/Home.module.css */
  .container {
    --grid-unit: 8px;
    --primary-blue: #0066FF;
    --primary-yellow: #FFD700;
    --primary-red: #FF3333;
    
    display: grid;
    grid-template-rows: calc(var(--grid-unit) * 8) 1fr calc(var(--grid-unit) * 10);
    height: 100vh;
    background: var(--bg-primary);
  }
  
  .main {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: calc(var(--grid-unit) * 3);
    padding: calc(var(--grid-unit) * 3);
  }
  
  /* Bauhaus-inspired cards */
  .articleCard {
    background: var(--bg-secondary);
    border-left: 4px solid var(--primary-blue);
    padding: calc(var(--grid-unit) * 2);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .articleCard:hover {
    transform: translateX(calc(var(--grid-unit)));
    box-shadow: 
      -8px 0 0 var(--primary-yellow),
      -16px 0 0 var(--primary-blue);
  }
  
  /* Masonry grid for Mind mode */
  .masonryGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    grid-auto-rows: calc(var(--grid-unit) * 2);
    gap: calc(var(--grid-unit) * 2);
  }
  
  .visualCard {
    grid-row: span var(--card-span);
    background: var(--card-color);
    position: relative;
    overflow: hidden;
  }
  
  /* Geometric animations */
  @keyframes geometricPulse {
    0% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
    25% { clip-path: polygon(25% 0, 100% 25%, 75% 100%, 0 75%); }
    50% { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
    75% { clip-path: polygon(25% 0, 100% 25%, 75% 100%, 0 75%); }
    100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
  }
  
  .loadingCard {
    animation: geometricPulse 2s ease-in-out infinite;
  }
  ```
- [ ] Create browser extension with matching design:
  ```javascript
  // extension/popup.html
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        width: 400px;
        height: 600px;
        margin: 0;
        font-family: 'DIN Next', -apple-system, sans-serif;
        background: #0A0A0B;
        color: #FFFFFF;
      }
      
      .header {
        padding: 16px;
        border-bottom: 2px solid #0066FF;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .saveOptions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 16px;
      }
      
      .saveButton {
        padding: 12px;
        border: 2px solid transparent;
        background: #1A1A1C;
        color: #FFFFFF;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }
      
      .saveButton:hover {
        border-color: #0066FF;
        transform: translateY(-2px);
      }
      
      .saveButton.feed::before {
        content: '';
        position: absolute;
        top: 4px;
        left: 4px;
        width: 8px;
        height: 8px;
        background: #0066FF;
      }
      
      .saveButton.mind::before {
        content: '';
        position: absolute;
        top: 4px;
        left: 4px;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 8px solid #FFD700;
      }
      
      .status {
        padding: 16px;
        background: #1A1A1C;
        margin: 16px;
        border-left: 4px solid #00C896;
      }
      
      .recentSaves {
        padding: 16px;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .recentItem {
        padding: 8px;
        margin-bottom: 8px;
        background: #1A1A1C;
        border-left: 2px solid #6B6B70;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo">
        <svg width="24" height="24">
          <!-- Bauhaus logo -->
        </svg>
        <span>Save</span>
      </div>
      <button class="settings">⚙</button>
      <button class="close">✕</button>
    </div>
    
    <div class="saveOptions">
      <button class="saveButton feed">Feed</button>
      <button class="saveButton mind">Mind</button>
      <button class="saveButton both">Both</button>
    </div>
    
    <div class="status">
      ✓ Paywall bypass enabled
      <br>
      ⚡ Quick save (Cmd+Shift+S)
    </div>
    
    <div class="recentSaves">
      <h3>Recent Saves</h3>
      <div id="recentList"></div>
    </div>
    
    <script src="popup.js"></script>
  </body>
  </html>
  ```
- [ ] Configure volumes
- [ ] Optimize image sizes

#### Kubernetes Deployment
- [ ] Create deployment manifests:
  ```yaml
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: save-backend
  spec:
    replicas: 3
    selector:
      matchLabels:
        app: save-backend
    template:
      spec:
        containers:
        - name: backend
          image: save-backend:latest
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          env:
          - name: NODE_ENV
            value: "production"
          - name: REDIS_URL
            valueFrom:
              secretKeyRef:
                name: save-secrets
                key: redis-url
  ```
- [ ] Set up ingress
- [ ] Configure secrets
- [ ] Add persistent volumes
- [ ] Implement rolling updates

### Day 18-19: Auto-scaling & Load Balancing

#### KEDA Configuration
- [ ] Install KEDA:
  ```bash
  kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.10.0/keda-2.10.0.yaml
  ```
- [ ] Create ScaledObject:
  ```yaml
  apiVersion: keda.sh/v1alpha1
  kind: ScaledObject
  metadata:
    name: save-worker-scaler
  spec:
    scaleTargetRef:
      name: save-workers
    minReplicaCount: 2
    maxReplicaCount: 20
    cooldownPeriod: 30
    triggers:
    - type: redis
      metadata:
        address: redis:6379
        listName: bull:extraction:wait
        listLength: "5"
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: extraction_queue_depth
        threshold: "10"
        query: |
          avg(extraction_queue_depth)
  ```
- [ ] Configure HPA
- [ ] Set up cluster autoscaler
- [ ] Add pod disruption budgets
- [ ] Test scaling scenarios

#### Load Balancer Setup
- [ ] Configure nginx:
  ```nginx
  upstream save_backend {
    least_conn;
    server backend-1:3000 max_fails=3 fail_timeout=30s;
    server backend-2:3000 max_fails=3 fail_timeout=30s;
    server backend-3:3000 max_fails=3 fail_timeout=30s;
  }
  
  server {
    listen 80;
    server_name save.app;
    
    location /api {
      proxy_pass http://save_backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      
      # WebSocket support
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    
    location / {
      root /usr/share/nginx/html;
      try_files $uri $uri/ /index.html;
    }
  }
  ```
- [ ] Add SSL/TLS
- [ ] Configure CDN
- [ ] Set up health checks
- [ ] Implement rate limiting

### Day 20-21: Testing & Launch

#### Testing Suite
- [ ] Create E2E tests:
  ```javascript
  describe('Extraction Pipeline', () => {
    test('Archive.is bypass works', async () => {
      const url = 'https://www.wsj.com/test-article';
      const result = await extractArticle(url);
      
      expect(result).toHaveProperty('content');
      expect(result.content.length).toBeGreaterThan(1000);
    });
    
    test('Twitter extraction with fallbacks', async () => {
      const url = 'https://twitter.com/test/status/123';
      const result = await extractTweet(url);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('author');
    });
    
    test('Continuous TTS plays queue', async () => {
      const articles = [
        { id: 1, content: 'First article' },
        { id: 2, content: 'Second article' }
      ];
      
      const tts = new ContinuousTTS();
      await tts.playQueue(articles);
      
      expect(tts.currentIndex).toBe(0);
      expect(tts.isPlaying).toBe(true);
    });
  });
  ```
- [ ] Load testing with k6
- [ ] Security scanning
- [ ] Performance profiling
- [ ] Accessibility testing

#### Launch Checklist
- [ ] Domain setup
- [ ] SSL certificates
- [ ] Backup strategy
- [ ] Monitoring alerts
- [ ] Documentation
- [ ] Support system
- [ ] Marketing materials
- [ ] TestFlight submission
- [ ] Play Store submission
- [ ] Product Hunt launch

---

## Success Metrics Dashboard

### Technical Metrics
```javascript
// Track these daily
const metrics = {
  extraction: {
    paywallBypass: {
      soft: 0.98, // Target: 98%
      hard: 0.60  // Target: 60%
    },
    socialMedia: {
      twitter: 0.85,  // Target: 85%
      instagram: 0.80, // Target: 80%
      tiktok: 0.75    // Target: 75%
    },
    speed: {
      p50: 2.1, // seconds
      p95: 4.8, // seconds
      p99: 8.2  // seconds
    }
  },
  tts: {
    gapBetweenArticles: 180, // ms
    sessionLength: 24.5,     // minutes average
    completionRate: 0.72     // % who finish articles
  },
  user: {
    dau: 1250,
    mau: 8500,
    retention: {
      d1: 0.65,
      d7: 0.42,
      d30: 0.28
    }
  }
};
```

---

## Quick Start Commands

```bash
# Clone and setup
git clone https://github.com/yourusername/save.git
cd save
npm install

# Start development
docker-compose up -d redis postgres
npm run dev

# Run extraction tests
npm test -- --grep "extraction"

# Deploy to production
kubectl apply -f k8s/
kubectl rollout status deployment/save-backend

# Monitor
kubectl port-forward svc/prometheus 9090:9090
open http://localhost:9090
```

---

## Next Steps After Launch

1. **Immediate (Week 5)**
   - Browser extension for desktop
   - Android app
   - Webhook API

2. **Month 2**
   - Team workspaces
   - AI summaries
   - Smart categorization

3. **Month 3**
   - Public API
   - Zapier integration
   - Enterprise features

This plan delivers a working MVP with industry-proven extraction techniques, ready for production deployment!