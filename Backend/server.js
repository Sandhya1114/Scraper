// server.js - Enhanced Anti-Detection for 24+ Hour Operation
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Use stealth plugin with all evasions
puppeteer.use(StealthPlugin());

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Storage
const scrapedData = new Map();
const requestLog = new Map(); // Track requests per IP/session
const sessionCookies = new Map(); // Store cookies per session
const COOKIES_DIR = path.join(__dirname, 'cookies');

// Ensure cookies directory exists
(async () => {
  try {
    await fs.mkdir(COOKIES_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create cookies directory:', err);
  }
})();

// Extensive user agent pool (desktop browsers only)
const userAgents = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
  
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

// Screen resolutions pool (common desktop resolutions)
const screenResolutions = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1440 },
  { width: 1920, height: 1200 }
];

// Language preferences
const languages = [
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['en-CA', 'en'],
  ['en-AU', 'en']
];

// Generate session ID for cookie persistence
const generateSessionId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Save cookies to file
const saveCookies = async (sessionId, cookies) => {
  try {
    const cookiePath = path.join(COOKIES_DIR, `${sessionId}.json`);
    await fs.writeFile(cookiePath, JSON.stringify(cookies, null, 2));
    sessionCookies.set(sessionId, cookies);
  } catch (err) {
    console.error('Failed to save cookies:', err);
  }
};

// Load cookies from file
const loadCookies = async (sessionId) => {
  try {
    const cookiePath = path.join(COOKIES_DIR, `${sessionId}.json`);
    const data = await fs.readFile(cookiePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
};

// Random delay with human-like variance
const randomDelay = (min, max) => {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
};

// Simulate human-like mouse movements
const simulateHumanBehavior = async (page) => {
  try {
    // Random mouse movements
    const moves = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < moves; i++) {
      const x = Math.floor(Math.random() * 1000);
      const y = Math.floor(Math.random() * 800);
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 20) + 10 });
      await randomDelay(100, 500);
    }
    
    // Human-like scrolling with pauses
    await page.evaluate(async () => {
      const distance = 150;
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, distance);
        await delay(Math.random() * 500 + 300);
        
        // Sometimes scroll back up a bit
        if (Math.random() > 0.7) {
          window.scrollBy(0, -50);
          await delay(200);
        }
      }
      
      // Scroll to bottom gradually
      const scrollHeight = document.body.scrollHeight;
      let currentPosition = window.pageYOffset;
      
      while (currentPosition < scrollHeight - window.innerHeight) {
        const scrollAmount = Math.floor(Math.random() * 200) + 100;
        window.scrollBy(0, scrollAmount);
        currentPosition += scrollAmount;
        await delay(Math.random() * 400 + 200);
      }
      
      // Scroll back to top
      await delay(500);
      window.scrollTo(0, 0);
    });
    
    await randomDelay(1000, 2000);
  } catch (err) {
    console.error('Human behavior simulation error:', err);
  }
};

// Advanced rate limiting with adaptive delays
const canMakeRequest = (identifier) => {
  const now = Date.now();
  const requestHistory = requestLog.get(identifier) || [];
  
  // Clean old requests (older than 1 hour)
  const recentRequests = requestHistory.filter(time => now - time < 3600000);
  
  // Adaptive rate limiting based on request frequency
  if (recentRequests.length === 0) {
    requestLog.set(identifier, [now]);
    return { allowed: true, delay: 0 };
  }
  
  const lastRequest = recentRequests[recentRequests.length - 1];
  const timeSinceLastRequest = now - lastRequest;
  
  // Base delay: 45 seconds minimum between requests
  const baseDelay = 45000;
  
  // Increase delay if making many requests
  if (recentRequests.length > 10) {
    return { allowed: false, delay: 120000, message: 'Too many requests. Please wait 2 minutes.' };
  } else if (recentRequests.length > 5) {
    if (timeSinceLastRequest < 90000) {
      return { allowed: false, delay: 90000 - timeSinceLastRequest, message: 'Rate limit: Please wait 90 seconds between requests.' };
    }
  } else if (timeSinceLastRequest < baseDelay) {
    return { allowed: false, delay: baseDelay - timeSinceLastRequest, message: 'Rate limit: Please wait 45 seconds between requests.' };
  }
  
  recentRequests.push(now);
  requestLog.set(identifier, recentRequests);
  return { allowed: true, delay: 0 };
};

