const SuspiciousActivity = require('../models/SuspiciousActivity');
const User = require('../models/User');
const { getLocationInfo, logSuspiciousActivity, SCORING } = require('./securityService');

// Track failed attempts in memory for quick rate limiting / detection
// In production, use Redis
const failedAttempts = new Map();
const actionTimestamps = new Map();

const checkSuspiciousActivity = async (username, ipAddress, actionType, metadata = {}) => {
  const location = await getLocationInfo(ipAddress);
  const now = new Date();

  // FEATURE 1: VPN / Different Country Login Detection
  if (actionType === 'login_success') {
    const lastLoginLog = await SuspiciousActivity.findOne({ 
      username, 
      activityType: { $in: ['UNUSUAL_LOCATION_LOGIN', 'VPN_LOGIN'] } 
    }).sort({ timestamp: -1 });

    if (location.isVPN) {
      await logSuspiciousActivity({
        username,
        ipAddress,
        location,
        activityType: 'VPN_LOGIN',
        metadata: { ...metadata, details: 'Login detected via VPN/Proxy' }
      });
    }

    // Check for unrealistic time difference between countries
    const previousLogin = await User.findOne({ username }).select('lastLogin location');
    if (previousLogin && previousLogin.lastLogin && previousLogin.location) {
      const timeDiffHours = (now - previousLogin.lastLogin) / (1000 * 60 * 60);
      
      // Parse previous location (assuming it was stored as "City, Country" or similar)
      const prevCountry = previousLogin.location.split(', ').pop();
      const currCountry = location.country;

      if (prevCountry !== currCountry && prevCountry !== 'Local' && currCountry !== 'Unknown') {
        // If travel speed > 1000km/h (rough estimate: different countries in < 2 hours)
        if (timeDiffHours < 2) {
          await logSuspiciousActivity({
            username,
            ipAddress,
            location,
            activityType: 'UNUSUAL_LOCATION_LOGIN',
            metadata: { 
              ...metadata, 
              prevCountry, 
              currCountry, 
              timeDiff: `${Math.round(timeDiffHours * 60)} minutes` 
            }
          });
        }
      }
    }
    
    // Update user location for next check
    await User.findOneAndUpdate({ username }, { location: `${location.city}, ${location.country}` });
  }

  // Log to general ActivityLog for the "System Logs" tab
  const ActivityLog = require('../models/ActivityLog');
  await ActivityLog.create({
    username: username || 'anonymous',
    ipAddress,
    location: `${location.city}, ${location.country}`,
    activityType: actionType,
    status: 'normal'
  });

  // FEATURE 2: Continuous Password Failure Detection
  if (actionType === 'login_failed') {
    const key = `${username}_${ipAddress}`;
    const attempts = (failedAttempts.get(key) || 0) + 1;
    failedAttempts.set(key, attempts);

    if (attempts > 3) {
      await logSuspiciousActivity({
        username,
        ipAddress,
        location,
        activityType: 'BRUTE_FORCE_ATTEMPT',
        metadata: { ...metadata, attempts }
      });
      // Reset after logging to prevent spamming logs
      failedAttempts.set(key, 0);
    }

    // Clear old attempts after 15 mins
    setTimeout(() => failedAttempts.delete(key), 15 * 60 * 1000);
  }

  // FEATURE 4: Bulk Account Creation Detection
  if (actionType === 'signup') {
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const recentSignups = await SuspiciousActivity.countDocuments({
      activityType: 'BULK_REGISTRATION',
      timestamp: { $gte: tenMinutesAgo }
    });

    // Also check raw signup logs in ActivityLog if they exist, but here we use SuspiciousActivity
    // For simplicity, we check if we've already flagged bulk registration recently
    // Better: Check User collection for signups in last 10 mins
    const signupCount = await User.countDocuments({ createdAt: { $gte: tenMinutesAgo } });
    if (signupCount >= 5) {
      await logSuspiciousActivity({
        username,
        ipAddress,
        location,
        activityType: 'BULK_REGISTRATION',
        metadata: { ...metadata, signupCount }
      });
    }
  }

  return false;
};

// FEATURE 3: Bot-like Fast Action Detection (Middleware or Hook)
const trackActionFrequency = async (username, ipAddress, action) => {
  const now = Date.now();
  const key = username || ipAddress;
  const userActions = actionTimestamps.get(key) || [];
  
  // Keep only actions in last 10 seconds
  const recentActions = userActions.filter(t => now - t < 10000);
  recentActions.push(now);
  actionTimestamps.set(key, recentActions);

  if (recentActions.length > 15) {
    const location = await getLocationInfo(ipAddress);
    await logSuspiciousActivity({
      username: username || 'anonymous',
      ipAddress,
      location,
      activityType: 'BOT_LIKE_ACTIVITY',
      metadata: { action, count: recentActions.length, period: '10s' }
    });
    return true; // Flagged
  }
  return false;
};

module.exports = { checkSuspiciousActivity, trackActionFrequency };
