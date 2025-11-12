import React, { useState, useEffect } from 'react';
import { User, Search, Download, CheckCircle, XCircle, Loader2, AlertCircle, Clock, RefreshCw, MapPin, Briefcase, GraduationCap, Award, Code, Globe, FileText, Link as LinkIcon, Brain, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import './App.css';

const App = () => {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzingProfile, setAnalyzingProfile] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [statusCheckCount, setStatusCheckCount] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const API_URL = 'http://localhost:3001';

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (loginInProgress && statusCheckCount < 20) {
      const timer = setTimeout(() => {
        setStatusCheckCount(prev => prev + 1);
        checkStatus();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loginInProgress, statusCheckCount]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      setIsLoggedIn(data.loggedIn);
      setLoginInProgress(data.loginInProgress || false);
      
      if (!data.loggedIn && !data.loginInProgress) {
        setError(data.error || 'Backend is running but not logged in.');
      } else if (data.loginInProgress) {
        setError(null);
      } else if (data.loggedIn) {
        setError(null);
        setStatusCheckCount(0);
      }
      
      setStatusLoading(false);
    } catch (err) {
      setError(`Cannot connect to backend: ${err.message}`);
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
    setAnalysis(null);
    setShowAnalysis(false);

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

  const handleAnalyze = async () => {
    if (!result || !result.data) {
      setError('No profile data to analyze');
      return;
    }

    setAnalyzingProfile(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: result.data })
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);
        setShowAnalysis(true);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Failed to analyze profile. Check if GROQ_API_KEY is set.');
    } finally {
      setAnalyzingProfile(false);
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

  const downloadAnalysis = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_analysis_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getRatingEmoji = (rating) => {
    switch(rating) {
      case 'Excellent': return '🌟';
      case 'Good': return '👍';
      case 'Average': return '📊';
      case 'Poor': return '⚠️';
      default: return '📋';
    }
  };

  if (statusLoading) {
    return (
      <div className="app-container">
        <div className="container">
          <div className="loading-card">
            <div className="spinner-large"></div>
            <p className="loading-text">Checking login status...</p>
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
            <button onClick={checkStatus} className="btn-secondary" style={{ marginTop: '20px' }}>
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
              <p>{error || 'Please restart the server to auto-login'}</p>
              <button onClick={checkStatus} className="btn-secondary" style={{ marginTop: '15px' }}>
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
            <h1>LinkedIn Profile Scraper + AI Analysis</h1>
          </div>
          <p className="header-subtitle">Extract & analyze LinkedIn profiles with AI-powered insights</p>
        </div>

        {/* Status Badge */}
        <div className="status-banner">
          <CheckCircle className="status-icon" />
          <span>Logged In & Ready</span>
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
              disabled={loading || analyzingProfile}
            />
          </div>

          {error && (
            <div className="error-card">
              <AlertCircle className="error-icon" />
              <div><p>{error}</p></div>
            </div>
          )}

          <button
            onClick={handleScrape}
            disabled={loading || !profileUrl || analyzingProfile}
            className="btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="icon spin" />
                <span>Scraping Profile...</span>
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
              <div className="results-header-left">
                <h2>Profile Data Extracted</h2>
                <p className="results-subtitle">
                  Scraped on {new Date(result.scrapedAt).toLocaleString()}
                </p>
              </div>
              <div className="results-header-actions">
                <button onClick={downloadJSON} className="btn-download">
                  <Download className="icon" />
                  <span>Download JSON</span>
                </button>
                <button 
                  onClick={handleAnalyze} 
                  disabled={analyzingProfile}
                  className="btn-analyze"
                >
                  {analyzingProfile ? (
                    <>
                      <Loader2 className="icon spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="icon" />
                      <span>Analyze with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Analysis Results */}
            {showAnalysis && analysis && (
              <div className="analysis-container">
                {/* Overall Score Card */}
                <div className="score-card">
                  <div className="score-header">
                    <div className="score-circle" style={{ 
                      background: `conic-gradient(${getScoreColor(analysis.overallScore)} ${analysis.overallScore * 3.6}deg, rgba(255,255,255,0.2) 0deg)` 
                    }}>
                      <div className="score-inner">
                        <span className="score-number">{analysis.overallScore}</span>
                        <span className="score-max">/100</span>
                      </div>
                    </div>
                    <div className="score-info">
                      <h2 className="score-title">
                        {getRatingEmoji(analysis.rating)} {analysis.rating} Profile
                      </h2>
                      <p className="score-summary">{analysis.summary}</p>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="score-breakdown">
                    <h3>Score Breakdown</h3>
                    <div className="breakdown-grid">
                      {Object.entries(analysis.scoreBreakdown).map(([key, value]) => (
                        <div key={key} className="breakdown-item">
                          <div className="breakdown-header">
                            <span className="breakdown-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                            <span className="breakdown-value">{value}</span>
                          </div>
                          <div className="breakdown-bar">
                            <div 
                              className="breakdown-fill" 
                              style={{ 
                                width: `${(value / (key === 'completeness' ? 30 : key === 'quality' ? 25 : key === 'professionalism' ? 20 : key === 'keywords' ? 15 : 10)) * 100}%`,
                                background: getScoreColor(value * (100 / (key === 'completeness' ? 30 : key === 'quality' ? 25 : key === 'professionalism' ? 20 : key === 'keywords' ? 15 : 10)))
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Priorities */}
                  {analysis.topPriorities && analysis.topPriorities.length > 0 && (
                    <div className="priorities-section">
                      <h3><AlertTriangle className="section-icon-inline" /> Top Priorities</h3>
                      <ul className="priorities-list">
                        {analysis.topPriorities.map((priority, i) => (
                          <li key={i}>{priority}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Quick Wins */}
                  {analysis.quickWins && analysis.quickWins.length > 0 && (
                    <div className="quickwins-section">
                      <h3><Zap className="section-icon-inline" /> Quick Wins</h3>
                      <ul className="quickwins-list">
                        {analysis.quickWins.map((win, i) => (
                          <li key={i}>{win}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button onClick={downloadAnalysis} className="btn-secondary" style={{ width: '100%', marginTop: '20px' }}>
                    <Download className="icon" />
                    Download Full Analysis
                  </button>
                </div>

                {/* Section-by-Section Analysis */}
                <div className="sections-analysis">
                  <h2 className="sections-title">Detailed Section Analysis</h2>
                  
                  {Object.entries(analysis.sections).map(([sectionKey, sectionData]) => (
                    <div key={sectionKey} className="section-analysis-card">
                      <div className="section-analysis-header">
                        <h3>{sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1).replace(/([A-Z])/g, ' $1')}</h3>
                        <div className="section-badges">
                          <span className={`status-badge ${sectionData.exists ? 'exists' : 'missing'}`}>
                            {sectionData.exists ? '✓ Exists' : '✗ Missing'}
                          </span>
                          <span className="score-badge" style={{ background: getScoreColor(sectionData.score * 10) }}>
                            {sectionData.score}/10
                          </span>
                        </div>
                      </div>

                      {sectionData.current && (
                        <div className="current-content">
                          <h4>Current:</h4>
                          <p>{sectionData.current}</p>
                        </div>
                      )}

                      {sectionData.count !== undefined && (
                        <p className="section-count">Found: {sectionData.count} {sectionKey}</p>
                      )}

                      {sectionData.issues && sectionData.issues.length > 0 && (
                        <div className="issues-block">
                          <h4><AlertCircle className="inline-icon" /> Issues:</h4>
                          <ul>
                            {sectionData.issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sectionData.suggestions && sectionData.suggestions.length > 0 && (
                        <div className="suggestions-block">
                          <h4><TrendingUp className="inline-icon" /> Suggestions:</h4>
                          <ul>
                            {sectionData.suggestions.map((suggestion, i) => (
                              <li key={i}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sectionData.examples && sectionData.examples.length > 0 && (
                        <div className="examples-block">
                          <h4>💡 Example Rewrites:</h4>
                          {sectionData.examples.map((example, i) => (
                            <div key={i} className="example-item">
                              <p><strong>Option {i + 1}:</strong> {example}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {sectionData.keywords && sectionData.keywords.length > 0 && (
                        <div className="keywords-block">
                          <h4>🔑 Recommended Keywords:</h4>
                          <div className="keywords-tags">
                            {sectionData.keywords.map((keyword, i) => (
                              <span key={i} className="keyword-tag">{keyword}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Display (existing code) */}
            <div className="profile-card">
              <div className="profile-header">
                {result.data.profileImage && (
                  <div className="profile-image-wrapper">
                    <img 
                      src={result.data.profileImage} 
                      alt={result.data.name || 'Profile'} 
                      className="profile-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="profile-info">
                  <h2 className="profile-name">{result.data.name || 'N/A'}</h2>
                  {result.data.headline && <p className="profile-headline">{result.data.headline}</p>}
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

            {/* Rest of profile sections (experience, education, etc.) - keeping existing code */}
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
                        {exp.description && <p className="list-description">{exp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {result.data.skills && result.data.skills.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <Code className="title-icon" />
                  Skills
                  <span className="count-badge">{result.data.skills.length}</span>
                </h3>
                <div className="tags-container">
                  {result.data.skills.map((skill, i) => (
                    <span key={i} className="tag skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                        {proj.description && <p className="list-description">{proj.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.data.languages && result.data.languages.length > 0 && (
              <div className="data-card">
                <h3 className="card-title">
                  <Globe className="title-icon" />
                  Languages
                  <span className="count-badge">{result.data.languages.length}</span>
                </h3>
                <div className="tags-container">
                  {result.data.languages.map((lang, i) => (
                    <span key={i} className="tag language-tag">{lang}</span>
                  ))}
                </div>
              </div>
            )}

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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;