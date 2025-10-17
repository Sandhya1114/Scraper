import React, { useState } from 'react';
import { Search, Download, Copy, AlertCircle } from 'lucide-react';

const LinkedInScraper = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('http://localhost:5000/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl: url }),
      });

      const data = await response.json();

      if (data.success || data.data) {
        setResult(data.data || data);
      } else {
        setError(data.error || 'Failed to scrape profile');
      }
    } catch (err) {
      setError(`Connection error: ${err.message}. Make sure backend is running on port 5000`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(result, null, 2))}`);
    element.setAttribute('download', `profile_${Date.now()}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="scraper-container">
      <div className="scraper-header">
        <h1>LinkedIn Profile Scraper</h1>
        <p>Enter a profile URL to extract public information</p>
      </div>

      <div className="scraper-card">
        <div className="input-group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/username/"
            className="scraper-input"
            disabled={loading}
          />
          <button
            onClick={handleScrape}
            disabled={loading}
            className="scraper-button"
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              <>
                <Search size={20} />
                Scrape
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error-box">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="result-box">
            <div className="result-header">
              <h2>Scraped Profile Data</h2>
              <div className="result-actions">
                <button
                  onClick={handleCopy}
                  className="action-button copy-button"
                  title="Copy JSON"
                >
                  <Copy size={18} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="action-button download-button"
                  title="Download JSON"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>
            </div>

            <div className="result-content">
              {result.name && (
                <div className="result-item">
                  <span className="result-label">Name:</span>
                  <span className="result-value">{result.name}</span>
                </div>
              )}
              {result.headline && (
                <div className="result-item">
                  <span className="result-label">Headline:</span>
                  <span className="result-value">{result.headline}</span>
                </div>
              )}
              {result.location && (
                <div className="result-item">
                  <span className="result-label">Location:</span>
                  <span className="result-value">{result.location}</span>
                </div>
              )}
              <div className="result-item">
                <span className="result-label">Scraped At:</span>
                <span className="result-value">
                  {result.scrapedAt || new Date().toLocaleString()}
                </span>
              </div>

              <div className="json-display">
                <p className="json-label">Full Data:</p>
                <pre className="json-content">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {!result && !error && !loading && (
          <div className="empty-state">
            <Search size={48} />
            <p>Enter a LinkedIn profile URL and click Scrape to get started</p>
          </div>
        )}
      </div>

      <style>{`
        .scraper-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .scraper-header {
          text-align: center;
          color: white;
          margin-bottom: 40px;
        }

        .scraper-header h1 {
          font-size: 2.5em;
          margin: 0 0 10px 0;
          font-weight: 700;
        }

        .scraper-header p {
          font-size: 1.1em;
          opacity: 0.9;
          margin: 0;
        }

        .scraper-card {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          padding: 40px;
          overflow: hidden;
        }

        .input-group {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .scraper-input {
          flex: 1;
          padding: 14px 18px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1em;
          transition: border-color 0.3s;
        }

        .scraper-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .scraper-input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .scraper-button {
          padding: 14px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1em;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .scraper-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }

        .scraper-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #fee;
          border: 2px solid #fcc;
          border-radius: 8px;
          color: #c33;
          margin-bottom: 24px;
        }

        .result-box {
          background: #f9f9f9;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: white;
          border-bottom: 2px solid #e0e0e0;
        }

        .result-header h2 {
          margin: 0;
          font-size: 1.3em;
          color: #333;
        }

        .result-actions {
          display: flex;
          gap: 8px;
        }

        .action-button {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.95em;
          font-weight: 600;
          transition: all 0.2s;
        }

        .copy-button {
          background: #e3f2fd;
          color: #1976d2;
        }

        .copy-button:hover {
          background: #bbdefb;
        }

        .download-button {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .download-button:hover {
          background: #e1bee7;
        }

        .result-content {
          padding: 20px;
        }

        .result-item {
          display: flex;
          gap: 12px;
          margin-bottom: 14px;
          padding: 10px;
          background: white;
          border-radius: 6px;
        }

        .result-label {
          font-weight: 600;
          color: #667eea;
          min-width: 120px;
        }

        .result-value {
          color: #333;
          word-break: break-word;
        }

        .json-display {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
        }

        .json-label {
          font-weight: 600;
          color: #667eea;
          margin-bottom: 10px;
        }

        .json-content {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 0.85em;
          line-height: 1.5;
          margin: 0;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #999;
        }

        .empty-state svg {
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .empty-state p {
          font-size: 1.1em;
          margin: 0;
        }

        @media (max-width: 600px) {
          .scraper-header h1 {
            font-size: 1.8em;
          }

          .scraper-card {
            padding: 20px;
          }

          .input-group {
            flex-direction: column;
          }

          .result-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .result-actions {
            width: 100%;
          }

          .action-button {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default LinkedInScraper;