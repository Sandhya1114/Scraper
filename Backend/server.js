// LinkedIn Profile Scraper - server.js (ROBUST FIXED VERSION)
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

      await this.page.waitForSelector('.pv-text-details__left-panel, .ph5', { timeout: 10000 }).catch(() => {});
      await this.randomDelay(3000, 5000);
      
      console.log('📜 Starting advanced scroll and section expansion...');
      await this.advancedScroll();
      await this.randomDelay(3000, 4000);

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

          // IMPROVED: Find section with multiple strategies
          findSection: (sectionId) => {
            console.log(`Looking for section: ${sectionId}`);
            
            // Strategy 1: Direct ID lookup
            let section = document.querySelector(`#${sectionId}`);
            if (section) {
              console.log(`  ✓ Found by ID: #${sectionId}`);
              
              // Try multiple container patterns
              const containers = [
                section.closest('section')?.querySelector('.pvs-list__outer-container'),
                section.closest('section')?.querySelector('ul.pvs-list'),
                section.parentElement?.querySelector('.pvs-list'),
                section.parentElement?.nextElementSibling?.querySelector('ul'),
                section.closest('section')?.querySelector('ul')
              ];
              
              for (const container of containers) {
                if (container) {
                  console.log(`  ✓ Found container`);
                  return container;
                }
              }
            }

            // Strategy 2: Find by section heading text
            const headings = document.querySelectorAll('h2, h3, div[id*="' + sectionId + '"]');
            for (const heading of headings) {
              const text = utils.getText(heading)?.toLowerCase();
              if (text?.includes(sectionId.replace(/_/g, ' '))) {
                console.log(`  ✓ Found by heading text: "${text}"`);
                const container = heading.closest('section')?.querySelector('ul') || 
                                heading.parentElement?.querySelector('ul');
                if (container) return container;
              }
            }

            // Strategy 3: Find all sections and match by content
            const sections = document.querySelectorAll('section.artdeco-card, section');
            for (const sec of sections) {
              const h2 = sec.querySelector('h2');
              if (h2) {
                const text = utils.getText(h2)?.toLowerCase();
                if (text?.includes(sectionId.replace(/_/g, ' '))) {
                  console.log(`  ✓ Found by section content: "${text}"`);
                  return sec.querySelector('ul');
                }
              }
            }

            console.log(`  ✗ Section not found: ${sectionId}`);
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

        // NAME
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

        // HEADLINE
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

        // LOCATION
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

        // ABOUT
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

        // PROFILE IMAGE
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

        // CONNECTIONS
        const getConnections = () => {
          const texts = utils.getAllText([
            '.pv-top-card--list-bullet li',
            'span.t-bold span',
            '.pv-top-card--list .text-body-small'
          ]);
          return texts.find(t => t.toLowerCase().includes('connection')) || null;
        };

        // EXPERIENCE - ROBUST
        const getExperience = () => {
          console.log('Extracting Experience...');
          const container = utils.findSection('experience');
          if (!container) {
            console.log('  ✗ Experience container not found');
            return [];
          }

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          console.log(`  Found ${items.length} experience items`);
          
          return Array.from(items).map((item, idx) => {
            const spans = utils.extractSpanTexts(item);
            console.log(`  Item ${idx + 1} spans:`, spans);
            
            // Find all links and bold text
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

        // EDUCATION - ROBUST
        const getEducation = () => {
          console.log('Extracting Education...');
          const container = utils.findSection('education');
          if (!container) {
            console.log('  ✗ Education container not found');
            return [];
          }

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          console.log(`  Found ${items.length} education items`);
          
          return Array.from(items).map((item, idx) => {
            const spans = utils.extractSpanTexts(item);
            console.log(`  Item ${idx + 1} spans:`, spans);

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

        // SKILLS - ROBUST
        const getSkills = () => {
          console.log('Extracting Skills...');
          const container = utils.findSection('skills');
          if (!container) {
            console.log('  ✗ Skills container not found');
            return [];
          }

          const skills = new Set();
          const skillElements = container.querySelectorAll('a[href*="/skills/"], .hoverable-link-text.t-bold');
          console.log(`  Found ${skillElements.length} skill elements`);
          
          skillElements.forEach(el => {
            const span = el.querySelector('span[aria-hidden="true"]');
            const skill = utils.getText(span || el);
            if (skill && skill.length > 1 && skill.length < 100 && !skill.match(/\d+ endorsement/i)) {
              skills.add(skill);
            }
          });

          return Array.from(skills).slice(0, 50);
        };

        // CERTIFICATIONS - ROBUST
        const getCertifications = () => {
          console.log('Extracting Certifications...');
          const container = utils.findSection('licenses_and_certifications');
          if (!container) {
            console.log('  ✗ Certifications container not found');
            return [];
          }

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          console.log(`  Found ${items.length} certification items`);
          
          return Array.from(items).map((item, idx) => {
            const spans = utils.extractSpanTexts(item);
            console.log(`  Item ${idx + 1} spans:`, spans);

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

        // PROJECTS - ROBUST
        const getProjects = () => {
          console.log('Extracting Projects...');
          const container = utils.findSection('projects');
          if (!container) {
            console.log('  ✗ Projects container not found');
            return [];
          }

          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          console.log(`  Found ${items.length} project items`);
          
          return Array.from(items).map((item, idx) => {
            const spans = utils.extractSpanTexts(item);
            console.log(`  Item ${idx + 1} spans:`, spans);
            
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

        // LANGUAGES - ROBUST
        const getLanguages = () => {
          console.log('Extracting Languages...');
          const container = utils.findSection('languages');
          if (!container) {
            console.log('  ✗ Languages container not found');
            return [];
          }

          const languages = [];
          const items = container.querySelectorAll('li.pvs-list__paged-list-item, li.artdeco-list__item');
          console.log(`  Found ${items.length} language items`);
          
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

      console.log('\n✅ SCRAPING COMPLETED!');
      console.log('═══════════════════════════════════════');
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
    console.log('📜 Advanced scrolling with section expansion...');
    
    // Phase 1: Initial scroll
    for (let i = 0; i < 6; i++) {
      await this.page.evaluate((i) => {
        window.scrollTo({
          top: (i + 1) * (document.body.scrollHeight / 6),
          behavior: 'smooth'
        });
      }, i);
      await this.randomDelay(2500, 3500);
    }

    // Phase 2: Click ALL "Show all" / "Show more" buttons
    await this.randomDelay(2000, 3000);
    
    // Find and click expand buttons multiple times
    for (let attempt = 0; attempt < 3; attempt++) {
      const buttons = await this.page.$$('button:has-text("Show all"), button:has-text("show more"), button[aria-label*="Show all"], button[aria-expanded="false"]').catch(() => []);
      console.log(`   Attempt ${attempt + 1}: Found ${buttons.length} expand buttons`);
      
      for (let i = 0; i < buttons.length; i++) {
        try {
          await buttons[i].scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          await buttons[i].click({ timeout: 3000 });
          console.log(`   ✓ Clicked button ${i + 1}`);
          await this.randomDelay(2000, 3000);
        } catch (e) {
          // Button not clickable or already expanded
        }
      }
      
      await this.randomDelay(1500, 2500);
    }

    // Phase 3: Scroll through each major section
    const sections = ['experience', 'education', 'skills', 'licenses_and_certifications', 'projects', 'languages'];
    for (const section of sections) {
      try {
        await this.page.evaluate((sectionId) => {
          const el = document.querySelector(`#${sectionId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, section);
        await this.randomDelay(2000, 3000);
      } catch (e) {}
    }

    // Phase 4: Final full scroll
    await this.page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await this.randomDelay(3000, 4000);

    await this.page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await this.randomDelay(2000, 3000);

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
    version: '5.0.0-robust',
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