# Adpick Affiliate Link Integration - Backend Architecture Design

## 1. System Architecture Overview

### 1.1 Component Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Application Layer                     │
│                         (app.ts)                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──────────────┬──────────────┬─────────────┐
             │              │              │             │
     ┌───────▼──────┐ ┌────▼────┐  ┌──────▼─────┐ ┌────▼─────┐
     │ ChromDriver  │ │  Naver  │  │    LLM     │ │  Adpick  │
     │   Factory    │ │ Service │  │  Service   │ │ Service  │
     └──────────────┘ └─────────┘  └────────────┘ └──────┬───┘
                                                          │
                          ┌───────────────────────────────┤
                          │                               │
                   ┌──────▼──────┐              ┌────────▼────────┐
                   │ Link Cache  │              │  Link Matching  │
                   │   Service   │              │     Service     │
                   └──────┬──────┘              └────────┬────────┘
                          │                               │
                   ┌──────▼──────┐              ┌────────▼────────┐
                   │    Link     │              │   Keyword       │
                   │ Repository  │              │   Extractor     │
                   └─────────────┘              └─────────────────┘
```

### 1.2 Data Flow Sequence

```
1. App Initialization:
   ChromDriver → WebDriver
   AdpickService.authenticate()
   NaverService.login()

2. Question Processing Loop:
   QuestionService.getQuestions() → Question[]

   For each Question:
   a) QuestionService.getQuestionDetail() → Question (with full content)

   b) LinkMatchingService.findBestMatch(Question) →
      ├─ KeywordExtractor.extract(Question.content) → keywords[]
      ├─ LinkCacheService.getLinks(category) →
      │  ├─ Check in-memory cache (hit: return, miss: continue)
      │  ├─ Check file cache (hit: load to memory, miss: continue)
      │  └─ AdpickService.fetchLinks(category) → scrape & cache
      └─ Score & select best match → AffiliateLink | null

   c) AutoAnswerService.createAutoAnswer(Question, AffiliateLink?) →
      ├─ Build prompt with link context (if link exists)
      ├─ LangChain + OpenAI → AI-generated answer
      └─ Return answer with embedded link reference

   d) QuestionService.postAnswer(driver, Question, answer)

3. Cache Management:
   Background task: LinkCacheService.refreshStaleCache()
```

## 2. Component Interfaces

### 2.1 Domain Models

```typescript
// adpick/domain/AffiliateLink.ts
export class AffiliateLink {
  constructor(
    public readonly id: string,
    public readonly url: string,
    public readonly productName: string,
    public readonly category: LinkCategory,
    public readonly keywords: string[],
    public readonly commissionRate?: number,
    public readonly description?: string,
    public readonly imageUrl?: string
  ) {}

  matches(keywords: string[]): number {
    // Relevance scoring logic
    const matchCount = keywords.filter(k =>
      this.keywords.includes(k) || this.productName.includes(k)
    ).length;
    return matchCount / keywords.length;
  }
}

// adpick/domain/LinkCategory.ts
export enum LinkCategory {
  FINANCE = 'finance',
  STOCK = 'stock',
  INVESTMENT = 'investment',
  CRYPTO = 'crypto',
  REAL_ESTATE = 'real_estate',
  INSURANCE = 'insurance',
  TECH = 'tech',
  EDUCATION = 'education',
  GENERAL = 'general'
}

// adpick/domain/CachedLinks.ts
export interface CachedLinks {
  category: LinkCategory;
  links: AffiliateLink[];
  fetchedAt: Date;
  ttl: number; // milliseconds
}
```

### 2.2 Command DTOs

```typescript
// adpick/in/adpickCredentials.ts
export class AdpickCredentials {
  constructor(
    public readonly username: string,
    public readonly password: string
  ) {}
}

// adpick/in/linkSearchCommand.ts
export class LinkSearchCommand {
  constructor(
    public readonly category: LinkCategory,
    public readonly keywords?: string[],
    public readonly limit: number = 20
  ) {}
}
```

### 2.3 Service Interfaces

```typescript
// adpick/service/adpickService.ts
export interface IAdpickService {
  /**
   * Authenticate with Adpick using Selenium
   * @throws AdpickAuthenticationError if login fails
   */
  authenticate(driver: WebDriver): Promise<void>;

  /**
   * Fetch affiliate links for a specific category
   * @param command Search criteria
   * @returns Array of affiliate links
   * @throws AdpickScrapingError if scraping fails
   */
  fetchLinks(driver: WebDriver, command: LinkSearchCommand): Promise<AffiliateLink[]>;

  /**
   * Check if service is authenticated
   */
  isAuthenticated(): boolean;
}

// adpick/service/linkCacheService.ts
export interface ILinkCacheService {
  /**
   * Get links for category (uses cache if available)
   * @param category Link category
   * @returns Cached or fresh links
   */
  getLinks(category: LinkCategory): Promise<AffiliateLink[]>;

  /**
   * Manually refresh cache for specific category
   */
  refreshCategory(category: LinkCategory): Promise<void>;

