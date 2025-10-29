const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Generic scraper function
const scrapeProfile = async (url, selectors) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const result = {};
    
    // Dynamically scrape based on provided selectors
    for (const [key, selector] of Object.entries(selectors)) {
      if (selector.type === 'text') {
        result[key] = $(selector.query).text().trim();
      } else if (selector.type === 'attr') {
        result[key] = $(selector.query).attr(selector.attribute);
      } else if (selector.type === 'array') {
        result[key] = [];
        $(selector.query).each((i, el) => {
          result[key].push($(el).text().trim());
        });
      } else if (selector.type === 'count') {
        result[key] = $(selector.query).length;
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  }
};

// GitHub-specific selectors
const githubSelectors = {
  name: { type: 'text', query: '.vcard-fullname' },
  username: { type: 'text', query: '.vcard-username' },
  bio: { type: 'text', query: '.user-profile-bio' },
  avatar: { type: 'attr', query: '.avatar-user', attribute: 'src' },
  followers: { type: 'text', query: 'a[href*="followers"] span' },
  following: { type: 'text', query: 'a[href*="following"] span' },
  repositories: { type: 'text', query: 'nav a[data-tab-item="repositories"] span' },
  location: { type: 'text', query: '[itemprop="homeLocation"]' },
  website: { type: 'attr', query: '[itemprop="url"]', attribute: 'href' },
  company: { type: 'text', query: '[itemprop="worksFor"]' },
  email: { type: 'text', query: '[itemprop="email"]' },
  twitter: { type: 'text', query: '[itemprop="social"]' },
  pinnedRepos: { type: 'array', query: '.pinned-item-list-item .repo' },
  contributions: { type: 'text', query: '.js-yearly-contributions h2' }
};

// Main scraping endpoint
app.post('/api/scrape', async (req, res) => {
  const { url, customSelectors } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Use custom selectors if provided, otherwise use GitHub defaults
    const selectors = customSelectors || githubSelectors;
    const data = await scrapeProfile(url, selectors);
    
    res.json({
      success: true,
      url,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get GitHub profile via API (alternative method)
app.get('/api/github/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    const response = await axios.get(`https://api.github.com/users/${username}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Scraper server running on http://localhost:${PORT}`);
});