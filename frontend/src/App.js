// App.jsx
import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, Download, ExternalLink, Globe, Database } from 'lucide-react';
import './App.css';

const App = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:3001/api/scrape';

  const handleScrape = async (e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) throw new Error('Scraping failed');
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to scrape. Make sure the backend is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (result) {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scrape_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const ItemCard = ({ item }) => {
    return (
      <div className="item-card">
        {item.image && (
          <div className="item-image">
            <img 
              src={item.image} 
              alt={item.name || 'Item'} 
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        )}
        <div className="item-content">
          {item.name && <h3 className="item-name">{item.name}</h3>}
          {item.price && <div className="item-price">{item.price}</div>}
          {item.description && (
            <p className="item-description">
              {item.description.substring(0, 150)}
              {item.description.length > 150 ? '...' : ''}
            </p>
          )}
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className="item-metadata">
              {Object.entries(item.metadata).slice(0, 3).map(([key, val]) => (
                <span key={key} className="meta-tag">{key}: {val}</span>
              ))}
            </div>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="item-link">
              View Details
              <ExternalLink size={14} />
            </a>
          )}
          <div className="confidence-bar">
            <div 
              className="confidence-fill" 
              style={{ width: `${(item.confidence || 0) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <Globe className="header-icon" />
            <h1>Universal Web Scraper</h1>
          </div>
          <p className="header-subtitle">
            Extract structured data from ANY website - Amazon, Flipkart, Zomato, GitHub, Real Estate, and more
          </p>
        </header>

        {/* Input Form */}
        <div className="search-card">
          <form onSubmit={handleScrape} className="search-form">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any URL here (e.g., Amazon product, restaurant menu, GitHub repo...)"
              className="url-input"
              disabled={loading}
              required
            />
            <button type="submit" className="scrape-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="btn-icon spin" />
                  <span>Scraping...</span>
                </>
              ) : (
                <>
                  <Search className="btn-icon" />
                  <span>Scrape</span>
                </>
              )}
            </button>
          </form>

          <div className="supported-sites">
            <p className="supported-label">Works with:</p>
            <div className="tags">
              {['E-commerce (Amazon, Flipkart)', 'Food (Zomato, Swiggy)', 'Real Estate', 'GitHub', 'News Sites', 'Blogs', 'Any Website'].map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Scraping website... This may take a few seconds</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-card">
            <AlertCircle className="error-icon" />
            <div>
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="results">
            {/* Metadata */}
            <div className="metadata-card">
              <div className="metadata-header">
                <div>
                  <h2>Scrape Results</h2>
                  <div className="metadata-info">
                    <span>
                      <Database size={16} />
                      {result.summary.totalItems} items found
                    </span>
                    <span>Type: <strong>{result.metadata.pageType}</strong></span>
                    <span>Method: <strong>{result.metadata.method}</strong></span>
                    <span>Confidence: <strong>{(result.summary.avgConfidence * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>
                <button onClick={downloadJson} className="download-btn">
                  <Download size={18} />
                  Download JSON
                </button>
              </div>

              {result.summary.warnings && result.summary.warnings.length > 0 && (
                <div className="warnings">
                  <p>⚠️ Warnings:</p>
                  <ul>
                    {result.summary.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Items Grid */}
            <div className="items-grid">
              {result.items.slice(0, 100).map((item, index) => (
                <ItemCard key={item.id || index} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;