/**
 * suspiciousLocationMonitor.js
 * 
 * Core engine for the AI-powered Suspicious Location Monitoring System.
 * 
 * Responsibilities:
 *  - Query ipapi.co for geolocation of an IP address
 *  - Calculate a risk score using multiple detection rules
 *  - Create/update UserSession records
 *  - Auto-generate SecurityAlert documents when score >= 30
 */

const axios     = require('axios');
const UserSession   = require('../models/UserSession');
const SecurityAlert = require('../models/SecurityAlert');
const User          = require('../models/User');

// ─── Haversine distance (km) ────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── IP Geolocation ─────────────────────────────────────────────────────────
async function getGeoInfo(ip) {
  let targetIp = ip;
  
  // If the IP is a local or private IP, try to discover our public IP using ipify
  if (!targetIp || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(targetIp)) {
    try {
      const { data } = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
      if (data && data.ip) {
        targetIp = data.ip;
      }
    } catch (err) {
      // Ignore and use local IP
    }
  }

  // Skip if still local
  if (!targetIp || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(targetIp)) {
    return {
      ip: targetIp || '127.0.0.1',
      country: 'Local',
      region: 'Local',
      city: 'Local',
      latitude: 0,
      longitude: 0,
      org: '',
      vpn: false,
      proxy: false,
      tor: false
    };
  }

  const countryNames = {
    IN: 'India',
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    SG: 'Singapore',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan'
  };

  const cleanCountryName = (c) => {
    if (!c) return 'Unknown';
    if (c.length === 2 && countryNames[c.toUpperCase()]) {
      return countryNames[c.toUpperCase()];
    }
    return c;
  };

  // 1. Try ipapi.co
  try {
    const { data } = await axios.get(`https://ipapi.co/${targetIp}/json/`, { timeout: 4000 });
    if (data && !data.error) {
      return {
        ip: data.ip || targetIp,
        country: cleanCountryName(data.country_name),
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        org: data.org || '',
        vpn: !!(data.security?.vpn || data.proxy || data.hosting),
        proxy: !!(data.proxy || data.security?.proxy),
        tor: !!(data.security?.tor || data.tor)
      };
    }
  } catch (err) {
    // Try fallback to ipinfo.io
  }

  // 2. Try ipinfo.io
  try {
    const { data } = await axios.get(`https://ipinfo.io/${targetIp}/json`, { timeout: 4000 });
    if (data && !data.error) {
      const [lat, lon] = (data.loc || '0,0').split(',').map(Number);
      return {
        ip: data.ip || targetIp,
        country: cleanCountryName(data.country),
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        latitude: lat || 0,
        longitude: lon || 0,
        org: data.org || '',
        vpn: false,
        proxy: false,
        tor: false
      };
    }
  } catch (err) {
    // Ignore
  }

  return {
    ip: targetIp,
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown',
    latitude: 0,
    longitude: 0,
    org: '',
    vpn: false,
    proxy: false,
    tor: false
  };
}

// ─── Risk Calculation ────────────────────────────────────────────────────────
const SCORE = {
  COUNTRY_CHANGE:       50,
  IMPOSSIBLE_TRAVEL:    100,
  VPN_DETECTED:         40,
  PROXY_DETECTED:       30,
  TOR_DETECTED:         70,
  MULTIPLE_IP_CHANGES:  20,
  NEW_DEVICE:           10,
  NEW_USER_AGENT:       10,
};

function severityFromScore(score) {
  if (score >= 100) return 'Critical';
  if (score >= 70)  return 'High';
  if (score >= 30)  return 'Medium';
  return 'Low';
}

// ─── Main Entry Point ────────────────────────────────────────────────────────
/**
 * Called after a successful login.
 * Creates a UserSession, calculates risk, and emits SecurityAlerts.
 *
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.username
 * @param {string} opts.ip
 * @param {string} opts.userAgent
 * @param {string} opts.deviceFingerprint
 */
