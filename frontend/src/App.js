import React, { useState, useEffect } from 'react';
import { User, Search, Download, CheckCircle, XCircle, Loader2, AlertCircle, Clock, RefreshCw, MapPin, Briefcase, GraduationCap, Award, Code, Globe, FileText, Link as LinkIcon } from 'lucide-react';
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
  const [elapsedTime, setElapsedTime] = useState(0);

  const API_URL = 'http://localhost:3001';

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (loginInProgress && statusCheckCount < 20) {
      const timer = setTimeout(() => {
        console.log('Login in progress, checking again...');
        setStatusCheckCount(prev => prev + 1);
        checkStatus();
      }, 3000);
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
        setStatusCheckCount(0);
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
    setElapsedTime(0);

    // Start real-time timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 10); // Update every 10ms for smooth animation

    try {
      const response = await fetch(`${API_URL}/api/scrape-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl })
      });

      const data = await response.json();
      clearInterval(timerInterval);

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Scraping failed');
      }
    } catch (err) {
      clearInterval(timerInterval);
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
    a.download = `linkedin_${result.data.name?.replace(/\s+/g, '_') || 'profile'}_${Date.now()}.json`;
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
              <RefreshCw className="icon" />
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
                <RefreshCw className="icon" />
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
          <p className="header-subtitle">⚡ Ultra-Fast Extraction - Target: &lt;1 Second</p>
        </div>

        {/* Status Badge */}
        <div className="status-banner">
          <CheckCircle className="status-icon" />
          <span>Logged In & Ready for Sub-1s Scraping</span>
        </div>

        {/* Scrape Form */}
        <div className="scrape-card">
          <div className="form-group">
            <label htmlFor="profileUrl">
              <LinkIcon className="label-icon" />
              LinkedIn Profile URL
            </label>
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

          {loading && (
            <div className="scraping-timer">
              <Clock className="icon spin" />
              <span className="scraping-timer-text">
                {(elapsedTime / 1000).toFixed(3)}s
              </span>
            </div>
          )}
        </div>

        {/* Results */}
        {result && result.success && (
          <div className="results-container">
            {/* Results Header */}
            <div className="results-header">
              <div className="results-header-left">
                <h2>
                  Profile Data Extracted
                  {result.timeSeconds && parseFloat(result.timeSeconds) < 1.0 && (
                    <span className="speed-indicator blazing">
                      ⚡ SUB-1s
                    </span>
                  )}
                  {result.timeSeconds && parseFloat(result.timeSeconds) >= 1.0 && parseFloat(result.timeSeconds) < 2.0 && (
                    <span className="speed-indicator ultra-fast">
                      🚀 ULTRA FAST
                    </span>
                  )}
                </h2>
                <div className="timing-badge">
                  <Clock className="timing-icon" />
                  <span className="timing-text">
                    Completed in <strong>{result.timeTaken}</strong> ({result.timeSeconds}s)
                  </span>
                </div>
                <p className="results-subtitle">
                  Scraped on {new Date(result.scrapedAt).toLocaleString()}
                </p>
              </div>
              <button onClick={downloadJSON} className="btn-download">
                <Download className="icon" />
                <span>Download JSON</span>
              </button>
            </div>

            {/* Profile Card with Image */}
            <div className="profile-card">
              <div className="profile-header">
                {result.data.profileImage && (
                  <div className="profile-image-wrapper">
                    <img 
                      src={result.data.profileImage} 
                      alt={result.data.name || 'Profile'} 
                      className="profile-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="profile-info">
                  <h2 className="profile-name">{result.data.name || 'N/A'}</h2>
                  {result.data.headline && (
                    <p className="profile-headline">{result.data.headline}</p>
                  )}
                  <div className="profile-meta">
                    {result.data.location && (
                      <div className="meta-item">
                        <MapPin className="meta-icon" />
                        <span>{result.data.location}</span>
                      </div>
                    )}
                    {result.data.connections && (
                      <div className="meta-item">
                        <User className="meta-icon" />
                        <span>{result.data.connections}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {result.data.about && (
                <div className="profile-about">
                  <h3 className="section-title">
                    <FileText className="section-icon" />
                    About
                  </h3>
                  <p className="about-text">{result.data.about}</p>
                </div>
              )}
            </div>

            {/* Experience */}
            {result.data.experience && result.data.experience.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <Briefcase className="title-icon" />
                  Experience
                  <span className="count-badge">{result.data.experience.length}</span>
                </h3>
                <div className="list-container">
                  {result.data.experience.map((exp, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker experience"></div>
                      <div className="list-content">
                        <p className="list-title">{exp.title || 'N/A'}</p>
                        {exp.company && <p className="list-subtitle">{exp.company}</p>}
                        {exp.duration && <p className="list-meta">{exp.duration}</p>}
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
              <div className="data-card">
                <h3 className="card-title">
                  <GraduationCap className="title-icon" />
                  Education
                  <span className="count-badge">{result.data.education.length}</span>
                </h3>
                <div className="list-container">
                  {result.data.education.map((edu, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker education"></div>
                      <div className="list-content">
                        <p className="list-title">{edu.school || 'N/A'}</p>
                        {edu.degree && <p className="list-subtitle">{edu.degree}</p>}
                        {edu.field && <p className="list-meta">{edu.field}</p>}
                        {edu.duration && <p className="list-meta">{edu.duration}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {result.data.skills && result.data.skills.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <Code className="title-icon" />
                  Skills
                  <span className="count-badge">{result.data.skills.length}</span>
                </h3>
                <div className="tags-container">
                  {result.data.skills.map((skill, i) => (
                    <span key={i} className="tag skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {result.data.certifications && result.data.certifications.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <Award className="title-icon" />
                  Certifications
                  <span className="count-badge">{result.data.certifications.length}</span>
                </h3>
                <div className="list-container">
                  {result.data.certifications.map((cert, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker certification"></div>
                      <div className="list-content">
                        <p className="list-title">{cert.name || 'N/A'}</p>
                        {cert.issuer && <p className="list-subtitle">{cert.issuer}</p>}
                        {cert.date && <p className="list-meta">{cert.date}</p>}
                        {cert.credentialId && (
                          <p className="list-meta credential-id">{cert.credentialId}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {result.data.projects && result.data.projects.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <FileText className="title-icon" />
                  Projects
                  <span className="count-badge">{result.data.projects.length}</span>
                </h3>
                <div className="list-container">
                  {result.data.projects.map((proj, i) => (
                    <div key={i} className="list-item">
                      <div className="list-marker project"></div>
                      <div className="list-content">
                        <p className="list-title">{proj.name || 'N/A'}</p>
                        {proj.date && <p className="list-meta">{proj.date}</p>}
                        {proj.association && <p className="list-meta">{proj.association}</p>}
                        {proj.description && (
                          <p className="list-description">{proj.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {result.data.languages && result.data.languages.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <Globe className="title-icon" />
                  Languages
                  <span className="count-badge">{result.data.languages.length}</span>
                </h3>
                <div className="tags-container">
                  {result.data.languages.map((lang, i) => (
                    <span key={i} className="tag language-tag">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="scraped-info">
              <div className="info-row">
                <span className="info-label">Profile URL:</span>
                <a href={result.profileUrl} target="_blank" rel="noopener noreferrer" className="info-link">
                  {result.profileUrl}
                </a>
              </div>
              <div className="info-row">
                <span className="info-label">Scraped At:</span>
                <span className="info-value">{new Date(result.scrapedAt).toLocaleString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Performance:</span>
                <span className="info-value">
                  {parseFloat(result.timeSeconds) < 1.0 ? '⚡ Lightning Fast' : '🚀 Ultra Fast'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;