  /**
   * Background task to refresh stale cache entries
   */
  refreshStaleCache(): Promise<void>;

  /**
   * Clear all cache (in-memory + file)
   */
  clearCache(): Promise<void>;
}

// adpick/service/linkMatchingService.ts
export interface ILinkMatchingService {
  /**
   * Find best matching affiliate link for a question
   * @param question The question to match
   * @returns Best match or null if no good match
   */
  findBestMatch(question: Question): Promise<AffiliateLink | null>;

  /**
   * Calculate relevance score between question and link
   * @param question The question
   * @param link The affiliate link
   * @returns Relevance score (0-1)
   */
  scoreRelevance(question: Question, link: AffiliateLink): number;
}

// adpick/repository/linkRepository.ts
export interface ILinkRepository {
  /**
   * Save links to persistent storage
   */
  save(cached: CachedLinks): Promise<void>;

  /**
   * Load links from persistent storage
   */
  load(category: LinkCategory): Promise<CachedLinks | null>;

  /**
   * Delete cached links for category
   */
  delete(category: LinkCategory): Promise<void>;

  /**
   * Get all cached categories
   */
  getAllCategories(): Promise<LinkCategory[]>;
}
```

### 2.4 Updated AutoAnswerService Interface

```typescript
// llm/service/autoAnswerService.ts (MODIFIED)
export interface IAutoAnswerService {
  /**
   * Generate AI answer for question with optional affiliate link
   * @param question The question to answer
   * @param affiliateLink Optional affiliate link to integrate
   * @returns Generated answer with embedded link (if provided)
   */
  createAutoAnswer(
    question: Question,
    affiliateLink?: AffiliateLink
  ): Promise<string>;
}
```

## 3. Implementation Strategy

### 3.1 Adpick Integration Method

**Recommended Approach: Selenium-based Scraping**

Reasons:
1. ✅ Reuses existing ChromDriver infrastructure
2. ✅ No dependency on Adpick API availability
3. ✅ Consistent with project's anti-CAPTCHA strategy
4. ✅ Handles dynamic content rendering

**Implementation Steps:**

```typescript
// Pseudo-code for AdpickService
class AdpickService implements IAdpickService {
  async authenticate(driver: WebDriver): Promise<void> {
    // Navigate to Adpick login page
    await driver.get('https://adpick.co.kr/login');

    // Fill credentials (similar to Naver login strategy)
    await driver.findElement(By.id('username')).sendKeys(this.credentials.username);
    await driver.findElement(By.id('password')).sendKeys(this.credentials.password);

    // Submit and verify
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.wait(until.urlContains('/dashboard'), 10000);

    this.authenticated = true;
  }

  async fetchLinks(driver: WebDriver, command: LinkSearchCommand): Promise<AffiliateLink[]> {
    // Navigate to category page
    await driver.get(`https://adpick.co.kr/links?category=${command.category}`);

    // Wait for link elements to load
    await driver.wait(until.elementsLocated(By.css('.affiliate-link-item')), 10000);

    // Scrape link data
    const linkElements = await driver.findElements(By.css('.affiliate-link-item'));
    const links: AffiliateLink[] = [];

    for (const elem of linkElements.slice(0, command.limit)) {
      const url = await elem.findElement(By.css('.link-url')).getText();
      const productName = await elem.findElement(By.css('.product-name')).getText();
      const category = command.category;
      const keywords = productName.split(' '); // Basic keyword extraction

      links.push(new AffiliateLink(
        generateId(),
        url,
        productName,
        category,
        keywords
      ));
    }

    return links;
  }
}
```

**Alternative: API Integration (if available)**

```typescript
// Future API-based implementation
class AdpickApiService implements IAdpickService {
  async authenticate(): Promise<void> {
    const response = await axios.post('https://api.adpick.co.kr/auth/token', {
      username: this.credentials.username,
      password: this.credentials.password
    });
    this.apiToken = response.data.token;
  }

  async fetchLinks(command: LinkSearchCommand): Promise<AffiliateLink[]> {
    const response = await axios.get('https://api.adpick.co.kr/links', {
      headers: { Authorization: `Bearer ${this.apiToken}` },
      params: { category: command.category, limit: command.limit }
    });
    return response.data.map(mapToAffiliateLink);
  }
}
```

### 3.2 Link Matching Algorithm

**Phase 1: Keyword-Based Matching (MVP)**

```typescript
class KeywordLinkMatcher implements ILinkMatchingService {
  constructor(
    private cacheService: ILinkCacheService,
    private keywordExtractor: KeywordExtractor
  ) {}

  async findBestMatch(question: Question): Promise<AffiliateLink | null> {
    // Extract keywords from question
    const keywords = this.keywordExtractor.extract(question.content);

    // Determine category from question
    const category = this.categorizeQuestion(question, keywords);

    // Get cached links for category
    const links = await this.cacheService.getLinks(category);

    // Score each link
    const scored = links.map(link => ({
      link,
      score: this.scoreRelevance(question, link)
    }));

    // Sort by score and return best match (if score > threshold)
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return best && best.score > 0.3 ? best.link : null;
  }

