import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, BarChart3, AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';

export default function LinkedInAnalyzer() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  // Check if user logged in (from callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('token');
    if (accessToken) {
      setToken(accessToken);
      setIsLoggedIn(true);
      console.log('✅ Logged in successfully!');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Login Function
  const handleLogin = () => {
    console.log('🔗 Redirecting to LinkedIn login...');
    window.location.href = 'http://localhost:5000/auth/linkedin';
  };

  // Analyze Profile Function
  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    setProfile(null);

    try {
      console.log('📊 Fetching profile analysis...');
      
      const response = await fetch(`http://localhost:5000/api/profile?token=${token}`);
      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        setAnalysis(data.analysis);
        setUserName(data.profile.firstName || 'User');
        console.log('✅ Analysis complete!');
      } else {
        setError(data.error || 'Failed to analyze profile');
        console.error('❌ Error:', data.message);
      }
    } catch (err) {
      setError('Connection error: Make sure backend is running on port 5000');
      console.error('❌ Connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Logout Function
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5000/api/logout');
      setIsLoggedIn(false);
      setToken('');
      setProfile(null);
      setAnalysis(null);
      setUserName('');
      console.log('✅ Logged out successfully');
    } catch (err) {
      console.error('❌ Logout error:', err);
    }
  };

  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Orange
    if (score >= 40) return '#ef4444'; // Red
    return '#dc2626'; // Dark Red
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return '🌟 Excellent';
    if (score >= 60) return '👍 Good';
    if (score >= 40) return '⚠️ Fair';
    return '❌ Needs Work';
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <h1>🔍 LinkedIn Profile Analyzer</h1>
        <p>Analyze your profile & get improvement suggestions</p>
      </header>

      {/* AUTH SECTION */}
      <div style={styles.authSection}>
        {!isLoggedIn ? (
          <div style={styles.authBox}>
            <h2>Welcome!</h2>
            <p>Sign in with LinkedIn to analyze your profile</p>
            <button onClick={handleLogin} style={styles.loginBtn}>
              <LogIn size={20} /> Sign In with LinkedIn
            </button>
          </div>
        ) : (
          <div style={styles.loggedInBox}>
            <div style={styles.userInfo}>
              <span style={styles.welcomeText}>✅ Logged in with LinkedIn</span>
              {userName && <span style={styles.userName}>Hello, {userName}! 👋</span>}
            </div>
            <div style={styles.actionButtons}>
              <button onClick={handleAnalyze} disabled={loading} style={styles.analyzeBtn}>
                {loading ? (
                  <>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart3 size={18} /> Analyze My Profile
                  </>
                )}
              </button>
              <button onClick={handleLogout} style={styles.logoutBtn}>
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div style={styles.errorBox}>
          <AlertCircle size={20} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* RESULTS SECTION */}
      {analysis && (
        <div style={styles.resultsContainer}>
          {/* OVERALL SCORE CARD */}
          <div
            style={{
              ...styles.scoreCard,
              borderTop: `4px solid ${getScoreColor(analysis.overallScore)}`,
            }}
          >
            <BarChart3
              size={32}
              style={{ color: getScoreColor(analysis.overallScore) }}
            />
            <div style={styles.scoreInfo}>
              <div style={styles.scoreLabel}>Overall Score</div>
              <div
                style={{
                  ...styles.scoreValue,
                  color: getScoreColor(analysis.overallScore),
                }}
              >
                {analysis.overallScore}/100
              </div>
              <div style={styles.scoreStatus}>
                {getScoreLabel(analysis.overallScore)}
              </div>
            </div>
          </div>

          {/* PROFILE INFO */}
          {profile && (
            <div style={styles.profileInfo}>
              <h3>📋 Your Profile</h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Name:</span>
                  <span style={styles.infoValue}>{profile.firstName} {profile.lastName}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Headline:</span>
                  <span style={styles.infoValue}>{profile.headline}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Photo:</span>
                  <span style={styles.infoValue}>{profile.hasPhoto ? '✓ Yes' : '✗ No'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Experience:</span>
                  <span style={styles.infoValue}>{profile.experiences} position(s)</span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION SCORES */}
          <div style={styles.sectionsBox}>
            <h3>📊 Section Breakdown</h3>
            <div style={styles.sectionsGrid}>
              {Object.entries(analysis.sections).map(([key, section]) => (
                <div key={key} style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <h4 style={styles.sectionTitle}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </h4>
                    <span style={styles.sectionScore}>
                      {section.score}/{section.maxScore}
                    </span>
                  </div>
                  <p style={styles.sectionStatus}>{section.status}</p>
                  {section.length !== undefined && (
                    <p style={styles.sectionLength}>
                      {section.length} / {section.ideal}
                    </p>
                  )}
                  {section.count !== undefined && (
                    <p style={styles.sectionLength}>Count: {section.count}</p>
                  )}
                  <p style={styles.sectionFeedback}>{section.feedback}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ERRORS */}
          {analysis.errors.length > 0 && (
            <div style={styles.errorsBox}>
              <div style={styles.errorHeader}>
                <AlertCircle size={22} />
                <h3>Issues to Fix ({analysis.errors.length})</h3>
              </div>
              <ul style={styles.list}>
                {analysis.errors.map((error, i) => (
                  <li key={i} style={styles.listItem}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* SUGGESTIONS */}
          {analysis.suggestions.length > 0 && (
            <div style={styles.suggestionsBox}>
              <div style={styles.suggestionHeader}>
                <Lightbulb size={22} />
                <h3>Suggestions for Improvement</h3>
              </div>
              <ul style={styles.list}>
                {analysis.suggestions.map((suggestion, i) => (
                  <li key={i} style={styles.listItem}>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: 'center',
    color: 'white',
    marginBottom: '40px',
  },
  authSection: {
    maxWidth: '900px',
    margin: '0 auto 30px',
  },
  authBox: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  loggedInBox: {
    background: 'white',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  userInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  welcomeText: {
    fontSize: '1.1em',
    fontWeight: '600',
    color: '#10b981',
  },
  userName: {
    fontSize: '1em',
    color: '#667eea',
    fontWeight: '600',
  },
  actionButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  loginBtn: {
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1em',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'transform 0.2s',
  },
  analyzeBtn: {
    flex: 1,
    minWidth: '200px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1em',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.2s',
  },
  logoutBtn: {
    padding: '12px 24px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1em',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorBox: {
    maxWidth: '900px',
    margin: '0 auto 20px',
    background: '#fee',
    border: '2px solid #fcc',
    color: '#c33',
    padding: '16px',
    borderRadius: '8px',
    display: 'flex',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  resultsContainer: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  scoreCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '25px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  scoreInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  scoreLabel: {
    fontSize: '0.9em',
    color: '#666',
    marginBottom: '5px',
  },
  scoreValue: {
    fontSize: '2.5em',
    fontWeight: '700',
  },
  scoreStatus: {
    fontSize: '0.95em',
    color: '#666',
    marginTop: '5px',
  },
  profileInfo: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginTop: '15px',
  },
  infoItem: {
    background: '#f9f9f9',
    padding: '12px',
    borderRadius: '8px',
  },
  infoLabel: {
    display: 'block',
    fontWeight: '600',
    color: '#667eea',
    marginBottom: '5px',
  },
  infoValue: {
    display: 'block',
    color: '#333',
  },
  sectionsBox: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  sectionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '15px',
    marginTop: '15px',
  },
  sectionCard: {
    background: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.95em',
    fontWeight: '600',
  },
  sectionScore: {
    background: '#e3f2fd',
    color: '#1976d2',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.85em',
    fontWeight: '600',
  },
  sectionStatus: {
    margin: '5px 0',
    fontSize: '0.9em',
  },
  sectionLength: {
    margin: '5px 0',
    fontSize: '0.85em',
    color: '#999',
  },
  sectionFeedback: {
    margin: '8px 0 0 0',
    fontSize: '0.85em',
    color: '#666',
    fontStyle: 'italic',
  },
  errorsBox: {
    background: '#fee',
    border: '2px solid #fcc',
    color: '#c33',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
  },
  suggestionsBox: {
    background: '#ffe',
    border: '2px solid #ffd',
    color: '#996600',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  suggestionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  listItem: {
    padding: '8px 0',
    borderBottom: '1px solid rgba(0,0,0,0.1)',
  },
};