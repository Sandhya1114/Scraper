// FIXED LinkedIn Profile Scraper - Experience Section Fixed
// Key fix: Improved section detection to correctly identify Experience vs Education

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
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      await this.randomDelay(1000, 1500);

      await this.page.fill('#username', email);
      await this.randomDelay(400, 700);

      await this.page.fill('#password', password);
      await this.randomDelay(400, 700);

      await this.page.click('button[type="submit"]');
      
      await this.page.waitForURL('**/feed/**', { timeout: 25000 }).catch(() => {});
      await this.randomDelay(1500, 2000);

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

async enhancedScroll() {
  console.log('📜 Enhanced scrolling with aggressive section expansion...');
  
  // First, scroll to load all sections
  for (let i = 0; i < 6; i++) {
    await this.page.evaluate((i) => {
      window.scrollTo({
        top: (i + 1) * (document.body.scrollHeight / 6),
        behavior: 'smooth'
      });
    }, i);
    await this.randomDelay(1200, 1800);
  }

  // Wait for sections to load
  await this.randomDelay(2000, 3000);

  // Now aggressively click ALL "Show all" and expansion buttons
  console.log('🔘 Clicking all expansion buttons...');
  
  try {
    // Multiple attempts to find and click all buttons
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`  Attempt ${attempt + 1} to expand sections...`);
      
      // Find all possible "Show all" button selectors
      const buttonSelectors = [
        'button[aria-label*="Show all"]',
        'button:has-text("Show all")',
        'button:has-text("show all")',
        'button.artdeco-button:has-text("Show")',
        'button[id^="navigation-index-see-all"]',
        'a[href*="#show-all"]',
        'button.pvs-navigation__item',
        'button span:has-text("Show all")',
        'div.pvs-list__footer-wrapper button'
      ];

      for (const selector of buttonSelectors) {
        try {
          const buttons = await this.page.$$(selector);
          console.log(`  Found ${buttons.length} buttons for selector: ${selector}`);
          
          for (const button of buttons) {
            try {
              const isVisible = await button.isVisible().catch(() => false);
              if (isVisible) {
                await button.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
                await this.randomDelay(300, 500);
                await button.click({ timeout: 2000, force: true });
                console.log(`  ✓ Clicked expansion button`);
                await this.randomDelay(1000, 1500);
              }
            } catch (e) {
              // Continue to next button
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Scroll again after clicking buttons
      await this.page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
      await this.randomDelay(2000, 2500);
    }
  } catch (e) {
    console.log('  Some buttons could not be clicked, continuing...');
  }

  // Final scroll to ensure everything is loaded
  await this.page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
  await this.randomDelay(3000, 4000);

  console.log('✅ Enhanced scrolling and expansion completed');
}
 async scrapeProfile(profileUrl) {
  try {
    if (!this.isLoggedIn) {
      throw new Error('Not logged in');
    }

    console.log(`\n🔍 Scraping profile: ${profileUrl}`);
    const startTime = Date.now();
    
    await this.page.goto(profileUrl, { 
      waitUntil: 'networkidle',  // Changed from domcontentloaded
      timeout: 30000 
    });

    // Wait longer for profile to load
    await this.page.waitForSelector('.pv-text-details__left-panel, .ph5', { timeout: 10000 }).catch(() => {});
    await this.randomDelay(2000, 3000);
    
    console.log('📜 Starting enhanced scroll and expansion...');
    
    // More aggressive scrolling
    await this.enhancedScroll();
    
    console.log('⏳ Waiting for sections to load...');
    await this.randomDelay(3000, 4000);

    // Take a screenshot for debugging
    await this.page.screenshot({ path: 'debug_profile.png', fullPage: true });
    console.log('📸 Screenshot saved as debug_profile.png');

    // Enhanced data extraction with detailed logging
    const profileData = await this.page.evaluate(() => {
      // Helper utilities
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

      // ENHANCED: Log ALL sections with full details
      console.log('\n========== COMPLETE PAGE ANALYSIS ==========');
      const allSections = document.querySelectorAll('section');
      console.log(`Total sections found: ${allSections.length}`);
      
      allSections.forEach((section, i) => {
        console.log(`\n--- Section ${i} ---`);
        
        // Check for ID
        const sectionId = section.id || 'no-id';
        console.log(`  Section ID: "${sectionId}"`);
        
        // Check for IDs in children
        const childWithId = section.querySelector('[id]');
        if (childWithId) {
          console.log(`  Child with ID: "${childWithId.id}"`);
        }
        
        // Check all headings
        const h2 = section.querySelector('h2');
        const h3 = section.querySelector('h3');
        const headingSpan = section.querySelector('div > div > span[aria-hidden="true"]');
        
        if (h2) console.log(`  H2: "${utils.getText(h2)}"`);
        if (h3) console.log(`  H3: "${utils.getText(h3)}"`);
        if (headingSpan) console.log(`  Heading Span: "${utils.getText(headingSpan)}"`);
        
        // Check for lists
        const ul = section.querySelector('ul');
        if (ul) {
          const items = ul.querySelectorAll(':scope > li');
          console.log(`  List items: ${items.length}`);
          
          // Log first item's content
          if (items.length > 0) {
            const firstItemText = utils.getText(items[0]);
            console.log(`  First item preview: "${firstItemText ? firstItemText.substring(0, 100) : 'empty'}"`);
          }
        } else {
          console.log(`  No list found`);
        }
        
        // Check for class names that might help
        const classes = section.className;
        if (classes) {
          console.log(`  Classes: ${classes}`);
        }
      });
      console.log('\n========================================\n');

      // ENHANCED: Find section with multiple fallback methods
      const findSection = (sectionName) => {
        console.log(`\n>>> Looking for "${sectionName}" section <<<`);
        
        // Method 1: Direct ID match on section
        let section = document.getElementById(sectionName);
        if (section && section.tagName === 'SECTION') {
          console.log(`  ✓ Found section by direct ID`);
          const list = section.querySelector('ul');
          if (list) {
            console.log(`  ✓ Found list with ${list.querySelectorAll(':scope > li').length} items`);
            return list;
          }
        }

        // Method 2: Find div with ID, then get parent section
        const idDiv = document.getElementById(sectionName);
        if (idDiv) {
          console.log(`  ✓ Found div with ID`);
          const parentSection = idDiv.closest('section');
          if (parentSection) {
            console.log(`  ✓ Found parent section`);
            const list = parentSection.querySelector('ul');
            if (list) {
              console.log(`  ✓ Found list with ${list.querySelectorAll(':scope > li').length} items`);
              return list;
            }
          }
        }

        // Method 3: Search by heading text
        const allSections = document.querySelectorAll('section');
        const searchTerms = [
          sectionName.toLowerCase(),
          sectionName.toLowerCase().replace('_', ' '),
          sectionName.toLowerCase().replace('_and_', ' & ')
        ];
        
        for (const sec of allSections) {
          // Check h2
          const h2 = sec.querySelector('h2');
          if (h2) {
            const h2Text = utils.getText(h2)?.toLowerCase() || '';
            if (searchTerms.some(term => h2Text.includes(term))) {
              console.log(`  ✓ Found by H2: "${h2Text}"`);
              const list = sec.querySelector('ul');
              if (list) {
                console.log(`  ✓ Found list with ${list.querySelectorAll(':scope > li').length} items`);
                return list;
              }
            }
          }
          
          // Check heading span
          const headingSpan = sec.querySelector('div > div > span[aria-hidden="true"]');
          if (headingSpan) {
            const spanText = utils.getText(headingSpan)?.toLowerCase() || '';
            if (searchTerms.some(term => spanText.includes(term))) {
              console.log(`  ✓ Found by heading span: "${spanText}"`);
              const list = sec.querySelector('ul');
              if (list) {
                console.log(`  ✓ Found list with ${list.querySelectorAll(':scope > li').length} items`);
                return list;
              }
            }
          }
        }

        console.log(`  ✗ Section "${sectionName}" not found`);
        return null;
      };

      // Basic info getters (unchanged)
      const getName = () => {
        const selectors = [
          'h1.text-heading-xlarge',
          'h1.inline.t-24',
          '.pv-text-details__left-panel h1',
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
          'span.text-body-small.inline'
        ];
        const texts = utils.getAllText(selectors);
        return texts.find(t => t.includes(',') || t.match(/India|USA|UK|Canada/i)) || 
               texts.find(t => t.length > 3 && !t.includes('connection')) || null;
      };

      const getAbout = () => {
        const aboutList = findSection('about');
        if (!aboutList) {
          // Fallback: try direct selectors
          const aboutSection = document.querySelector('section:has(#about), section:has([id*="about"])');
          if (aboutSection) {
            const spans = aboutSection.querySelectorAll('span[aria-hidden="true"]');
            for (const span of spans) {
              const text = utils.getText(span);
              if (text && text.length > 50) return text;
            }
          }
          return null;
        }

        const textElements = aboutList.querySelectorAll('span[aria-hidden="true"]');
        for (const el of textElements) {
          const text = utils.getText(el);
          if (text && text.length > 20) return text;
        }
        return null;
      };

      const getProfileImage = () => {
        const selectors = [
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
          '.text-body-small'
        ]);
        return texts.find(t => t.toLowerCase().includes('connection')) || null;
      };

      // Section data extractors (with enhanced logging)
      const getExperience = () => {
        console.log('\n=== EXTRACTING EXPERIENCE ===');
        const list = findSection('experience');
        if (!list) {
          console.log('❌ Experience list not found');
          return [];
        }

        const items = list.querySelectorAll(':scope > li');
        console.log(`✓ Found ${items.length} experience items`);
        
        return Array.from(items).map((item, i) => {
          console.log(`\n  Processing experience item ${i + 1}:`);
          const spans = utils.extractSpanTexts(item);
          console.log(`    All spans:`, spans);
          
          const boldElements = item.querySelectorAll('.t-bold span[aria-hidden="true"]');
          const boldTexts = Array.from(boldElements).map(e => utils.getText(e)).filter(Boolean);
          console.log(`    Bold texts:`, boldTexts);
          
          const title = boldTexts[0] || spans[0] || null;
          const company = boldTexts[1] || spans.find(s => s !== title && !s.match(/\d{4}/)) || null;
          const duration = spans.find(s => s.match(/\d{4}|present|yr|mo/i)) || null;
          const location = spans.find(s => s.includes(',') && !s.match(/\d{4}/)) || null;
          const description = utils.getText(item.querySelector('.inline-show-more-text span[aria-hidden="true"]'));

          console.log(`    Extracted: title="${title}", company="${company}"`);
          return { title, company, duration, location, description };
        })
        .filter(exp => exp.title && exp.title.length > 2)
        .slice(0, 15);
      };

      const getEducation = () => {
        console.log('\n=== EXTRACTING EDUCATION ===');
        const list = findSection('education');
        if (!list) {
          console.log('❌ Education list not found');
          return [];
        }

        const items = list.querySelectorAll(':scope > li');
        console.log(`✓ Found ${items.length} education items`);
        
        return Array.from(items).map((item, i) => {
          console.log(`\n  Processing education item ${i + 1}:`);
          const spans = utils.extractSpanTexts(item);
          console.log(`    All spans:`, spans);
          
          const boldElements = item.querySelectorAll('.t-bold span[aria-hidden="true"]');
          const boldTexts = Array.from(boldElements).map(e => utils.getText(e)).filter(Boolean);
          console.log(`    Bold texts:`, boldTexts);
          
          const school = boldTexts[0] || spans[0] || null;
          const degree = spans.find(s => s.match(/Bachelor|Master|B\.?Tech|M\.?Tech|PhD|Degree|Diploma/i)) || boldTexts[1] || null;
          const field = spans.find(s => s !== school && s !== degree && !s.match(/\d{4}/) && s.length > 3) || null;
          const duration = spans.find(s => s.match(/\d{4}/)) || null;

          console.log(`    Extracted: school="${school}", degree="${degree}"`);
          return { school, degree, field, duration };
        })
        .filter(edu => edu.school && edu.school.length > 2)
        .slice(0, 10);
      };

      const getSkills = () => {
        console.log('\n=== EXTRACTING SKILLS ===');
        const list = findSection('skills');
        if (!list) {
          console.log('❌ Skills list not found');
          return [];
        }

        const skills = new Set();
        
        // Method 1: Try skill links (most common)
        console.log('  Method 1: Extracting from skill links...');
        const skillLinks = list.querySelectorAll('a[href*="/skills/"]');
        console.log(`    Found ${skillLinks.length} skill links`);
        
        skillLinks.forEach((link, i) => {
          // Get ALL text content from the link, then clean it
          const fullText = utils.getText(link);
          if (fullText) {
            // Split by newlines and take first meaningful line
            const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const skillName = lines[0]; // First line is usually the skill name
            
            console.log(`    Skill ${i + 1}: "${skillName}"`);
            
            if (skillName && 
                skillName.length > 1 && 
                skillName.length < 100 && 
                !skillName.match(/\d+\s*endorsement/i) &&
                !skillName.match(/\d+\s*experience/i) &&
                !skillName.toLowerCase().includes('show all') &&
                !skillName.match(/^\d+$/)) {
              skills.add(skillName);
            }
          }
        });

        // Method 2: Extract from list items directly
        if (skills.size === 0) {
          console.log('  Method 2: Extracting from list items...');
          const listItems = list.querySelectorAll(':scope > li');
          console.log(`    Found ${listItems.length} list items`);
          
          listItems.forEach((item, i) => {
            // Try to find the skill name in various ways
            const skillLink = item.querySelector('a[href*="/skills/"]');
            if (skillLink) {
              const skillName = utils.getText(skillLink)?.split('\n')[0]?.trim();
              console.log(`    Item ${i + 1}: "${skillName}"`);
              
              if (skillName && 
                  skillName.length > 1 && 
                  skillName.length < 100 && 
                  !skillName.match(/\d+\s*endorsement/i) &&
                  !skillName.match(/\d+\s*experience/i)) {
                skills.add(skillName);
              }
            } else {
              // Fallback: get first span text
              const firstSpan = item.querySelector('span[aria-hidden="true"]');
              if (firstSpan) {
                const text = utils.getText(firstSpan)?.split('\n')[0]?.trim();
                console.log(`    Item ${i + 1}: "${text}"`);
                
                if (text && 
                    text.length > 1 && 
                    text.length < 100 && 
                    !text.match(/\d+\s*endorsement/i) &&
                    !text.match(/\d+\s*experience/i)) {
                  skills.add(text);
                }
              }
            }
          });
        }

        // Method 3: Brute force - find all divs with skill-like content
        if (skills.size === 0) {
          console.log('  Method 3: Brute force extraction...');
          const allDivs = list.querySelectorAll('div');
          allDivs.forEach(div => {
            const text = utils.getText(div)?.split('\n')[0]?.trim();
            if (text && 
                text.length > 2 && 
                text.length < 50 && 
                !text.match(/\d+\s*endorsement/i) &&
                !text.match(/\d+\s*experience/i) &&
                !text.toLowerCase().includes('show') &&
                !text.match(/^\d+$/)) {
              skills.add(text);
            }
          });
          console.log(`    Found ${skills.size} potential skills`);
        }

        const finalSkills = Array.from(skills).slice(0, 100);
        console.log(`✓ Extracted ${finalSkills.length} unique skills`);
        return finalSkills;
      };

      const getCertifications = () => {
        console.log('\n=== EXTRACTING CERTIFICATIONS ===');
        const list = findSection('licenses_and_certifications');
        if (!list) {
          console.log('❌ Certifications list not found');
          return [];
        }

        const items = list.querySelectorAll(':scope > li');
        console.log(`✓ Found ${items.length} certification items`);
        
        return Array.from(items).map(item => {
          const spans = utils.extractSpanTexts(item);
          const boldElements = item.querySelectorAll('.t-bold span[aria-hidden="true"]');
          const boldTexts = Array.from(boldElements).map(e => utils.getText(e)).filter(Boolean);

          const name = boldTexts[0] || spans[0] || null;
          const issuer = boldTexts[1] || spans.find(s => s !== name && !s.match(/issued|credential/i)) || null;
          const date = spans.find(s => s.toLowerCase().includes('issued') || s.match(/\w+\s+\d{4}/)) || null;
          const credentialId = spans.find(s => s.toLowerCase().includes('credential')) || null;

          return { name, issuer, date, credentialId };
        })
        .filter(cert => cert.name && cert.name.length > 2)
        .slice(0, 15);
      };

      const getProjects = () => {
        console.log('\n=== EXTRACTING PROJECTS ===');
        const list = findSection('projects');
        if (!list) {
          console.log('❌ Projects list not found');
          return [];
        }

        const items = list.querySelectorAll(':scope > li');
        console.log(`✓ Found ${items.length} project items`);
        
        return Array.from(items).map(item => {
          const spans = utils.extractSpanTexts(item);
          const boldElements = item.querySelectorAll('.t-bold span[aria-hidden="true"]');
          const boldTexts = Array.from(boldElements).map(e => utils.getText(e)).filter(Boolean);

          const name = boldTexts[0] || spans[0] || null;
          const date = spans.find(s => s.match(/\d{4}/)) || null;
          const association = spans.find(s => s.toLowerCase().includes('associated')) || null;
          const description = utils.getText(item.querySelector('.inline-show-more-text span[aria-hidden="true"]'));

          return { name, date, association, description };
        })
        .filter(proj => proj.name && proj.name.length > 2)
        .slice(0, 10);
      };

      const getLanguages = () => {
        console.log('\n=== EXTRACTING LANGUAGES ===');
        const list = findSection('languages');
        if (!list) {
          console.log('❌ Languages list not found');
          return [];
        }

        const languages = [];
        const items = list.querySelectorAll(':scope > li');
        console.log(`✓ Found ${items.length} language items`);
        
        items.forEach(item => {
          const boldElement = item.querySelector('.t-bold span[aria-hidden="true"]');
          const lang = utils.getText(boldElement);
          
          if (lang && 
              lang.length > 1 && 
              lang.length < 30 && 
              !lang.includes('follower') &&
              !lang.includes('connection') &&
              !lang.match(/\d{3,}/)) {
            languages.push(lang);
          }
        });

        return languages.slice(0, 10);
      };

      // Return complete profile data
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

  async optimizedScroll() {
    console.log('📜 Optimized scrolling...');
    
    for (let i = 0; i < 4; i++) {
      await this.page.evaluate((i) => {
        window.scrollTo({
          top: (i + 1) * (document.body.scrollHeight / 4),
          behavior: 'smooth'
        });
      }, i);
      await this.randomDelay(1200, 1800);
    }

    await this.randomDelay(800, 1200);
    
    try {
      const buttons = await this.page.$$('button:has-text("Show all"), button:has-text("show more"), button[aria-label*="Show all"]').catch(() => []);
      console.log(`   Found ${buttons.length} expand buttons`);
      
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

    await this.page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await this.randomDelay(1500, 2000);

    console.log('✅ Optimized scrolling completed');
  }

  async waitForDataLoad() {
    await this.randomDelay(1000, 1500);
    
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

  console.log('\n🚀 AUTO-LOGIN MODE ENABLED (FIXED VERSION)');
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
      console.log('🎯 Ready to scrape profiles (Experience section fixed)!');
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
    version: '6.1.0-fixed',
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