  scoreRelevance(question: Question, link: AffiliateLink): number {
    const questionKeywords = this.keywordExtractor.extract(question.content);

    // Simple keyword overlap scoring
    const overlap = questionKeywords.filter(qk =>
      link.keywords.some(lk => lk.includes(qk) || qk.includes(lk))
    ).length;

    return overlap / questionKeywords.length;
  }

  private categorizeQuestion(question: Question, keywords: string[]): LinkCategory {
    // Rule-based category mapping
    const categoryRules: Record<string, string[]> = {
      [LinkCategory.STOCK]: ['주식', '증권', '코스피', '코스닥', '배당'],
      [LinkCategory.CRYPTO]: ['코인', '비트코인', '이더리움', '암호화폐'],
      [LinkCategory.REAL_ESTATE]: ['부동산', '아파트', '전세', '월세', '매매'],
      [LinkCategory.INSURANCE]: ['보험', '건강보험', '자동차보험', '실손'],
      // ... more rules
    };

    for (const [category, terms] of Object.entries(categoryRules)) {
      if (keywords.some(k => terms.includes(k))) {
        return category as LinkCategory;
      }
    }

    return LinkCategory.GENERAL;
  }
}
```

**Phase 2: Semantic Similarity (Future Enhancement)**

```typescript
class SemanticLinkMatcher implements ILinkMatchingService {
  constructor(
    private embeddingService: EmbeddingService,
    private cacheService: ILinkCacheService
  ) {}

  async findBestMatch(question: Question): Promise<AffiliateLink | null> {
    // Generate question embedding
    const questionEmbedding = await this.embeddingService.embed(question.content);

    // Get all links (or category-specific)
    const links = await this.cacheService.getLinks(this.categorizeQuestion(question));

    // Compute cosine similarity for each link
    const scored = await Promise.all(links.map(async link => {
      const linkEmbedding = await this.embeddingService.embed(
        `${link.productName} ${link.description}`
      );
      const similarity = cosineSimilarity(questionEmbedding, linkEmbedding);

      return { link, score: similarity };
    }));

    // Return best match
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0.5 ? scored[0].link : null;
  }
}
```

### 3.3 Answer Composition Strategy

**Modify AutoAnswerService Prompt**

```typescript
// llm/service/autoAnswerService.ts
class AutoAnswerService implements IAutoAnswerService {
  async createAutoAnswer(question: Question, affiliateLink?: AffiliateLink): Promise<string> {
    // Build system prompt with link context
    const systemPrompt = this.buildSystemPrompt(affiliateLink);

    // Build user prompt
    const userPrompt = `질문: ${question.content}\n\n위 질문에 대한 전문적이고 유용한 답변을 작성해주세요.`;

    // Generate answer using LangChain
    const chain = this.createChain(systemPrompt);
    const answer = await chain.invoke({ question: userPrompt });

    return answer;
  }

  private buildSystemPrompt(affiliateLink?: AffiliateLink): string {
    let basePrompt = `당신은 네이버 지식iN의 전문 답변자입니다.
정확하고 유용한 정보를 제공하며, 친절하고 전문적인 어조로 답변합니다.`;

    if (affiliateLink) {
      basePrompt += `\n\n답변에 다음 추천 리소스를 자연스럽게 포함해주세요:
- 서비스명: ${affiliateLink.productName}
- 링크: ${affiliateLink.url}
- 설명: ${affiliateLink.description || '관련 정보를 제공합니다'}

⚠️ 주의: 링크는 답변의 맥락에 자연스럽게 녹여서 소개하되, 과도한 홍보는 피하세요.
예시: "이와 관련하여 ${affiliateLink.productName}(${affiliateLink.url})에서 더 자세한 정보를 확인하실 수 있습니다."`;
    }

    return basePrompt;
  }
}
```

### 3.4 Caching Implementation

```typescript
// adpick/service/linkCacheService.ts
class LinkCacheService implements ILinkCacheService {
  private memoryCache: Map<LinkCategory, CachedLinks> = new Map();

  constructor(
    private adpickService: IAdpickService,
    private repository: ILinkRepository,
    private driver: WebDriver,
    private ttl: number = 24 * 60 * 60 * 1000 // 24 hours
  ) {}

  async getLinks(category: LinkCategory): Promise<AffiliateLink[]> {
    // 1. Check in-memory cache
    const memCached = this.memoryCache.get(category);
    if (memCached && !this.isStale(memCached)) {
      console.log(`[Cache HIT] In-memory cache for ${category}`);
      return memCached.links;
    }

    // 2. Check file cache
    const fileCached = await this.repository.load(category);
    if (fileCached && !this.isStale(fileCached)) {
      console.log(`[Cache HIT] File cache for ${category}`);
      this.memoryCache.set(category, fileCached);
      return fileCached.links;
    }

    // 3. Fetch fresh links
    console.log(`[Cache MISS] Fetching fresh links for ${category}`);
    return await this.fetchAndCache(category);
  }

