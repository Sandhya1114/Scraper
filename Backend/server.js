// OPTIMIZED LinkedIn Profile Scraper - Faster without detection
// Key optimizations:
// 1. Reduced delays to minimum safe values
// 2. Parallel operations where possible
// 3. Smarter waiting strategies
// 4. Optimized scrolling
// 5. Early data extraction

const express = require('express');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const cors = require('cors');
const path = require('path');
require('dotenv').config();

chromium.use(stealth);

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(express.static('public'));

class LinkedInScraper {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isLoggedIn = false;
    this.loginInProgress = false;
  }

  async init() {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      permissions: ['geolocation'],
      geolocation: { latitude: 23.2599, longitude: 77.4126 },
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
      window.chrome = { runtime: {} };
    });

    this.page = await this.context.newPage();
  }

  async login(email, password) {
    try {
      this.loginInProgress = true;
      console.log('🔐 Logging into LinkedIn...');
      
      await this.page.goto('https://www.linkedin.com/login', { 
        waitUntil: 'domcontentloaded', // Faster than networkidle
        timeout: 30000 
      });

      // Reduced delays
      await this.randomDelay(1000, 1500);

      await this.page.fill('#username', email);
      await this.randomDelay(400, 700);

      await this.page.fill('#password', password);
      await this.randomDelay(400, 700);

      await this.page.click('button[type="submit"]');
      
      await this.page.waitForURL('**/feed/**', { timeout: 25000 }).catch(() => {});
      await this.randomDelay(1500, 2000); // Reduced from 3-5s

      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
        this.isLoggedIn = true;
        this.loginInProgress = false;
        console.log('✅ Login successful!');
        return true;
      } else if (currentUrl.includes('/checkpoint/challenge')) {
        console.log('⚠️  Security checkpoint detected - waiting for manual verification...');
        await this.page.waitForURL('**/feed/**', { timeout: 120000 }).catch(() => {});
        this.isLoggedIn = true;
        this.loginInProgress = false;
        console.log('✅ Verification completed!');
        return true;
      } else {
        console.log('❌ Login failed');
        this.loginInProgress = false;
        return false;
      }
    } catch (error) {
      console.error('❌ Login error:', error.message);
      this.loginInProgress = false;
      return false;
    }
  }

  async scrapeProfile(profileUrl) {
    try {
      if (!this.isLoggedIn) {
        throw new Error('Not logged in');
      }

      console.log(`\n🔍 Scraping profile: ${profileUrl}`);
      const startTime = Date.now();
      
      // Use domcontentloaded instead of networkidle for faster loading
      await this.page.goto(profileUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Wait for key element with shorter timeout
      await this.page.waitForSelector('.pv-text-details__left-panel, .ph5', { timeout: 5000 }).catch(() => {});
      await this.randomDelay(1000, 1500); // Reduced initial wait
      
      console.log('📜 Starting optimized scroll and expansion...');
      
      // Run scroll and data extraction in parallel
      await Promise.all([
        this.optimizedScroll(),
        this.waitForDataLoad()
      ]);

      const profileData = await this.page.evaluate(() => {
        const utils = {
          getText: (element) => {
            if (!element) return null;
            const text = (element.innerText || element.textContent || '').trim();
            return text.length > 0 ? text : null;
          },

          trySelectors: (selectors) => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el) {
                const text = utils.getText(el);
                if (text) return text;
              }
            }
            return null;
          },

          getAllText: (selectors) => {
            const texts = new Set();
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                const text = utils.getText(el);
                if (text) texts.add(text);
              });
            }
            return Array.from(texts);
          },

          findSection: (sectionId) => {
            // Direct ID lookup first (fastest)
            let section = document.querySelector(`#${sectionId}`);
            if (section) {
              const containers = [
                section.closest('section')?.querySelector('.pvs-list__outer-container'),
                section.closest('section')?.querySelector('ul.pvs-list'),
                section.parentElement?.querySelector('.pvs-list'),
                section.parentElement?.nextElementSibling?.querySelector('ul'),
                section.closest('section')?.querySelector('ul')
              ];
              
              for (const container of containers) {
                if (container) return container;
              }
            }

            // Fallback: heading text search
            const headings = document.querySelectorAll('h2, h3');
            for (const heading of headings) {
              const text = utils.getText(heading)?.toLowerCase();
              if (text?.includes(sectionId.replace(/_/g, ' '))) {
                const container = heading.closest('section')?.querySelector('ul') || 
                                heading.parentElement?.querySelector('ul');
                if (container) return container;
              }
            }

            return null;
          },

          extractSpanTexts: (container) => {
            if (!container) return [];
            const spans = container.querySelectorAll('span[aria-hidden="true"]');
            return Array.from(spans)
              .map(s => utils.getText(s))
              .filter(t => t && t.length > 0);
          }
        };

        const getName = () => {
          const selectors = [
            'h1.text-heading-xlarge',
            'h1.inline.t-24',
            '.pv-text-details__left-panel h1',
            '.ph5 h1',
            'h1'
          ];
          return utils.trySelectors(selectors);
        };

        const getHeadline = () => {
          const selectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            'div.text-body-medium'
          ];
          const headline = utils.trySelectors(selectors);
          if (headline && headline.length > 10 && !headline.includes('connection')) {
            return headline;
          }
          return null;
        };

        const getLocation = () => {
          const selectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small',
            'span.text-body-small.inline'
          ];
          const texts = utils.getAllText(selectors);
          return texts.find(t => t.includes(',') || t.match(/India|USA|UK|Canada/i)) || 
                 texts.find(t => t.length > 3 && !t.includes('connection')) || null;
        };

        const getAbout = () => {
          const aboutSection = utils.findSection('about');
          if (!aboutSection) return null;

          const textElements = aboutSection.querySelectorAll('span[aria-hidden="true"]');
          for (const el of textElements) {
            const text = utils.getText(el);
            if (text && text.length > 20) return text;
          }
          return null;
        };

        const getProfileImage = () => {
          const selectors = [
            '.pv-top-card-profile-picture__image--show img',
            '.pv-top-card-profile-picture__image',
            'img.pv-top-card-profile-picture__image',
            'button img[class*="profile"]',
            'img[src*="profile-displayphoto"]'
          ];

          for (const selector of selectors) {
            const img = document.querySelector(selector);
            if (img?.src && img.src.includes('http') && !img.src.includes('data:')) {
              return img.src;
            }
          }
          return null;
        };

        const getConnections = () => {
          const texts = utils.getAllText([
            '.pv-top-card--list-bullet li',
            'span.t-bold span',
            '.pv-top-card--list .text-body-small'
          ]);
          return texts.find(t => t.toLowerCase().includes('connection')) || null;
        };

        const getExperience = () => {
          const container = utils.findSection('experience');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          
          return Array.from(items).map((item) => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(s => utils.getText(s)).filter(t => t);
            
            const description = utils.getText(item.querySelector('.inline-show-more-text span[aria-hidden="true"]'));

            let title = boldTexts[0] || spans[0] || null;
            let company = boldTexts[1] || spans[1] || null;
            let duration = spans.find(s => s.match(/\d{4}|yr|mo/i)) || null;
            let location = spans.find(s => s.includes(',') && !s.match(/\d{4}/)) || null;

            return { title, company, duration, location, description };
          })
          .filter(exp => exp.title || exp.company)
          .slice(0, 15);
        };

        const getEducation = () => {
          const container = utils.findSection('education');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          
          return Array.from(items).map((item) => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(s => utils.getText(s)).filter(t => t);

            let school = boldTexts[0] || spans[0] || null;
            let degree = spans.find(s => s.match(/Bachelor|Master|B\.?Tech|M\.?Tech|PhD|Degree|Diploma/i)) || boldTexts[1] || spans[1] || null;
            let field = spans[2] || null;
            let duration = spans.find(s => s.match(/\d{4}|20\d{2}/)) || null;

            return { school, degree, field, duration };
          })
          .filter(edu => edu.school)
          .slice(0, 10);
        };

        const getSkills = () => {
          const container = utils.findSection('skills');
          if (!container) return [];

          const skills = new Set();
          const skillElements = container.querySelectorAll('a[href*="/skills/"], .hoverable-link-text.t-bold');
          
          skillElements.forEach(el => {
            const span = el.querySelector('span[aria-hidden="true"]');
            const skill = utils.getText(span || el);
            if (skill && skill.length > 1 && skill.length < 100 && !skill.match(/\d+ endorsement/i)) {
              skills.add(skill);
            }
          });

          return Array.from(skills).slice(0, 50);
        };

        const getCertifications = () => {
          const container = utils.findSection('licenses_and_certifications');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          
          return Array.from(items).map((item) => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(s => utils.getText(s)).filter(t => t);

            let name = boldTexts[0] || spans[0] || null;
            let issuer = boldTexts[1] || spans[1] || null;
            let date = spans.find(s => s.includes('Issued') || s.match(/\w+ \d{4}/)) || null;
            let credentialId = spans.find(s => s.toLowerCase().includes('credential')) || null;

            return { name, issuer, date, credentialId };
          })
          .filter(cert => cert.name)
          .slice(0, 15);
        };

        const getProjects = () => {
          const container = utils.findSection('projects');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          
          return Array.from(items).map((item) => {
            const spans = utils.extractSpanTexts(item);
            const description = utils.getText(item.querySelector('.inline-show-more-text span[aria-hidden="true"]'));
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(s => utils.getText(s)).filter(t => t);

            let name = boldTexts[0] || spans[0] || null;
            let date = spans.find(s => s.match(/\d{4}/)) || null;
            let association = spans.find(s => s.includes('Associated')) || null;

            return { name, date, association, description };
          })
          .filter(proj => proj.name)
          .slice(0, 10);
        };

        const getLanguages = () => {
          const container = utils.findSection('languages');
          if (!container) return [];

          const languages = [];
          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          
          items.forEach(item => {
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(s => utils.getText(s)).filter(t => t);
            const lang = boldTexts[0];
            if (lang && lang.length > 1 && lang.length < 50 && !lang.includes('follower')) {
              languages.push(lang);
            }
          });

          return languages.slice(0, 10);
        };

        return {
          name: getName(),
          headline: getHeadline(),
          location: getLocation(),
          about: getAbout(),
          profileImage: getProfileImage(),
          connections: getConnections(),
          experience: getExperience(),
          education: getEducation(),
          skills: getSkills(),
          certifications: getCertifications(),
          projects: getProjects(),
          languages: getLanguages()
        };
      });

      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n✅ SCRAPING COMPLETED!');
      console.log('═══════════════════════════════════════');
      console.log(`⏱️  Time taken: ${timeTaken}s`);
      console.log(`📛 Name: ${profileData.name || '❌ NOT FOUND'}`);
      console.log(`💼 Headline: ${profileData.headline || '❌ NOT FOUND'}`);
      console.log(`📍 Location: ${profileData.location || '❌ NOT FOUND'}`);
      console.log(`🖼️  Profile Image: ${profileData.profileImage ? '✅ Found' : '❌ NOT FOUND'}`);
      console.log(`📝 About: ${profileData.about ? '✅ Found (' + profileData.about.length + ' chars)' : '❌ NOT FOUND'}`);
      console.log(`🔗 Connections: ${profileData.connections || '❌ NOT FOUND'}`);
      console.log(`💼 Experience: ${profileData.experience.length} entries`);
      console.log(`🎓 Education: ${profileData.education.length} entries`);
      console.log(`⚡ Skills: ${profileData.skills.length} skills`);
      console.log(`🏆 Certifications: ${profileData.certifications.length} certifications`);
      console.log(`🚀 Projects: ${profileData.projects.length} projects`);
      console.log(`🌐 Languages: ${profileData.languages.length} languages`);
      console.log('═══════════════════════════════════════\n');

      return {
        success: true,
        data: profileData,
        scrapedAt: new Date().toISOString(),
        profileUrl: profileUrl,
        timeTaken: `${timeTaken}s`
      };

    } catch (error) {
      console.error('❌ Scraping error:', error.message);
      return {
        success: false,
        error: error.message,
        profileUrl: profileUrl
      };
    }
  }

  // OPTIMIZED: Faster scrolling with smart waiting
  async optimizedScroll() {
    console.log('📜 Optimized scrolling...');
    
    // Phase 1: Quick initial scroll (4 steps instead of 6)
    for (let i = 0; i < 4; i++) {
      await this.page.evaluate((i) => {
        window.scrollTo({
          top: (i + 1) * (document.body.scrollHeight / 4),
          behavior: 'smooth'
        });
      }, i);
      await this.randomDelay(1200, 1800); // Reduced from 2500-3500ms
    }

    // Phase 2: Expand buttons (single pass, parallel clicks)
    await this.randomDelay(800, 1200);
    
    try {
      const buttons = await this.page.$$('button:has-text("Show all"), button:has-text("show more"), button[aria-label*="Show all"]').catch(() => []);
      console.log(`   Found ${buttons.length} expand buttons`);
      
      // Click up to 5 buttons in parallel (safe limit)
      const clickPromises = buttons.slice(0, 5).map(async (button, i) => {
        try {
          await button.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
          await button.click({ timeout: 2000 });
          console.log(`   ✓ Clicked button ${i + 1}`);
        } catch (e) {
          // Ignore if button not clickable
        }
      });
      
      await Promise.all(clickPromises);
      await this.randomDelay(1500, 2000);
    } catch (e) {
      console.log('   Button expansion skipped');
    }

    // Phase 3: Quick final scroll
    await this.page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await this.randomDelay(1500, 2000);

    console.log('✅ Optimized scrolling completed');
  }

  // NEW: Wait for key data to load without excessive delays
  async waitForDataLoad() {
    await this.randomDelay(1000, 1500);
    
    // Wait for at least one section to be fully loaded
    const sections = ['experience', 'education', 'skills'];
    for (const section of sections) {
      const loaded = await this.page.evaluate((sectionId) => {
        const el = document.querySelector(`#${sectionId}`);
        return el !== null;
      }, section);
      
      if (loaded) {
        break;
      }
      await this.randomDelay(500, 800);
    }
  }

  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      this.loginInProgress = false;
    }
  }
}

