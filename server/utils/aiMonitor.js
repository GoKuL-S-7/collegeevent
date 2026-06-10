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

  const dns = require('dns').promises;
  const axios = require('axios');
  const BlacklistDomain = require('../models/BlacklistDomain');
  const SecurityAlert = require('../models/SecurityAlert');
  const User = require('../models/User');

  let parsedUrl;
  try {
    parsedUrl = new URL(registrationLink);
  } catch (e) {
    event.validationStatus = 'INVALID';
    event.httpStatusCode = null;
    event.responseTime = 0;
    event.redirectCount = 0;
    await event.save().catch(() => {});
    return;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const protocol = parsedUrl.protocol.toLowerCase();
  
  let ip = '';
  let status = null;
  let responseTime = 0;
  let redirectCount = 0;
  let dnsFailed = false;
  let timeout = false;
  let pageContent = '';
  let sslValid = true;
  let hasSslError = false;
  
  const startTime = Date.now();

  // 1. DNS Lookup
  try {
    const lookupResult = await dns.lookup(hostname);
    ip = lookupResult.address;
  } catch (err) {
    dnsFailed = true;
  }

  // 2. HTTP/HTTPS Request
  if (!dnsFailed) {
    try {
      const response = await axios.get(registrationLink, {
        timeout: 5000,
        maxRedirects: 10,
        validateStatus: () => true, // resolve promise for any status code
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      responseTime = Date.now() - startTime;
      status = response.status;
      pageContent = typeof response.data === 'string' ? response.data : '';
      if (response.request && response.request._redirectable) {
        redirectCount = response.request._redirectable._redirectCount || 0;
      }
    } catch (err) {
      responseTime = Date.now() - startTime;
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        timeout = true;
      } else if (err.code === 'ENOTFOUND') {
        dnsFailed = true;
      } else if (err.message.includes('SSL') || err.message.includes('certificate') || err.code === 'EPROTO') {
        hasSslError = true;
        sslValid = false;
      } else {
        dnsFailed = true;
      }
    }
  }

  // 3. SSL check for HTTPS
  if (protocol === 'https:' && !dnsFailed && !timeout && !hasSslError) {
    const checkSslCertificate = require('./sslChecker');
    const sslDetails = await checkSslCertificate(hostname);
    if (!sslDetails.valid) {
      sslValid = false;
    }
  }

  // Determine validationStatus
  let validationStatus = 'VALID';
  if (dnsFailed || timeout || status === 404 || status === 410) {
    validationStatus = 'INVALID';
  } else if (status === 403 || status === 429) {
    validationStatus = 'SUSPICIOUS';
  } else if (status === 301 || status === 302 || redirectCount > 5) {
    validationStatus = 'WARNING';
  }

  const alertsToCreate = [];

  // Localhost check
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    validationStatus = 'INVALID';
    alertsToCreate.push({
      alertType: 'LOCALHOST_LINK',
      description: `Event "${title}" registration link points to localhost: ${hostname}`,
      severity: 'Critical',
      score: 100
    });
  }

  // Private IP check
  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipRegex.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    const isPrivateIp = 
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168);
    if (isPrivateIp) {
      validationStatus = 'INVALID';
      alertsToCreate.push({
        alertType: 'PRIVATE_IP_LINK',
        description: `Event "${title}" registration link points to private IP: ${hostname}`,
        severity: 'Critical',
        score: 95
      });
    }
  }

  // Malware domain check
  const isMalicious = await BlacklistDomain.findOne({ domain: hostname });
  if (isMalicious || ['malicious-site.com', 'scam-events.org', 'phish-login.net'].includes(hostname)) {
    validationStatus = 'INVALID';
    alertsToCreate.push({
      alertType: 'MALICIOUS_DOMAIN',
      description: `Event "${title}" registration link matches blacklisted malicious domain: ${hostname}`,
      severity: 'Critical',
      score: 100
    });
  }

  // DNS / Timeout / HTTP Status Alerts
  if (dnsFailed && !alertsToCreate.length) {
    alertsToCreate.push({
      alertType: 'MALICIOUS_LINK_DETECTED',
      description: `Event "${title}" registration link DNS lookup failed: ${hostname}`,
      severity: 'Critical',
      score: 100
    });
  } else if (timeout && !alertsToCreate.length) {
    alertsToCreate.push({
      alertType: 'MALICIOUS_LINK_DETECTED',
      description: `Event "${title}" registration link connection timed out`,
      severity: 'Critical',
      score: 100
    });
  }

  // SSL Validation Alert
  if (protocol === 'https:' && !sslValid) {
    alertsToCreate.push({
      alertType: 'INVALID_SSL_CERTIFICATE',
      description: `Event "${title}" registration link has invalid or expired SSL certificate`,
      severity: 'High',
      score: 70
    });
  }

  // Non-HTTPS Validation Alert
  if (protocol === 'http:') {
    alertsToCreate.push({
      alertType: 'NON_HTTPS_LINK',
      description: `Event "${title}" registration link uses non-secure HTTP protocol: ${registrationLink}`,
      severity: 'High',
      score: 75
    });
  }

  // Shortener Detection Alert
  const shorteners = ['bit.ly', 'tinyurl', 'cutt.ly', 'shorturl'];
  if (shorteners.some(s => hostname.includes(s))) {
    alertsToCreate.push({
      alertType: 'SHORTENED_LINK',
      description: `Event "${title}" registration link uses a URL shortener: ${hostname}`,
      severity: 'High',
      score: 70
    });
  }

  // Registration Page content check
  if (validationStatus === 'VALID' || validationStatus === 'WARNING' || validationStatus === 'SUSPICIOUS') {
    const indicators = [
      'register',
      'registration',
      'sign up',
      'apply now',
      'event registration',
      'participant form',
      'google form',
      'microsoft form',
      'registration deadline'
    ];
    const formHosts = ['forms.gle', 'docs.google.com/forms', 'forms.office.com', 'forms.microsoft.com'];
    const hasFormHost = formHosts.some(h => registrationLink.toLowerCase().includes(h));
    
    let containsIndicator = hasFormHost;
    if (!containsIndicator && pageContent) {
      const lowerContent = pageContent.toLowerCase();
      containsIndicator = indicators.some(ind => lowerContent.includes(ind));
    }

    if (!containsIndicator) {
      alertsToCreate.push({
        alertType: 'MISSING_REGISTRATION_PAGE',
        description: `Event "${title}" registration page is missing standard form indicators`,
        severity: 'Medium',
        score: 40
      });
    }
  }

  // Save validation status and details on event
  event.validationStatus = validationStatus;
  event.httpStatusCode = status;
  event.responseTime = responseTime;
  event.redirectCount = redirectCount;
  await event.save();

  // Clear existing alerts for this event's registration link to avoid duplication
  await SecurityAlert.deleteMany({
    'metadata.eventId': event._id,
    alertType: { $in: [
      'LOCALHOST_LINK',
      'PRIVATE_IP_LINK',
      'RAW_IP_LINK',
      'NON_HTTPS_LINK',
      'SHORTENER_LINK',
      'BLACKLISTED_DOMAIN',
      'MALICIOUS_LINK_DETECTED',
      'MISSING_REGISTRATION_PAGE',
      'INVALID_SSL_CERTIFICATE',
      'SHORTENED_LINK',
      'MALICIOUS_DOMAIN'
    ] }
  });

  // Create new alerts
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
        validationStatus,
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

// Start daily recheck cron job
const startDailyRecheckCron = () => {
  // Recheck every 24 hours
  setInterval(async () => {
    try {
      console.log('[AutoRecheck] Starting daily registration link verification...');
      const Event = require('../models/Event');
      const events = await Event.find({ status: { $in: ['approved', 'pending'] } });
      for (const event of events) {
        await checkRegistrationLinkSecurity(event, '127.0.0.1');
      }
      console.log('[AutoRecheck] Daily registration link verification complete.');
    } catch (err) {
      console.error('[AutoRecheck] Error during daily verification:', err);
    }
  }, 24 * 60 * 60 * 1000);
};

module.exports = { 
  checkSuspiciousActivity, 
  trackActionFrequency, 
  checkRegistrationLinkSecurity,
  startDailyRecheckCron
};