  private async fetchAndCache(category: LinkCategory): Promise<AffiliateLink[]> {
    try {
      const command = new LinkSearchCommand(category, undefined, 20);
      const links = await this.adpickService.fetchLinks(this.driver, command);

      const cached: CachedLinks = {
        category,
        links,
        fetchedAt: new Date(),
        ttl: this.ttl
      };

      // Save to both caches
      this.memoryCache.set(category, cached);
      await this.repository.save(cached);

      return links;
    } catch (error) {
      console.error(`Failed to fetch links for ${category}:`, error);
      // Return empty array or throw based on requirements
      return [];
    }
  }

  private isStale(cached: CachedLinks): boolean {
    const age = Date.now() - cached.fetchedAt.getTime();
    return age > cached.ttl;
  }

  async refreshStaleCache(): Promise<void> {
    const categories = await this.repository.getAllCategories();

    for (const category of categories) {
      const cached = this.memoryCache.get(category) || await this.repository.load(category);

      if (cached && this.isStale(cached)) {
        console.log(`[Refresh] Stale cache detected for ${category}`);
        await this.fetchAndCache(category);
      }
    }
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    const categories = await this.repository.getAllCategories();
    await Promise.all(categories.map(c => this.repository.delete(c)));
  }
}

// adpick/repository/linkRepository.ts
class JsonLinkRepository implements ILinkRepository {
  private cacheDir = path.join(__dirname, '../../.cache/adpick');

