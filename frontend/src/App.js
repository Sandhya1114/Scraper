import React, { useState } from 'react';
import './App.css';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [useCustomSelectors, setUseCustomSelectors] = useState(false);
  const [customSelectors, setCustomSelectors] = useState('');

  const defaultSelectors = {
    name: { type: 'text', query: '.vcard-fullname' },
    username: { type: 'text', query: '.vcard-username' },
    bio: { type: 'text', query: '.user-profile-bio' },
    avatar: { type: 'attr', query: '.avatar-user', attribute: 'src' },
    followers: { type: 'text', query: 'a[href*="followers"] span' },
    following: { type: 'text', query: 'a[href*="following"] span' },
    repositories: { type: 'text', query: 'nav a[data-tab-item="repositories"] span' },
  };

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        url: url.trim(),
      };

      if (useCustomSelectors && customSelectors.trim()) {
        try {
          payload.customSelectors = JSON.parse(customSelectors);
        } catch (e) {
          setError('Invalid JSON format for custom selectors');
          setLoading(false);
          return;
        }
      }

      const response = await fetch('http://localhost:3001/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Scraping failed');
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure the backend is running on port 3001');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setUrl('https://github.com/torvalds');
  };

  const renderValue = (value) => {
    if (typeof value === 'string' && value.startsWith('http')) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="link">
          {value}
        </a>
      );
    }
    if (Array.isArray(value)) {
      return (
        <ul className="array-list">
          {value.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }
    return value || 'N/A';
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🔍 Generic Web Scraper</h1>
        <p className="subtitle">Extract data from any GitHub profile or custom website</p>
      </div>

      <div className="input-section">
        <div className="input-group">
          <label htmlFor="url">Profile URL</label>
          <div className="input-with-button">
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/username"
              className="input"
              onKeyPress={(e) => e.key === 'Enter' && handleScrape()}
            />
            <button onClick={handleQuickFill} className="btn-secondary">
              Quick Fill
            </button>
          </div>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useCustomSelectors}
              onChange={(e) => setUseCustomSelectors(e.target.checked)}
            />
            <span>Use Custom Selectors (Advanced)</span>
          </label>
        </div>

        {useCustomSelectors && (
          <div className="input-group">
            <label htmlFor="selectors">Custom Selectors (JSON)</label>
            <textarea
              id="selectors"
              value={customSelectors}
              onChange={(e) => setCustomSelectors(e.target.value)}
              placeholder={JSON.stringify(defaultSelectors, null, 2)}
              className="textarea"
              rows="8"
            />
            <p className="hint">
              Format: {`{ "key": { "type": "text|attr|array|count", "query": "css-selector" } }`}
            </p>
          </div>
        )}

        <button
          onClick={handleScrape}
          disabled={loading}
          className={`btn-primary ${loading ? 'loading' : ''}`}
        >
          {loading ? 'Scraping...' : '🚀 Scrape Data'}
        </button>
      </div>

      {error && (
        <div className="error-box">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-section">
          <div className="result-header">
            <h2>📊 Scraped Data</h2>
            <span className="timestamp">
              {new Date(result.timestamp).toLocaleString()}
            </span>
          </div>

          <div className="result-url">
            <strong>Source:</strong>{' '}
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.url}
            </a>
          </div>

          <div className="data-grid">
            {Object.entries(result.data).map(([key, value]) => (
              <div key={key} className="data-item">
                <div className="data-key">{key}</div>
                <div className="data-value">
                  {key === 'avatar' && value ? (
                    <img src={value} alt="Avatar" className="avatar" />
                  ) : (
                    renderValue(value)
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="json-section">
            <h3>Raw JSON</h3>
            <pre className="json-output">{JSON.stringify(result.data, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>ℹ️ How to Use</h3>
        <ol>
          <li>Enter a GitHub profile URL (e.g., https://github.com/username)</li>
          <li>Click "Scrape Data" to extract profile information</li>
          <li>Optionally, enable "Custom Selectors" to scrape any website with your own CSS selectors</li>
          <li>Selector types: <code>text</code>, <code>attr</code>, <code>array</code>, <code>count</code></li>
        </ol>
      </div>
    </div>
  );
}