async function monitorLogin({ userId, username, ip, userAgent = '', deviceFingerprint = '' }) {
  try {
    const geo   = await module.exports.getGeoInfo(ip);
    const now   = new Date();
    const alerts = [];
    let totalScore = 0;

    // ── Fetch most recent session for this user ─────────────────────────────
    const lastSession = await UserSession.findOne({ userId }).sort({ loginTime: -1 });

    // ── Rule 1: Country change within 30 min ────────────────────────────────
    if (
      lastSession &&
      lastSession.country !== 'Unknown' &&
      lastSession.country !== 'Local' &&
      geo.country !== 'Unknown' &&
      geo.country !== 'Local' &&
      lastSession.country !== geo.country
    ) {
      const minutesDiff = (now - lastSession.loginTime) / 60000;
      if (minutesDiff <= 30) {
        totalScore += SCORE.COUNTRY_CHANGE;
        alerts.push({
          alertType:   'COUNTRY_CHANGE',
          description: `Country changed from "${lastSession.country}" to "${geo.country}" in ${Math.round(minutesDiff)} minutes`,
          score:       SCORE.COUNTRY_CHANGE,
          factor:      'COUNTRY_CHANGE',
        });
      }

      // ── Rule 2: Impossible travel (>800 km/h) ─────────────────────────────
      if (lastSession.latitude && lastSession.longitude && geo.latitude && geo.longitude) {
        const km   = haversineKm(lastSession.latitude, lastSession.longitude, geo.latitude, geo.longitude);
        const hrs  = (now - lastSession.loginTime) / 3600000;
        if (hrs > 0 && km / hrs > 800) {
          totalScore += SCORE.IMPOSSIBLE_TRAVEL;
          alerts.push({
            alertType:   'IMPOSSIBLE_TRAVEL',
            description: `Travel speed of ${Math.round(km / hrs)} km/h detected (${Math.round(km)} km in ${Math.round(hrs * 60)} min)`,
            score:       SCORE.IMPOSSIBLE_TRAVEL,
            factor:      'IMPOSSIBLE_TRAVEL',
            metadata:    { distance_km: Math.round(km), speed_kmh: Math.round(km / hrs) },
          });
        }
      }
    }

    // ── Rule 3: VPN / proxy / TOR detected ────────────────────────────────────────
    if (geo.vpn) {
      totalScore += SCORE.VPN_DETECTED;
      alerts.push({
        alertType:   'VPN_DETECTED',
        description: `VPN network detected (ASN: ${geo.org || 'N/A'})`,
        score:       SCORE.VPN_DETECTED,
        factor:      'VPN_DETECTED',
      });
    }

    if (geo.proxy || (geo.org && /proxy|hosting|cloud|datacenter/i.test(geo.org))) {
      totalScore += SCORE.PROXY_DETECTED;
      alerts.push({
        alertType:   'PROXY_DETECTED',
        description: `Proxy/Hosting network detected (ASN: ${geo.org || 'N/A'})`,
        score:       SCORE.PROXY_DETECTED,
        factor:      'PROXY_DETECTED',
      });
    }

    if (geo.tor) {
      totalScore += SCORE.TOR_DETECTED;
      alerts.push({
        alertType:   'TOR_DETECTED',
        description: `TOR Exit Node detected (ASN: ${geo.org || 'N/A'})`,
        score:       SCORE.TOR_DETECTED,
        factor:      'TOR_DETECTED',
      });
    }

    // ── Rule 4: Multiple IP changes in 1 hour ───────────────────────────────
    const oneHourAgo  = new Date(now - 3600000);
    const recentIps   = await UserSession.distinct('ipAddress', {
      userId,
      loginTime: { $gte: oneHourAgo }
    });
    if (!recentIps.includes(ip)) {
      recentIps.push(ip);
    }
    if (recentIps.length > 3) {
      const prevIp = lastSession ? lastSession.ipAddress : 'N/A';
      totalScore += SCORE.MULTIPLE_IP_CHANGES;
      alerts.push({
        alertType:   'MULTIPLE_IP_CHANGES',
        description: `${recentIps.length} distinct IP addresses used in the last hour`,
        score:       SCORE.MULTIPLE_IP_CHANGES,
        factor:      'MULTIPLE_IP_CHANGES',
        metadata:    { 
          previousIp: prevIp,
          currentIp: ip,
          timestamp: now,
          ips: recentIps 
        },
      });
    }

    // ── Rule 5: New device fingerprint ──────────────────────────────────────
    if (deviceFingerprint && lastSession && lastSession.deviceFingerprint &&
        lastSession.deviceFingerprint !== deviceFingerprint) {
      totalScore += SCORE.NEW_DEVICE;
      alerts.push({
        alertType:   'NEW_DEVICE',
        description: 'Login from a previously unseen device fingerprint',
        score:       SCORE.NEW_DEVICE,
        factor:      'NEW_DEVICE',
      });
    }

    // ── Rule 6: New user-agent ────────────────────────────────────────────── 
    if (userAgent && lastSession && lastSession.userAgent &&
        lastSession.userAgent !== userAgent) {
      totalScore += SCORE.NEW_USER_AGENT;
      alerts.push({
        alertType:   'NEW_USER_AGENT',
        description: 'Login from a previously unseen browser/OS user-agent',
        score:       SCORE.NEW_USER_AGENT,
        factor:      'NEW_USER_AGENT',
      });
    }

    // ── Save session ─────────────────────────────────────────────────────────
    const session = await UserSession.create({
      userId,
      username,
      ipAddress:         ip,
      country:           geo.country,
      region:            geo.region,
      city:              geo.city,
      latitude:          geo.latitude,
      longitude:         geo.longitude,
      deviceFingerprint,
      userAgent,
      loginTime:         now,
      lastActivity:      now,
      riskScore:         totalScore,
      riskFactors:       alerts.map(a => a.factor),
      vpnDetected:       geo.vpn || geo.proxy,
    });

    // ── Emit SecurityAlerts for all detected alerts ──────────────────────────
    for (const a of alerts) {
      const isCriticalOverride = a.alertType === 'IMPOSSIBLE_TRAVEL';
      const severity = isCriticalOverride ? 'Critical' : severityFromScore(a.score);
      const scoreVal = isCriticalOverride ? 100 : a.score;

      await SecurityAlert.create({
        userId,
        username,
        sessionId:   session._id,
        alertType:   a.alertType,
        description: a.description,
        severity,
        score:       scoreVal,
        ipAddress:   ip,
        country:     geo.country,
        city:        geo.city,
        latitude:    geo.latitude,
        longitude:   geo.longitude,
        metadata:    a.metadata || {},
      });
    }

    // ── Rule 7: Same IP Multi-Account Detection ───────────────────────────
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
    const uniqueUsersOnIP = await UserSession.distinct('username', {
      ipAddress: ip,
      loginTime: { $gte: twentyFourHoursAgo }
    });
    
    if (!uniqueUsersOnIP.includes(username)) {
      uniqueUsersOnIP.push(username);
    }

    if (uniqueUsersOnIP.length >= 3) {
      const severity = uniqueUsersOnIP.length >= 5 ? 'High' : 'Medium';
      const score = severity === 'High' ? 75 : 40;
      
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
      const existingAlert = await SecurityAlert.findOne({
        ipAddress: ip,
        alertType: 'MULTIPLE_ACCOUNTS_SAME_IP',
        createdAt: { $gte: fiveMinutesAgo }
      });

      if (!existingAlert) {
        await SecurityAlert.create({
          userId,
          username,
          sessionId: session._id,
          alertType: 'MULTIPLE_ACCOUNTS_SAME_IP',
          description: `Multiple accounts (${uniqueUsersOnIP.join(', ')}) logged in from same IP (${ip}) within 24 hours`,
          severity,
          score,
          ipAddress: ip,
          country: geo.country,
          city: geo.city,
          latitude: geo.latitude,
          longitude: geo.longitude,
          metadata: {
            affectedUsers: uniqueUsersOnIP,
            attemptCount: uniqueUsersOnIP.length
          }
        });
      }
    }

    return { session, totalScore, alerts };
  } catch (err) {
    console.error('[SecurityMonitor] Error:', err.message);
    return null;
  }
}

/**
 * Update session lastActivity for keep-alive purposes.
 * Rate-limited to 1 update per 5 min per session.
 */
async function touchSession(userId) {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    await UserSession.findOneAndUpdate(
      { userId, lastActivity: { $lt: fiveMinAgo } },
      { lastActivity: new Date() },
      { sort: { loginTime: -1 } }
    );
  } catch { /* silent */ }
}

module.exports = { monitorLogin, touchSession, getGeoInfo };
