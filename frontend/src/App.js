import React, { useState, useEffect } from 'react';
import { User, Search, Download, CheckCircle, XCircle, Loader2, AlertCircle, Clock, RefreshCw, Brain, TrendingUp, AlertTriangle, Zap, FileText, Award } from 'lucide-react';

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
      // Step 1: Scrape profile
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

      // Step 2: Automatically analyze
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
            <User size={52} color="#fff" />
            <h1 style={styles.h1}>LinkedIn Profile Analyzer</h1>
          </div>
        </div>
        <div style={styles.loadingCard}>
          <Clock size={56} style={{ margin: '0 auto 24px', animation: 'pulse 2s infinite' }} />
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
            <User size={52} color="#fff" />
            <h1 style={styles.h1}>LinkedIn Profile Analyzer</h1>
          </div>
        </div>
        <div style={styles.errorCard}>
          <XCircle size={26} />
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
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <Brain size={52} color="#fff" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} />
            <h1 style={styles.h1}>LinkedIn Profile Analyzer</h1>
          </div>
          <p style={styles.subtitle}>AI-powered profile analysis with actionable insights</p>
        </div>

        {/* Status Badge */}
        <div style={styles.statusBanner}>
          <CheckCircle size={24} />
          <span>Ready to Analyze</span>
        </div>

        {/* Input Form */}
        <div style={styles.card}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <FileText size={18} />
              LinkedIn Profile URL
            </label>
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && profileUrl && handleAnalyze()}
              placeholder="https://www.linkedin.com/in/username/"
              style={styles.input}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={styles.errorCard}>
              <AlertCircle size={26} />
              <div><p style={styles.errorText}>{error}</p></div>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !profileUrl}
            style={{...styles.btnPrimary, opacity: (loading || !profileUrl) ? 0.6 : 1}}
          >
            {loading ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Analyzing Profile...</span>
              </>
            ) : (
              <>
                <Brain size={20} />
                <span>Analyze Profile</span>
              </>
            )}
          </button>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div style={styles.resultsContainer}>
            {/* Overall Score Card */}
            <div style={styles.scoreCard}>
              <div style={styles.scoreHeader}>
                <div style={{
                  ...styles.scoreCircle,
                  background: `conic-gradient(${getScoreColor(analysis.overallScore)} ${analysis.overallScore * 3.6}deg, rgba(255,255,255,0.2) 0deg)`
                }}>
                  <div style={styles.scoreInner}>
                    <span style={styles.scoreNumber}>{analysis.overallScore}</span>
                    <span style={styles.scoreMax}>/100</span>
                  </div>
                </div>
                <div style={styles.scoreInfo}>
                  <h2 style={styles.scoreTitle}>
                    {getRatingEmoji(analysis.rating)} {analysis.rating} Profile
                  </h2>
                  <p style={styles.scoreSummary}>{analysis.summary}</p>
                </div>
              </div>

              {/* Score Breakdown */}
              <div style={styles.scoreBreakdown}>
                <h3 style={styles.breakdownTitle}>Score Breakdown</h3>
                <div style={styles.breakdownGrid}>
                  {Object.entries(analysis.scoreBreakdown).map(([key, value]) => {
                    const maxScore = key === 'completeness' ? 30 : key === 'quality' ? 25 : key === 'professionalism' ? 20 : key === 'keywords' ? 15 : 10;
                    return (
                      <div key={key} style={styles.breakdownItem}>
                        <div style={styles.breakdownHeader}>
                          <span style={styles.breakdownLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                          <span style={styles.breakdownValue}>{value}/{maxScore}</span>
                        </div>
                        <div style={styles.breakdownBar}>
                          <div 
                            style={{
                              ...styles.breakdownFill,
                              width: `${(value / maxScore) * 100}%`,
                              background: getScoreColor(value * (100 / maxScore))
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Priorities */}
              {analysis.topPriorities && analysis.topPriorities.length > 0 && (
                <div style={styles.prioritiesSection}>
                  <h3 style={styles.sectionTitle}>
                    <AlertTriangle size={24} color="#fbbf24" /> Top Priorities
                  </h3>
                  <ul style={styles.list}>
                    {analysis.topPriorities.map((priority, i) => (
                      <li key={i} style={styles.listItem}>{priority}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Wins */}
              {analysis.quickWins && analysis.quickWins.length > 0 && (
                <div style={styles.quickWinsSection}>
                  <h3 style={styles.sectionTitle}>
                    <Zap size={24} color="#fbbf24" /> Quick Wins
                  </h3>
                  <ul style={styles.list}>
                    {analysis.quickWins.map((win, i) => (
                      <li key={i} style={styles.listItemWin}>{win}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button onClick={downloadAnalysis} style={styles.btnDownload}>
                <Download size={20} />
                Download Full Report
              </button>
            </div>

            {/* Detailed Section Analysis */}
            <div style={styles.sectionsAnalysis}>
              <h2 style={styles.sectionsTitle}>Detailed Section Analysis</h2>
              
              {Object.entries(analysis.sections).map(([sectionKey, sectionData]) => (
                <div key={sectionKey} style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionName}>
                      {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1).replace(/([A-Z])/g, ' $1')}
                    </h3>
                    <div style={styles.badges}>
                      <span style={sectionData.exists ? styles.badgeExists : styles.badgeMissing}>
                        {sectionData.exists ? '✓ Exists' : '✗ Missing'}
                      </span>
                      <span style={{...styles.scoreBadge, background: getScoreColor(sectionData.score * 10)}}>
                        {sectionData.score}/10
                      </span>
                    </div>
                  </div>

                  {sectionData.current && (
                    <div style={styles.currentContent}>
                      <h4 style={styles.currentTitle}>Current:</h4>
                      <p style={styles.currentText}>{sectionData.current}</p>
                    </div>
                  )}

                  {sectionData.count !== undefined && (
                    <p style={styles.sectionCount}>Found: {sectionData.count} {sectionKey}</p>
                  )}

                  {sectionData.issues && sectionData.issues.length > 0 && (
                    <div style={styles.issuesBlock}>
                      <h4 style={styles.blockTitle}>
                        <AlertCircle size={20} /> Issues:
                      </h4>
                      <ul style={styles.blockList}>
                        {sectionData.issues.map((issue, i) => (
                          <li key={i} style={styles.issueItem}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sectionData.suggestions && sectionData.suggestions.length > 0 && (
                    <div style={styles.suggestionsBlock}>
                      <h4 style={styles.blockTitle}>
                        <TrendingUp size={20} /> Suggestions:
                      </h4>
                      <ul style={styles.blockList}>
                        {sectionData.suggestions.map((suggestion, i) => (
                          <li key={i} style={styles.suggestionItem}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sectionData.examples && sectionData.examples.length > 0 && (
                    <div style={styles.examplesBlock}>
                      <h4 style={styles.blockTitle}>💡 Example Rewrites:</h4>
                      {sectionData.examples.map((example, i) => (
                        <div key={i} style={styles.exampleItem}>
                          <p style={styles.exampleText}><strong>Option {i + 1}:</strong> {example}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {sectionData.keywords && sectionData.keywords.length > 0 && (
                    <div style={styles.keywordsBlock}>
                      <h4 style={styles.blockTitle}>🔑 Recommended Keywords:</h4>
                      <div style={styles.keywordsTags}>
                        {sectionData.keywords.map((keyword, i) => (
                          <span key={i} style={styles.keywordTag}>{keyword}</span>
                        ))}
                      </div>
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
    background: 'linear-gradient(135deg, #0a66c2 0%, #004182 50%, #0077b5 100%)',
    minHeight: '100vh',
    padding: '20px',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    paddingTop: '40px',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '15px',
  },
  h1: {
    fontSize: '2.8rem',
    fontWeight: '800',
    margin: 0,
    color: '#fff',
    textShadow: '0 2px 15px rgba(0,0,0,0.3)',
  },
  subtitle: {
    fontSize: '1.15rem',
    color: 'rgba(255,255,255,0.92)',
    margin: 0,
    fontWeight: '500',
  },
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '14px 28px',
    background: 'rgba(16,185,129,0.25)',
    border: '2px solid rgba(16,185,129,0.6)',
    backdropFilter: 'blur(12px)',
    borderRadius: '14px',
    marginBottom: '30px',
    color: '#6ee7b7',
    fontWeight: '600',
    fontSize: '1.05rem',
    boxShadow: '0 4px 20px rgba(16,185,129,0.2)',
  },
  card: {
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(12px)',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '30px',
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  },
  formGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '600',
    marginBottom: '12px',
  },
  input: {
    width: '100%',
    padding: '18px 22px',
    fontSize: '1.05rem',
    border: '2px solid transparent',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.96)',
    color: '#1e293b',
    outline: 'none',
    fontWeight: '500',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    width: '100%',
    padding: '18px 36px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontSize: '1.05rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    boxShadow: '0 6px 20px rgba(139,92,246,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 28px',
    background: 'rgba(255,255,255,0.22)',
    color: 'white',
    border: '2px solid rgba(255,255,255,0.45)',
    borderRadius: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '1rem',
    marginTop: '20px',
  },
  btnDownload: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '1rem',
    marginTop: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  errorCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '22px',
    background: 'rgba(239,68,68,0.22)',
    border: '2px solid rgba(239,68,68,0.55)',
    borderRadius: '14px',
    marginBottom: '22px',
    color: '#fca5a5',
  },
  errorTitle: {
    fontSize: '1.25rem',
    marginBottom: '10px',
    fontWeight: '700',
  },
  errorText: {
    color: '#fecaca',
    margin: '6px 0',
    fontSize: '1rem',
    lineHeight: '1.5',
  },
  loadingCard: {
    textAlign: 'center',
    padding: '70px 30px',
    background: 'rgba(255,255,255,0.18)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.25)',
  },
  spinnerLarge: {
    width: '56px',
    height: '56px',
    border: '5px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 24px',
  },
  loadingText: {
    fontSize: '1.3rem',
    color: '#fff',
    fontWeight: '700',
    marginBottom: '10px',
  },
  loadingSubtext: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.85)',
  },
  resultsContainer: {
    animation: 'fadeInUp 0.6s ease-out',
  },
  scoreCard: {
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(12px)',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '30px',
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  },
  scoreHeader: {
    display: 'flex',
    gap: '40px',
    alignItems: 'center',
    marginBottom: '40px',
    flexWrap: 'wrap',
  },
  scoreCircle: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreInner: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: '3.5rem',
    fontWeight: '800',
    color: '#1e293b',
    lineHeight: '1',
  },
  scoreMax: {
    fontSize: '1.2rem',
    color: '#64748b',
    fontWeight: '600',
  },
  scoreInfo: {
    flex: 1,
    minWidth: '300px',
  },
  scoreTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '16px',
    textShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  scoreSummary: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: '1.7',
    margin: 0,
  },
  scoreBreakdown: {
    background: 'rgba(0,0,0,0.2)',
    padding: '30px',
    borderRadius: '16px',
    marginBottom: '30px',
  },
  breakdownTitle: {
    color: '#fff',
    fontSize: '1.4rem',
    marginBottom: '20px',
    fontWeight: '700',
  },
  breakdownGrid: {
    display: 'grid',
    gap: '20px',
  },
  breakdownItem: {
    background: 'rgba(255,255,255,0.1)',
    padding: '16px',
    borderRadius: '12px',
  },
  breakdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  breakdownLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: '1rem',
  },
  breakdownValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: '1.1rem',
  },
  breakdownBar: {
    height: '8px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.6s ease',
  },
  prioritiesSection: {
    background: 'rgba(0,0,0,0.2)',
    padding: '24px',
    borderRadius: '14px',
    marginBottom: '20px',
  },
  quickWinsSection: {
    background: 'rgba(0,0,0,0.2)',
    padding: '24px',
    borderRadius: '14px',
    marginBottom: '20px',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '1.3rem',
    marginBottom: '16px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    color: 'rgba(255,255,255,0.9)',
    padding: '12px 16px 12px 40px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    marginBottom: '10px',
    lineHeight: '1.6',
    fontSize: '1rem',
    position: 'relative',
  },
  listItemWin: {
    color: 'rgba(255,255,255,0.9)',
    padding: '12px 16px 12px 40px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    marginBottom: '10px',
    lineHeight: '1.6',
    fontSize: '1rem',
    position: 'relative',
  },
  sectionsAnalysis: {
    marginTop: '30px',
  },
  sectionsTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '24px',
    textShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  sectionCard: {
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(12px)',
    borderRadius: '18px',
    padding: '30px',
    marginBottom: '20px',
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  sectionName: {
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: '700',
    textTransform: 'capitalize',
    margin: 0,
  },
  badges: {
    display: 'flex',
    gap: '10px',
  },
  badgeExists: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '600',
    background: 'rgba(16,185,129,0.3)',
    color: '#6ee7b7',
    border: '2px solid rgba(16,185,129,0.5)',
  },
  badgeMissing: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '600',
    background: 'rgba(239,68,68,0.3)',
    color: '#fca5a5',
    border: '2px solid rgba(239,68,68,0.5)',
  },
  scoreBadge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#fff',
  },
  currentContent: {
    background: 'rgba(0,0,0,0.2)',
    padding: '16px',
    borderRadius: '10px',
    marginBottom: '16px',
  },
  currentTitle: {
    color: '#93c5fd',
    fontSize: '0.9rem',
    marginBottom: '8px',
    fontWeight: '600',
  },
  currentText: {
    color: 'rgba(255,255,255,0.9)',
    lineHeight: '1.6',
    margin: 0,
  },
  sectionCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.95rem',
    marginBottom: '16px',
  },
  issuesBlock: {
    marginTop: '20px',
    padding: '16px',
    borderRadius: '10px',
    background: 'rgba(239,68,68,0.15)',
    borderLeft: '4px solid #ef4444',
  },
  suggestionsBlock: {
    marginTop: '20px',
    padding: '16px',
    borderRadius: '10px',
    background: 'rgba(59,130,246,0.15)',
    borderLeft: '4px solid #3b82f6',
  },
  examplesBlock: {
    marginTop: '20px',
    padding: '16px',
    borderRadius: '10px',
    background: 'rgba(16,185,129,0.15)',
    borderLeft: '4px solid #10b981',
  },
  keywordsBlock: {
    marginTop: '20px',
    padding: '16px',
    borderRadius: '10px',
    background: 'rgba(139,92,246,0.15)',
    borderLeft: '4px solid #8b5cf6',
  },
  blockTitle: {
    color: '#fff',
    fontSize: '1.1rem',
    marginBottom: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  blockList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  issueItem: {
    color: 'rgba(255,255,255,0.9)',
    padding: '8px 0 8px 24px',
    lineHeight: '1.6',
    position: 'relative',
  },
  suggestionItem: {
    color: 'rgba(255,255,255,0.9)',
    padding: '8px 0 8px 24px',
    lineHeight: '1.6',
    position: 'relative',
  },
  exampleItem: {
    background: 'rgba(255,255,255,0.1)',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '10px',
  },
  exampleText: {
    color: 'rgba(255,255,255,0.9)',
    lineHeight: '1.6',
    margin: 0,
  },
  keywordsTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '12px',
  },
  keywordTag: {
    padding: '8px 16px',
    background: 'rgba(139,92,246,0.3)',
    border: '2px solid rgba(139,92,246,0.5)',
    color: '#ddd6fe',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
};

export default App;