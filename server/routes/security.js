const express = require('express');
const mongoose = require('mongoose');
const SecurityAlert = require('../models/SecurityAlert');
const UserSession   = require('../models/UserSession');
const { auth, isAdmin } = require('../middleware/auth');
const router = express.Router();

// All routes require admin
router.use(auth, isAdmin);

// ─── GET /api/security/stats ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      total,
      critical,
      high,
      medium,
      unresolved,
      byType,
      byCountry,
      dailyTrends,
      topRiskyUsers,
    ] = await Promise.all([
      SecurityAlert.countDocuments(),
      SecurityAlert.countDocuments({ severity: 'Critical' }),
      SecurityAlert.countDocuments({ severity: 'High' }),
      SecurityAlert.countDocuments({ severity: 'Medium' }),
      SecurityAlert.countDocuments({ resolved: false }),

      // Breakdown by alert type
      SecurityAlert.aggregate([
        { $group: { _id: '$alertType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Breakdown by country
      SecurityAlert.aggregate([
        { $match: { country: { $ne: 'Unknown' } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Daily alert counts – last 7 days
      SecurityAlert.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Top 5 risky users
      SecurityAlert.aggregate([
        { $group: { _id: '$username', totalScore: { $sum: '$score' }, alertCount: { $sum: 1 } } },
        { $sort: { totalScore: -1 } },
        { $limit: 5 }
      ]),
    ]);

    res.json({
      total,
      critical,
      high,
      medium,
      unresolved,
      byType,
      byCountry,
      dailyTrends,
      topRiskyUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/security/alerts ────────────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const { severity, resolved, username, alertType, page = 1, limit = 50 } = req.query;
    const query = {};

    if (severity)   query.severity  = severity;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (username)   query.username  = new RegExp(username, 'i');
    if (alertType)  query.alertType = alertType;

    const alerts = await SecurityAlert.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalCount = await SecurityAlert.countDocuments(query);

    res.json({ alerts, total: totalCount, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/security/user/:username ────────────────────────────────────────
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const [alerts, sessions] = await Promise.all([
      SecurityAlert.find({ username }).sort({ createdAt: -1 }).limit(20),
      UserSession.find({ username }).sort({ loginTime: -1 }).limit(20),
    ]);
    res.json({ username, alerts, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/security/resolve/:alertId ────────────────────────────────────
router.post('/resolve/:alertId', async (req, res) => {
  try {
    const alert = await SecurityAlert.findByIdAndUpdate(
      req.params.alertId,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert resolved', alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/security/sessions ─────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    const query = username ? { username: new RegExp(username, 'i') } : {};
    const sessions = await UserSession.find(query).sort({ loginTime: -1 }).limit(100);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
