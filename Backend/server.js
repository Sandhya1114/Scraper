// LinkedIn Profile Scraper - server.js (ADVANCED SELECTORS)
// Install: npm install express playwright-extra puppeteer-extra-plugin-stealth cors dotenv

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
        waitUntil: 'networkidle',
        timeout: 60000 
      });

      await this.randomDelay(2000, 3000);

      await this.page.fill('#username', email);
      await this.randomDelay(800, 1500);

      await this.page.fill('#password', password);
      await this.randomDelay(800, 1500);

      await this.page.click('button[type="submit"]');
      
      await this.page.waitForURL('**/feed/**', { timeout: 30000 }).catch(() => {});
      await this.randomDelay(3000, 5000);

      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
        this.isLoggedIn = true;
        this.loginInProgress = false;
        console.log('✅ Login successful!');
        return true;
      } else if (currentUrl.includes('/checkpoint/challenge')) {
        console.log('⚠️  Security checkpoint detected - waiting for manual verification...');
        console.log('👉 Please complete the verification in the browser window');
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
      
      await this.page.goto(profileUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });

      // Wait for main content
      await this.page.waitForSelector('.pv-text-details__left-panel, .ph5', { timeout: 10000 }).catch(() => {});
      await this.randomDelay(3000, 5000);
      
      // Advanced scrolling with button clicks
      await this.advancedScroll();
      
      await this.randomDelay(2000, 3000);

      const profileData = await this.page.evaluate(() => {
        // ============================================
        // ADVANCED SELECTOR SYSTEM
        // ============================================

        const utils = {
          // Safe text extraction with multiple fallbacks
          getText: (element) => {
            if (!element) return null;
            const text = (element.innerText || element.textContent || '').trim();
            return text.length > 0 ? text : null;
          },

          // Try multiple selectors in order
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

          // Get all matching elements' text
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

          // Find section container by ID
          findSection: (sectionId) => {
            const section = document.querySelector(`#${sectionId}`);
            if (!section) return null;
            
            // Try multiple container patterns
            return section.closest('section')?.querySelector('.pvs-list__outer-container') ||
                   section.parentElement?.querySelector('.pvs-list') ||
                   section.parentElement?.nextElementSibling?.querySelector('ul') ||
                   section.parentElement?.querySelector('ul');
          },

          // Extract all visible text from spans
          extractSpanTexts: (container) => {
            const spans = container.querySelectorAll('span[aria-hidden="true"]');
            return Array.from(spans)
              .map(s => utils.getText(s))
              .filter(t => t && t.length > 0);
          }
        };

        // ============================================
        // NAME EXTRACTION
        // ============================================
        const getName = () => {
          const selectors = [
            'h1.text-heading-xlarge',
            'h1.inline.t-24.v-align-middle.break-words',
            '.pv-text-details__left-panel h1',
            '.ph5.pb5 h1',
            'h1[class*="heading"]',
            'div.ph5 h1'
          ];
          
          let name = utils.trySelectors(selectors);
          if (name) return name;

          // Fallback: Find any h1 that looks like a name
          const h1s = document.querySelectorAll('h1');
          for (const h1 of h1s) {
            const text = utils.getText(h1);
            if (text && text.length > 2 && text.length < 100 && 
                !text.toLowerCase().includes('linkedin') && 
                !text.includes('|')) {
              return text;
            }
          }

          // Last resort: meta tag
          const metaTitle = document.querySelector('meta[property="og:title"]');
          if (metaTitle?.content) {
            return metaTitle.content.split('|')[0].split('-')[0].trim();
          }

          return null;
        };

        // ============================================
        // HEADLINE EXTRACTION
        // ============================================
        const getHeadline = () => {
          const selectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            'div.text-body-medium',
            '.pv-top-card--list .text-body-medium',
            '[class*="headline"]',
            '.pv-top-card-v2-section__info h2 + div'
          ];
          
          const headline = utils.trySelectors(selectors);
          
          // Filter out if it looks like a location or connections
          if (headline && headline.length > 10 && 
              !headline.includes('connection') && 
              !headline.match(/^\d+\s*connection/i)) {
            return headline;
          }

          return null;
        };

        // ============================================
        // LOCATION EXTRACTION
        // ============================================
        const getLocation = () => {
          const selectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small',
            'span.text-body-small.inline',
            '.pv-top-card--list .text-body-small'
          ];
          
          const texts = utils.getAllText(selectors);
          
          // Find text that looks like a location (has comma or country names)
          for (const text of texts) {
            if (text.includes(',') || text.match(/India|USA|UK|Canada|Australia/i)) {
              return text;
            }
          }

          return texts.find(t => t.length > 3 && !t.includes('connection')) || null;
        };

        // ============================================
        // ABOUT SECTION EXTRACTION
        // ============================================
        const getAbout = () => {
          const aboutSection = utils.findSection('about');
          if (!aboutSection) return null;

          // Try multiple approaches
          const selectors = [
            'span[aria-hidden="true"]',
            '.inline-show-more-text span[aria-hidden="true"]',
            '.display-flex.ph5.pv3 span',
            '.pvs-list__outer-container span'
          ];

          for (const selector of selectors) {
            const span = aboutSection.querySelector(selector);
            const text = utils.getText(span);
            if (text && text.length > 20) return text;
          }

          // Get all text from about section
          const allText = utils.getText(aboutSection);
          if (allText && allText.length > 20) return allText;

          return null;
        };

        // ============================================
        // PROFILE IMAGE EXTRACTION
        // ============================================
        const getProfileImage = () => {
          const selectors = [
            '.pv-top-card-profile-picture__image',
            'img[data-ghost-classes]',
            '.pv-top-card__photo img',
            'img.evi-image',
            'img[class*="profile"]'
          ];

          for (const selector of selectors) {
            const img = document.querySelector(selector);
            if (img?.src && !img.src.includes('data:image')) {
              return img.src;
            }
          }

          return null;
        };

        // ============================================
        // CONNECTIONS EXTRACTION
        // ============================================
        const getConnections = () => {
          const selectors = [
            '.pv-top-card--list-bullet li',
            '.pvs-header__subtitle',
            'span.t-bold span',
            '.pv-top-card--list .text-body-small'
          ];

          const texts = utils.getAllText(selectors);
          const connectionText = texts.find(t => t.toLowerCase().includes('connection'));
          
          return connectionText || null;
        };

        // ============================================
        // EXPERIENCE SECTION EXTRACTION
        // ============================================
        const getExperience = () => {
          const container = utils.findSection('experience');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li[class*="artdeco-list__item"]');
          
          return Array.from(items).map(item => {
            const texts = utils.extractSpanTexts(item);
            const description = utils.getText(item.querySelector('.inline-show-more-text span[aria-hidden="true"]'));

            // Smart parsing based on text patterns
            let title = null, company = null, duration = null, location = null;

            for (let i = 0; i < texts.length; i++) {
              const text = texts[i];
              
              // Title is usually first and bold
              if (!title && text.length > 2 && text.length < 150) {
                title = text;
              }
              // Company name usually contains company indicators
              else if (!company && (text.includes('·') || text.includes('•') || i === 1)) {
                company = text.replace(/[·•]/g, '').trim();
              }
              // Duration contains date patterns
              else if (!duration && text.match(/\d{4}|\d+\s*(yr|mo|year|month)/i)) {
                duration = text;
              }
              // Location usually has comma or city names
              else if (!location && (text.includes(',') || text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/))) {
                location = text;
              }
            }

            return {
              title: title,
              company: company,
              duration: duration,
              location: location,
              description: description,
              rawTexts: texts
            };
          })
          .filter(exp => exp.title || exp.company)
          .slice(0, 15);
        };

        // ============================================
        // EDUCATION SECTION EXTRACTION
        // ============================================
        const getEducation = () => {
          const container = utils.findSection('education');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li[class*="artdeco-list__item"]');
          
          return Array.from(items).map(item => {
            const texts = utils.extractSpanTexts(item);

            let school = null, degree = null, field = null, duration = null;

            for (let i = 0; i < texts.length; i++) {
              const text = texts[i];
              
              if (!school && i === 0) {
                school = text;
              }
              else if (!degree && (text.includes('Bachelor') || text.includes('Master') || text.includes('PhD') || i === 1)) {
                degree = text;
              }
              else if (!field && !text.match(/\d{4}/) && i === 2) {
                field = text;
              }
              else if (!duration && text.match(/\d{4}/)) {
                duration = text;
              }
            }

            return {
              school: school,
              degree: degree,
              field: field,
              duration: duration,
              rawTexts: texts
            };
          })
          .filter(edu => edu.school)
          .slice(0, 10);
        };

        // ============================================
        // SKILLS SECTION EXTRACTION
        // ============================================
        const getSkills = () => {
          const container = utils.findSection('skills');
          if (!container) return [];

          const selectors = [
            '.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
            '.hoverable-link-text span[aria-hidden="true"]',
            'a[href*="/skills/"] span[aria-hidden="true"]',
            '.pvs-list__item--one-column span.t-bold'
          ];

          const skills = new Set();
          
          for (const selector of selectors) {
            const elements = container.querySelectorAll(selector);
            elements.forEach(el => {
              const skill = utils.getText(el);
              if (skill && skill.length > 1 && skill.length < 100) {
                skills.add(skill);
              }
            });
          }

          return Array.from(skills).slice(0, 50);
        };

        // ============================================
        // CERTIFICATIONS SECTION EXTRACTION
        // ============================================
        const getCertifications = () => {
          const container = utils.findSection('licenses_and_certifications');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li[class*="artdeco-list__item"]');
          
          return Array.from(items).map(item => {
            const texts = utils.extractSpanTexts(item);

            return {
              name: texts[0] || null,
              issuer: texts[1] || null,
              date: texts[2] || null,
              credentialId: texts.find(t => t.toLowerCase().includes('credential')) || null,
              rawTexts: texts
            };
          })
          .filter(cert => cert.name)
          .slice(0, 15);
        };

        // ============================================
        // PROJECTS SECTION EXTRACTION
        // ============================================
        const getProjects = () => {
          const container = utils.findSection('projects');
          if (!container) return [];

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li[class*="artdeco-list__item"]');
          
          return Array.from(items).map(item => {
            const texts = utils.extractSpanTexts(item);
            const description = utils.getText(item.querySelector('.inline-show-more-text span[aria-hidden="true"]'));

            return {
              name: texts[0] || null,
              date: texts.find(t => t.match(/\d{4}/)) || null,
              description: description,
              rawTexts: texts
            };
          })
          .filter(proj => proj.name)
          .slice(0, 10);
        };

        // ============================================
        // LANGUAGES SECTION EXTRACTION
        // ============================================
        const getLanguages = () => {
          const container = utils.findSection('languages');
          if (!container) return [];

          const texts = utils.extractSpanTexts(container);
          return texts.filter(t => t.length > 1 && t.length < 50).slice(0, 10);
        };

        // ============================================
        // RETURN ALL DATA
        // ============================================
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

      // Enhanced logging
      console.log('\n✅ SCRAPING COMPLETED!');
      console.log('═══════════════════════════════════════');
      console.log(`📛 Name: ${profileData.name || '❌ NOT FOUND'}`);
      console.log(`💼 Headline: ${profileData.headline || '❌ NOT FOUND'}`);
      console.log(`📍 Location: ${profileData.location || '❌ NOT FOUND'}`);
      console.log(`📝 About: ${profileData.about ? '✅ Found (' + profileData.about.length + ' chars)' : '❌ NOT FOUND'}`);
      console.log(`🔗 Connections: ${profileData.connections || '❌ NOT FOUND'}`);
      console.log(`💼 Experience: ${profileData.experience.length} entries`);
      console.log(`🎓 Education: ${profileData.education.length} entries`);
      console.log(`⚡ Skills: ${profileData.skills.length} skills`);
      console.log(`🏆 Certifications: ${profileData.certifications.length} certifications`);
      console.log(`🚀 Projects: ${profileData.projects.length} projects`);
      console.log(`🌐 Languages: ${profileData.languages.length} languages`);
      console.log('═══════════════════════════════════════\n');

      // Log sample data for debugging
      if (profileData.experience.length > 0) {
        console.log('📊 First Experience Entry:');
        console.log('   Title:', profileData.experience[0].title);
        console.log('   Company:', profileData.experience[0].company);
        console.log('   Raw texts:', profileData.experience[0].rawTexts);
      }

      if (profileData.education.length > 0) {
        console.log('\n📊 First Education Entry:');
        console.log('   School:', profileData.education[0].school);
        console.log('   Degree:', profileData.education[0].degree);
        console.log('   Raw texts:', profileData.education[0].rawTexts);
      }

      return {
        success: true,
        data: profileData,
        scrapedAt: new Date().toISOString(),
        profileUrl: profileUrl
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

  async advancedScroll() {
    console.log('📜 Advanced scrolling initiated...');
    
    // Phase 1: Initial slow scroll to trigger lazy loading
    for (let i = 0; i < 5; i++) {
      await this.page.evaluate((i) => {
        window.scrollTo({
          top: (i + 1) * (document.body.scrollHeight / 5),
          behavior: 'smooth'
        });
      }, i);
      await this.randomDelay(2000, 3000);
    }

    // Phase 2: Click "Show all" buttons
    await this.randomDelay(1000, 2000);
    const showButtons = await this.page.$$('button[aria-expanded="false"], button:has-text("Show all"), button:has-text("show more")').catch(() => []);
    console.log(`   Found ${showButtons.length} expandable buttons`);
    
    for (let i = 0; i < Math.min(showButtons.length, 10); i++) {
      try {
        await showButtons[i].click({ timeout: 3000 });
        await this.randomDelay(1500, 2500);
      } catch (e) {
        // Button not clickable or already expanded
      }
    }

    // Phase 3: Scroll to bottom
    await this.page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await this.randomDelay(2000, 3000);

    // Phase 4: Scroll back to top
    await this.page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await this.randomDelay(2000, 3000);

    // Phase 5: One more pass through sections
    const sections = ['experience', 'education', 'skills', 'licenses_and_certifications'];
    for (const section of sections) {
      try {
        await this.page.evaluate((sectionId) => {
          const el = document.querySelector(`#${sectionId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, section);
        await this.randomDelay(1500, 2000);
      } catch (e) {
        // Section not found
      }
    }

    console.log('✅ Advanced scrolling completed');
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

  console.log('\n🚀 AUTO-LOGIN MODE ENABLED');
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
      console.log('🎯 Ready to scrape profiles!');
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

// API Endpoints
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
    version: '3.0.0-advanced',
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