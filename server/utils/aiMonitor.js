const SuspiciousActivity = require('../models/SuspiciousActivity');
const User = require('../models/User');
const { getLocationInfo, logSuspiciousActivity, SCORING } = require('./securityService');
const { formatLocationText } = require('./suspiciousLocationMonitor');

// Track failed attempts in memory for quick rate limiting / detection
// In production, use Redis
const failedAttempts = new Map();
const failedLoginHistory = new Map(); // username -> array of { timestamp, ipAddress }
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
    const formattedLocation = formatLocationText(location);
    await User.findOneAndUpdate({ username }, { 
      location: formattedLocation,
      district: location.district,
      state: location.state,
      locationSource: location.locationSource,
      ipAddress
    });
  }

  // Log to general ActivityLog for the "System Logs" tab
  const ActivityLog = require('../models/ActivityLog');
  const formattedLogLocation = formatLocationText(location);
  await ActivityLog.create({
    username: username || 'anonymous',
    ipAddress,
    location: formattedLogLocation,
    district: location.district,
    state: location.state,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    locationSource: location.locationSource,
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

    // NEW: Count failed logins in MongoDB
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const [failed15, failed30] = await Promise.all([
      ActivityLog.countDocuments({
        username,
        activityType: 'login_failed',
        timestamp: { $gte: fifteenMinsAgo }
      }),
      ActivityLog.countDocuments({
        username,
        activityType: 'login_failed',
        timestamp: { $gte: thirtyMinsAgo }
      })
    ]);

    let severity = null;
    let score = 0;
    let attemptCount = 0;
    let timeWindowMinutes = 0;
    let alertDescription = '';

    if (failed30 === 5) {
      severity = 'Critical';
      score = 100;
      attemptCount = failed30;
      timeWindowMinutes = 30;
      alertDescription = `Failed login attempts threshold reached: ${failed30} attempts within 30 minutes.`;
    } else if (failed15 === 3) {
      severity = 'Medium';
      score = 40;
      attemptCount = failed15;
      timeWindowMinutes = 15;
      alertDescription = `Failed login attempts threshold reached: ${failed15} attempts within 15 minutes.`;
    }

    if (severity) {
      const SecurityAlert = require('../models/SecurityAlert');
      const { getGeoInfo } = require('./suspiciousLocationMonitor');
      
      const user = await User.findOne({ username });
      const geo = await getGeoInfo(ipAddress);

      await SecurityAlert.create({
        userId: user ? user._id : undefined,
        username,
        alertType: 'MULTIPLE_FAILED_LOGINS',
        description: alertDescription,
        severity,
        score,
        ipAddress,
        location: formatLocationText(geo),
        country: geo.country,
        city: geo.city,
        district: geo.district,
        state: geo.state,
        locationSource: geo.locationSource,
        latitude: geo.latitude,
        longitude: geo.longitude,
        attemptCount,
        metadata: {
          attemptCount,
          timeWindowMinutes
        }
      });
    }
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

const checkRegistrationLinkSecurity = async (event, reqIp, requestUser) => {
  const { registrationLink, collegeName, title, createdBy } = event;
  if (!registrationLink) return;

  const alertsToCreate = [];
  let parsedUrl;
  try {
    parsedUrl = new URL(registrationLink);
  } catch (e) {
    return;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const protocol = parsedUrl.protocol.toLowerCase();

  // 1. Blacklisted / Phishing
  const blacklist = ['malicious-site.com', 'scam-events.org', 'phish-login.net'];
  const isBlacklisted = blacklist.includes(hostname) || blacklist.some(d => hostname.endsWith('.' + d));
  
  if (isBlacklisted) {
    alertsToCreate.push({
      alertType: 'BLACKLISTED_DOMAIN',
      description: `Event "${title}" registration link matches blacklisted domain: ${hostname}`,
      severity: 'Critical',
      score: 100
    });
  }

  // 2. Localhost, Private IP, Raw IP Checks
  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  const isRawIp = ipRegex.test(hostname);
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') {
    alertsToCreate.push({
      alertType: 'LOCALHOST_LINK',
      description: `Event "${title}" registration link points to localhost/loopback: ${hostname}`,
      severity: 'Critical',
      score: 100
    });
  } else if (isRawIp) {
    const parts = hostname.split('.').map(Number);
    const isPrivateIp = 
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168);
    
    if (isPrivateIp) {
      alertsToCreate.push({
        alertType: 'PRIVATE_IP_LINK',
        description: `Event "${title}" registration link points to private network IP: ${hostname}`,
        severity: 'Critical',
        score: 100
      });
    } else {
      alertsToCreate.push({
        alertType: 'RAW_IP_LINK',
        description: `Event "${title}" registration link uses a raw IP address: ${hostname}`,
        severity: 'Critical',
        score: 100
      });
    }
  }

  // 3. URL shorteners
  const shorteners = ['bit.ly', 'tinyurl.com', 't.ly', 'shorturl.at', 'bitly.com'];
  const isShortener = shorteners.includes(hostname) || shorteners.some(d => hostname.endsWith('.' + d));
  if (isShortener) {
    alertsToCreate.push({
      alertType: 'SHORTENER_LINK',
      description: `Event "${title}" registration link uses a URL shortener: ${hostname}`,
      severity: 'Medium',
      score: 40
    });
  }

  // 4. Non HTTPS links
  if (protocol === 'http:') {
    alertsToCreate.push({
      alertType: 'NON_HTTPS_LINK',
      description: `Event "${title}" registration link uses non-secure HTTP protocol: ${registrationLink}`,
      severity: 'High',
      score: 75
    });
  }

  if (alertsToCreate.length > 0) {
    let alertUser = requestUser?.username;
    let alertUserId = requestUser?.userId;

    if (!alertUser && createdBy) {
      const creator = await User.findById(createdBy);
      if (creator) {
        alertUser = creator.username;
        alertUserId = creator._id;
      }
    }

    alertUser = alertUser || 'unknown';

    const SecurityAlert = require('../models/SecurityAlert');
    const { getGeoInfo } = require('./suspiciousLocationMonitor');
    const geo = await getGeoInfo(reqIp);

    for (const a of alertsToCreate) {
      await SecurityAlert.create({
        userId: alertUserId,
        username: alertUser,
        alertType: a.alertType,
        description: a.description,
        severity: a.severity,
        score: a.score,
        ipAddress: reqIp,
        location: formatLocationText(geo),
        country: geo.country,
        city: geo.city,
        district: geo.district,
        state: geo.state,
        locationSource: geo.locationSource,
        latitude: geo.latitude,
        longitude: geo.longitude,
        metadata: {
          eventId: event._id,
          eventTitle: title,
          registrationLink,
          collegeName
        }
      });
    }
  }
};

module.exports = { checkSuspiciousActivity, trackActionFrequency, checkRegistrationLinkSecurity };