  async save(cached: CachedLinks): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const filePath = path.join(this.cacheDir, `${cached.category}.json`);
    await fs.writeFile(filePath, JSON.stringify(cached, null, 2));
  }

  async load(category: LinkCategory): Promise<CachedLinks | null> {
    const filePath = path.join(this.cacheDir, `${category}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async delete(category: LinkCategory): Promise<void> {
    const filePath = path.join(this.cacheDir, `${category}.json`);
    await fs.unlink(filePath).catch(() => {}); // Ignore if not exists
  }

  async getAllCategories(): Promise<LinkCategory[]> {
    try {
      const files = await fs.readdir(this.cacheDir);
      return files.map(f => f.replace('.json', '') as LinkCategory);
    } catch {
      return [];
    }
  }
}
```

## 4. File Organization

```
src/
├── adpick/                                    # NEW: Adpick integration module
│   ├── domain/
│   │   ├── AffiliateLink.ts                  # Core domain entity
│   │   ├── LinkCategory.ts                   # Category enum/type
│   │   └── CachedLinks.ts                    # Cache structure
│   ├── in/                                    # Input DTOs
│   │   ├── adpickCredentials.ts              # Login credentials DTO
│   │   └── linkSearchCommand.ts              # Search command DTO
│   ├── service/
│   │   ├── adpickService.ts                  # Main Adpick scraping service
│   │   ├── linkCacheService.ts               # Cache management service
│   │   └── linkMatchingService.ts            # Link matching algorithm
│   ├── repository/
│   │   └── linkRepository.ts                 # Cache persistence (JSON file)
│   └── errors/
│       ├── AdpickAuthenticationError.ts      # Authentication error
│       └── AdpickScrapingError.ts            # Scraping error
│
├── shared/                                    # NEW: Shared utilities
│   ├── config/
│   │   ├── adpickConfig.ts                   # Adpick configuration
│   │   └── index.ts                          # Config aggregator
│   └── utils/
│       ├── keywordExtractor.ts               # Keyword extraction utility
│       └── stringUtils.ts                    # String manipulation helpers
│
├── chrom/
│   └── utils/
│       └── chromDriver.ts                    # (Existing) WebDriver factory
│
├── naver/
│   ├── domain/
│   │   └── Question.ts                       # (Existing) Question entity
│   └── service/
│       ├── login.ts                          # (Existing) Naver login
│       └── question.ts                       # (Existing) Question service
│
├── llm/
│   └── service/
│       └── autoAnswerService.ts              # MODIFIED: Accept AffiliateLink param
│
└── app.ts                                     # MODIFIED: Integrate Adpick flow

.cache/                                        # NEW: Cache directory (gitignored)
└── adpick/
    ├── stock.json                            # Cached stock links
    ├── finance.json                          # Cached finance links
    └── ...
```

## 5. Configuration Schema

### 5.1 Environment Variables

```bash
# .env (add these variables)

# Adpick Credentials
ADPICK_USERNAME=your_username
ADPICK_PASSWORD=your_password

# Adpick Configuration
ADPICK_BASE_URL=https://adpick.co.kr
ADPICK_CACHE_TTL=86400000           # 24 hours in milliseconds
ADPICK_DEFAULT_LINK=https://next-stock.com/  # Fallback link

# Link Matching Configuration
LINK_MATCHING_THRESHOLD=0.3         # Minimum relevance score (0-1)
LINK_MATCHING_STRATEGY=keyword      # keyword | semantic

# Cache Configuration
CACHE_ENABLED=true
CACHE_DIRECTORY=.cache/adpick
```

### 5.2 Configuration File

```typescript
// shared/config/adpickConfig.ts
import dotenv from 'dotenv';
dotenv.config();

export const adpickConfig = {
  credentials: {
    username: process.env.ADPICK_USERNAME || '',
    password: process.env.ADPICK_PASSWORD || ''
  },

  service: {
    baseUrl: process.env.ADPICK_BASE_URL || 'https://adpick.co.kr',
    defaultLink: process.env.ADPICK_DEFAULT_LINK || 'https://next-stock.com/',
    cacheTtl: parseInt(process.env.ADPICK_CACHE_TTL || '86400000')
  },

  matching: {
    threshold: parseFloat(process.env.LINK_MATCHING_THRESHOLD || '0.3'),
    strategy: process.env.LINK_MATCHING_STRATEGY as 'keyword' | 'semantic' || 'keyword'
  },

  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    directory: process.env.CACHE_DIRECTORY || '.cache/adpick'
  },

  // Category keyword rules
  categoryRules: {
    stock: ['주식', '증권', '코스피', '코스닥', '배당', '펀드', '투자'],
    crypto: ['코인', '비트코인', '이더리움', '암호화폐', '가상화폐', '블록체인'],
    real_estate: ['부동산', '아파트', '전세', '월세', '매매', '분양'],
    insurance: ['보험', '건강보험', '자동차보험', '실손', '연금'],
    finance: ['금융', '대출', '카드', '적금', '예금', '은행'],
    general: [] // Fallback category
  }
};

// Validation
export function validateAdpickConfig(): void {
  if (!adpickConfig.credentials.username || !adpickConfig.credentials.password) {
    throw new Error('Adpick credentials not configured. Check ADPICK_USERNAME and ADPICK_PASSWORD in .env');
  }
}
```

### 5.3 .gitignore Updates

```gitignore
# Add to existing .gitignore
.cache/
*.cache.json
```

## 6. Error Handling Strategy

### 6.1 Error Hierarchy

```typescript
// adpick/errors/AdpickAuthenticationError.ts
export class AdpickAuthenticationError extends Error {
  constructor(message: string) {
    super(`[Adpick Auth] ${message}`);
    this.name = 'AdpickAuthenticationError';
  }
}

// adpick/errors/AdpickScrapingError.ts
export class AdpickScrapingError extends Error {
  constructor(
    message: string,
    public readonly category: LinkCategory,
    public readonly originalError?: Error
  ) {
    super(`[Adpick Scraping] ${message}`);
    this.name = 'AdpickScrapingError';
  }
}
```

### 6.2 Fallback Mechanisms

```typescript
// Graceful degradation in app.ts
async function processQuestion(question: Question): Promise<void> {
  try {
    // 1. Try to find matching affiliate link
    const affiliateLink = await linkMatchingService.findBestMatch(question);

    if (!affiliateLink) {
      console.warn(`No matching link found for question ${question.id}, using default`);
    }

    // 2. Generate answer with link (or default)
    const answer = await autoAnswerService.createAutoAnswer(question, affiliateLink);

    // 3. Extract final link for posting
    const finalLink = affiliateLink?.url || adpickConfig.service.defaultLink;

    // 4. Post answer
    await questionService.postAnswer(driver, question, finalLink);

  } catch (error) {
    if (error instanceof AdpickAuthenticationError) {
      console.error('Adpick authentication failed, using default link:', error);
      // Fallback to default link
      const answer = await autoAnswerService.createAutoAnswer(question);
      await questionService.postAnswer(driver, question, adpickConfig.service.defaultLink);
    }
    else if (error instanceof AdpickScrapingError) {
      console.error(`Scraping failed for category ${error.category}, using cached or default:`, error);
      // Try cache or use default
      const answer = await autoAnswerService.createAutoAnswer(question);
      await questionService.postAnswer(driver, question, adpickConfig.service.defaultLink);
    }
    else {
      // Unexpected error, log and skip question
      console.error('Unexpected error processing question:', error);
      throw error;
    }
  }
}
```

### 6.3 Circuit Breaker Pattern

```typescript
// adpick/service/circuitBreaker.ts
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN, service temporarily disabled');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.error(`Circuit breaker OPEN after ${this.failureCount} failures`);
    }
  }
}

// Usage in AdpickService
class ResilientAdpickService implements IAdpickService {
  private circuitBreaker = new CircuitBreaker(5, 60000);

  async fetchLinks(driver: WebDriver, command: LinkSearchCommand): Promise<AffiliateLink[]> {
    return this.circuitBreaker.execute(async () => {
      // Actual scraping logic
      return this.scrapeLinks(driver, command);
    });
  }
}
```

### 6.4 Logging Strategy

```typescript
// shared/utils/logger.ts
class Logger {
  error(context: string, message: string, error?: Error): void {
    console.error(`[ERROR][${context}] ${message}`, error?.stack);
    // TODO: Send to monitoring service (Sentry, LogRocket, etc.)
  }

  warn(context: string, message: string): void {
    console.warn(`[WARN][${context}] ${message}`);
  }

  info(context: string, message: string): void {
    console.log(`[INFO][${context}] ${message}`);
  }

  debug(context: string, message: string, data?: any): void {
    if (process.env.DEBUG === 'true') {
      console.debug(`[DEBUG][${context}] ${message}`, data);
    }
  }
}

export const logger = new Logger();

// Usage
logger.error('AdpickService', 'Failed to authenticate', error);
logger.warn('LinkMatcher', 'No matching link found, using default');
logger.info('CacheService', `Cache HIT for category: ${category}`);
```

## 7. Future Extensibility

### 7.1 Multiple Affiliate Network Support

**Strategy Pattern Implementation:**

```typescript
// shared/affiliate/affiliateProvider.ts
export interface AffiliateProvider {
  readonly name: string;

  authenticate(driver: WebDriver): Promise<void>;
  fetchLinks(driver: WebDriver, criteria: LinkSearchCriteria): Promise<AffiliateLink[]>;
  supports(category: LinkCategory): boolean;
  getPriority(): number; // For provider selection
}

// adpick/service/adpickProvider.ts
export class AdpickProvider implements AffiliateProvider {
  readonly name = 'Adpick';

  supports(category: LinkCategory): boolean {
    // Adpick supports all categories
    return true;
  }

  getPriority(): number {
    return 1; // Default priority
  }

  // ... implement interface methods
}

// coupang/service/coupangProvider.ts (future)
export class CoupangProvider implements AffiliateProvider {
  readonly name = 'Coupang';

  supports(category: LinkCategory): boolean {
    // Coupang only supports product categories
    return [LinkCategory.TECH, LinkCategory.GENERAL].includes(category);
  }

  getPriority(): number {
    return 2; // Higher priority for supported categories
  }
}
```

**Provider Registry:**

```typescript
// shared/affiliate/providerRegistry.ts
export class AffiliateProviderRegistry {
  private providers: Map<string, AffiliateProvider> = new Map();

  register(provider: AffiliateProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): AffiliateProvider | undefined {
    return this.providers.get(name);
  }

  getBestProvider(category: LinkCategory): AffiliateProvider | null {
    const supporting = Array.from(this.providers.values())
      .filter(p => p.supports(category))
      .sort((a, b) => b.getPriority() - a.getPriority());

    return supporting[0] || null;
  }

  getAllProviders(): AffiliateProvider[] {
    return Array.from(this.providers.values());
  }
}

// Usage in app.ts
const registry = new AffiliateProviderRegistry();
registry.register(new AdpickProvider(adpickConfig));
registry.register(new CoupangProvider(coupangConfig)); // future

const provider = registry.getBestProvider(category);
```

**Multi-Provider Link Matching:**

```typescript
class MultiProviderLinkMatcher implements ILinkMatchingService {
  constructor(
    private registry: AffiliateProviderRegistry,
    private cacheService: ILinkCacheService
  ) {}

  async findBestMatch(question: Question): Promise<AffiliateLink | null> {
    const category = this.categorizeQuestion(question);

    // Try providers in priority order
    const providers = this.registry.getAllProviders()
      .filter(p => p.supports(category))
      .sort((a, b) => b.getPriority() - a.getPriority());

    for (const provider of providers) {
      try {
        const links = await this.cacheService.getLinks(category, provider.name);
        const match = this.findMatchInLinks(question, links);

        if (match) {
          return match;
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed, trying next:`, error);
        continue;
      }
    }

    return null; // No match from any provider
  }
}
```

### 7.2 Advanced Features Roadmap

**Performance Tracking:**

```typescript
// adpick/domain/LinkPerformance.ts
export class LinkPerformance {
  constructor(
    public linkId: string,
    public clicks: number = 0,
    public conversions: number = 0,
    public revenue: number = 0,
    public lastUsed: Date = new Date()
  ) {}

