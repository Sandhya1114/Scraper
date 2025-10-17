const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let cachedProxies = [];

// Fetch free proxies
async function fetchProxies() {
  try {
    const response = await axios.get(
      'https://www.proxy-list.download/api/v1/get?type=http',
      { timeout: 5000 }
    );
    if (response.data?.LISTA) {
      cachedProxies = response.data.LISTA.slice(0, 20);
      console.log(`✓ Fetched ${cachedProxies.length} proxies`);
    }
  } catch (error) {
    console.warn('⚠ Could not fetch proxies:', error.message);
  }
}

// Get random proxy
function getRandomProxy() {
  if (cachedProxies.length === 0) return null;
  return cachedProxies[Math.floor(Math.random() * cachedProxies.length)];
}

// Initialize browser with proxy
async function initBrowser() {
  const proxy = getRandomProxy();
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ];

  if (proxy) {
    args.push(`--proxy-server=http://${proxy}`);
    console.log(`Using proxy: ${proxy}`);
  }

  return await puppeteer.launch({ headless: 'new', args });
}

// Scrape with anti-detection
async function scrapeLinkedInProfile(profileUrl) {
  let page = null;

  try {
    if (!browser || browser.isConnected() === false) {
      browser = await initBrowser();
    }

    page = await browser.newPage();

    // Set random user agent
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    ];
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(ua);

    // Anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log(`Scraping: ${profileUrl}`);

    // Random delay
    await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));

    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Scroll to load content
    await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
    await new Promise(r => setTimeout(r, 1500));

    // Extract data
    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      return {
        name: getText('h1'),
        headline: getText('[data-test-id="headline"]'),
        location: getText('[data-test-id="top-card-bottom-container"]'),
        success: true,
      };
    });

    return data;
  } catch (error) {
    console.error('Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (page) await page.close();
  }
}

// Routes
app.post('/api/scrape', async (req, res) => {
  const { profileUrl } = req.body;

  if (!profileUrl) {
    return res.status(400).json({ error: 'profileUrl required' });
  }

  try {
    const result = await scrapeLinkedInProfile(profileUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/proxies', (req, res) => {
  res.json({ count: cachedProxies.length, proxies: cachedProxies });
});

// Initialize and start
async function start() {
  await fetchProxies();
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

start();