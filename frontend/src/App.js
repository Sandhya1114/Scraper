// App.jsx
import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, Download, ExternalLink, Globe, Database, CheckCircle, XCircle } from 'lucide-react';
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

  const downloadCSV = () => {
    if (!result || result.items.length === 0) return;
    
    // Create CSV headers
    const headers = ['Name', 'Price', 'Description', 'Image', 'Link', 'Metadata'];
    
    // Create CSV rows
    const rows = result.items.map(item => [
      item.name || '',
      item.price || '',
      (item.description || '').replace(/"/g, '""').substring(0, 200),
      item.image || '',
      item.link || '',
      JSON.stringify(item.metadata || {}).replace(/"/g, '""')
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ItemCard = ({ item, index }) => {
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
          <div className="item-number">#{index + 1}</div>
          
          {item.name && <h3 className="item-name">{item.name}</h3>}
          
          {item.price && <div className="item-price">{item.price}</div>}
          
          {item.description && (
            <p className="item-description">
              {item.description.substring(0, 180)}
              {item.description.length > 180 ? '...' : ''}
            </p>
          )}
          
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className="item-metadata">
              {Object.entries(item.metadata).slice(0, 4).map(([key, val]) => (
                <span key={key} className="meta-tag">
                  <strong>{key}:</strong> {String(val).substring(0, 40)}
                </span>
              ))}
            </div>
          )}
          
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="item-link">
              <ExternalLink size={14} />
              View Details
            </a>
          )}
          
          <div className="confidence-bar">
            <div 
              className="confidence-fill" 
              style={{ 
                width: `${(item.confidence || 0) * 100}%`,
                backgroundColor: item.confidence >= 0.7 ? '#10b981' : 
                               item.confidence >= 0.4 ? '#f59e0b' : '#ef4444'
              }}
            />
            <span className="confidence-text">{((item.confidence || 0) * 100).toFixed(0)}%</span>
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
            <h1>Advanced Web Scraper</h1>
          </div>
          <p className="header-subtitle">
            Extract accurate, deduplicated data from ANY website with advanced selectors
          </p>
          <div className="header-features">
            <span><CheckCircle size={16} /> No Duplicates</span>
            <span><CheckCircle size={16} /> Smart Detection</span>
            <span><CheckCircle size={16} /> Multiple Strategies</span>
            <span><CheckCircle size={16} /> High Accuracy</span>
          </div>
        </header>

        {/* Input Form */}
        <div className="search-card">
          <form onSubmit={handleScrape} className="search-form">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste any URL (Amazon, Flipkart, Zomato, GitHub, Real Estate, News...)"
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
                  <span>Scrape Now</span>
                </>
              )}
            </button>
          </form>

          <div className="supported-sites">
            <p className="supported-label">✨ Works with 100+ website types:</p>
            <div className="tags">
              {[
                'E-commerce', 'Food Delivery', 'Real Estate', 
                'Job Portals', 'News', 'Blogs', 'GitHub',
                'Social Media', 'Forums', 'Marketplaces'
              ].map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p className="loading-text">Analyzing page structure...</p>
            <p className="loading-subtext">Using advanced selectors and multiple extraction strategies</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-card">
            <XCircle className="error-icon" />
            <div>
              <h3>Scraping Error</h3>
              <p>{error}</p>
              <p className="error-hint">Make sure the backend server is running on port 3001</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="results">
            {/* Metadata */}
            <div className="metadata-card">
              <div className="metadata-header">
                <div className="metadata-left">
                  <h2>Scrape Results</h2>
                  <div className="metadata-info">
                    <span className="stat-item">
                      <Database size={18} />
                      <strong>{result.summary.totalItems}</strong> items
                    </span>
                    <span className="stat-item">
                      <CheckCircle size={18} />
                      <strong>{result.summary.duplicatesRemoved}</strong> duplicates removed
                    </span>
                    <span className="stat-item stat-type">
                      Type: <strong>{result.metadata.pageType}</strong>
                    </span>
                    <span className="stat-item stat-confidence">
                      Avg Confidence: 
                      <strong 
                        className={`confidence-badge ${
                          result.summary.avgConfidence >= 0.7 ? 'high' : 
                          result.summary.avgConfidence >= 0.4 ? 'medium' : 'low'
                        }`}
                      >
                        {(result.summary.avgConfidence * 100).toFixed(0)}%
                      </strong>
                    </span>
                  </div>
                </div>
                
                <div className="download-buttons">
                  <button onClick={downloadJson} className="download-btn json">
                    <Download size={18} />
                    JSON
                  </button>
                  <button onClick={downloadCSV} className="download-btn csv">
                    <Download size={18} />
                    CSV
                  </button>
                </div>
              </div>

              {result.summary.warnings && result.summary.warnings.length > 0 && (
                <div className="warnings">
                  <AlertCircle size={20} />
                  <div>
                    <p className="warnings-title">Warnings:</p>
                    <ul>
                      {result.summary.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Items Grid */}
            {result.items.length > 0 ? (
              <div className="items-grid">
                {result.items.slice(0, 150).map((item, index) => (
                  <ItemCard key={item.id || index} item={item} index={index} />
                ))}
              </div>
            ) : (
              <div className="no-results">
                <XCircle size={48} />
                <h3>No items found</h3>
                <p>The scraper couldn't extract structured data from this page.</p>
                <p className="no-results-hint">Try a different URL or check the warnings above.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;