  get conversionRate(): number {
    return this.clicks > 0 ? this.conversions / this.clicks : 0;
  }
}

// Enhanced matching with performance data
class PerformanceAwareMatcher implements ILinkMatchingService {
  async findBestMatch(question: Question): Promise<AffiliateLink | null> {
    const links = await this.cacheService.getLinks(category);

    // Combine relevance score with performance metrics
    const scored = links.map(link => {
      const relevance = this.scoreRelevance(question, link);
      const performance = this.getPerformanceScore(link.id);

      return {
        link,
        score: relevance * 0.7 + performance * 0.3 // Weighted combination
      };
    });

    // Return best combined score
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.link || null;
  }
}
```

**A/B Testing Support:**

```typescript
// shared/affiliate/abTesting.ts
export class ABTestingService {
  async selectLink(question: Question, candidates: AffiliateLink[]): Promise<AffiliateLink> {
    const userId = this.getUserId(question);
    const variant = this.getVariant(userId, candidates.length);

    // Track variant assignment
    await this.trackAssignment(userId, candidates[variant].id);

    return candidates[variant];
  }

  private getVariant(userId: string, variantCount: number): number {
    // Consistent hashing for stable variant assignment
    const hash = this.hashUserId(userId);
    return hash % variantCount;
  }
}
```

**Machine Learning Integration:**

```typescript
// shared/ml/linkRanker.ts
export class MLLinkRanker {
  constructor(private modelPath: string) {}

