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
  // Skip private/loopback IPs
  if (!ip || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    return {
      ip, country: 'Local', region: 'Local', city: 'Local',
      latitude: 0, longitude: 0, org: '', vpn: false, proxy: false
    };
  }

  try {
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 5000 });
    if (data.error) throw new Error(data.reason);
    return {
      ip:        data.ip,
      country:   data.country_name   || 'Unknown',
      region:    data.region         || 'Unknown',
      city:      data.city           || 'Unknown',
      latitude:  data.latitude       || 0,
      longitude: data.longitude      || 0,
      org:       data.org            || '',
      vpn:       false,   // ipapi.co free tier doesn't expose VPN flag
      proxy:     false,
    };
  } catch {
    return {
      ip, country: 'Unknown', region: 'Unknown', city: 'Unknown',
      latitude: 0, longitude: 0, org: '', vpn: false, proxy: false
    };
  }
}

// ─── Risk Calculation ────────────────────────────────────────────────────────
const SCORE = {
  COUNTRY_CHANGE:       50,
  IMPOSSIBLE_TRAVEL:    70,
  VPN_DETECTED:         40,
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
    const geo   = await getGeoInfo(ip);
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

    // ── Rule 3: VPN / proxy detected ────────────────────────────────────────
    if (geo.vpn || geo.proxy || (geo.org && /vpn|proxy|hosting|cloud|datacenter/i.test(geo.org))) {
      totalScore += SCORE.VPN_DETECTED;
      alerts.push({
        alertType:   'VPN_DETECTED',
        description: `VPN/Proxy/Hosting network detected (ASN: ${geo.org})`,
        score:       SCORE.VPN_DETECTED,
        factor:      'VPN_DETECTED',
      });
    }

    // ── Rule 4: Multiple IP changes in 1 hour ───────────────────────────────
    const oneHourAgo  = new Date(now - 3600000);
    const recentIps   = await UserSession.distinct('ipAddress', {
      userId,
      loginTime: { $gte: oneHourAgo }
    });
    if (recentIps.length > 3) {
      totalScore += SCORE.MULTIPLE_IP_CHANGES;
      alerts.push({
        alertType:   'MULTIPLE_IP_CHANGES',
        description: `${recentIps.length} distinct IP addresses used in the last hour`,
        score:       SCORE.MULTIPLE_IP_CHANGES,
        factor:      'MULTIPLE_IP_CHANGES',
        metadata:    { ips: recentIps },
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

    // ── Emit SecurityAlerts for score >= 30 ──────────────────────────────────
    if (totalScore >= 30) {
      const severity = severityFromScore(totalScore);
      for (const a of alerts) {
        await SecurityAlert.create({
          userId,
          username,
          sessionId:   session._id,
          alertType:   a.alertType,
          description: a.description,
          severity,
          score:       a.score,
          ipAddress:   ip,
          country:     geo.country,
          city:        geo.city,
          latitude:    geo.latitude,
          longitude:   geo.longitude,
          metadata:    a.metadata || {},
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
