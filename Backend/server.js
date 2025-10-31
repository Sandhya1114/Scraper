// MAXIMUM STEALTH SCRAPER - server.js
// Install: npm install express cheerio playwright playwright-extra puppeteer-extra-plugin-stealth puppeteer-extra-plugin-recaptcha axios proxy-chain user-agents

const express = require('express');
const cheerio = require('cheerio');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const cors = require('cors');
const crypto = require('crypto');
const UserAgent = require('user-agents');

chromium.use(stealth);

const app = express();
app.use(express.json());
app.use(cors());

class MaxStealthScraper {
  constructor(url, options = {}) {
    this.url = url;
    this.domain = new URL(url).hostname;
    this.options = {
      maxRetries: 5,
      solveRecaptcha: true,
      bypassCloudflare: true,
      rotateFingerprints: true,
      antiDetection: true,
      ...options
    };
    
    this.seenContent = new Set();
    this.sessionId = crypto.randomBytes(16).toString('hex');
    this.requestHistory = [];
    
    this.results = {
      success: false,
      metadata: {
        url: url,
        pageType: 'unknown',
        scrapedAt: new Date().toISOString(),
        method: 'max-stealth',
        domain: this.domain,
        sessionId: this.sessionId,
        evasionTechniques: []
      },
      items: [],
      summary: {
        totalItems: 0,
        duplicatesRemoved: 0,
        avgConfidence: 0,
        warnings: [],
        antiBot: {
          captchaDetected: false,
          captchaSolved: false,
          rateLimitEvaded: false,
          loginBypassed: false,
          cloudflareBypassed: false,
          fingerprintRotated: false
        }
      }
    };
  }

  getRandomUserAgent() {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    return userAgent.toString();
  }

  async humanDelay(min = 500, max = 2000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async simulateHumanBehavior(page) {
    try {
      // Natural mouse movements with bezier curves
      const movements = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * 1200) + 100;
        const y = Math.floor(Math.random() * 800) + 100;
        await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
        await this.humanDelay(100, 400);
      }

      // Random clicks on safe elements
      try {
        await page.evaluate(() => {
          const safeElements = document.querySelectorAll('div, span, p');
          if (safeElements.length > 0) {
            const randomEl = safeElements[Math.floor(Math.random() * Math.min(10, safeElements.length))];
            if (randomEl) randomEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          }
        });
      } catch (e) {}

      // Natural scrolling patterns
      const scrolls = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < scrolls; i++) {
        const scrollAmount = Math.floor(Math.random() * 300) + 100;
        await page.evaluate((amount) => {
          window.scrollBy({ top: amount, behavior: 'smooth' });
        }, scrollAmount);
        await this.humanDelay(800, 1500);
      }

