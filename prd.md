# Save App - Product Requirements Document (prd.md)
*Pocket + MyMind replacement with proven extraction techniques*

## Executive Summary

**Product**: Save - A unified read-later and knowledge management app  
**Vision**: Replace both Pocket (shutting down July 2025) and MyMind with superior extraction  
**Core Innovation**: Continuous TTS playback + 98% paywall bypass + reliable social extraction  
**Target Users**: People who save articles to read/listen later AND organize knowledge visually  
**Business Model**: Self-hosted SaaS with tiered pricing ($0/$4.99/$9.99)

## Problem Statement

### Market Gap (Urgent)
- **Pocket shutting down July 2025** - 30M users need replacement
- **Omnivore acquired/shut down** - Open source alternative gone
- **MyMind is expensive** - $12/month for visual bookmarking
- **No app combines both** - Reading queue + visual knowledge management

### User Pain Points
1. **Can't save paywalled articles** - Current apps fail on WSJ, NYT, etc.
2. **Twitter/X extraction broken** - Nitter dead, API expensive
3. **No continuous TTS** - Apps stop after each article
4. **Separate apps for different needs** - Pocket for reading, MyMind for organizing
5. **Privacy concerns** - All data on corporate servers

## Core Features

### 1. Industry-Leading Content Extraction

#### Paywall Bypass (98% Success Rate)
**Archive.is Method** (Primary)
- Programmatic access: `archive.is/latest/<URL>`
- Presents as Googlebot to bypass restrictions
- Works on 98% soft paywalls, 60% hard paywalls
- Free, no API key required

**Cookie Manipulation** (Secondary)
- Clear cookies between page loads
- Resets metered paywall counters
- 95% success on NYT, WSJ, Washington Post
- Bypass Paywalls Clean extension logic

**Google Cache** (Tertiary)
- URL pattern: `webcache.googleusercontent.com/search?q=cache:<URL>&strip=1`
- Strip parameter removes JavaScript/CSS
- Alternative: Yandex/Bing caches
- Less rate-limited than Google

**JavaScript Removal** (Advanced)
- MutationObserver to detect paywall elements
- Remove overlays while preserving content
- Selective script blocking
- CSS selector targeting

#### Social Media Extraction

**Twitter/X (Post-Nitter)**
- iOS Save Extension captures URL
- Backend browser farm with Playwright
- Undetected-chromedriver with anti-detection
- Cookie pool from throwaway accounts
- Thread detection and full extraction
- Media download and local storage
- Fallback: Screenshot → OCR

**Instagram**
- Instaloader Python library
- Handles carousels, stories, reels
- Cookie pool management
- Residential proxy rotation
- Metadata extraction (likes, comments)
- Video download support

**TikTok**
- yt-dlp for video extraction
- Remove watermarks
- Extract music information
- Playwright fallback for metadata
- Thumbnail generation

### 2. Dual-Mode Architecture

#### Feed Mode (Pocket Replacement)
- **Linear queue** for consumption
- **Continuous TTS** with auto-advance
- **Sleep timer** with fade-out
- **Reading progress** sync
- **Archive after reading**
- **Offline support**

#### Mind Mode (MyMind Replacement)
- **Visual masonry gallery**
- **Color extraction** from images
- **Mood detection** (warm/cool/vibrant)
- **Project workspaces**
- **Inline social posts** display
- **Visual search** by color/mood

### 3. Continuous TTS (Killer Feature)

#### Implementation
- Auto-advance between articles
- <200ms gap target
- Pre-rendering option for gapless
- Multiple voice options
- Speed control (0.5x-2x)
- Sleep timer with fade
- Background playback on mobile

#### User Experience
- "Press play once, listen for hours"
- Perfect for bedtime routines
- Commute-friendly
- Workout companion
- Accessibility first

### 4. Privacy & Local-First

#### Data Storage
- SQLite with FTS5 for local search
- Optional E2E encrypted sync
- Self-hostable
- No telemetry
- User owns all data
- Export anytime

## Technical Architecture

### Core Stack
- **Backend**: Node.js/TypeScript
- **Mobile**: React Native
- **Web**: Next.js
- **Database**: PostgreSQL + SQLite
- **Cache**: Redis
- **Storage**: S3-compatible
- **Queue**: BullMQ
- **Search**: SQLite FTS5

### Browser Automation
- **Primary**: Playwright (best reliability)
- **Anti-detection**: Disabled automation flags
- **Browser pool**: 5-10 persistent contexts
- **Cookie management**: Rotating sessions
- **Proxy support**: Residential proxies

