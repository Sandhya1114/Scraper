const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport LinkedIn Strategy
passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackURL: 'http://localhost:5000/auth/callback',
    scope: ['r_liteprofile', 'r_emailaddress'],
  },
  (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// ===== ANALYSIS FUNCTION =====
function analyzeProfile(profileData) {
  const analysis = {
    overallScore: 0,
    sections: {},
    errors: [],
    suggestions: [],
  };

  // 1. PHOTO ANALYSIS (20 points)
  const hasPhoto = profileData.profilePicture ? true : false;
  analysis.sections.photo = {
    score: hasPhoto ? 20 : 0,
    maxScore: 20,
    status: hasPhoto ? '✓ Present' : '✗ Missing',
    feedback: hasPhoto ? 'Great! You have a professional photo' : 'Add a professional headshot',
  };

  // 2. NAME ANALYSIS (20 points)
  const firstName = profileData.localizedFirstName || '';
  const lastName = profileData.localizedLastName || '';
  const name = (firstName + ' ' + lastName).trim();
  const nameLength = name.length;
  let nameScore = 0;
  let nameFeedback = '';

  if (nameLength < 3) {
    nameScore = 0;
    nameFeedback = 'Name too short or missing';
  } else if (nameLength > 60) {
    nameScore = 10;
    nameFeedback = 'Name is too long (max 60 characters)';
  } else {
    nameScore = 20;
    nameFeedback = 'Perfect! Good name format';
  }

  analysis.sections.name = {
    score: nameScore,
    maxScore: 20,
    status: name ? '✓ Present' : '✗ Missing',
    feedback: nameFeedback,
    length: nameLength,
    value: name,
  };

  // 3. HEADLINE ANALYSIS (20 points)
  const headline = profileData.headline?.localized?.en_US || '';
  const headlineLength = headline.length;
  let headlineScore = 0;
  let headlineFeedback = '';

  if (!headline) {
    headlineScore = 0;
    headlineFeedback = 'Missing - Add job title + skills';
  } else if (headlineLength < 20) {
    headlineScore = 10;
    headlineFeedback = 'Too short - Add more keywords (minimum 20 chars)';
  } else if (headlineLength > 220) {
    headlineScore = 10;
    headlineFeedback = 'Too long - Keep under 220 characters';
  } else if (headlineLength < 50) {
    headlineScore = 15;
    headlineFeedback = 'Could be more detailed';
  } else {
    headlineScore = 20;
    headlineFeedback = 'Excellent headline!';
  }

  analysis.sections.headline = {
    score: headlineScore,
    maxScore: 20,
    status: headline ? '✓ Present' : '✗ Missing',
    feedback: headlineFeedback,
    length: headlineLength,
    ideal: '20-220 characters',
    value: headline,
  };

  // 4. ABOUT/SUMMARY ANALYSIS (30 points)
  const about = profileData.summary || '';
  const aboutLength = about.length;
  let aboutScore = 0;
  let aboutFeedback = '';

  if (!about) {
    aboutScore = 0;
    aboutFeedback = 'Missing - Write about yourself (minimum 100 characters)';
  } else if (aboutLength < 100) {
    aboutScore = 10;
    aboutFeedback = 'Too short - Make it more detailed (minimum 100 chars)';
  } else if (aboutLength > 2600) {
    aboutScore = 20;
    aboutFeedback = 'Very long - Consider shortening it';
  } else if (aboutLength < 200) {
    aboutScore = 15;
    aboutFeedback = 'Good start - Add more information';
  } else {
    aboutScore = 30;
    aboutFeedback = 'Excellent about section!';
  }

  analysis.sections.about = {
    score: aboutScore,
    maxScore: 30,
    status: about ? '✓ Present' : '✗ Missing',
    feedback: aboutFeedback,
    length: aboutLength,
    ideal: '100-2600 characters',
    preview: about ? about.substring(0, 100) + '...' : null,
  };

  // 5. EXPERIENCE ANALYSIS (10 points)
  const experiences = profileData.positions?.values || [];
  const hasExperience = experiences.length > 0;

  analysis.sections.experience = {
    score: hasExperience ? 10 : 0,
    maxScore: 10,
    status: hasExperience ? '✓ Present' : '✗ Missing',
    feedback: hasExperience ? `You have ${experiences.length} position(s)` : 'Add your work experience',
    count: experiences.length,
  };

  // CALCULATE OVERALL SCORE (out of 100)
  const totalScore = Object.values(analysis.sections).reduce((sum, s) => sum + s.score, 0);
  const maxTotal = Object.values(analysis.sections).reduce((sum, s) => sum + s.maxScore, 0);
  analysis.overallScore = Math.round((totalScore / maxTotal) * 100);

  // COLLECT ERRORS
  Object.entries(analysis.sections).forEach(([key, section]) => {
    if (section.score < section.maxScore) {
      analysis.errors.push(`❌ ${section.feedback}`);
    }
  });

  // ADD SUGGESTIONS
  if (analysis.overallScore >= 80) {
    analysis.suggestions.push('✅ Excellent! Your profile is very complete!');
  } else if (analysis.overallScore >= 60) {
    analysis.suggestions.push('📈 Good profile! Follow suggestions to improve');
  } else if (analysis.overallScore >= 40) {
    analysis.suggestions.push('🚀 Profile needs improvement - Focus on missing sections');
  } else {
    analysis.suggestions.push('⚡ Profile is incomplete - Add missing information');
  }

  analysis.suggestions.push('💡 Add professional photo if missing');
  analysis.suggestions.push('💡 Write detailed headline with keywords');
  analysis.suggestions.push('💡 Fill the about section with your professional story');
  analysis.suggestions.push('💡 Add work experience and education');
  analysis.suggestions.push('💡 Request recommendations from colleagues');
  analysis.suggestions.push('💡 Add skills and ask for endorsements');
  analysis.suggestions.push('💡 Connect with professionals in your field');
  analysis.suggestions.push('💡 Update your profile regularly');

  return analysis;
}

// ===== ROUTES =====

// 1. Start LinkedIn Login
app.get('/auth/linkedin', passport.authenticate('linkedin'));

// 2. LinkedIn Callback
app.get('/auth/callback',
  passport.authenticate('linkedin', { failureRedirect: 'http://localhost:3000' }),
  (req, res) => {
    req.session.accessToken = req.user.accessToken;
    console.log('✅ User logged in successfully');
    res.redirect(`http://localhost:3000?token=${req.user.accessToken}`);
  }
);

// 3. Get Profile and Analyze IT
app.get('/api/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;

  if (!token) {
    return res.status(400).json({ 
      error: 'No access token provided',
      message: 'Please login first'
    });
  }

  try {
    console.log('📊 Fetching profile data...');

    // Get full profile data from LinkedIn API
    const profileResponse = await axios.get(
      'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage),headline,summary,positions)',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const profileData = profileResponse.data;
    console.log('✅ Profile data received');

    // ANALYZE THE PROFILE
    const analysis = analyzeProfile(profileData);
    console.log(`📈 Analysis complete - Score: ${analysis.overallScore}/100`);

    res.json({
      success: true,
      profile: {
        firstName: profileData.localizedFirstName,
        lastName: profileData.localizedLastName,
        headline: profileData.headline?.localized?.en_US || 'No headline',
        summary: profileData.summary || 'No summary',
        experiences: profileData.positions?.values?.length || 0,
        hasPhoto: profileData.profilePicture ? true : false,
      },
      analysis: analysis,
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response?.status === 401) {
      res.status(401).json({
        error: 'Unauthorized - Token expired or invalid',
        message: 'Please login again',
      });
    } else {
      res.status(500).json({
        error: 'Could not fetch profile',
        message: error.message,
        hint: 'Make sure LinkedIn API access is approved (wait 24-48 hours)',
      });
    }
  }
});

// 4. Logout
app.get('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// 5. Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: '✅ Backend server is running',
    endpoints: {
      login: 'http://localhost:5000/auth/linkedin',
      profile: 'GET /api/profile (requires token)',
      logout: 'GET /api/logout',
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 LinkedIn Profile Analyzer Backend`);
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Login URL: http://localhost:${PORT}/auth/linkedin`);
  console.log(`💾 Profile API: GET /api/profile?token=YOUR_TOKEN`);
  console.log(`✅ Health Check: http://localhost:${PORT}/api/health\n`);
});