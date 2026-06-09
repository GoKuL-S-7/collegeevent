const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const ActivityLog = require('../models/ActivityLog');
const { auth, isAdmin } = require('../middleware/auth');
const { checkRegistrationLinkSecurity } = require('../utils/aiMonitor');
const router = express.Router();

router.use(auth, isAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle block status
router.patch('/users/:id/block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot be blocked' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`, isBlocked: user.isBlocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user activity
router.get('/users/:id/activity', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('username');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const Registration = require('../models/Registration');

    const [hostedEvents, registrations] = await Promise.all([
      Event.find({ createdBy: userId }).sort({ dateTime: -1 }),
      Registration.find({ userId }).populate('eventId').sort({ createdAt: -1 })
    ]);

    const registeredEvents = registrations.map(r => r.eventId).filter(e => e !== null);

    res.json({
      username: user.username,
      hostedEvents,
      registeredEvents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events for moderation
router.get('/events/all', async (req, res) => {
  try {
    const events = await Event.find().populate('createdBy', 'username').sort({ createdAt: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pending events
router.get('/events/pending', async (req, res) => {
  try {
    const events = await Event.find({ status: 'pending' }).populate('createdBy', 'username');
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve or reject event
router.put('/events/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const event = await Event.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (status === 'approved') {
      checkRegistrationLinkSecurity(event, req.ip, req.user).catch(err => console.error("Link analysis error:", err));
    }

    res.json({ message: `Event ${status} successfully`, event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flagged activity logs
router.get('/activity-logs', async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete any event
router.delete('/events/:id', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const Registration = require('../models/Registration');
    
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Delete poster file if it exists
    if (event.posterUrl) {
      const posterPath = path.join(__dirname, '..', event.posterUrl);
      if (fs.existsSync(posterPath)) {
        fs.unlinkSync(posterPath);
      }
    }

    await Event.findByIdAndDelete(req.params.id);
    await Registration.deleteMany({ eventId: req.params.id });

    res.json({ message: 'Event deleted globally by admin' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const SuspiciousActivity = require('../models/SuspiciousActivity');

// SECURITY DASHBOARD: Get all suspicious activities
router.get('/suspicious-activities', async (req, res) => {
  try {
    const { riskLevel, status, activityType, username } = req.query;
    let query = {};
    
    if (riskLevel) query.riskLevel = riskLevel;
    if (status) query.status = status;
    if (activityType) query.activityType = activityType;
    if (username) query.username = new RegExp(username, 'i');

    const activities = await SuspiciousActivity.find(query).sort({ timestamp: -1 });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SECURITY DASHBOARD: Update activity status
router.put('/suspicious-activities/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const activity = await SuspiciousActivity.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json({ message: 'Activity updated successfully', activity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SECURITY DASHBOARD: Get security stats
router.get('/security-stats', async (req, res) => {
  try {
    const stats = await SuspiciousActivity.aggregate([
      {
        $group: {
          _id: '$activityType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const riskStats = await SuspiciousActivity.aggregate([
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    const dailyTrends = await SuspiciousActivity.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 7 }
    ]);

    res.json({ stats, riskStats, dailyTrends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