### Extraction Pipeline
```
URL Input → Cache Check → Extraction Queue
    ↓
Extraction Strategy Selection
    ↓
Primary Method (Archive.is / Direct)
    ↓ (fallback)
Secondary Method (Cookies / Nitter)
    ↓ (fallback)
Tertiary Method (Cache / OCR)
    ↓
Content Processing
    ↓
Storage (Multi-tier Cache)
```

### Infrastructure
- **Docker**: Multi-stage builds
- **Kubernetes**: KEDA auto-scaling
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: GitHub Actions
- **CDN**: CloudFlare

## Implementation Timeline

### Week 1: Core Extraction
- Day 1-2: Archive.is integration
- Day 3: Cookie bypass system
- Day 4: Twitter extraction
- Day 5: Instagram/TikTok

### Week 2: User Features
- Day 6-7: iOS Save Extension
- Day 8-9: Continuous TTS
- Day 10: Visual features

### Week 3: Polish
- Day 11-12: Caching system
- Day 13-14: Worker scaling
- Day 15: Legal compliance

### Week 4: Launch
- Day 16-17: Docker/K8s setup
- Day 18-19: Monitoring
- Day 20-21: TestFlight/Beta

## Success Metrics

### Technical KPIs
- **Paywall bypass**: >90% soft, >50% hard
- **Social extraction**: >85% success
- **TTS gap**: <200ms
- **Extraction speed**: <3 seconds
- **Uptime**: >99.9%

### User KPIs
- **Capture-to-read**: >60%
- **Daily active**: >40%
- **TTS sessions**: >20 min average
- **Retention**: >70% at 30 days

### Business KPIs
- **Free → Paid**: >5% conversion
- **Churn**: <10% monthly
- **CAC**: <$5
- **LTV**: >$50

## Legal & Compliance

### Strategy
- **User-directed extraction** (non-volitional)
- **Personal use positioning**
- **DMCA compliance** ready
- **24-hour takedown** response
- **Clear attribution** to sources

### Risk Mitigation
- Respect robots.txt
- Rate limiting (1-5 sec)
- User agent transparency
- Publisher opt-out
- No bulk scraping

## Monetization

### Pricing Tiers
```javascript
{
  free: {
    price: 0,
    saves: 30/month,
    tts: "basic",
    storage: "1GB"
  },
  pro: {
    price: 4.99,
    saves: "unlimited",
    tts: "premium",
    storage: "50GB"
  },
  power: {
    price: 9.99,
    saves: "unlimited",
    tts: "all voices",
    storage: "200GB",
    api: true
  }
}
```

### Revenue Projections
- Year 1: 10K users, 5% paid = $2.5K/mo
- Year 2: 100K users, 7% paid = $35K/mo
- Year 3: 500K users, 10% paid = $250K/mo

## Competitive Analysis

| Feature | Pocket | MyMind | Omnivore | **Save** |
|---------|--------|---------|----------|-----------|
| Paywall Bypass | ✓ | ✗ | ✗ | **✓✓** |
| Twitter Save | ✓ | ✓ | ✓ | **✓✓** |
| Continuous TTS | ✗ | ✗ | ✗ | **✓** |
| Visual Gallery | ✗ | ✓ | ✗ | **✓** |
| Local-First | ✗ | ✗ | ✗ | **✓** |
| Price | Free* | $12/mo | Free* | **$0-10** |
| Status | Dying | Active | Dead | **New** |

## Development Priorities

### Must Have (MVP)
1. Archive.is paywall bypass
2. Twitter extraction
3. iOS Save Extension
4. Continuous TTS
5. Basic dual-mode UI

### Should Have (v1.0)
1. Cookie bypass
2. Instagram/TikTok
3. Visual gallery
4. Color extraction
5. Offline search

### Nice to Have (v2.0)
1. Browser extension
2. Android app
3. Team workspaces
4. AI summaries
5. Webhooks/API

## Conclusion

Save combines the best of Pocket (reading queue) and MyMind (visual knowledge) with superior extraction capabilities. By implementing proven paywall bypass techniques and reliable social media extraction, we solve the core problems users face today. The continuous TTS feature provides a unique differentiator no competitor offers.

With Pocket shutting down and MyMind being expensive, the market opportunity is massive. Our technical approach using Archive.is, cookie manipulation, and browser automation ensures we can deliver where others fail. The local-first architecture addresses privacy concerns while the dual-mode UI serves both use cases elegantly.

This is the read-later app users have been waiting for.