import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [profiles, setProfiles] = useState([]);

  // Check server status on load
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/health`);
      setStatus(res.data);
    } catch (err) {
      setError('Cannot connect to server. Make sure backend is running.');
    }
  };

  const handleScrape = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a LinkedIn profile URL');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);
      
      const res = await axios.post(`${API_URL}/scrape`, {
        profileUrl: profileUrl.trim()
      });
      
      if (res.data.success) {
        setResult(res.data.data);
        setProfileUrl(''); // Clear input
        loadProfiles(); // Refresh profiles list
      } else {
        setError(res.data.error || 'Scraping failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Scraping failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const res = await axios.get(`${API_URL}/profiles`);
      if (res.data.success) {
        setProfiles(res.data.profiles);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  };

  const exportProfile = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/export/${id}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `profile-${id}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Export failed');
    }
  };

  const deleteProfile = async (id) => {
    try {
      await axios.delete(`${API_URL}/profiles/${id}`);
      loadProfiles();
    } catch (err) {
      setError('Delete failed');
    }
  };

  return (
    <div className="container">
      <h1>🔍 LinkedIn Profile Scraper</h1>
      
      {status && (
        <div className="card status-card">
          <p>
            <strong>Status:</strong> {status.loggedIn ? '✅ Ready' : '⏳ Initializing...'}
          </p>
          <p>
            <strong>Credentials:</strong> {status.credentialsConfigured ? '✓ Configured' : '✗ Not configured'}
          </p>
          <p><small>Total Profiles Scraped: {status.totalProfiles}</small></p>
        </div>
      )}

      <div className="card">
        <h2>Scrape LinkedIn Profile</h2>
        <p>Enter a LinkedIn profile URL to extract information</p>
        
        <div className="input-group">
          <input
            type="text"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/username"
            className="input"
            disabled={loading}
          />
          <button 
            onClick={handleScrape} 
            disabled={loading || !status?.credentialsConfigured}
            className="btn-primary"
          >
            {loading ? '⏳ Scraping...' : '🔍 Scrape Profile'}
          </button>
        </div>
        
        {!status?.credentialsConfigured && (
          <p className="warning">⚠️ LinkedIn credentials not configured. Check backend .env file.</p>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="card result">
          <h2>✅ {result.name}</h2>
          <p><strong>Headline:</strong> {result.headline}</p>
          <p><strong>Location:</strong> {result.location}</p>
          <p><strong>Connections:</strong> {result.connections}</p>
          
          {result.about && (
            <>
              <h3>About</h3>
              <p>{result.about}</p>
            </>
          )}
          
          {result.experience && result.experience.length > 0 && (
            <>
              <h3>Experience</h3>
              <ul>
                {result.experience.map((exp, i) => (
                  <li key={i}>
                    <strong>{exp.title}</strong> at {exp.company}
                    {exp.duration && <><br/><small>{exp.duration}</small></>}
                  </li>
                ))}
              </ul>
            </>
          )}
          
          {result.education && result.education.length > 0 && (
            <>
              <h3>Education</h3>
              <ul>
                {result.education.map((edu, i) => (
                  <li key={i}>
                    <strong>{edu.school}</strong>
                    {edu.degree && <><br/>{edu.degree}</>}
                    {edu.year && <><br/><small>{edu.year}</small></>}
                  </li>
                ))}
              </ul>
            </>
          )}
          
          {result.skills && result.skills.length > 0 && (
            <>
              <h3>Skills</h3>
              <div className="skills">
                {result.skills.map((skill, i) => (
                  <span key={i} className="skill-tag">{skill}</span>
                ))}
              </div>
            </>
          )}
          
          <p><small>Scraped at: {new Date(result.scrapedAt).toLocaleString()}</small></p>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="card">
          <h2>📚 Scraped Profiles ({profiles.length})</h2>
          <div className="profiles-list">
            {profiles.map(profile => (
              <div key={profile.id} className="profile-item">
                <div>
                  <strong>{profile.name}</strong>
                  <br/>
                  <small>{profile.headline}</small>
                </div>
                <div className="profile-actions">
                  <button onClick={() => exportProfile(profile.id)} className="btn-small">📥 Export</button>
                  <button onClick={() => deleteProfile(profile.id)} className="btn-small btn-danger">🗑️ Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;