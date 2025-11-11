import React, { useState, useEffect } from 'react';
import { User, Search, Download, CheckCircle, XCircle, Loader2, AlertCircle, Clock, RefreshCw, MapPin, Briefcase, GraduationCap, Award, Code, Globe, FileText, Link as LinkIcon, Zap } from 'lucide-react';

const App = () => {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [statusCheckCount, setStatusCheckCount] = useState(0);
  const [showInstantBadge, setShowInstantBadge] = useState(false);

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
        setError(data.error || 'Backend is running but not logged in');
      } else if (data.loggedIn) {
        setError(null);
        setStatusCheckCount(0);
      }
      
      setStatusLoading(false);
    } catch (err) {
      setError(`Cannot connect to backend: ${err.message}`);
      setIsLoggedIn(false);
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
    setShowInstantBadge(true);

    const startTime = Date.now();

    try {
      const response = await fetch(`${API_URL}/api/scrape-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl })
      });

      const data = await response.json();
      const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (data.success) {
        // Show data INSTANTLY
        setResult({
          ...data,
          actualResponseTime: `${responseTime}s`
        });
        
        // Hide instant badge after 3 seconds
        setTimeout(() => setShowInstantBadge(false), 3000);
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
    a.download = `linkedin_${result.data.name?.replace(/\s+/g, '_') || 'profile'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (statusLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <Loader2 style={styles.spinnerLarge} className="spin" />
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
            <User size={32} style={styles.headerIcon} />
            <h1 style={styles.headerTitle}>LinkedIn Profile Scraper</h1>
          </div>
        </div>
        <div style={styles.loadingCard}>
          <Clock size={48} style={styles.spinnerLarge} />
          <p style={styles.loadingText}>Login in Progress...</p>
          <p style={styles.loadingSubtext}>Please wait while we log into LinkedIn</p>
          <button onClick={checkStatus} style={styles.btnSecondary}>
            <RefreshCw size={16} style={styles.btnIcon} />
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
            <User size={32} style={styles.headerIcon} />
            <h1 style={styles.headerTitle}>LinkedIn Profile Scraper</h1>
          </div>
        </div>
        <div style={styles.errorCard}>
          <XCircle size={48} style={styles.errorIcon} />
          <div>
            <h3 style={styles.errorTitle}>Not Logged In</h3>
            <p style={styles.errorText}>{error || 'Please restart the server'}</p>
            <button onClick={checkStatus} style={styles.btnSecondary}>
              <RefreshCw size={16} style={styles.btnIcon} />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <User size={32} style={styles.headerIcon} />
            <h1 style={styles.headerTitle}>LinkedIn Profile Scraper</h1>
          </div>
          <p style={styles.headerSubtitle}>⚡ Instant results in under 1 second</p>
        </div>

        {/* Status Banner */}
        <div style={styles.statusBanner}>
          <CheckCircle size={20} style={styles.statusIcon} />
          <span>Logged In & Ready • Instant Mode Active</span>
          {showInstantBadge && (
            <span style={styles.instantBadge}>
              <Zap size={14} /> INSTANT
            </span>
          )}
        </div>

        {/* Scrape Form */}
        <div style={styles.scrapeCard}>
          <div style={styles.formGroup}>
            <label htmlFor="profileUrl" style={styles.label}>
              <LinkIcon size={18} style={styles.labelIcon} />
              LinkedIn Profile URL
            </label>
            <input
              type="url"
              id="profileUrl"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && profileUrl && handleScrape()}
              placeholder="https://www.linkedin.com/in/username/"
              style={styles.input}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={styles.errorCard}>
              <AlertCircle size={20} style={styles.errorIcon} />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={handleScrape}
            disabled={loading || !profileUrl}
            style={{
              ...styles.btnPrimary,
              ...(loading || !profileUrl ? styles.btnDisabled : {})
            }}
          >
            {loading ? (
              <>
                <Loader2 size={20} style={styles.btnIcon} className="spin" />
                <span>Scraping...</span>
              </>
            ) : (
              <>
                <Search size={20} style={styles.btnIcon} />
                <span>Scrape Profile</span>
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && result.success && (
          <div style={styles.resultsContainer}>
            {/* Results Header */}
            <div style={styles.resultsHeader}>
              <div>
                <h2 style={styles.resultsTitle}>Profile Data Extracted</h2>
                <p style={styles.resultsSubtitle}>
                  Response time: {result.actualResponseTime} ⚡
                </p>
              </div>
              <button onClick={downloadJSON} style={styles.btnDownload}>
                <Download size={18} style={styles.btnIcon} />
                Download JSON
              </button>
            </div>

            {/* Profile Card */}
            <div style={styles.profileCard}>
              <div style={styles.profileHeader}>
                {result.data.profileImage && (
                  <img 
                    src={result.data.profileImage} 
                    alt={result.data.name} 
                    style={styles.profileImage}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <div style={styles.profileInfo}>
                  <h2 style={styles.profileName}>{result.data.name || 'N/A'}</h2>
                  {result.data.headline && (
                    <p style={styles.profileHeadline}>{result.data.headline}</p>
                  )}
                  <div style={styles.profileMeta}>
                    {result.data.location && (
                      <div style={styles.metaItem}>
                        <MapPin size={16} />
                        <span>{result.data.location}</span>
                      </div>
                    )}
                    {result.data.connections && (
                      <div style={styles.metaItem}>
                        <User size={16} />
                        <span>{result.data.connections}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {result.data.about && (
                <div style={styles.profileAbout}>
                  <h3 style={styles.sectionTitle}>
                    <FileText size={20} style={styles.sectionIcon} />
                    About
                  </h3>
                  <p style={styles.aboutText}>{result.data.about}</p>
                </div>
              )}
            </div>

            {/* Experience */}
            {result.data.experience && result.data.experience.length > 0 && (
              <DataCard 
                title="Experience" 
                icon={<Briefcase size={20} />}
                count={result.data.experience.length}
              >
                {result.data.experience.map((exp, i) => (
                  <ListItem key={i} color="#3b82f6">
                    <p style={styles.listTitle}>{exp.title || 'N/A'}</p>
                    {exp.company && <p style={styles.listSubtitle}>{exp.company}</p>}
                    {exp.duration && <p style={styles.listMeta}>{exp.duration}</p>}
                    {exp.location && <p style={styles.listMeta}>{exp.location}</p>}
                    {exp.description && <p style={styles.listDescription}>{exp.description}</p>}
                  </ListItem>
                ))}
              </DataCard>
            )}

            {/* Education */}
            {result.data.education && result.data.education.length > 0 && (
              <DataCard 
                title="Education" 
                icon={<GraduationCap size={20} />}
                count={result.data.education.length}
              >
                {result.data.education.map((edu, i) => (
                  <ListItem key={i} color="#8b5cf6">
                    <p style={styles.listTitle}>{edu.school || 'N/A'}</p>
                    {edu.degree && <p style={styles.listSubtitle}>{edu.degree}</p>}
                    {edu.field && <p style={styles.listMeta}>{edu.field}</p>}
                    {edu.duration && <p style={styles.listMeta}>{edu.duration}</p>}
                  </ListItem>
                ))}
              </DataCard>
            )}

            {/* Skills */}
            {result.data.skills && result.data.skills.length > 0 && (
              <DataCard 
                title="Skills" 
                icon={<Code size={20} />}
                count={result.data.skills.length}
              >
                <div style={styles.tagsContainer}>
                  {result.data.skills.map((skill, i) => (
                    <span key={i} style={styles.tag}>{skill}</span>
                  ))}
                </div>
              </DataCard>
            )}

            {/* Certifications */}
            {result.data.certifications && result.data.certifications.length > 0 && (
              <DataCard 
                title="Certifications" 
                icon={<Award size={20} />}
                count={result.data.certifications.length}
              >
                {result.data.certifications.map((cert, i) => (
                  <ListItem key={i} color="#f59e0b">
                    <p style={styles.listTitle}>{cert.name || 'N/A'}</p>
                    {cert.issuer && <p style={styles.listSubtitle}>{cert.issuer}</p>}
                    {cert.date && <p style={styles.listMeta}>{cert.date}</p>}
                  </ListItem>
                ))}
              </DataCard>
            )}

            {/* Projects */}
            {result.data.projects && result.data.projects.length > 0 && (
              <DataCard 
                title="Projects" 
                icon={<FileText size={20} />}
                count={result.data.projects.length}
              >
                {result.data.projects.map((proj, i) => (
                  <ListItem key={i} color="#10b981">
                    <p style={styles.listTitle}>{proj.name || 'N/A'}</p>
                    {proj.date && <p style={styles.listMeta}>{proj.date}</p>}
                  </ListItem>
                ))}
              </DataCard>
            )}

            {/* Languages */}
            {result.data.languages && result.data.languages.length > 0 && (
              <DataCard 
                title="Languages" 
                icon={<Globe size={20} />}
                count={result.data.languages.length}
              >
                <div style={styles.tagsContainer}>
                  {result.data.languages.map((lang, i) => (
                    <span key={i} style={{...styles.tag, ...styles.langTag}}>{lang}</span>
                  ))}
                </div>
              </DataCard>
            )}

            {/* Footer */}
            <div style={styles.footer}>
              <div style={styles.footerRow}>
                <span style={styles.footerLabel}>Profile URL:</span>
                <a href={result.profileUrl} target="_blank" rel="noopener noreferrer" style={styles.footerLink}>
                  {result.profileUrl}
                </a>
              </div>
              <div style={styles.footerRow}>
                <span style={styles.footerLabel}>Scraped At:</span>
                <span>{new Date(result.scrapedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

const DataCard = ({ title, icon, count, children }) => (
  <div style={styles.dataCard}>
    <h3 style={styles.cardTitle}>
      {icon}
      {title}
      <span style={styles.countBadge}>{count}</span>
    </h3>
    <div style={styles.listContainer}>
      {children}
    </div>
  </div>
);

const ListItem = ({ color, children }) => (
  <div style={styles.listItem}>
    <div style={{...styles.listMarker, backgroundColor: color}} />
    <div style={styles.listContent}>
      {children}
    </div>
  </div>
);

const styles = {
  appContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto'
  },
  header: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '8px'
  },
  headerIcon: {
    color: '#667eea'
  },
  headerTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a202c',
    margin: 0
  },
  headerSubtitle: {
    fontSize: '16px',
    color: '#718096',
    margin: 0
  },
  statusBanner: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    padding: '16px 24px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    boxShadow: '0 4px 6px rgba(16,185,129,0.3)',
    fontSize: '15px',
    fontWeight: '600'
  },
  statusIcon: {
    flexShrink: 0
  },
  instantBadge: {
    marginLeft: 'auto',
    background: 'rgba(255,255,255,0.25)',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    animation: 'pulse 1.5s infinite'
  },
  scrapeCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  formGroup: {
    marginBottom: '24px'
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  labelIcon: {
    color: '#667eea'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box'
  },
  btnPrimary: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 6px rgba(102,126,234,0.4)'
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  btnSecondary: {
    padding: '12px 24px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px'
  },
  btnDownload: {
    padding: '12px 24px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnIcon: {
    flexShrink: 0
  },
  loadingCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '48px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  spinnerLarge: {
    width: '48px',
    height: '48px',
    color: '#667eea',
    margin: '0 auto 16px'
  },
  loadingText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a202c',
    margin: '0 0 8px'
  },
  loadingSubtext: {
    fontSize: '14px',
    color: '#718096',
    margin: 0
  },
  errorCard: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px'
  },
  errorIcon: {
    color: '#dc2626',
    flexShrink: 0
  },
  errorTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#991b1b',
    margin: '0 0 4px'
  },
  errorText: {
    fontSize: '14px',
    color: '#991b1b',
    margin: 0
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  resultsHeader: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  resultsTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a202c',
    margin: '0 0 4px'
  },
  resultsSubtitle: {
    fontSize: '14px',
    color: '#10b981',
    margin: 0,
    fontWeight: '600'
  },
  profileCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  profileHeader: {
    display: 'flex',
    gap: '24px',
    marginBottom: '24px'
  },
  profileImage: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #f3f4f6'
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a202c',
    margin: '0 0 8px'
  },
  profileHeadline: {
    fontSize: '16px',
    color: '#4b5563',
    margin: '0 0 12px'
  },
  profileMeta: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#6b7280'
  },
  profileAbout: {
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a202c',
    margin: '0 0 12px'
  },
  sectionIcon: {
    color: '#667eea'
  },
  aboutText: {
    fontSize: '15px',
    lineHeight: '1.6',
    color: '#4b5563',
    margin: 0
  },
  dataCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a202c',
    margin: '0 0 20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f3f4f6'
  },
  countBadge: {
    marginLeft: 'auto',
    background: '#ede9fe',
    color: '#7c3aed',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '700'
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  listItem: {
    display: 'flex',
    gap: '16px'
  },
  listMarker: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    marginTop: '8px',
    flexShrink: 0
  },
  listContent: {
    flex: 1
  },
  listTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    margin: '0 0 4px'
  },
  listSubtitle: {
    fontSize: '15px',
    color: '#4b5563',
    margin: '0 0 4px'
  },
  listMeta: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 4px'
  },
  listDescription: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#6b7280',
    margin: '8px 0 0'
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  tag: {
    background: '#ede9fe',
    color: '#7c3aed',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500'
  },
  langTag: {
    background: '#dbeafe',
    color: '#1e40af'
  },
  footer: {
    background: '#f9fafb',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  footerRow: {
    display: 'flex',
    gap: '12px',
    fontSize: '14px'
  },
  footerLabel: {
    fontWeight: '600',
    color: '#374151'
  },
  footerLink: {
    color: '#667eea',
    textDecoration: 'none'
  }
};

export default App;