let scraper = null;
let loginStatus = {
  isLoggedIn: false,
  loginInProgress: false,
  error: null
};

const startAutoScraper = async () => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    console.log('\n⚠️  Missing credentials in .env file');
    console.log('Please add:\nLINKEDIN_EMAIL=your_email@example.com\nLINKEDIN_PASSWORD=your_password\n');
    loginStatus.error = 'Missing credentials in .env file';
    return;
  }

  console.log('\n🚀 AUTO-LOGIN MODE ENABLED (OPTIMIZED)');
  console.log('📧 Email:', email);
  console.log('🔑 Password: ' + '*'.repeat(password.length) + '\n');

  try {
    loginStatus.loginInProgress = true;
    scraper = new LinkedInScraper();
    await scraper.init();

    console.log('⏳ Logging in...');
    const loginSuccess = await scraper.login(email, password);

    if (loginSuccess) {
      loginStatus.isLoggedIn = true;
      loginStatus.loginInProgress = false;
      loginStatus.error = null;
      console.log('\n✅ AUTO-LOGIN COMPLETED!');
      console.log('🎯 Ready to scrape profiles (FASTER MODE)!');
      console.log('\n📌 Open the UI: http://localhost:3001');
      console.log('📌 Or use API: POST http://localhost:3001/api/scrape-profile\n');
    } else {
      loginStatus.isLoggedIn = false;
      loginStatus.loginInProgress = false;
      loginStatus.error = 'Login failed - check credentials';
      console.log('\n❌ Auto-login failed. Please check credentials.\n');
    }
  } catch (error) {
    loginStatus.isLoggedIn = false;
    loginStatus.loginInProgress = false;
    loginStatus.error = error.message;
    console.error('\n❌ Auto-login error:', error.message);
  }
};

app.post('/api/scrape-profile', async (req, res) => {
  try {
    const { profileUrl } = req.body;

    if (!profileUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Profile URL is required' 
      });
    }

    if (!scraper || !scraper.isLoggedIn) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not logged in - please restart server to auto-login' 
      });
    }

    const result = await scraper.scrapeProfile(profileUrl);
    res.json(result);

  } catch (error) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    loggedIn: scraper ? scraper.isLoggedIn : false,
    loginInProgress: scraper ? scraper.loginInProgress : loginStatus.loginInProgress,
    error: loginStatus.error,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/logout', async (req, res) => {
  try {
    if (scraper) {
      await scraper.close();
      scraper = null;
    }
    loginStatus = {
      isLoggedIn: false,
      loginInProgress: false,
      error: null
    };
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'linkedin-scraper',
    version: '6.0.0-optimized',
    loginStatus: loginStatus
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (scraper) {
    await scraper.close();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ LinkedIn Scraper API running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}\n`);
  startAutoScraper();
});