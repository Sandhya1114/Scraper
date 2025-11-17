import React, { useState, useEffect } from 'react';
import { User, Search, Download, CheckCircle, XCircle, Loader2, AlertCircle, Clock, RefreshCw, Brain, TrendingUp, AlertTriangle, Zap, FileText, Award, ChevronDown, ChevronUp } from 'lucide-react';

const App = () => {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [statusCheckCount, setStatusCheckCount] = useState(0);
  const [scrapedProfile, setScrapedProfile] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

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

  const handleAnalyze = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a valid LinkedIn profile URL');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setScrapedProfile(null);

    try {
      const scrapeResponse = await fetch(`${API_URL}/api/scrape-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl })
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeData.success) {
        setError(scrapeData.error || 'Scraping failed');
        setLoading(false);
        return;
      }

      setScrapedProfile(scrapeData);

      const analyzeResponse = await fetch(`${API_URL}/api/analyze-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: scrapeData.data })
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeData.success) {
        setAnalysis(analyzeData.analysis);
      } else {
        setError(analyzeData.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Failed to analyze profile. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const downloadAnalysis = () => {
    if (!analysis) return;
    const fullReport = {
      profileUrl: profileUrl,
      analyzedAt: new Date().toISOString(),
      analysis: analysis,
      profileData: scrapedProfile?.data
    };
    const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_analysis_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getPriorityIcon = (type) => {
    if (type === 'critical') return <AlertCircle size={20} color="#ef4444" />;
    if (type === 'warning') return <AlertTriangle size={20} color="#f59e0b" />;
    return <Zap size={20} color="#10b981" />;
  };

  if (statusLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <div style={styles.spinnerLarge}></div>
          <p style={styles.loadingText}>Checking login status...</p>
        </div>
      </div>
    );
  }

  if (loginInProgress) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.h1}>
              <Brain size={28} color="#0a66c2" />
              LinkedIn Profile Analyzer
            </h1>
          </div>
        </div>
        <div style={styles.loadingCard}>
          <Clock size={56} color="#0a66c2" />
          <p style={styles.loadingText}>Login in Progress...</p>
          <p style={styles.loadingSubtext}>Please wait while we log into LinkedIn</p>
          <button onClick={checkStatus} style={styles.btnSecondary}>
            <RefreshCw size={20} />
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.h1}>
              <Brain size={28} color="#0a66c2" />
              LinkedIn Profile Analyzer
            </h1>
          </div>
        </div>
        <div style={styles.errorCard}>
          <XCircle size={24} color="#ef4444" />
          <div>
            <h3 style={styles.errorTitle}>Not Logged In</h3>
            <p style={styles.errorText}>{error || 'Please restart the server to auto-login'}</p>
            <button onClick={checkStatus} style={styles.btnSecondary}>
              <RefreshCw size={20} />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.h1}>
              <Brain size={28} color="#0a66c2" />
              LinkedIn Profile Analyzer
            </h1>
            <p style={styles.subtitle}>Paste your LinkedIn URL to get instant analysis and actionable feedback</p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {isLoggedIn && (
        <div style={styles.statusBanner}>
          <CheckCircle size={18} />
          <span>Ready to Analyze</span>
        </div>
      )}

      <div style={styles.content}>
        {/* Input Section */}
        <div style={styles.inputSection}>
          <div style={styles.card}>
            <label style={styles.label}>Enter your LinkedIn profile URL...</label>
            <div style={styles.inputWrapper}>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && profileUrl && handleAnalyze()}
                placeholder="https://www.linkedin.com/in/username/"
                style={styles.input}
                disabled={loading}
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || !profileUrl}
                style={{...styles.btnPrimary, opacity: (loading || !profileUrl) ? 0.6 : 1}}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Analyze
                  </>
                )}
              </button>
            </div>

            {error && (
              <div style={styles.errorBanner}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results Layout */}
        {analysis && (
          <div style={styles.mainContent}>
            {/* Left Sidebar */}
            <div style={styles.sidebar}>
              {/* Profile Card */}
              {scrapedProfile?.data && (
                <div style={styles.card}>
                  <div style={styles.profileHeader}>
                    {scrapedProfile.data.profileImage ? (
                      <img src={scrapedProfile.data.profileImage} alt="Profile" style={styles.profileImage} />
                    ) : (
                      <div style={styles.profileImagePlaceholder}>
                        <User size={48} color="#94a3b8" />
                      </div>
                    )}
                    <div style={styles.profileInfo}>
                      <h2 style={styles.profileName}>{scrapedProfile.data.name || 'User'}</h2>
                      <p style={styles.profileHeadline}>{scrapedProfile.data.headline || 'No headline'}</p>
                      {scrapedProfile.data.location && (
                        <p style={styles.profileLocation}>{scrapedProfile.data.location}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Score Card */}
              <div style={styles.card}>
                <h3 style={styles.sidebarTitle}>Your Profile Score</h3>
                <div style={styles.scoreCircleContainer}>
                  <svg width="180" height="180" style={styles.scoreCircleSvg}>
                    <circle cx="90" cy="90" r="80" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle 
                      cx="90" 
                      cy="90" 
                      r="80" 
                      fill="none" 
                      stroke={getScoreColor(analysis.overallScore)} 
                      strokeWidth="12"
                      strokeDasharray={`${(analysis.overallScore / 100) * 502.4} 502.4`}
                      strokeLinecap="round"
                      transform="rotate(-90 90 90)"
                    />
                  </svg>
                  <div style={styles.scoreCircleText}>
                    <span style={styles.scoreNumber}>{analysis.overallScore}</span>
                    <span style={styles.scoreMax}>/100</span>
                  </div>
                </div>
                <p style={styles.scoreLabel}>{analysis.rating}</p>
                <p style={styles.scoreDescription}>{analysis.summary}</p>
                
                <button onClick={downloadAnalysis} style={styles.btnDownload}>
                  <Download size={18} />
                  Download Report
                </button>
              </div>
            </div>

            {/* Right Content */}
            <div style={styles.rightContent}>
              {/* Improvement Suggestions */}
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Improvement Suggestions</h2>
                <p style={styles.sectionSubtitle}>Actionable insights to boost your score and visibility</p>

                {/* Top Priorities */}
                {analysis.topPriorities && analysis.topPriorities.length > 0 && (
                  <div style={styles.suggestionsContainer}>
                    {analysis.topPriorities.slice(0, 3).map((priority, i) => (
                      <div key={i} style={styles.suggestionCard} onClick={() => toggleSection(`priority-${i}`)}>
                        <div style={styles.suggestionHeader}>
                          <div style={styles.suggestionIcon}>
                            {i === 0 ? <AlertCircle size={20} color="#ef4444" /> : 
                             i === 1 ? <AlertTriangle size={20} color="#f59e0b" /> :
                             <Zap size={20} color="#10b981" />}
                          </div>
                          <div style={styles.suggestionContent}>
                            <h3 style={styles.suggestionTitle}>{priority}</h3>
                            <span style={i === 0 ? styles.badgeCritical : i === 1 ? styles.badgeWarning : styles.badgeSuccess}>
                              {i === 0 ? 'Critical Fix' : i === 1 ? 'Improvement' : 'Well Done'}
                            </span>
                          </div>
                          {expandedSections[`priority-${i}`] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Wins */}
                {analysis.quickWins && analysis.quickWins.length > 0 && (
                  <div style={{marginTop: '24px'}}>
                    {analysis.quickWins.map((win, i) => (
                      <div key={i} style={styles.quickWinCard}>
                        <Zap size={18} color="#10b981" />
                        <span>{win}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section Analysis */}
              {Object.entries(analysis.sections).map(([sectionKey, sectionData]) => (
                <div key={sectionKey} style={styles.card}>
                  <div style={styles.sectionCardHeader} onClick={() => toggleSection(sectionKey)}>
                    <div style={styles.sectionHeaderLeft}>
                      {sectionData.exists ? 
                        <div style={styles.iconSuccess}><CheckCircle size={20} /></div> :
                        <div style={styles.iconError}><XCircle size={20} /></div>
                      }
                      <div>
                        <h3 style={styles.sectionName}>
                          {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1).replace(/([A-Z])/g, ' $1')}
                        </h3>
                        {sectionData.count !== undefined && (
                          <p style={styles.sectionCount}>Found: {sectionData.count} {sectionKey}</p>
                        )}
                      </div>
                    </div>
                    <div style={styles.sectionHeaderRight}>
                      <span style={{...styles.scoreBadge, background: getScoreColor(sectionData.score * 10)}}>
                        {sectionData.score}/10
                      </span>
                      {expandedSections[sectionKey] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {expandedSections[sectionKey] && (
                    <div style={styles.sectionContent}>
                      {sectionData.current && (
                        <div style={styles.currentBlock}>
                          <p style={styles.blockLabel}>Current:</p>
                          <p style={styles.blockText}>{sectionData.current}</p>
                        </div>
                      )}

                      {sectionData.issues && sectionData.issues.length > 0 && (
                        <div style={styles.issuesBlock}>
                          <p style={styles.blockLabel}>
                            <AlertCircle size={16} /> Issues:
                          </p>
                          <ul style={styles.blockList}>
                            {sectionData.issues.map((issue, i) => (
                              <li key={i} style={styles.listItem}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sectionData.suggestions && sectionData.suggestions.length > 0 && (
                        <div style={styles.suggestionsBlock}>
                          <p style={styles.blockLabel}>
                            <TrendingUp size={16} /> Suggestions:
                          </p>
                          <ul style={styles.blockList}>
                            {sectionData.suggestions.map((suggestion, i) => (
                              <li key={i} style={styles.listItem}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sectionData.examples && sectionData.examples.length > 0 && (
                        <div style={styles.examplesBlock}>
                          <p style={styles.blockLabel}>💡 Example Rewrites:</p>
                          {sectionData.examples.map((example, i) => (
                            <div key={i} style={styles.exampleCard}>
                              <strong>Option {i + 1}:</strong> {example}
                            </div>
                          ))}
                        </div>
                      )}

                      {sectionData.keywords && sectionData.keywords.length > 0 && (
                        <div style={styles.keywordsBlock}>
                          <p style={styles.blockLabel}>🔑 Recommended Keywords:</p>
                          <div style={styles.keywordsTags}>
                            {sectionData.keywords.map((keyword, i) => (
                              <span key={i} style={styles.keywordTag}>{keyword}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: '#f8fafc',
    minHeight: '100vh',
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '20px 0',
  },
  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 40px',
  },
  h1: {
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: 0,
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#64748b',
    margin: '8px 0 0 0',
  },
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    maxWidth: '1400px',
    margin: '20px auto',
    color: '#059669',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 40px 40px',
  },
  inputSection: {
    marginBottom: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  },
  label: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '12px',
    display: 'block',
  },
  inputWrapper: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '14px 18px',
    fontSize: '0.95rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#fff',
    color: '#1e293b',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  btnPrimary: {
    padding: '14px 32px',
    background: '#0a66c2',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 0.2s',
    whiteSpace: 'nowrap',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.9rem',
    marginTop: '16px',
  },
  btnDownload: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.9rem',
    marginTop: '20px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    marginTop: '12px',
    color: '#dc2626',
    fontSize: '0.9rem',
  },
  errorCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '24px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '12px',
    margin: '40px auto',
    maxWidth: '600px',
    color: '#991b1b',
  },
  errorTitle: {
    fontSize: '1.1rem',
    marginBottom: '8px',
    fontWeight: '700',
    color: '#991b1b',
  },
  errorText: {
    color: '#dc2626',
    margin: '4px 0',
    fontSize: '0.95rem',
  },
  loadingCard: {
    textAlign: 'center',
    padding: '60px 30px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    margin: '40px auto',
    maxWidth: '500px',
  },
  spinnerLarge: {
    width: '48px',
    height: '48px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#0a66c2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  loadingText: {
    fontSize: '1.2rem',
    color: '#1e293b',
    fontWeight: '700',
    marginBottom: '8px',
  },
  loadingSubtext: {
    fontSize: '0.95rem',
    color: '#64748b',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  sidebar: {
    position: 'sticky',
    top: '20px',
  },
  profileHeader: {
    textAlign: 'center',
  },
  profileImage: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    objectFit: 'cover',
    margin: '0 auto 16px',
    border: '3px solid #e2e8f0',
  },
  profileImagePlaceholder: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  profileInfo: {
    textAlign: 'center',
  },
  profileName: {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 8px 0',
  },
  profileHeadline: {
    fontSize: '0.9rem',
    color: '#64748b',
    margin: '0 0 4px 0',
    lineHeight: '1.5',
  },
  profileLocation: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    margin: 0,
  },
  sidebarTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '20px',
    textAlign: 'center',
  },
  scoreCircleContainer: {
    position: 'relative',
    width: '180px',
    height: '180px',
    margin: '0 auto 20px',
  },
  scoreCircleSvg: {
    transform: 'rotate(-90deg)',
  },
  scoreCircleText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
  },
  scoreNumber: {
    fontSize: '3rem',
    fontWeight: '800',
    color: '#1e293b',
    display: 'block',
    lineHeight: '1',
  },
  scoreMax: {
    fontSize: '1rem',
    color: '#94a3b8',
    fontWeight: '600',
  },
  scoreLabel: {
    textAlign: 'center',
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '8px',
  },
  scoreDescription: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: '1.5',
    margin: '0 0 20px 0',
  },
  rightContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '8px',
  },
  sectionSubtitle: {
    fontSize: '0.95rem',
    color: '#64748b',
    marginBottom: '24px',
  },
  suggestionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  suggestionCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: '#fff',
  },
  suggestionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: 'space-between',
  },
  suggestionIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    flexShrink: 0,
  },
  suggestionContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  suggestionTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: 0,
  },
  badgeCritical: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    background: '#fee2e2',
    color: '#dc2626',
    whiteSpace: 'nowrap',
  },
  badgeWarning: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    background: '#fef3c7',
    color: '#d97706',
    whiteSpace: 'nowrap',
  },
  badgeSuccess: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    background: '#d1fae5',
    color: '#059669',
    whiteSpace: 'nowrap',
  },
   quickWinCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    marginBottom: '8px',
    fontSize: '0.9rem',
    color: '#166534',
    fontWeight: '500',
  },
  sectionCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    padding: '4px 0',
    transition: 'all 0.2s',
  },
  sectionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
  },
  sectionHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconSuccess: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#d1fae5',
    color: '#059669',
    flexShrink: 0,
  },
  iconError: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fee2e2',
    color: '#dc2626',
    flexShrink: 0,
  },
  sectionName: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: 0,
  },
  sectionCount: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '4px 0 0 0',
  },
  scoreBadge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'white',
  },
  sectionContent: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0',
  },
  currentBlock: {
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  blockLabel: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#475569',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  blockText: {
    fontSize: '0.9rem',
    color: '#1e293b',
    lineHeight: '1.6',
    margin: 0,
  },
  issuesBlock: {
    padding: '16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  suggestionsBlock: {
    padding: '16px',
    background: '#f0f9ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  examplesBlock: {
    padding: '16px',
    background: '#fefce8',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  keywordsBlock: {
    padding: '16px',
    background: '#f5f3ff',
    border: '1px solid #ddd6fe',
    borderRadius: '8px',
  },
  blockList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
  },
  listItem: {
    fontSize: '0.9rem',
    color: '#334155',
    lineHeight: '1.7',
    marginBottom: '6px',
  },
  exampleCard: {
    padding: '12px',
    background: '#fff',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '0.9rem',
    color: '#334155',
    lineHeight: '1.6',
    border: '1px solid #fde68a',
  },
  keywordsTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  keywordTag: {
    padding: '6px 12px',
    background: '#fff',
    border: '1px solid #ddd6fe',
    borderRadius: '20px',
    fontSize: '0.85rem',
    color: '#6366f1',
    fontWeight: '500',
  },
  }
  export default App;