// Main scraper function with maximum stealth
async function scrapeLinkedInProfile(profileUrl, sessionId = null) {
  let browser;
  const currentSessionId = sessionId || generateSessionId();
  
  try {
    // Check rate limiting
    const domain = new URL(profileUrl).hostname;
    const rateLimitCheck = canMakeRequest(domain);
    
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: rateLimitCheck.message,
        retryAfter: Math.ceil(rateLimitCheck.delay / 1000)
      };
    }

    // Randomize configuration for each request
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const randomResolution = screenResolutions[Math.floor(Math.random() * screenResolutions.length)];
    const randomLanguage = languages[Math.floor(Math.random() * languages.length)];
    
    console.log(`\n🔍 Scraping with session: ${currentSessionId}`);
    console.log(`📱 User Agent: ${randomUserAgent.substring(0, 50)}...`);
    console.log(`🖥️  Resolution: ${randomResolution.width}x${randomResolution.height}`);

    // Launch browser with maximum stealth
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking',
        `--window-size=${randomResolution.width},${randomResolution.height}`,
        `--user-agent=${randomUserAgent}`,
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync'
      ],
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(profileUrl, ['geolocation', 'notifications']);
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: randomResolution.width,
      height: randomResolution.height,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });
    
    // Set user agent
    await page.setUserAgent(randomUserAgent);
    
    // Load cookies from previous session if available
    const savedCookies = await loadCookies(currentSessionId);
    if (savedCookies && savedCookies.length > 0) {
      await page.setCookie(...savedCookies);
      console.log('🍪 Loaded cookies from previous session');
    }
    
    // Set comprehensive headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': randomLanguage.join(','),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'DNT': '1',
      'sec-ch-ua': '"Chromium";v="121", "Not A(Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });

    // Maximum evasions - override all detection methods
    await page.evaluateOnNewDocument(() => {
      // Override webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          }
        ]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Override Chrome property
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Override hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      });

      // Override device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      });

      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
      });

      // Override vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.'
      });

      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        get: () => () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1
        })
      });

      // Override connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false
        })
      });

      // Override screen properties
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24
      });

      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24
      });

      // Remove automation indicators
      delete navigator.__proto__.webdriver;

      // Override toString to hide proxy
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === navigator.permissions.query) {
          return 'function query() { [native code] }';
        }
        return originalToString.apply(this, arguments);
      };

      // Add realistic WebGL fingerprint
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, arguments);
      };
    });

    // Random initial delay (3-7 seconds)
    await randomDelay(3000, 7000);
    
    console.log('🌐 Navigating to profile...');
    
    // Navigate with realistic behavior
    await page.goto(profileUrl, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait after page load (2-5 seconds)
    await randomDelay(2000, 5000);
    
    // Check for blocking
    const pageContent = await page.content();
    if (pageContent.includes('authwall') || 
        pageContent.includes('checkpoint') || 
        pageContent.includes('challenge') ||
        pageContent.includes('captcha')) {
      throw new Error('LinkedIn access restricted. Try again later or the profile may not be public.');
    }
    
    // Simulate human behavior
    console.log('🖱️  Simulating human behavior...');
    await simulateHumanBehavior(page);
    
    // Random delay before extraction (2-4 seconds)
    await randomDelay(2000, 4000);
    
    console.log('📊 Extracting profile data...');
    
    // Extract profile data with enhanced selectors
    const profileData = await page.evaluate(() => {
      const data = {
        name: '',
        headline: '',
        location: '',
        about: '',
        experience: [],
        education: [],
        skills: [],
        connections: '',
        profileUrl: window.location.href,
        scrapedAt: new Date().toISOString()
      };
      
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.innerText.trim() : '';
      };

      const getElements = (selector) => {
        return Array.from(document.querySelectorAll(selector));
      };
      
      // Extract name
      data.name = getText('h1.text-heading-xlarge') || 
                  getText('h1.top-card-layout__title') ||
                  getText('.pv-top-card--list li:first-child') ||
                  getText('h1');
      
      // Extract headline
      data.headline = getText('.text-body-medium.break-words') || 
                     getText('.top-card-layout__headline') ||
                     getText('.pv-top-card-section__headline');
      
      // Extract location
      data.location = getText('.text-body-small.inline.t-black--light.break-words') ||
                     getText('.top-card-layout__second-subline') ||
                     getText('.pv-top-card--list-bullet li');
      
      // Extract connections
      data.connections = getText('.dist-value') || getText('.top-card__connections-count') || '';
      
      // Extract about
      const aboutSelectors = [
        '#about ~ .display-flex.ph5.pv3 .inline-show-more-text',
        '.core-section-container__content .inline-show-more-text',
        '.pv-about-section .pv-about__summary-text',
        '[data-section="summary"] .section-info',
        '.about-section .pv-about__summary-text'
      ];
      
      for (const selector of aboutSelectors) {
        const aboutText = getText(selector);
        if (aboutText) {
          data.about = aboutText;
          break;
        }
      }
      
      // Extract experience
      const experienceItems = getElements('#experience ~ .pvs-list__outer-container li.artdeco-list__item');
      experienceItems.forEach(item => {
        const titleEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const companyEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
        const durationEls = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
        
        if (titleEl && titleEl.innerText.trim()) {
          data.experience.push({
            title: titleEl.innerText.trim(),
            company: companyEl ? companyEl.innerText.trim() : '',
            duration: durationEls[0] ? durationEls[0].innerText.trim() : '',
            location: durationEls[1] ? durationEls[1].innerText.trim() : ''
          });
        }
      });
      
      // Extract education
      const educationItems = getElements('#education ~ .pvs-list__outer-container li.artdeco-list__item');
      educationItems.forEach(item => {
        const schoolEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const degreeEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
        const yearEls = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
        
        if (schoolEl && schoolEl.innerText.trim()) {
          data.education.push({
            school: schoolEl.innerText.trim(),
            degree: degreeEl ? degreeEl.innerText.trim() : '',
            year: yearEls[0] ? yearEls[0].innerText.trim() : ''
          });
        }
      });
      
      // Extract skills
      const skillElements = getElements('#skills ~ .pvs-list__outer-container li .t-bold span[aria-hidden="true"]');
      skillElements.forEach(el => {
        const skill = el.innerText.trim();
        if (skill && !data.skills.includes(skill)) {
          data.skills.push(skill);
        }
      });
      
      return data;
    });
    
    // Save cookies for future requests
    const cookies = await page.cookies();
    await saveCookies(currentSessionId, cookies);
    
    // Random delay before closing (2-4 seconds)
    await randomDelay(2000, 4000);
    
    await browser.close();
    
    if (!profileData.name || profileData.name.length === 0) {
      return {
        success: false,
        error: 'Could not extract profile data. The profile may not be public.',
        sessionId: currentSessionId
      };
    }
    
    console.log(`✅ Successfully scraped: ${profileData.name}`);
    return { 
      success: true, 
      data: { ...profileData, sessionId: currentSessionId }
    };
    
  } catch (error) {
    if (browser) await browser.close();
    console.error('❌ Scraping error:', error.message);
    return { 
      success: false, 
      error: error.message,
      sessionId: currentSessionId,
      message: 'Failed to scrape profile. Please try again.'
    };
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date(),
    totalProfiles: scrapedData.size,
    stealthMode: 'maximum',
    activeSessions: sessionCookies.size
  });
});

