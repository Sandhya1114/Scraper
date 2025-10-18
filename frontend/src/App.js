import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState('scraper');
  const [sessionId, setSessionId] = useState('');

  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAllProfiles();
    }
  }, [activeTab]);

  const fetchAllProfiles = async () => {
    try {
      const response = await fetch(`${API_URL}/profiles`);
      const data = await response.json();
      if (data.success) {
        setAllProfiles(data.profiles);
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setProfileData(null);
    
    if (!profileUrl) {
      setError('Please enter a LinkedIn profile URL');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profileUrl,
          sessionId: sessionId || undefined 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProfileData(data.data);
        setSuccess(data.message);
        if (data.data.sessionId) {
          setSessionId(data.data.sessionId);
        }
        setProfileUrl('');
      } else {
        setError(data.error || data.message || 'Failed to scrape profile');
        if (data.retryAfter) {
          setError(`${data.error} (Retry after ${data.retryAfter} seconds)`);
        }
      }
    } catch (err) {
      setError('Network error. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/profiles/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        fetchAllProfiles();
      }
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
  };

  const handleExport = async (id) => {
    try {
      const response = await fetch(`${API_URL}/export/${id}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkedin-profile-${id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export profile:', err);
    }
  };

  const handleViewDetails = (profile) => {
    setProfileData(profile);
    setActiveTab('scraper');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1 className="title">🔍 LinkedIn Profile Scraper</h1>
          <p className="subtitle">Advanced stealth scraper with 24hr+ operation capability</p>
          {sessionId && (
            <p className="session-info">
              🔐 Session Active: {sessionId.substring(0, 8)}...
            </p>
          )}
        </div>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'scraper' ? 'active' : ''}`}
          onClick={() => setActiveTab('scraper')}
        >
          🎯 Scrape Profile
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📚 History ({allProfiles.length})
        </button>
      </div>

      <div className="container">
        {activeTab === 'scraper' && (
          <div className="scraper-section">
            <div className="card">
              <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                  <label htmlFor="profileUrl" className="label">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="text"
                    id="profileUrl"
                    className="input"
                    placeholder="https://linkedin.com/in/username"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    disabled={loading}
                  />
                  <small className="help-text">
                    ℹ️ Enter the full LinkedIn profile URL (e.g., https://linkedin.com/in/williamhgates)
                  </small>
                  <small className="help-text">
                    ⏱️ Please wait 45-90 seconds between requests for optimal stealth
                  </small>
                </div>

                <button 
                  type="submit" 
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Scraping... (20-40s)
                    </>
                  ) : (
                    '🚀 Scrape Profile'
                  )}
                </button>
              </form>

              {error && (
                <div className="alert alert-error">
                  <span className="alert-icon">⚠️</span>
                  <div>
                    <strong>Error:</strong> {error}
                  </div>
                </div>
              )}

              {success && (
                <div className="alert alert-success">
                  <span className="alert-icon">✅</span>
                  <div>
                    <strong>Success!</strong> {success}
                  </div>
                </div>
              )}

              {loading && (
                <div className="loading-info">
                  <div className="loading-steps">
                    <p>🌐 Connecting to LinkedIn...</p>
                    <p>🎭 Applying stealth measures...</p>
                    <p>🖱️ Simulating human behavior...</p>
                    <p>📊 Extracting profile data...</p>
                  </div>
                </div>
              )}
            </div>

            {profileData && !loading && (
              <div className="card profile-card">
                <div className="profile-card-header-section">
                  <h2 className="section-title">Profile Information</h2>
                  <button 
                    className="btn btn-export"
                    onClick={() => handleExport(profileData.id)}
                  >
                    📥 Export JSON
                  </button>
                </div>
                
                <div className="profile-header">
                  <div className="profile-avatar">
                    {profileData.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="profile-info">
                    <h3 className="profile-name">{profileData.name}</h3>
                    <p className="profile-headline">{profileData.headline}</p>
                    <p className="profile-location">📍 {profileData.location}</p>
                    {profileData.connections && (
                      <p className="profile-connections">🤝 {profileData.connections}</p>
                    )}
                    {profileData.scrapedAt && (
                      <p className="profile-timestamp">
                        🕒 Scraped: {new Date(profileData.scrapedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {profileData.about && (
                  <div className="profile-section">
                    <h4 className="subsection-title">📝 About</h4>
                    <p className="profile-text">{profileData.about}</p>
                  </div>
                )}

                {profileData.experience && profileData.experience.length > 0 && (
                  <div className="profile-section">
                    <h4 className="subsection-title">💼 Experience ({profileData.experience.length})</h4>
                    <div className="list">
                      {profileData.experience.map((exp, index) => (
                        <div key={index} className="list-item">
                          <strong>{exp.title}</strong>
                          {exp.company && <p className="company">{exp.company}</p>}
                          {exp.duration && <small className="duration">📅 {exp.duration}</small>}
                          {exp.location && <small className="location">📍 {exp.location}</small>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileData.education && profileData.education.length > 0 && (
                  <div className="profile-section">
                    <h4 className="subsection-title">🎓 Education ({profileData.education.length})</h4>
                    <div className="list">
                      {profileData.education.map((edu, index) => (
                        <div key={index} className="list-item">
                          <strong>{edu.school}</strong>
                          {edu.degree && <p className="degree">{edu.degree}</p>}
                          {edu.year && <small className="year">📅 {edu.year}</small>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileData.skills && profileData.skills.length > 0 && (
                  <div className="profile-section">
                    <h4 className="subsection-title">⚡ Skills ({profileData.skills.length})</h4>
                    <div className="skills-container">
                      {profileData.skills.slice(0, 20).map((skill, index) => (
                        <span key={index} className="skill-tag">{skill}</span>
                      ))}
                      {profileData.skills.length > 20 && (
                        <span className="skill-tag more">+{profileData.skills.length - 20} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            {allProfiles.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-icon">📂</div>
                <h3>No profiles scraped yet</h3>
                <p>Start by scraping your first LinkedIn profile!</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setActiveTab('scraper')}
                >
                  Go to Scraper
                </button>
              </div>
            ) : (
              <>
                <div className="history-header">
                  <h2>Scraped Profiles ({allProfiles.length})</h2>
                  <p>Click on any profile to view details</p>
                </div>
                <div className="profiles-grid">
                  {allProfiles.map((profile) => (
                    <div key={profile.id} className="card profile-card-mini">
                      <div className="profile-card-header">
                        <div className="profile-avatar-small">
                          {profile.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="profile-mini-info">
                          <h4 className="profile-name-small">{profile.name}</h4>
                          <p className="profile-headline-small">{profile.headline}</p>
                        </div>
                      </div>
                      
                      <div className="profile-card-footer">
                        <span className="profile-stat">
                          💼 {profile.experience?.length || 0} Experiences
                        </span>
                        <span className="profile-stat">
                          🎓 {profile.education?.length || 0} Education
                        </span>
                        <span className="profile-stat">
                          ⚡ {profile.skills?.length || 0} Skills
                        </span>
                      </div>

                      {profile.scrapedAt && (
                        <div className="profile-timestamp-mini">
                          🕒 {new Date(profile.scrapedAt).toLocaleDateString()}
                        </div>
                      )}

                      <div className="profile-actions">
                        <button 
                          className="btn btn-view btn-sm"
                          onClick={() => handleViewDetails(profile)}
                        >
                          👁️ View
                        </button>
                        <button 
                          className="btn btn-export btn-sm"
                          onClick={() => handleExport(profile.id)}
                        >
                          📥 Export
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(profile.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <footer className="footer">
        <div className="footer-content">
          <p>⚠️ <strong>Educational purposes only.</strong> Respect LinkedIn's Terms of Service and privacy policies.</p>
          <p className="footer-tips">💡 <strong>Tips:</strong> Wait 45-90 seconds between requests • Only scrape public profiles • Use session persistence for better results</p>
        </div>
      </footer>
    </div>
  );
}

export default App;