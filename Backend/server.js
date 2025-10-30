// BACKEND API - server.js
// Install: npm install express cheerio playwright axios

const express = require('express');
const cheerio = require('cheerio');
const playwright = require('playwright');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// UNIVERSAL SCRAPER - TRULY GENERIC APPROACH
class UniversalScraper {
  constructor(url) {
    this.url = url;
    this.domain = new URL(url).hostname;
    this.results = {
      success: false,
      metadata: {
        url: url,
        pageType: 'unknown',
        scrapedAt: new Date().toISOString(),
        method: 'playwright', // Always use Playwright for reliability
        domain: this.domain
      },
      items: [],
      summary: {
        totalItems: 0,
        avgConfidence: 0,
        warnings: []
      }
    };
  }

  async scrape() {
    try {
      // Always use Playwright for modern sites
      return await this.scrapeWithPlaywright();
    } catch (error) {
      this.results.summary.warnings.push(error.message);
      return this.results;
    }
  }

  async scrapeWithPlaywright() {
    const browser = await playwright.chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US'
    });
    
    const page = await context.newPage();
    
    try {
      console.log(`🌐 Navigating to: ${this.url}`);
      
      await page.goto(this.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 45000 
      });
      
      // Wait for page to settle
      await page.waitForTimeout(4000);
      
      // Intelligent scrolling - scroll multiple times to trigger lazy loading
      console.log('📜 Scrolling to load content...');
      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await page.waitForTimeout(800);
      }
      
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      // Get the fully rendered HTML
      const html = await page.content();
      const $ = cheerio.load(html);
      
      console.log('🔍 Analyzing page structure...');
      
      // STEP 1: Detect page type using advanced heuristics
      const analysis = this.analyzePage($);
      this.results.metadata.pageType = analysis.type;
      
      console.log(`📊 Detected: ${analysis.type} page with ${analysis.candidates.length} potential items`);
      
      // STEP 2: Extract based on page type
      if (analysis.type === 'listing') {
        await this.extractListingAdvanced($, analysis);
      } else {
        await this.extractSingleAdvanced($);
      }

      this.results.success = this.results.items.length > 0;
      this.calculateSummary();
      
      console.log(`✅ Extracted ${this.results.items.length} items`);

    } catch (error) {
      console.error('❌ Error:', error.message);
      this.results.summary.warnings.push(`Scraping error: ${error.message}`);
    } finally {
      await browser.close();
    }

    return this.results;
  }

  // ADVANCED PAGE ANALYSIS
  analyzePage($) {
    const analysis = {
      type: 'single',
      candidates: [],
      patterns: []
    };

    // Find ALL elements with class or id attributes
    const allElements = $('[class], [id]');
    const elementGroups = new Map();

    // Group elements by their tag + class pattern
    allElements.each((_, el) => {
      const $el = $(el);
      const tag = el.name;
      const classes = ($el.attr('class') || '').split(/\s+/).filter(c => c.length > 0);
      
      // Skip if too generic or too small
      const text = $el.text().trim();
      if (text.length < 5) return;
      
      // Create signature for this element type
      classes.forEach(cls => {
        const signature = `${tag}.${cls}`;
        
        if (!elementGroups.has(signature)) {
          elementGroups.set(signature, []);
        }
        elementGroups.get(signature).push(el);
      });
    });

    // Find groups with 2+ similar elements
    let bestGroup = null;
    let maxCount = 0;
    let maxScore = 0;

    for (const [signature, elements] of elementGroups) {
      if (elements.length >= 2) {
        // Score this group based on richness of content
        const score = this.scoreElementGroup($, elements);
        
        if (score > maxScore && elements.length >= maxCount * 0.8) {
          maxScore = score;
          maxCount = elements.length;
          bestGroup = elements;
        } else if (elements.length > maxCount && score >= maxScore * 0.8) {
          maxScore = score;
          maxCount = elements.length;
          bestGroup = elements;
        }
      }
    }

    // Also check for common parent patterns
    const parentGroups = this.findParentGroups($);
    if (parentGroups.elements.length > maxCount && parentGroups.score > maxScore) {
      bestGroup = parentGroups.elements;
      maxCount = parentGroups.elements.length;
      maxScore = parentGroups.score;
    }

    if (maxCount >= 2) {
      analysis.type = 'listing';
      analysis.candidates = bestGroup;
      analysis.score = maxScore;
    }

    return analysis;
  }

  // Score element group by content richness
  scoreElementGroup($, elements) {
    let score = 0;
    const sample = elements.slice(0, 5);
    
    sample.forEach(el => {
      const $el = $(el);
      
      // Check for rich content indicators
      if ($el.find('img').length > 0) score += 20;
      if ($el.find('a').length > 0) score += 15;
      if ($el.find('h1, h2, h3, h4').length > 0) score += 25;
      if ($el.find('[class*="price"], [class*="cost"]').length > 0) score += 30;
      if ($el.find('[class*="title"], [class*="name"]').length > 0) score += 20;
      
      const text = $el.text().trim();
      if (text.length > 20) score += 10;
      if (text.length > 50) score += 10;
      
      // Check for common data attributes
      if ($el.attr('data-id') || $el.attr('data-item-id')) score += 15;
    });
    
    return score / sample.length;
  }

  // Find groups by analyzing parent-child patterns
  findParentGroups($) {
    let bestElements = [];
    let bestScore = 0;

    // Look for parents with multiple similar children
    $('body *').each((_, parent) => {
      const $parent = $(parent);
      const children = $parent.children();
      
      if (children.length >= 2 && children.length <= 500) {
        // Check if children are similar
        const similarity = this.checkChildrenSimilarity($, children);
        
        if (similarity > 0.5) {
          const score = this.scoreElementGroup($, children.toArray());
          
          if (score > bestScore && children.length >= 2) {
            bestScore = score;
            bestElements = children.toArray();
          }
        }
      }
    });

    return { elements: bestElements, score: bestScore };
  }

  // Check similarity between sibling elements
  checkChildrenSimilarity($, children) {
    if (children.length < 2) return 0;
    
    const first = $(children[0]);
    const structure = {
      tagName: children[0].name,
      hasImg: first.find('img').length > 0,
      hasLink: first.find('a').length > 0,
      hasHeading: first.find('h1, h2, h3, h4, h5, h6').length > 0,
      childCount: first.children().length,
      textLength: first.text().trim().length
    };

    let similarCount = 0;
    const sample = children.slice(1, Math.min(children.length, 10));
    
    sample.each((_, child) => {
      const $child = $(child);
      const matches = [
        child.name === structure.tagName,
        ($child.find('img').length > 0) === structure.hasImg,
        ($child.find('a').length > 0) === structure.hasLink,
        Math.abs($child.children().length - structure.childCount) <= 3,
        Math.abs($child.text().trim().length - structure.textLength) < structure.textLength * 0.5
      ];
      
      const matchCount = matches.filter(m => m).length;
      if (matchCount >= 3) similarCount++;
    });

    return similarCount / sample.length;
  }

  // ADVANCED LISTING EXTRACTION
  async extractListingAdvanced($, analysis) {
    const items = [];
    const candidates = analysis.candidates || [];

    console.log(`🔄 Processing ${candidates.length} candidate items...`);

    candidates.forEach((el, i) => {
      if (i >= 200) return; // Limit to 200 items
      
      const $el = $(el);
      const item = this.extractUniversalData($, $el);
      
      // Accept item if it has ANY meaningful data
      if (this.isValidItem(item)) {
        item.id = `item_${i + 1}`;
        items.push(item);
      }
    });

    this.results.items = items;
  }

  // ADVANCED SINGLE PAGE EXTRACTION
  async extractSingleAdvanced($) {
    const item = this.extractUniversalData($, $('body'));
    
    if (this.isValidItem(item)) {
      item.id = 'single_item';
      this.results.items = [item];
    }
  }

  // UNIVERSAL DATA EXTRACTION - Works for ANY content type
  extractUniversalData($, container) {
    const item = {
      name: null,
      price: null,
      description: null,
      image: null,
      link: null,
      metadata: {},
      confidence: 0
    };

    // 1. EXTRACT NAME/TITLE using multiple strategies
    item.name = this.extractTitle($, container);
    if (item.name) item.confidence += 0.25;

    // 2. EXTRACT PRICE (if exists)
    item.price = this.extractPrice($, container);
    if (item.price) item.confidence += 0.2;

    // 3. EXTRACT IMAGE
    item.image = this.extractImage($, container);
    if (item.image) item.confidence += 0.15;

    // 4. EXTRACT LINK
    item.link = this.extractLink($, container);
    if (item.link) item.confidence += 0.1;

    // 5. EXTRACT DESCRIPTION
    item.description = this.extractDescription($, container);
    if (item.description) item.confidence += 0.15;

    // 6. EXTRACT METADATA (ratings, stats, etc.)
    item.metadata = this.extractMetadata($, container);
    if (Object.keys(item.metadata).length > 0) item.confidence += 0.15;

    return item;
  }

  // Extract title with multiple fallback strategies
  extractTitle($, container) {
    // Strategy 1: Semantic headings
    const headings = container.find('h1, h2, h3, h4, h5, h6').toArray();
    for (const h of headings) {
      const text = $(h).text().trim();
      if (text.length >= 3 && text.length <= 300) {
        return text;
      }
    }

    // Strategy 2: Common class patterns
    const titlePatterns = [
      '[class*="title"]', '[class*="Title"]', '[class*="name"]', '[class*="Name"]',
      '[class*="heading"]', '[class*="Heading"]', '[data-testid*="title"]',
      '[aria-label*="title"]', '[itemprop="name"]'
    ];
    
    for (const pattern of titlePatterns) {
      const el = container.find(pattern).first();
      const text = el.text().trim();
      if (text.length >= 3 && text.length <= 300) {
        return text;
      }
    }

    // Strategy 3: First significant link text
    const links = container.find('a');
    for (let i = 0; i < links.length; i++) {
      const text = $(links[i]).text().trim();
      if (text.length >= 10 && text.length <= 200 && !text.match(/^(click|view|read|more|see)/i)) {
        return text;
      }
    }

    // Strategy 4: First significant text block
    const textBlocks = container.find('span, div, p').toArray();
    for (const block of textBlocks.slice(0, 10)) {
      const text = $(block).clone().children().remove().end().text().trim();
      if (text.length >= 10 && text.length <= 200) {
        return text;
      }
    }

    return null;
  }

  // Extract price with pattern matching
  extractPrice($, container) {
    // Strategy 1: Price-specific classes
    const priceSelectors = [
      '[class*="price"]', '[class*="Price"]', '[class*="cost"]', '[class*="Cost"]',
      '[class*="amount"]', '[data-testid*="price"]', '[itemprop="price"]'
    ];
    
    for (const sel of priceSelectors) {
      const text = container.find(sel).first().text().trim();
      if (text && this.looksLikePrice(text)) {
        return text.replace(/\s+/g, ' ');
      }
    }

    // Strategy 2: Pattern matching in all text
    const pricePatterns = [
      /[$₹€£¥]\s*[\d,]+\.?\d*/,
      /[\d,]+\.?\d*\s*[$₹€£¥]/,
      /(?:USD|INR|EUR|GBP|USD|CAD)\s*[\d,]+\.?\d*/,
      /[\d,]+\.?\d*\s*(?:USD|INR|EUR|GBP|USD|CAD)/,
      /(?:Rs\.?|INR)\s*[\d,]+\.?\d*/
    ];

    const allText = container.text();
    for (const pattern of pricePatterns) {
      const match = allText.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    return null;
  }

  looksLikePrice(text) {
    return /[$₹€£¥]|\d+[.,]\d{2}|(?:USD|INR|EUR|GBP|Rs)/i.test(text);
  }

  // Extract image intelligently
  extractImage($, container) {
    const images = container.find('img').toArray();
    
    // Prioritize larger, content images
    let bestImg = null;
    let bestScore = 0;

    for (const img of images) {
      const $img = $(img);
      const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy') || 
                  $img.attr('data-original') || ($img.attr('srcset') || '').split(' ')[0];
      
      if (!src || src.includes('data:image') || src.length < 10) continue;
      
      // Score image
      let score = 0;
      const width = parseInt($img.attr('width') || '0');
      const height = parseInt($img.attr('height') || '0');
      
      if (width > 100) score += 20;
      if (height > 100) score += 20;
      if (width > 200) score += 30;
      
      // Avoid icons, logos, sprites
      const srcLower = src.toLowerCase();
      if (srcLower.includes('icon') || srcLower.includes('logo') || srcLower.includes('sprite')) {
        score -= 50;
      }
      
      if (score > bestScore) {
        bestScore = score;
        try {
          bestImg = src.startsWith('http') ? src : new URL(src, this.url).href;
        } catch (e) {}
      }
    }

    return bestImg;
  }

  // Extract link
  extractLink($, container) {
    const links = container.find('a[href]').toArray();
    
    for (const link of links) {
      const href = $(link).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
      
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, this.url).href;
        const linkDomain = new URL(fullUrl).hostname;
        const baseDomain = this.domain.split('.').slice(-2).join('.');
        
        // Keep same-domain links
        if (linkDomain.includes(baseDomain) || baseDomain.includes(linkDomain.split('.').slice(-2).join('.'))) {
          return fullUrl;
        }
      } catch (e) {}
    }

    return null;
  }

  // Extract description
  extractDescription($, container) {
    const descSelectors = [
      'p', '[class*="desc"]', '[class*="Desc"]', '[class*="description"]',
      '[class*="summary"]', '[class*="detail"]', '[itemprop="description"]'
    ];

    for (const sel of descSelectors) {
      const elements = container.find(sel).toArray();
      for (const el of elements) {
        const text = $(el).text().trim();
        if (text.length >= 20 && text.length <= 1000) {
          return text.substring(0, 500);
        }
      }
    }

    // Fallback: find longest paragraph-like text
    let longestText = '';
    container.find('div, span, p').each((_, el) => {
      const text = $(el).clone().children().remove().end().text().trim();
      if (text.length > longestText.length && text.length >= 30 && text.length <= 1000) {
        longestText = text;
      }
    });

    return longestText || null;
  }

  // Extract metadata (flexible)
  extractMetadata($, container) {
    const metadata = {};
    
    // Common metadata patterns
    const patterns = [
      '[class*="rating"]', '[class*="Rating"]', '[class*="star"]',
      '[class*="review"]', '[class*="Review"]',
      '[class*="follower"]', '[class*="Follower"]',
      '[class*="repo"]', '[class*="language"]',
      '[class*="delivery"]', '[class*="time"]',
      '[class*="stock"]', '[class*="available"]',
      '[class*="cuisine"]', '[class*="category"]'
    ];

    patterns.forEach(pattern => {
      container.find(pattern).each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        if (text && text.length > 0 && text.length < 150) {
          const classes = ($el.attr('class') || '').split(/\s+/);
          const key = classes.find(c => c.length > 2) || 'meta';
          const cleanKey = key.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
          
          if (!metadata[cleanKey]) {
            metadata[cleanKey] = text;
          }
        }
      });
    });

    // Extract any data attributes
    container.find('[data-value], [data-count], [data-score]').each((_, el) => {
      const $el = $(el);
      Object.keys(el.attribs).forEach(attr => {
        if (attr.startsWith('data-')) {
          const key = attr.replace('data-', '');
          const value = $el.attr(attr);
          if (value && value.length < 100) {
            metadata[key] = value;
          }
        }
      });
    });

    return metadata;
  }

  // Check if item has valid data
  isValidItem(item) {
    const hasBasicInfo = item.name || item.link;
    const hasRichInfo = item.price || item.image || item.description;
    const hasMetadata = Object.keys(item.metadata).length > 0;
    
    return (hasBasicInfo || hasRichInfo || hasMetadata) && item.confidence >= 0.1;
  }

  calculateSummary() {
    this.results.summary.totalItems = this.results.items.length;
    
    if (this.results.items.length > 0) {
      const avgConf = this.results.items.reduce((sum, item) => 
        sum + (item.confidence || 0), 0) / this.results.items.length;
      this.results.summary.avgConfidence = parseFloat(avgConf.toFixed(2));
    }

    if (this.results.items.length === 0) {
      this.results.summary.warnings.push('No structured data found - page may require login or have anti-bot protection');
    }
  }
}

// API Endpoints
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  console.log(`\n🚀 Starting scrape for: ${url}\n`);
  const scraper = new UniversalScraper(url);
  const results = await scraper.scrape();
  
  res.json(results);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Universal Scraper API running on port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/api/scrape\n`);
});

module.exports = UniversalScraper;