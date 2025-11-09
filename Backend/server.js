// STABLE ULTRA-FAST LinkedIn Scraper - No execution context errors
// Uses tab management to avoid navigation conflicts

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
    this.loginPage = null; // Keep login page separate
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

    // Block heavy resources
    await this.context.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      
      if (['image', 'media', 'font'].includes(resourceType) ||
          url.includes('analytics') ||
          url.includes('tracking')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
      window.chrome = { runtime: {} };
    });

    this.loginPage = await this.context.newPage();
  }

  async login(email, password) {
    try {
      this.loginInProgress = true;
      console.log('🔐 Logging into LinkedIn...');
      
      await this.loginPage.goto('https://www.linkedin.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      await this.loginPage.fill('#username', email);
      await this.loginPage.fill('#password', password);
      await this.loginPage.click('button[type="submit"]');
      
      await this.loginPage.waitForURL('**/feed/**', { timeout: 25000 }).catch(() => {});
      await this.delay(500);

      const currentUrl = this.loginPage.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
        this.isLoggedIn = true;
        this.loginInProgress = false;
        console.log('✅ Login successful!');
        return true;
      } else if (currentUrl.includes('/checkpoint/challenge')) {
        console.log('⚠️  Security checkpoint detected - waiting for manual verification...');
        await this.loginPage.waitForURL('**/feed/**', { timeout: 120000 }).catch(() => {});
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
    const startTime = Date.now();
    const timings = {};
    let scrapePage = null;
    
    try {
      if (!this.isLoggedIn) {
        throw new Error('Not logged in');
      }

      console.log(`\n⚡ ULTRA-FAST SCRAPING: ${profileUrl}`);
      
      // Create NEW page for each scrape (avoids context destruction)
      const pageStart = Date.now();
      scrapePage = await this.context.newPage();
      timings.pageCreation = Date.now() - pageStart;
      
      // FAST NAVIGATION
      const navStart = Date.now();
      await scrapePage.goto(profileUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      });
      timings.navigation = Date.now() - navStart;

      // Minimal wait
      await this.delay(300);
      timings.domWait = 300;
      
      // Fast scroll
      const scrollStart = Date.now();
      await scrapePage.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        window.scrollTo(0, document.body.scrollHeight * 0.4);
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.delay(300);
      timings.scroll = Date.now() - scrollStart;
      
      // Extract data
      const extractStart = Date.now();
      const profileData = await scrapePage.evaluate(() => {
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

          extractSpanTexts: (container) => {
            if (!container) return [];
            const spans = container.querySelectorAll('span[aria-hidden="true"]');
            return Array.from(spans)
              .map(s => utils.getText(s))
              .filter(t => t && t.length > 0);
          }
        };

        const findSection = (sectionName) => {
          let section = document.getElementById(sectionName);
          if (section?.tagName === 'SECTION') {
            const list = section.querySelector('ul');
            if (list) return list;
          }

          const idDiv = document.getElementById(sectionName);
          if (idDiv) {
            const parentSection = idDiv.closest('section');
            if (parentSection) {
              const list = parentSection.querySelector('ul');
              if (list) return list;
            }
          }

          const sections = Array.from(document.querySelectorAll('section')).slice(0, 15);
          const searchTerm = sectionName.toLowerCase().replace('_', ' ');
          
          for (const sec of sections) {
            const h2 = sec.querySelector('h2');
            const h2Text = utils.getText(h2)?.toLowerCase() || '';
            
            if (h2Text.includes(searchTerm)) {
              const list = sec.querySelector('ul');
              if (list) return list;
            }
          }

          return null;
        };

        const getName = () => utils.trySelectors(['h1.text-heading-xlarge', 'h1']);
        
        const getHeadline = () => {
          const headline = utils.trySelectors(['.text-body-medium.break-words', 'div.text-body-medium']);
          return (headline && headline.length > 10 && !headline.includes('connection')) ? headline : null;
        };
        
        const getLocation = () => {
          const texts = utils.getAllText(['.text-body-small.inline.t-black--light.break-words', 'span.text-body-small.inline']);
          return texts.find(t => t.includes(',') || t.match(/India|USA|UK|Canada/i)) || texts[0] || null;
        };
        
        const getAbout = () => {
          const aboutList = findSection('about');
          if (!aboutList) return null;
          
          const textElements = aboutList.querySelectorAll('span[aria-hidden="true"]');
          for (const el of textElements) {
            const text = utils.getText(el);
            if (text && text.length > 20) return text;
          }
          return null;
        };
        
        const getProfileImage = () => {
          const img = document.querySelector('img.pv-top-card-profile-picture__image, img[src*="profile-displayphoto"]');
          return (img?.src && img.src.includes('http') && !img.src.includes('data:')) ? img.src : null;
        };
        
        const getConnections = () => {
          const texts = utils.getAllText(['.pv-top-card--list-bullet li', 'span.t-bold span']);
          return texts.find(t => t.toLowerCase().includes('connection')) || null;
        };

        const getExperience = () => {
          const list = findSection('experience');
          if (!list) return [];

          const items = list.querySelectorAll(':scope > li');
          return Array.from(items).slice(0, 10).map(item => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(e => utils.getText(e)).filter(Boolean);
            
            return {
              title: boldTexts[0] || spans[0] || null,
              company: boldTexts[1] || spans.find(s => s !== boldTexts[0] && !s.match(/\d{4}/)) || null,
              duration: spans.find(s => s.match(/\d{4}|present|yr|mo/i)) || null,
              location: spans.find(s => s.includes(',') && !s.match(/\d{4}/)) || null,
            };
          }).filter(exp => exp.title);
        };

        const getEducation = () => {
          const list = findSection('education');
          if (!list) return [];

          const items = list.querySelectorAll(':scope > li');
          return Array.from(items).slice(0, 8).map(item => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(e => utils.getText(e)).filter(Boolean);
            
            return {
              school: boldTexts[0] || spans[0] || null,
              degree: spans.find(s => s.match(/Bachelor|Master|B\.?Tech|M\.?Tech|PhD|Degree|Diploma/i)) || boldTexts[1] || null,
              field: spans.find(s => s !== boldTexts[0] && !s.match(/\d{4}/) && s.length > 3) || null,
              duration: spans.find(s => s.match(/\d{4}/)) || null
            };
          }).filter(edu => edu.school);
        };

        const getSkills = () => {
          const list = findSection('skills');
          if (!list) return [];

          const skills = new Set();
          const skillLinks = list.querySelectorAll('a[href*="/skills/"]');
          
          skillLinks.forEach(link => {
            const fullText = utils.getText(link);
            if (fullText) {
              const skillName = fullText.split('\n')[0].trim();
              if (skillName && skillName.length > 1 && skillName.length < 100) {
                skills.add(skillName);
              }
            }
          });

          return Array.from(skills).slice(0, 40);
        };

        const getCertifications = () => {
          const list = findSection('licenses_and_certifications');
          if (!list) return [];

          const items = list.querySelectorAll(':scope > li');
          return Array.from(items).slice(0, 8).map(item => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(e => utils.getText(e)).filter(Boolean);

            return {
              name: boldTexts[0] || spans[0] || null,
              issuer: boldTexts[1] || spans.find(s => s !== boldTexts[0]) || null,
              date: spans.find(s => s.match(/\w+\s+\d{4}/)) || null
            };
          }).filter(cert => cert.name);
        };

        const getProjects = () => {
          const list = findSection('projects');
          if (!list) return [];

          const items = list.querySelectorAll(':scope > li');
          return Array.from(items).slice(0, 8).map(item => {
            const spans = utils.extractSpanTexts(item);
            const boldTexts = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]'))
              .map(e => utils.getText(e)).filter(Boolean);

            return {
              name: boldTexts[0] || spans[0] || null,
              date: spans.find(s => s.match(/\d{4}/)) || null
            };
          }).filter(proj => proj.name);
        };

        const getLanguages = () => {
          const list = findSection('languages');
          if (!list) return [];

          const languages = [];
          const items = list.querySelectorAll(':scope > li');
          
          items.forEach(item => {
            const boldElement = item.querySelector('.t-bold span[aria-hidden="true"]');
            const lang = utils.getText(boldElement);
            if (lang && lang.length > 1 && lang.length < 30) {
              languages.push(lang);
            }
          });

          return languages.slice(0, 8);
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
      timings.extraction = Date.now() - extractStart;

      // Close the scrape page
      await scrapePage.close().catch(() => {});
      timings.cleanup = 50;

      const timeTaken = Date.now() - startTime;
      const timeSeconds = (timeTaken / 1000).toFixed(3);
      
      console.log('\n⚡ SCRAPING COMPLETED!');
      console.log('═══════════════════════════════════════');
      console.log(`⏱️  Total Time: ${timeTaken}ms (${timeSeconds}s)`);
      console.log(`📊 Performance Breakdown:`);
      console.log(`   🆕 Page Creation: ${timings.pageCreation}ms`);
      console.log(`   🚀 Navigation: ${timings.navigation}ms`);
      console.log(`   ⏳ DOM Wait: ${timings.domWait}ms`);
      console.log(`   📜 Scrolling: ${timings.scroll}ms`);
      console.log(`   📦 Extraction: ${timings.extraction}ms`);
      console.log(`   🧹 Cleanup: ${timings.cleanup}ms`);
      console.log(`📛 Name: ${profileData.name || '❌'}`);
      console.log(`💼 Headline: ${profileData.headline ? '✅' : '❌'}`);
      console.log(`💼 Experience: ${profileData.experience.length} entries`);
      console.log(`🎓 Education: ${profileData.education.length} entries`);
      console.log(`⚡ Skills: ${profileData.skills.length} skills`);
      console.log('═══════════════════════════════════════\n');

      return {
        success: true,
        data: profileData,
        scrapedAt: new Date().toISOString(),
        profileUrl: profileUrl,
        timeTaken: `${timeTaken}ms`,
        timeSeconds: timeSeconds,
        timings: timings
      };

    } catch (error) {
      const timeTaken = Date.now() - startTime;
      console.error('❌ Scraping error:', error.message);
      
      return {
        success: false,
        error: error.message,
        profileUrl: profileUrl,
        timeTaken: `${timeTaken}ms`
      };
    } finally {
      // Always close the scrape page if it exists
      if (scrapePage && !scrapePage.isClosed()) {
        await scrapePage.close().catch(() => {});
      }
    }
  }

  async delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.loginPage = null;
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
    loginStatus.error = 'Missing credentials';
    return;
  }

  console.log('\n🚀 STABLE ULTRA-FAST MODE ENABLED');
  console.log('📧 Email:', email);
  console.log('⚡ Target: <2 seconds per profile (stable)\n');

  try {
    loginStatus.loginInProgress = true;
    scraper = new LinkedInScraper();
    await scraper.init();

    const loginSuccess = await scraper.login(email, password);

    if (loginSuccess) {
      loginStatus.isLoggedIn = true;
      loginStatus.loginInProgress = false;
      loginStatus.error = null;
      console.log('\n✅ READY FOR STABLE ULTRA-FAST SCRAPING!');
      console.log('📌 Open UI: http://localhost:3001\n');
    } else {
      loginStatus.isLoggedIn = false;
      loginStatus.loginInProgress = false;
      loginStatus.error = 'Login failed';
      console.log('\n❌ Auto-login failed\n');
    }
  } catch (error) {
    loginStatus.isLoggedIn = false;
    loginStatus.loginInProgress = false;
    loginStatus.error = error.message;
    console.error('\n❌ Error:', error.message);
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
        error: 'Not logged in' 
      });
    }

    const result = await scraper.scrapeProfile(profileUrl);
    res.json(result);

  } catch (error) {
    console.error('Scrape error:', error);
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
    mode: 'stable-ultra-fast',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/logout', async (req, res) => {
  try {
    if (scraper) {
      await scraper.close();
      scraper = null;
    }
    loginStatus = { isLoggedIn: false, loginInProgress: false, error: null };
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'stable-ultra-fast-linkedin-scraper',
    version: '10.0.0-stable',
    loginStatus: loginStatus
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (scraper) await scraper.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Stable Ultra-Fast LinkedIn Scraper on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}\n`);
  startAutoScraper();
});