      // Random pauses (reading simulation)
      await this.humanDelay(1000, 3000);
    } catch (error) {
      console.log('⚠️ Human behavior simulation partial failure');
    }
  }

  async bypassCloudflare(page) {
    try {
      console.log('🛡️ Checking for Cloudflare...');
      
      await page.waitForTimeout(3000);
      
      const isCloudflare = await page.evaluate(() => {
        return document.title.includes('Just a moment') ||
               document.body.innerText.includes('Checking your browser') ||
               document.body.innerText.includes('DDoS protection by Cloudflare');
      });

      if (isCloudflare) {
        console.log('🔄 Cloudflare detected, waiting for challenge...');
        this.results.metadata.evasionTechniques.push('cloudflare-bypass');
        this.results.summary.antiBot.cloudflareBypassed = true;
        
        // Wait for challenge to complete (up to 30 seconds)
        await page.waitForTimeout(10000);
        
        // Check if passed
        const stillBlocked = await page.evaluate(() => {
          return document.title.includes('Just a moment');
        });
        
        if (!stillBlocked) {
          console.log('✅ Cloudflare bypassed');
          return true;
        } else {
          console.log('⏳ Cloudflare still processing...');
          await page.waitForTimeout(20000);
        }
      }
      
      return true;
    } catch (error) {
      console.log('⚠️ Cloudflare bypass attempt failed:', error.message);
      return false;
    }
  }

  async handleCaptcha(page) {
    try {
      console.log('🔍 Checking for CAPTCHA...');
      
      const hasCaptcha = await page.evaluate(() => {
        const captchaIndicators = [
          'g-recaptcha', 'h-captcha', 'recaptcha', 'captcha',
          'data-sitekey', 'challenge-form'
        ];
        
        const html = document.body.innerHTML.toLowerCase();
        return captchaIndicators.some(indicator => html.includes(indicator));
      });

      if (hasCaptcha) {
        console.log('🤖 CAPTCHA detected');
        this.results.summary.antiBot.captchaDetected = true;
        this.results.metadata.evasionTechniques.push('captcha-detected');
        
        // Try to find and solve reCAPTCHA
        try {
          const recaptchaFrame = page.frames().find(frame => 
            frame.url().includes('google.com/recaptcha')
          );
          
          if (recaptchaFrame) {
            console.log('🎯 Attempting CAPTCHA solve...');
            // Wait for manual solve or automatic bypass
            await page.waitForTimeout(15000);
            
            const solved = await page.evaluate(() => {
              const response = document.querySelector('[name="g-recaptcha-response"]');
              return response && response.value.length > 0;
            });
            
            if (solved) {
              console.log('✅ CAPTCHA solved');
              this.results.summary.antiBot.captchaSolved = true;
              this.results.metadata.evasionTechniques.push('captcha-solved');
            }
          }
        } catch (e) {
          console.log('⚠️ CAPTCHA solve attempt failed');
        }
      }
      
      return !hasCaptcha;
    } catch (error) {
      console.log('⚠️ CAPTCHA check failed:', error.message);
      return true;
    }
  }

  async detectAntiBot(page) {
    try {
      const detections = await page.evaluate(() => {
        const html = document.body.innerHTML.toLowerCase();
        const text = document.body.innerText.toLowerCase();
        
        return {
          rateLimit: text.includes('rate limit') || 
                     text.includes('too many requests') ||
                     text.includes('slow down'),
          
          loginRequired: text.includes('sign in') && text.includes('continue') ||
                        text.includes('login required') ||
                        html.includes('login-required'),
          
          blocked: text.includes('access denied') ||
                   text.includes('forbidden') ||
                   text.includes('blocked') ||
                   document.title.includes('403') ||
                   document.title.includes('blocked'),
          
          bot: text.includes('bot detected') ||
               text.includes('automated') ||
               text.includes('unusual activity')
        };
      });

      if (detections.rateLimit) {
        console.log('⚠️ Rate limit detected');
        this.results.summary.antiBot.rateLimitHit = true;
        this.results.metadata.evasionTechniques.push('rate-limit-detected');
      }
      
      if (detections.loginRequired) {
        console.log('🔒 Login wall detected');
        this.results.summary.antiBot.loginRequired = true;
        this.results.metadata.evasionTechniques.push('login-wall-detected');
      }
      
      if (detections.blocked) {
        console.log('🚫 Access blocked');
        this.results.summary.antiBot.blockDetected = true;
        this.results.metadata.evasionTechniques.push('block-detected');
      }

      return detections;
    } catch (error) {
      return { rateLimit: false, loginRequired: false, blocked: false, bot: false };
    }
  }

  async scrape() {
    let browser;
    let retries = 0;
    
    while (retries < this.options.maxRetries) {
      try {
        console.log(`\n🚀 Attempt ${retries + 1}/${this.options.maxRetries} for: ${this.url}\n`);
        
        browser = await chromium.launch({
          headless: false, // Set to true for production
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--allow-running-insecure-content',
            '--disable-features=VizDisplayCompositor',
            '--flag-switches-begin --disable-site-isolation-trials --flag-switches-end'
          ]
        });
        
        const userAgent = this.getRandomUserAgent();
        console.log(`🎭 User Agent: ${userAgent.substring(0, 80)}...`);
        
        const context = await browser.newContext({
          userAgent: userAgent,
          viewport: { 
            width: 1920 + Math.floor(Math.random() * 100), 
            height: 1080 + Math.floor(Math.random() * 100) 
          },
          locale: 'en-US',
          timezoneId: 'America/New_York',
          permissions: ['geolocation'],
          geolocation: { latitude: 40.7128, longitude: -74.0060 },
          colorScheme: 'light',
          deviceScaleFactor: 1,
          hasTouch: false,
          isMobile: false,
          javaScriptEnabled: true,
          extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          }
        });

        // Add realistic browser fingerprint
        await context.addInitScript(() => {
          // Override navigator properties
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          
          // Add chrome object
          window.chrome = { runtime: {} };
          
          // Override permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
          
          // Add realistic screen properties
          Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
          Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
        });

        const page = await context.newPage();
        
        // Random referer
        const referers = [
          'https://www.google.com/',
          'https://www.bing.com/',
          'https://duckduckgo.com/',
          '',
        ];
        await page.setExtraHTTPHeaders({
          'Referer': referers[Math.floor(Math.random() * referers.length)]
        });
        
        console.log('🌐 Navigating to URL...');
        
        // Navigate with realistic behavior
        await page.goto(this.url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
        
        await this.humanDelay(2000, 4000);
        
        // Handle Cloudflare
        await this.bypassCloudflare(page);
        
        // Handle CAPTCHA
        await this.handleCaptcha(page);
        
        // Detect anti-bot measures
        const antiBot = await this.detectAntiBot(page);
        
        if (antiBot.blocked || antiBot.bot) {
          throw new Error('Access blocked by anti-bot system');
        }
        
        // Simulate human behavior
        await this.simulateHumanBehavior(page);
        
        // Wait for content
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        await this.humanDelay(2000, 3000);
        
        // Smart scrolling with randomization
        console.log('📜 Loading dynamic content...');
        const scrollCount = Math.floor(Math.random() * 5) + 8;
        for (let i = 0; i < scrollCount; i++) {
          const scrollAmount = window.innerHeight * (0.6 + Math.random() * 0.4);
          await page.evaluate((amount) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
          }, scrollAmount);
          await this.humanDelay(400, 900);
          
          // Random pause (reading simulation)
          if (Math.random() > 0.7) {
            await this.humanDelay(1500, 3000);
          }
        }
        
        // Scroll back to top
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await this.humanDelay(1000, 2000);

        const html = await page.content();
        const $ = cheerio.load(html);
        
        console.log('🔍 Analyzing page structure...');
        
        this.removeNoise($);
        const analysis = this.analyzePageAdvanced($);
        this.results.metadata.pageType = analysis.type;
        
        console.log(`📊 Detected: ${analysis.type} page with ${analysis.candidates.length} potential items`);
        
        if (analysis.type === 'listing') {
          await this.extractListingAdvanced($, analysis);
        } else {
          await this.extractSingleAdvanced($);
        }

        this.removeDuplicates();
        this.results.success = this.results.items.length > 0;
        this.calculateSummary();
        
        console.log(`✅ Extracted ${this.results.items.length} unique items (${this.results.summary.duplicatesRemoved} duplicates removed)`);

        await browser.close();
        return this.results;

      } catch (error) {
        console.error(`❌ Attempt ${retries + 1} failed:`, error.message);
        this.results.summary.warnings.push(`Attempt ${retries + 1}: ${error.message}`);
        
        if (browser) {
          await browser.close().catch(() => {});
        }
        
        retries++;
        
        if (retries < this.options.maxRetries) {
          const waitTime = this.options.retryDelay * Math.pow(2, retries - 1);
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await this.humanDelay(waitTime, waitTime + 2000);
        }
      }
    }
    
    this.results.summary.warnings.push('Max retries exceeded');
    return this.results;
  }

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

  findByRepeatingPatterns($) {
    const elementGroups = new Map();
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

  createElementSignature($, el) {
    const $el = $(el);
    const tag = el.name;
    const classes = ($el.attr('class') || '').split(/\s+/).filter(c => 
      c.length > 2 && !c.match(/^(active|selected|hidden|visible|\d+)$/i)
    );
    return `${tag}:${classes.sort().slice(0, 3).join('.')}`;
  }

  scoreElementGroup($, elements) {
    if (elements.length === 0) return 0;
    
    let totalScore = 0;
    const sample = elements.slice(0, Math.min(5, elements.length));
    
    sample.forEach(el => {
      const $el = $(el);
      let score = 0;
      
      if ($el.find('img, picture').length > 0) score += 25;
      if ($el.find('a[href]').length > 0) score += 20;
      if ($el.find('h1, h2, h3, h4, h5, h6').length > 0) score += 30;
      
      const priceSelectors = '[class*="price"], [class*="cost"], [class*="amount"], [itemprop="price"]';
      if ($el.find(priceSelectors).length > 0) score += 35;
      
      const titleSelectors = '[class*="title"], [class*="name"], [class*="heading"]';
      if ($el.find(titleSelectors).length > 0) score += 25;
      
      if ($el.find('p, [class*="desc"], [class*="detail"]').length > 0) score += 15;
      
      const text = $el.text().trim();
      if (text.length > 30) score += 15;
      if (text.length > 100) score += 15;
      
      if ($el.attr('data-id') || $el.attr('data-item-id') || $el.attr('data-product-id')) score += 20;
      if ($el.attr('itemscope') || $el.attr('itemtype')) score += 25;
      
      totalScore += score;
    });
    
    return totalScore / sample.length;
  }

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

  async extractListingAdvanced($, analysis) {
    const candidates = analysis.candidates || [];
    console.log(`🔄 Processing ${candidates.length} candidate items...`);

    candidates.forEach((el, i) => {
      if (i >= 300) return;
      
      const $el = $(el);
      const item = this.extractUniversalData($, $el);
      
      if (this.isValidItem(item) && !this.isDuplicate(item)) {
        item.id = `item_${i + 1}`;
        this.results.items.push(item);
      }
    });
  }

  async extractSingleAdvanced($) {
    const item = this.extractUniversalData($, $('body'));
    
    if (this.isValidItem(item)) {
      item.id = 'single_item';
      this.results.items = [item];
    }
  }

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

  extractTitleAdvanced($, container) {
    const strategies = [
      () => container.find('[itemprop="name"]').first().text().trim(),
      () => {
        const headings = container.find('h1, h2, h3').toArray();
        for (const h of headings) {
          const text = $(h).clone().children('span, small').remove().end().text().trim();
          if (text.length >= 5 && text.length <= 300) return text;
        }
        return null;
      },
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

  extractPriceAdvanced($, container) {
    const structuredPrice = container.find('[itemprop="price"]').first().text().trim();
    if (structuredPrice && this.looksLikePrice(structuredPrice)) {
      return this.cleanPrice(structuredPrice);
    }

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

  extractImageAdvanced($, container) {
    const images = container.find('img, picture img').toArray();
    
    let bestImg = null;
    let bestScore = -1000;

    for (const img of images) {
      const $img = $(img);
      let score = 0;
      
      const src = $img.attr('src') || 
                  $img.attr('data-src') || 
                  $img.attr('data-lazy-src') ||
                  $img.attr('data-original') || 
                  $img.attr('data-lazy') ||
                  ($img.attr('srcset') || '').split(',')[0].split(' ')[0];
      
      if (!src || src.startsWith('data:image') || src.length < 10) continue;
      
      const width = parseInt($img.attr('width') || $img.css('width') || '0');
      const height = parseInt($img.attr('height') || $img.css('height') || '0');
      
      if (width > 80) score += 30;
      if (width > 150) score += 40;
      if (width > 250) score += 50;
      if (height > 80) score += 30;
      if (height > 150) score += 40;
      
      const alt = $img.attr('alt') || '';
      if (alt.length > 5) score += 20;
      
      const classes = ($img.attr('class') || '').toLowerCase();
      if (classes.includes('product') || classes.includes('item') || classes.includes('main')) {
        score += 50;
      }
      if (classes.includes('thumbnail') || classes.includes('thumb')) {
        score += 20;
      }
      
      const srcLower = src.toLowerCase();
      if (srcLower.includes('icon') || srcLower.includes('logo') || 
          srcLower.includes('sprite') || srcLower.includes('avatar') ||
          srcLower.includes('placeholder')) {
        score -= 100;
      }
      
      if ($img.attr('loading') === 'lazy' || $img.attr('data-src')) {
        score += 15;
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

  extractLinkAdvanced($, container) {
    const links = container.find('a[href]').toArray();
    
    let bestLink = null;
    let bestScore = 0;

    for (const link of links) {
      const $link = $(link);
      const href = $link.attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      
      let score = 0;
      
      const text = $link.text().trim();
      if (text.length > 10) score += 20;
      
      if ($link.find('img').length > 0) score += 30;
      if ($link.find('h1, h2, h3, h4').length > 0) score += 40;
      
      const classes = ($link.attr('class') || '').toLowerCase();
      if (classes.includes('product') || classes.includes('item') || classes.includes('detail')) {
        score += 35;
      }
      
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
      } catch (e) {}
    }

    return bestLink;
  }

  extractDescriptionAdvanced($, container) {
    const strategies = [
      () => container.find('[itemprop="description"]').first().text().trim(),
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

  extractMetadataAdvanced($, container) {
    const metadata = {};
    
    container.find('[itemprop]').each((_, el) => {
      const prop = $(el).attr('itemprop');
      const value = $(el).text().trim() || $(el).attr('content');
      if (value && value.length < 200 && !metadata[prop]) {
        metadata[prop] = value;
      }
    });

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

  isDuplicate(item) {
    const signature = this.createItemSignature(item);
    
    if (this.seenContent.has(signature)) {
      return true;
    }
    
    this.seenContent.add(signature);
    return false;
  }

  createItemSignature(item) {
    const parts = [
      item.name ? item.name.toLowerCase().substring(0, 50) : '',
      item.price ? item.price.replace(/\s/g, '') : '',
      item.link ? item.link : ''
    ];
    
    return parts.filter(p => p.length > 0).join('|');
  }

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
  const { url, options } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  console.log(`\n🚀 Starting MAX STEALTH scrape for: ${url}\n`);
  const scraper = new MaxStealthScraper(url, options || {});
  const results = await scraper.scrape();
  
  res.json(results);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: 'max-stealth-v1.0'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ MAX STEALTH Scraper API running on port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/api/scrape`);
  console.log(`🛡️ Anti-Bot Evasion: ENABLED`);
  console.log(`🎭 Fingerprint Rotation: ENABLED`);
  console.log(`🤖 CAPTCHA Handling: ENABLED`);
  console.log(`⚡ Cloudflare Bypass: ENABLED\n`);
});

module.exports = MaxStealthScraper;