  async rank(question: Question, links: AffiliateLink[]): Promise<AffiliateLink[]> {
    // Load trained model
    const model = await this.loadModel();

    // Generate features
    const features = links.map(link => this.extractFeatures(question, link));

    // Predict relevance scores
    const scores = await model.predict(features);

    // Sort by predicted score
    return links
      .map((link, idx) => ({ link, score: scores[idx] }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.link);
  }

  private extractFeatures(question: Question, link: AffiliateLink): number[] {
    return [
      this.keywordOverlap(question, link),
      this.categoryMatch(question, link),
      this.historicalCTR(link),
      this.conversionRate(link),
      this.recency(link),
      // ... more features
    ];
  }
}
```

## 8. Integration Example

### 8.1 Updated app.ts

```typescript
// app.ts (MODIFIED)
import { ChromDriver } from './chrom/utils/chromDriver';
import { NaverLoginService } from './naver/service/login';
import { QuestionService } from './naver/service/question';
import { AutoAnswerService } from './llm/service/autoAnswerService';

// NEW: Adpick imports
import { AdpickService } from './adpick/service/adpickService';
import { LinkCacheService } from './adpick/service/linkCacheService';
import { KeywordLinkMatcher } from './adpick/service/linkMatchingService';
import { JsonLinkRepository } from './adpick/repository/linkRepository';
import { adpickConfig, validateAdpickConfig } from './shared/config/adpickConfig';
import { logger } from './shared/utils/logger';

async function main() {
  // Validate configuration
  validateAdpickConfig();

  // 1. Initialize WebDriver
  const chromDriver = new ChromDriver();
  const driver = await chromDriver.createDriver();

  try {
    // 2. Initialize services
    const loginService = new NaverLoginService();
    const questionService = new QuestionService();
    const autoAnswerService = new AutoAnswerService();

    // NEW: Initialize Adpick services
    const adpickService = new AdpickService(adpickConfig.credentials);
    const linkRepository = new JsonLinkRepository();
    const linkCacheService = new LinkCacheService(
      adpickService,
      linkRepository,
      driver,
      adpickConfig.service.cacheTtl
    );
    const linkMatcher = new KeywordLinkMatcher(linkCacheService);

    // 3. Authenticate with Naver
    logger.info('Main', 'Logging into Naver...');
    await loginService.login(driver);

    // 4. Authenticate with Adpick
    logger.info('Main', 'Authenticating with Adpick...');
    try {
      await adpickService.authenticate(driver);
    } catch (error) {
      logger.warn('Main', 'Adpick authentication failed, will use default link');
    }

    // 5. Get questions
    logger.info('Main', 'Fetching questions...');
    const questions = await questionService.getQuestions(driver);

    // 6. Process each question
    for (const question of questions) {
      try {
        // Get full question details
        await questionService.getQuestionDetail(driver, question);
        logger.info('Main', `Processing question: ${question.id}`);

        // NEW: Find best matching affiliate link
        let affiliateLink;
        try {
          affiliateLink = await linkMatcher.findBestMatch(question);

          if (affiliateLink) {
            logger.info('Main', `Matched link: ${affiliateLink.productName}`);
          } else {
            logger.warn('Main', 'No matching link, using default');
          }
        } catch (error) {
          logger.error('Main', 'Link matching failed', error as Error);
          affiliateLink = null;
        }

        // Generate answer with link context
        const answer = await autoAnswerService.createAutoAnswer(question, affiliateLink);

        // Post answer with final link
        const finalLink = affiliateLink?.url || adpickConfig.service.defaultLink;
        await questionService.postAnswer(driver, question, finalLink);

        logger.info('Main', `Successfully answered question ${question.id}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        logger.error('Main', `Failed to process question ${question.id}`, error as Error);
        continue; // Skip to next question
      }
    }

    logger.info('Main', 'All questions processed successfully');

  } catch (error) {
    logger.error('Main', 'Fatal error in main flow', error as Error);
    throw error;
  } finally {
    // Cleanup
    await driver.quit();
  }
}

main().catch(error => {
  logger.error('Main', 'Unhandled error', error);
  process.exit(1);
});
```

### 8.2 Dependency Injection Setup (Optional)

For better testability and maintainability:

```typescript
// shared/di/container.ts
import { Container } from 'inversify';
import { TYPES } from './types';

const container = new Container();

// Bind interfaces to implementations
container.bind(TYPES.IAdpickService).to(AdpickService).inSingletonScope();
container.bind(TYPES.ILinkRepository).to(JsonLinkRepository).inSingletonScope();
container.bind(TYPES.ILinkCacheService).to(LinkCacheService).inSingletonScope();
container.bind(TYPES.ILinkMatchingService).to(KeywordLinkMatcher).inSingletonScope();

export { container };

// Usage in app.ts
const linkMatcher = container.get<ILinkMatchingService>(TYPES.ILinkMatchingService);
```

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// tests/adpick/linkMatchingService.test.ts
describe('KeywordLinkMatcher', () => {
  let matcher: KeywordLinkMatcher;
  let mockCacheService: jest.Mocked<ILinkCacheService>;

  beforeEach(() => {
    mockCacheService = {
      getLinks: jest.fn()
    } as any;

    matcher = new KeywordLinkMatcher(mockCacheService);
  });

  it('should return link with highest relevance score', async () => {
    const question = new Question('1', '주식 투자 방법', '');

    const links = [
      new AffiliateLink('1', 'url1', '주식 투자 가이드', LinkCategory.STOCK, ['주식', '투자']),
      new AffiliateLink('2', 'url2', '부동산 투자', LinkCategory.REAL_ESTATE, ['부동산'])
    ];

    mockCacheService.getLinks.mockResolvedValue(links);

    const result = await matcher.findBestMatch(question);

    expect(result?.id).toBe('1');
    expect(result?.productName).toBe('주식 투자 가이드');
  });

  it('should return null when no link exceeds threshold', async () => {
    const question = new Question('1', '날씨 어때요', '');
    const links = [
      new AffiliateLink('1', 'url1', '주식 투자', LinkCategory.STOCK, ['주식'])
    ];

    mockCacheService.getLinks.mockResolvedValue(links);

    const result = await matcher.findBestMatch(question);

    expect(result).toBeNull();
  });
});
```

### 9.2 Integration Tests

```typescript
// tests/adpick/integration/adpickFlow.test.ts
describe('Adpick Integration Flow', () => {
  let driver: WebDriver;
  let adpickService: AdpickService;

  beforeAll(async () => {
    driver = await new ChromDriver().createDriver();
    adpickService = new AdpickService(testCredentials);
  });

  afterAll(async () => {
    await driver.quit();
  });

  it('should authenticate and fetch links', async () => {
    await adpickService.authenticate(driver);
    expect(adpickService.isAuthenticated()).toBe(true);

    const command = new LinkSearchCommand(LinkCategory.STOCK, undefined, 10);
    const links = await adpickService.fetchLinks(driver, command);

    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toBeInstanceOf(AffiliateLink);
  });
});
```

## 10. Monitoring & Observability

### 10.1 Metrics to Track

```typescript
// shared/metrics/metricsCollector.ts
export class MetricsCollector {
  // Link matching metrics
  trackLinkMatch(questionId: string, linkId: string | null, score: number): void {
    // Send to analytics service
  }

  // Performance metrics
  trackCacheHit(category: LinkCategory, hitType: 'memory' | 'file'): void {
    // Track cache efficiency
  }

  trackScrapingTime(category: LinkCategory, duration: number): void {
    // Monitor scraping performance
  }

  // Error metrics
  trackError(service: string, errorType: string): void {
    // Track error rates
  }

  // Business metrics
  trackLinkUsage(linkId: string, questionCategory: string): void {
    // Track which links are most used
  }
}
```

### 10.2 Health Checks

```typescript
// shared/health/healthCheck.ts
export class HealthCheckService {
  async checkAdpickHealth(): Promise<HealthStatus> {
    try {
      const isAuthenticated = adpickService.isAuthenticated();
      const cacheStatus = await linkCacheService.getHealthStatus();

      return {
        service: 'Adpick',
        status: isAuthenticated ? 'healthy' : 'degraded',
        details: { isAuthenticated, cache: cacheStatus }
      };
    } catch (error) {
      return {
        service: 'Adpick',
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}
```

---

## Summary

This architecture design provides:

✅ **Separation of Concerns**: Clear boundaries between Adpick, Naver, and LLM logic
✅ **Extensibility**: Strategy pattern enables multiple affiliate networks
✅ **Resilience**: Circuit breaker, fallbacks, comprehensive error handling
✅ **Performance**: Two-tier caching with configurable TTL
✅ **Maintainability**: TypeScript interfaces, dependency injection support
✅ **Testability**: Mocked services, unit and integration test strategies
✅ **Observability**: Logging, metrics, health checks

**Next Steps:**
1. Implement core Adpick scraping service (validate selectors)
2. Build caching layer with file persistence
3. Implement keyword-based matching (MVP)
4. Integrate into existing app.ts flow
5. Add comprehensive error handling
6. Deploy and monitor performance
7. Iterate based on link matching accuracy

**MVP Timeline Estimate:**
- Week 1: Adpick service + caching (scraping, authentication, persistence)
- Week 2: Link matching + LLM integration (keyword matching, prompt engineering)
- Week 3: Error handling + testing (circuit breaker, fallbacks, unit tests)
- Week 4: Monitoring + optimization (metrics, performance tuning)