app.post('/api/scrape', async (req, res) => {
  const { profileUrl, sessionId } = req.body;
  
  if (!profileUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'Profile URL is required' 
    });
  }
  
  const linkedInPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;
  if (!linkedInPattern.test(profileUrl)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid LinkedIn profile URL. Format: https://linkedin.com/in/username' 
    });
  }
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 New scrape request: ${profileUrl}`);
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    
    const result = await scrapeLinkedInProfile(profileUrl, sessionId);
    
    if (result.success) {
      const id = Date.now().toString();
      scrapedData.set(id, result.data);
      
      console.log(`✅ Success! Profile stored with ID: ${id}`);
      console.log(`${'='.repeat(60)}\n`);
      
      res.json({ 
        success: true, 
        data: result.data,
        id: id,
        message: 'Profile scraped successfully with maximum stealth'
      });
    } else {
      console.log(`❌ Failed: ${result.error}`);
      console.log(`${'='.repeat(60)}\n`);
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

app.get('/api/profiles', (req, res) => {
  const profiles = Array.from(scrapedData.entries()).map(([id, data]) => ({
    id,
    ...data
  }));
  
  res.json({ 
    success: true, 
    count: profiles.length,
    profiles 
  });
});

app.get('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  const profile = scrapedData.get(id);
  
  if (profile) {
    res.json({ success: true, profile });
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'Profile not found' 
    });
  }
});

app.delete('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  const deleted = scrapedData.delete(id);
  
  if (deleted) {
    res.json({ 
      success: true, 
      message: 'Profile deleted successfully' 
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'Profile not found' 
    });
  }
});

app.get('/api/export/:id', (req, res) => {
  const { id } = req.params;
  const profile = scrapedData.get(id);
  
  if (profile) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="linkedin-profile-${id}.json"`);
    res.json(profile);
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'Profile not found' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 LinkedIn Scraper - MAXIMUM STEALTH MODE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🛡️  Anti-Detection: MAXIMUM (24hr+ operation capable)`);
  console.log(`🔒 Features:`);
  console.log(`   ✓ User agent rotation (14 agents)`);
  console.log(`   ✓ Screen resolution randomization`);
  console.log(`   ✓ Human behavior simulation`);
  console.log(`   ✓ Cookie persistence across sessions`);
  console.log(`   ✓ Adaptive rate limiting (45-90s delays)`);
  console.log(`   ✓ WebGL/Canvas fingerprint spoofing`);
  console.log(`   ✓ Advanced header manipulation`);
  console.log(`   ✓ Mouse movement & scroll simulation`);
  console.log(`${'='.repeat(70)}\n`);
});