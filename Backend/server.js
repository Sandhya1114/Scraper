// BACKEND API - server.js
// Install: npm install express cheerio playwright axios

const express = require('express');
const cheerio = require('cheerio');
const playwright = require('playwright');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ADVANCED UNIVERSAL SCRAPER - NO DUPLICATES, MAXIMUM ACCURACY
class UniversalScraper {
  constructor(url) {
    this.url = url;
    this.domain = new URL(url).hostname;
    this.seenContent = new Set(); // Track unique content
    this.results = {
      success: false,
      metadata: {
        url: url,
        pageType: 'unknown',
        scrapedAt: new Date().toISOString(),
        method: 'playwright',
        domain: this.domain
      },
      items: [],
      summary: {
        totalItems: 0,
        duplicatesRemoved: 0,
        avgConfidence: 0,
        warnings: []
      }
    };
  }

  async scrape() {
    try {
      return await this.scrapeWithPlaywright();
    } catch (error) {
      this.results.summary.warnings.push(error.message);
      return this.results;
    }
  }

  async scrapeWithPlaywright() {
    const browser = await playwright.chromium.launch({ 
      headless: false,
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
        waitUntil: 'networkidle',
        timeout: 60000 
      });
      
      // Wait for dynamic content
      await page.waitForTimeout(3000);
      
      // Intelligent scrolling with pauses
      console.log('📜 Loading dynamic content...');
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
        await page.waitForTimeout(600);
      }
      
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);

      const html = await page.content();
      const $ = cheerio.load(html);
      
      console.log('🔍 Analyzing page structure...');
      
      // Remove noise elements
      this.removeNoise($);
      
      // Advanced page analysis
      const analysis = this.analyzePageAdvanced($);
      this.results.metadata.pageType = analysis.type;
      
      console.log(`📊 Detected: ${analysis.type} page with ${analysis.candidates.length} potential items`);
      
      // Extract based on page type
      if (analysis.type === 'listing') {
        await this.extractListingAdvanced($, analysis);
      } else {
        await this.extractSingleAdvanced($);
      }

      // Remove duplicates
      this.removeDuplicates();

      this.results.success = this.results.items.length > 0;
      this.calculateSummary();
      
      console.log(`✅ Extracted ${this.results.items.length} unique items (${this.results.summary.duplicatesRemoved} duplicates removed)`);

    } catch (error) {
      console.error('❌ Error:', error.message);
      this.results.summary.warnings.push(`Scraping error: ${error.message}`);
    } finally {
      await browser.close();
    }

    return this.results;
  }

  // Remove noise elements that interfere with scraping
  removeNoise($) {
    const noiseSelectors = [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header:not([role="banner"])', 'footer',
      '[class*="cookie"]', '[class*="banner"]', '[class*="popup"]',
      '[class*="modal"]', '[class*="overlay"]', '[class*="advertisement"]',
      '[class*="sidebar"]', '[class*="menu"]', '[id*="menu"]',
      '[class*="navigation"]', '[class*="breadcrumb"]'
    ];
    
    noiseSelectors.forEach(sel => $(sel).remove());
  }

  // ADVANCED PAGE ANALYSIS WITH MULTIPLE STRATEGIES
  analyzePageAdvanced($) {
    const strategies = [
      () => this.findByRepeatingPatterns($),
      () => this.findBySemanticStructure($),
      () => this.findByCommonContainers($),
      () => this.findByDataAttributes($)
    ];

    let bestAnalysis = { type: 'single', candidates: [], score: 0 };

    for (const strategy of strategies) {
      const result = strategy();
      if (result.score > bestAnalysis.score && result.candidates.length >= 2) {
        bestAnalysis = result;
      }
    }

    if (bestAnalysis.candidates.length >= 2) {
      bestAnalysis.type = 'listing';
    }

    return bestAnalysis;
  }

  // Strategy 1: Find repeating class/tag patterns
  findByRepeatingPatterns($) {
    const elementGroups = new Map();
    
    // Find all potential item containers
    const potentialItems = $('article, [class*="item"], [class*="card"], [class*="product"], [class*="listing"], [class*="result"], [data-testid], [data-item]');
    
    potentialItems.each((_, el) => {
      const $el = $(el);
      const signature = this.createElementSignature($, el);
      
      if (!elementGroups.has(signature)) {
        elementGroups.set(signature, []);
      }
      elementGroups.get(signature).push(el);
    });

    let bestGroup = [];
    let bestScore = 0;

    for (const [sig, elements] of elementGroups) {
      if (elements.length >= 2) {
        const score = this.scoreElementGroup($, elements);
        if (score > bestScore || (score >= bestScore * 0.9 && elements.length > bestGroup.length)) {
          bestScore = score;
          bestGroup = elements;
        }
      }
    }

    return { candidates: bestGroup, score: bestScore, type: bestGroup.length >= 2 ? 'listing' : 'single' };
  }

  // Strategy 2: Semantic HTML structure
  findBySemanticStructure($) {
    const semanticSelectors = [
      'article', '[itemtype]', '[itemscope]',
      'li[class*="item"]', 'li[class*="product"]', 'li[class*="card"]',
      'div[class*="item"]', 'div[class*="product"]', 'div[class*="card"]',
      '[role="article"]', '[role="listitem"]'
    ];

    let bestElements = [];
    let bestScore = 0;

    for (const selector of semanticSelectors) {
      const elements = $(selector).toArray();
      if (elements.length >= 2) {
        const score = this.scoreElementGroup($, elements);
        if (score > bestScore) {
          bestScore = score;
          bestElements = elements;
        }
      }
    }

    return { candidates: bestElements, score: bestScore };
  }

  // Strategy 3: Common container patterns
  findByCommonContainers($) {
    let bestElements = [];
    let bestScore = 0;

    $('body *').each((_, parent) => {
      const $parent = $(parent);
      const children = $parent.children();
      
      if (children.length >= 2 && children.length <= 500) {
        const similarity = this.checkChildrenSimilarity($, children);
        
        if (similarity > 0.6) {
          const score = this.scoreElementGroup($, children.toArray());
          
          if (score > bestScore && children.length >= 2) {
            bestScore = score;
            bestElements = children.toArray();
          }
        }
      }
    });

    return { candidates: bestElements, score: bestScore };
  }

  // Strategy 4: Data attributes
  findByDataAttributes($) {
    const dataSelectors = [
      '[data-product-id]', '[data-item-id]', '[data-id]',
      '[data-component-type="product"]', '[data-component-type="item"]',
      '[data-test*="item"]', '[data-test*="product"]', '[data-test*="card"]'
    ];

    let bestElements = [];
    let bestScore = 0;

    for (const selector of dataSelectors) {
      const elements = $(selector).toArray();
      if (elements.length >= 2) {
        const score = this.scoreElementGroup($, elements);
        if (score > bestScore) {
          bestScore = score;
          bestElements = elements;
        }
      }
    }

    return { candidates: bestElements, score: bestScore };
  }

  // Create unique signature for element
  createElementSignature($, el) {
    const $el = $(el);
    const tag = el.name;
    const classes = ($el.attr('class') || '').split(/\s+/).filter(c => 
      c.length > 2 && !c.match(/^(active|selected|hidden|visible|\d+)$/i)
    );
    
    return `${tag}:${classes.sort().slice(0, 3).join('.')}`;
  }

  // Score element group
  scoreElementGroup($, elements) {
    if (elements.length === 0) return 0;
    
    let totalScore = 0;
    const sample = elements.slice(0, Math.min(5, elements.length));
    
    sample.forEach(el => {
      const $el = $(el);
      let score = 0;
      
      // Rich content indicators
      if ($el.find('img, picture').length > 0) score += 25;
      if ($el.find('a[href]').length > 0) score += 20;
      if ($el.find('h1, h2, h3, h4, h5, h6').length > 0) score += 30;
      
      // Price indicators
      const priceSelectors = '[class*="price"], [class*="cost"], [class*="amount"], [itemprop="price"]';
      if ($el.find(priceSelectors).length > 0) score += 35;
      
      // Title indicators
      const titleSelectors = '[class*="title"], [class*="name"], [class*="heading"]';
      if ($el.find(titleSelectors).length > 0) score += 25;
      
      // Description
      if ($el.find('p, [class*="desc"], [class*="detail"]').length > 0) score += 15;
      
      // Text content
      const text = $el.text().trim();
      if (text.length > 30) score += 15;
      if (text.length > 100) score += 15;
      
      // Data attributes
      if ($el.attr('data-id') || $el.attr('data-item-id') || $el.attr('data-product-id')) score += 20;
      
      // Structured data
      if ($el.attr('itemscope') || $el.attr('itemtype')) score += 25;
      
      totalScore += score;
    });
    
    return totalScore / sample.length;
  }

  // Check children similarity
  checkChildrenSimilarity($, children) {
    if (children.length < 2) return 0;
    
    const first = $(children[0]);
    const structure = {
      tagName: children[0].name,
      hasImg: first.find('img, picture').length > 0,
      hasLink: first.find('a[href]').length > 0,
      hasHeading: first.find('h1, h2, h3, h4, h5, h6').length > 0,
      hasPrice: first.find('[class*="price"], [class*="cost"]').length > 0,
      childCount: first.children().length,
      textLength: first.text().trim().length
    };

    let similarCount = 0;
    const sample = children.slice(1, Math.min(children.length, 15));
    
    sample.each((_, child) => {
      const $child = $(child);
      const matches = [
        child.name === structure.tagName,
        ($child.find('img, picture').length > 0) === structure.hasImg,
        ($child.find('a[href]').length > 0) === structure.hasLink,
        ($child.find('h1, h2, h3, h4, h5, h6').length > 0) === structure.hasHeading,
        Math.abs($child.children().length - structure.childCount) <= 4,
        Math.abs($child.text().trim().length - structure.textLength) < structure.textLength * 0.6
      ];
      
      const matchCount = matches.filter(m => m).length;
      if (matchCount >= 4) similarCount++;
    });

    return similarCount / sample.length;
  }

  // ADVANCED LISTING EXTRACTION
  async extractListingAdvanced($, analysis) {
    const candidates = analysis.candidates || [];
    console.log(`🔄 Processing ${candidates.length} candidate items...`);

    candidates.forEach((el, i) => {
      if (i >= 300) return; // Limit
      
      const $el = $(el);
      const item = this.extractUniversalData($, $el);
      
      if (this.isValidItem(item) && !this.isDuplicate(item)) {
        item.id = `item_${i + 1}`;
        this.results.items.push(item);
      }
    });
  }

  // SINGLE PAGE EXTRACTION
  async extractSingleAdvanced($) {
    const item = this.extractUniversalData($, $('body'));
    
    if (this.isValidItem(item)) {
      item.id = 'single_item';
      this.results.items = [item];
    }
  }

  // UNIVERSAL DATA EXTRACTION - ENHANCED
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

    // Extract with multiple strategies
    item.name = this.extractTitleAdvanced($, container);
    if (item.name) item.confidence += 0.25;

    item.price = this.extractPriceAdvanced($, container);
    if (item.price) item.confidence += 0.2;

    item.image = this.extractImageAdvanced($, container);
    if (item.image) item.confidence += 0.15;

    item.link = this.extractLinkAdvanced($, container);
    if (item.link) item.confidence += 0.1;

    item.description = this.extractDescriptionAdvanced($, container);
    if (item.description) item.confidence += 0.15;

    item.metadata = this.extractMetadataAdvanced($, container);
    if (Object.keys(item.metadata).length > 0) item.confidence += 0.15;

    return item;
  }

  // ADVANCED TITLE EXTRACTION
  extractTitleAdvanced($, container) {
    const strategies = [
      // Structured data
      () => container.find('[itemprop="name"]').first().text().trim(),
      
      // Headings
      () => {
        const headings = container.find('h1, h2, h3').toArray();
        for (const h of headings) {
          const text = $(h).clone().children('span, small').remove().end().text().trim();
          if (text.length >= 5 && text.length <= 300) return text;
        }
        return null;
      },
      
      // Title/name classes
      () => {
        const selectors = [
          '[class*="title"]:not([class*="subtitle"])',
          '[class*="Title"]:not([class*="Subtitle"])',
          '[class*="name"]:not([class*="username"])',
          '[class*="Name"]:not([class*="Username"])',
          '[class*="heading"]',
          '[data-testid*="title"]',
          '[data-testid*="name"]',
          '[aria-label*="title"]'
        ];
        
        for (const sel of selectors) {
          const text = container.find(sel).first().clone().children().remove().end().text().trim();
          if (text.length >= 5 && text.length <= 300) return text;
        }
        return null;
      },
      
      // Link text
      () => {
        const links = container.find('a[href]').toArray();
        for (const link of links) {
          const text = $(link).clone().children('span').remove().end().text().trim();
          if (text.length >= 10 && text.length <= 200 && 
              !text.match(/^(click|view|read|more|see|learn|shop|buy)/i)) {
            return text;
          }
        }
        return null;
      },
      
      // Strong/bold text
      () => {
        const bold = container.find('strong, b').first().text().trim();
        if (bold.length >= 10 && bold.length <= 200) return bold;
        return null;
      }
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) return result;
    }

    return null;
  }

  // ADVANCED PRICE EXTRACTION
  extractPriceAdvanced($, container) {
    // Structured data
    const structuredPrice = container.find('[itemprop="price"]').first().text().trim();
    if (structuredPrice && this.looksLikePrice(structuredPrice)) {
      return this.cleanPrice(structuredPrice);
    }

    // Price classes
    const priceSelectors = [
      '[class*="price"]:not([class*="original"]):not([class*="old"])',
      '[class*="Price"]:not([class*="Original"]):not([class*="Old"])',
      '[class*="cost"]', '[class*="Cost"]',
      '[class*="amount"]', '[class*="Amount"]',
      '[data-testid*="price"]',
      '[aria-label*="price"]'
    ];
    
    for (const sel of priceSelectors) {
      const elements = container.find(sel).toArray();
      for (const el of elements) {
        const text = $(el).text().trim();
        if (this.looksLikePrice(text)) {
          return this.cleanPrice(text);
        }
      }
    }

    // Pattern matching
    const pricePatterns = [
      /[$₹€£¥]\s*[\d,]+\.?\d*/g,
      /[\d,]+\.?\d*\s*[$₹€£¥]/g,
      /(?:USD|INR|EUR|GBP|CAD|AUD)\s*[\d,]+\.?\d*/gi,
      /[\d,]+\.?\d*\s*(?:USD|INR|EUR|GBP|CAD|AUD)/gi,
      /(?:Rs\.?|INR|₹)\s*[\d,]+\.?\d*/gi
    ];

    const allText = container.text();
    for (const pattern of pricePatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        // Return the first reasonable price
        for (const match of matches) {
          if (this.looksLikePrice(match)) {
            return this.cleanPrice(match);
          }
        }
      }
    }

    return null;
  }

  looksLikePrice(text) {
    return /[$₹€£¥]|\d+[.,]\d{2}|(?:USD|INR|EUR|GBP|Rs)/i.test(text) &&
           parseFloat(text.replace(/[^0-9.]/g, '')) > 0;
  }

  cleanPrice(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  // ADVANCED IMAGE EXTRACTION
  extractImageAdvanced($, container) {
    const images = container.find('img, picture img').toArray();
    
    let bestImg = null;
    let bestScore = -1000;

    for (const img of images) {
      const $img = $(img);
      let score = 0;
      
      // Get all possible image sources
      const src = $img.attr('src') || 
                  $img.attr('data-src') || 
                  $img.attr('data-lazy-src') ||
                  $img.attr('data-original') || 
                  $img.attr('data-lazy') ||
                  ($img.attr('srcset') || '').split(',')[0].split(' ')[0];
      
      if (!src || src.startsWith('data:image') || src.length < 10) continue;
      
      // Dimensions
      const width = parseInt($img.attr('width') || $img.css('width') || '0');
      const height = parseInt($img.attr('height') || $img.css('height') || '0');
      
      if (width > 80) score += 30;
      if (width > 150) score += 40;
      if (width > 250) score += 50;
      if (height > 80) score += 30;
      if (height > 150) score += 40;
      
      // Alt text quality
      const alt = $img.attr('alt') || '';
      if (alt.length > 5) score += 20;
      
      // Class names
      const classes = ($img.attr('class') || '').toLowerCase();
      if (classes.includes('product') || classes.includes('item') || classes.includes('main')) {
        score += 50;
      }
      if (classes.includes('thumbnail') || classes.includes('thumb')) {
        score += 20;
      }
      
      // Penalty for icons, logos, etc.
      const srcLower = src.toLowerCase();
      if (srcLower.includes('icon') || srcLower.includes('logo') || 
          srcLower.includes('sprite') || srcLower.includes('avatar') ||
          srcLower.includes('placeholder')) {
        score -= 100;
      }
      
      // Lazy loading indicators (good sign)
      if ($img.attr('loading') === 'lazy' || $img.attr('data-src')) {
        score += 15;
      }
      
      if (score > bestScore) {
        bestScore = score;
        try {
          bestImg = src.startsWith('http') ? src : new URL(src, this.url).href;
        } catch (e) {
          // Invalid URL
        }
      }
    }

    return bestImg;
  }

  // ADVANCED LINK EXTRACTION
  extractLinkAdvanced($, container) {
    const links = container.find('a[href]').toArray();
    
    let bestLink = null;
    let bestScore = 0;

    for (const link of links) {
      const $link = $(link);
      const href = $link.attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      
      let score = 0;
      
      // Prefer links with meaningful text
      const text = $link.text().trim();
      if (text.length > 10) score += 20;
      
      // Prefer links that contain images or titles
      if ($link.find('img').length > 0) score += 30;
      if ($link.find('h1, h2, h3, h4').length > 0) score += 40;
      
      // Class indicators
      const classes = ($link.attr('class') || '').toLowerCase();
      if (classes.includes('product') || classes.includes('item') || classes.includes('detail')) {
        score += 35;
      }
      
      // Prefer same-domain links
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, this.url).href;
        const linkDomain = new URL(fullUrl).hostname;
        const baseDomain = this.domain.split('.').slice(-2).join('.');
        
        if (linkDomain.includes(baseDomain)) {
          score += 25;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestLink = fullUrl;
        }
      } catch (e) {
        // Invalid URL
      }
    }

    return bestLink;
  }

  // ADVANCED DESCRIPTION EXTRACTION
  extractDescriptionAdvanced($, container) {
    const strategies = [
      // Structured data
      () => container.find('[itemprop="description"]').first().text().trim(),
      
      // Description classes
      () => {
        const selectors = [
          '[class*="description"]', '[class*="Description"]',
          '[class*="desc"]', '[class*="Desc"]',
          '[class*="summary"]', '[class*="Summary"]',
          '[class*="detail"]', '[class*="Detail"]',
          '[class*="content"]', '[class*="Content"]',
          '[data-testid*="description"]'
        ];
        
        for (const sel of selectors) {
          const text = container.find(sel).first().text().trim();
          if (text.length >= 30 && text.length <= 2000) {
            return text.substring(0, 800);
          }
        }
        return null;
      },
      
      // Paragraphs
      () => {
        const paragraphs = container.find('p').toArray();
        for (const p of paragraphs) {
          const text = $(p).text().trim();
          if (text.length >= 30 && text.length <= 2000) {
            return text.substring(0, 800);
          }
        }
        return null;
      },
      
      // Longest text block
      () => {
        let longest = '';
        container.find('div, span, section').each((_, el) => {
          const text = $(el).clone().children().remove().end().text().trim();
          if (text.length > longest.length && text.length >= 40 && text.length <= 2000) {
            longest = text;
          }
        });
        return longest ? longest.substring(0, 800) : null;
      }
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) return result;
    }

    return null;
  }

  // ADVANCED METADATA EXTRACTION
  extractMetadataAdvanced($, container) {
    const metadata = {};
    
    // Structured data
    container.find('[itemprop]').each((_, el) => {
      const prop = $(el).attr('itemprop');
      const value = $(el).text().trim() || $(el).attr('content');
      if (value && value.length < 200 && !metadata[prop]) {
        metadata[prop] = value;
      }
    });

    // Common metadata patterns
    const patterns = {
      rating: '[class*="rating"], [class*="Rating"], [class*="star"], [aria-label*="rating"]',
      reviews: '[class*="review"], [class*="Review"]',
      availability: '[class*="stock"], [class*="Stock"], [class*="available"], [class*="Available"]',
      brand: '[class*="brand"], [class*="Brand"], [itemprop="brand"]',
      category: '[class*="category"], [class*="Category"], [class*="type"]',
      sku: '[class*="sku"], [class*="SKU"], [class*="product-id"]'
    };

    for (const [key, selector] of Object.entries(patterns)) {
      if (!metadata[key]) {
        const value = container.find(selector).first().text().trim();
        if (value && value.length > 0 && value.length < 200) {
          metadata[key] = value;
        }
      }
    }

    // Data attributes
    container.find('[data-value], [data-count], [data-rating], [data-price]').each((_, el) => {
      const $el = $(el);
      Object.keys(el.attribs).forEach(attr => {
        if (attr.startsWith('data-') && !attr.includes('test') && !attr.includes('id')) {
          const key = attr.replace('data-', '').replace(/-/g, '_');
          const value = $el.attr(attr);
          if (value && value.length < 150 && !metadata[key]) {
            metadata[key] = value;
          }
        }
      });
    });

    return metadata;
  }

  // Check if item is valid
  isValidItem(item) {
    const hasTitle = item.name && item.name.length >= 3;
    const hasPrice = item.price && item.price.length > 0;
    const hasImage = item.image && item.image.length > 0;
    const hasDescription = item.description && item.description.length >= 20;
    const hasLink = item.link && item.link.length > 0;
    const hasMetadata = Object.keys(item.metadata).length > 0;
    
    const criteriaCount = [hasTitle, hasPrice, hasImage, hasDescription, hasLink, hasMetadata]
      .filter(Boolean).length;
    
    return criteriaCount >= 2 && item.confidence >= 0.15;
  }

  // Check for duplicate content
  isDuplicate(item) {
    const signature = this.createItemSignature(item);
    
    if (this.seenContent.has(signature)) {
      return true;
    }
    
    this.seenContent.add(signature);
    return false;
  }

  // Create unique signature for item
  createItemSignature(item) {
    const parts = [
      item.name ? item.name.toLowerCase().substring(0, 50) : '',
      item.price ? item.price.replace(/\s/g, '') : '',
      item.link ? item.link : ''
    ];
    
    return parts.filter(p => p.length > 0).join('|');
  }

  // Remove duplicate items from results
  removeDuplicates() {
    const seen = new Set();
    const unique = [];
    let duplicateCount = 0;

    for (const item of this.results.items) {
      const sig = this.createItemSignature(item);
      if (!seen.has(sig)) {
        seen.add(sig);
        unique.push(item);
      } else {
        duplicateCount++;
      }
    }

    this.results.items = unique;
    this.results.summary.duplicatesRemoved = duplicateCount;
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
    } else if (this.results.summary.avgConfidence < 0.3) {
      this.results.summary.warnings.push('Low confidence scores - extracted data may be incomplete');
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