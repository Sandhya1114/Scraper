import React, { useState, useEffect } from 'react';
import { User, Search, Download, CheckCircle, XCircle, Loader2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import './App.css';

const App = () => {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [statusCheckCount, setStatusCheckCount] = useState(0);

  const API_URL = 'http://localhost:3001';

  // Check login status on mount and retry if login is in progress
  useEffect(() => {
    checkStatus();
  }, []);

  // Retry status check if login is in progress
  useEffect(() => {
    if (loginInProgress && statusCheckCount < 20) {
      const timer = setTimeout(() => {
        console.log('Login in progress, checking again...');
        setStatusCheckCount(prev => prev + 1);
        checkStatus();
      }, 3000); // Check every 3 seconds
      return () => clearTimeout(timer);
    }
  }, [loginInProgress, statusCheckCount]);

  const checkStatus = async () => {
    try {
      console.log('Checking status...');
      const response = await fetch(`${API_URL}/api/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Status response:', data);
      
      setIsLoggedIn(data.loggedIn);
      setLoginInProgress(data.loginInProgress || false);
      
      if (!data.loggedIn && !data.loginInProgress) {
        setError(data.error || 'Backend is running but not logged in. Please check server logs.');
      } else if (data.loginInProgress) {
        setError(null);
      } else if (data.loggedIn) {
        setError(null);
        setStatusCheckCount(0); // Reset counter on successful login
      }
      
      setStatusLoading(false);
    } catch (err) {
      console.error('Status check failed:', err);
      setError(`Cannot connect to backend: ${err.message}. Make sure server is running on http://localhost:3001`);
      setIsLoggedIn(false);
      setLoginInProgress(false);
      setStatusLoading(false);
    }
  };

  const handleScrape = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a valid LinkedIn profile URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/scrape-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Scraping failed');
      }
    } catch (err) {
      setError('Failed to scrape. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_${result.data.name || 'profile'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (statusLoading) {
    return (
      <div className="app-container">
        <div className="container">
          <div className="loading-card">
            <div className="spinner-large"></div>
            <p className="loading-text">Checking login status...</p>
            <p className="loading-subtext">Connecting to backend...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loginInProgress) {
    return (
      <div className="app-container">
        <div className="container">
          <div className="header">
            <div className="header-content">
              <User className="header-icon" />
              <h1>LinkedIn Profile Scraper</h1>
            </div>
          </div>
          <div className="loading-card">
            <Clock className="spinner-large" style={{ animation: 'pulse 2s infinite' }} />
            <p className="loading-text">Login in Progress...</p>
            <p className="loading-subtext">Please wait while we log into LinkedIn</p>
            <p className="loading-subtext" style={{ marginTop: '10px' }}>
              If this takes too long, check the browser window for verification
            </p>
            <button 
              onClick={checkStatus}
              className="btn-secondary"
              style={{ marginTop: '20px' }}
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="app-container">
        <div className="container">
          <div className="header">
            <div className="header-content">
              <User className="header-icon" />
              <h1>LinkedIn Profile Scraper</h1>
            </div>
          </div>
          <div className="error-card">
            <XCircle className="error-icon" />
            <div>
              <h3>Not Logged In</h3>
              <p>{error || 'Please restart the server to auto-login with credentials from .env file'}</p>
              <p className="error-hint">Make sure LINKEDIN_EMAIL and LINKEDIN_PASSWORD are set in .env</p>
              <button 
                onClick={checkStatus}
                className="btn-secondary"
                style={{ marginTop: '15px' }}
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="header-content">
            <User className="header-icon" />
            <h1>LinkedIn Profile Scraper</h1>
          </div>
          <p className="header-subtitle">Extract profile data from any LinkedIn profile</p>
        </div>

        {/* Status Badge */}
        <div className="status-banner">
          <CheckCircle className="status-icon" />
          <span>Logged In & Ready</span>
        </div>

        {/* Scrape Form */}
        <div className="scrape-card">
          <div className="form-group">
            <label htmlFor="profileUrl">LinkedIn Profile URL</label>
            <input
              type="url"
              id="profileUrl"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && profileUrl && handleScrape()}
              placeholder="https://www.linkedin.com/in/username/"
              className="input-field"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-card">
              <AlertCircle className="error-icon" />
              <div>
                <p>{error}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleScrape}
            disabled={loading || !profileUrl}
            className="btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="icon spin" />
                <span>Scraping...</span>
              </>
            ) : (
              <>
                <Search className="icon" />
                <span>Scrape Profile</span>
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && result.success && (
          <div className="results-container">
            {/* Results Header */}
            <div className="results-header">
              <h2>Profile Data</h2>
              <button onClick={downloadJSON} className="btn-download">
                <Download className="icon" />
                <span>Download JSON</span>
              </button>
            </div>

            {/* Basic Info */}
            <div className="info-card">
              <h3 className="card-title">Basic Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Name:</span>
                  <p className="info-value">{result.data.name || 'N/A'}</p>
                </div>
                <div className="info-item">
                  <span className="info-label">Location:</span>
                  <p className="info-value">{result.data.location || 'N/A'}</p>
                </div>
                <div className="info-item full-width">
                  <span className="info-label">Headline:</span>
                  <p className="info-value">{result.data.headline || 'N/A'}</p>
                </div>
                {result.data.connections && (
                  <div className="info-item">
                    <span className="info-label">Connections:</span>
                    <p className="info-value">{result.data.connections}</p>
                  </div>
                )}
                {result.data.about && (
                  <div className="info-item full-width">
                    <span className="info-label">About:</span>
                    <p className="info-value about-text">{result.data.about}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Experience */}
            {result.data.experience && result.data.experience.length > 0 && (
              <div className="info-card">
                <h3 className="card-title">Experience ({result.data.experience.length})</h3>
                <div className="list-container">
                  {result.data.experience.map((exp, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker"></div>
                      <div className="list-content">
                        <p className="list-title">{exp.title}</p>
                        <p className="list-subtitle">{exp.company}</p>
                        <p className="list-meta">{exp.duration}</p>
                        {exp.location && <p className="list-meta">{exp.location}</p>}
                        {exp.description && (
                          <p className="list-description">{exp.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {result.data.education && result.data.education.length > 0 && (
              <div className="info-card">
                <h3 className="card-title">Education ({result.data.education.length})</h3>
                <div className="list-container">
                  {result.data.education.map((edu, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker edu"></div>
                      <div className="list-content">
                        <p className="list-title">{edu.school}</p>
                        <p className="list-subtitle">{edu.degree}</p>
                        {edu.field && <p className="list-meta">{edu.field}</p>}
                        <p className="list-meta">{edu.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {result.data.skills && result.data.skills.length > 0 && (
              <div className="info-card">
                <h3 className="card-title">Skills ({result.data.skills.length})</h3>
                <div className="tags-container">
                  {result.data.skills.map((skill, i) => (
                    <span key={i} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {result.data.certifications && result.data.certifications.length > 0 && (
              <div className="info-card">
                <h3 className="card-title">Certifications ({result.data.certifications.length})</h3>
                <div className="list-container">
                  {result.data.certifications.map((cert, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker cert"></div>
                      <div className="list-content">
                        <p className="list-title">{cert.name}</p>
                        <p className="list-subtitle">{cert.issuer}</p>
                        {cert.date && <p className="list-meta">{cert.date}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scraped Info */}
            <div className="scraped-info">
              <p>Scraped at: {new Date(result.scrapedAt).toLocaleString()}</p>
              <p>Profile URL: <a href={result.profileUrl} target="_blank" rel="noopener noreferrer">{result.profileUrl}</a></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;