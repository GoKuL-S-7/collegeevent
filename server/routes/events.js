const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { auth } = require('../middleware/auth');
const { checkSuspiciousActivity, checkRegistrationLinkSecurity } = require('../utils/aiMonitor');
const { getClientIp } = require('../utils/ipExtractor');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { analyzeEventTrust, logSuspiciousActivity, getLocationInfo } = require('../utils/securityService');

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/posters/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Helper for security analysis
const runSecurityAnalysis = async (req, eventData) => {
  const clientIp = getClientIp(req);
  const organizerContext = `${eventData.collegeName} ${eventData.hostName || ''}`;
  const trustAnalysis = await analyzeEventTrust(eventData.title, organizerContext, eventData.registrationLink || '');
  
  if (trustAnalysis.riskLevel === 'Critical' || trustAnalysis.riskLevel === 'Warning') {
    const location = await getLocationInfo(clientIp);
    await logSuspiciousActivity({
      username: req.user.username,
      ipAddress: clientIp,
      location,
      activityType: 'MALICIOUS_LINK_DETECTION',
      additionalScore: trustAnalysis.anomalyScore,
      eventDetails: {
        eventTitle: eventData.title,
        organizerName: eventData.collegeName,
        submittedUrl: eventData.registrationLink,
        finalDestinationUrl: trustAnalysis.finalUrl,
        trustScore: trustAnalysis.trustScore,
        suspicionReasons: trustAnalysis.suspicionReasons,
        domainAge: trustAnalysis.domainAge,
        domainReputation: trustAnalysis.domainReputation,
        riskLevel: trustAnalysis.riskLevel,
        anomalyScore: trustAnalysis.anomalyScore,
        matchedBrand: trustAnalysis.matchedBrand,
        scannedTitle: trustAnalysis.webAnalysis?.scannedTitle,
        pageCategory: trustAnalysis.webAnalysis?.status,
        webpageStatus: trustAnalysis.webAnalysis?.status,
        eventRelevanceScore: trustAnalysis.webAnalysis?.eventRelevanceScore,
        redirectCount: trustAnalysis.webAnalysis?.redirectCount,
        classification: trustAnalysis.webAnalysis?.classification
      }
    });
    
    // Do NOT block event creation. Only flag and notify admins.
    // if (trustAnalysis.riskLevel === 'Critical' && trustAnalysis.anomalyScore >= 50) {
    //   throw new Error('Security Alert: Registration link flagged as high-risk impersonation or unofficial domain.');
    // }
  }
  return trustAnalysis;
};

// Get my events
router.get('/my-events', auth, async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user.userId }).sort({ createdAt: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all approved events - grouped by category
router.get('/grouped', async (req, res) => {
  try {
    const events = await Event.find({ status: 'approved' }).sort({ dateTime: 1 });
    const grouped = {};
    for (const event of events) {
      const cat = event.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(event);
    }
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all approved events
router.get('/', async (req, res) => {
  try {
    const { category, mode, date } = req.query;
    let query = { status: 'approved' };
    if (category) query.category = category;
    if (mode) query.mode = mode;
    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(targetDate.getDate() + 1);
      query.dateTime = { $gte: targetDate, $lt: nextDay };
    }
    const events = await Event.find(query).sort({ dateTime: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a new event
router.post('/', auth, upload.single('poster'), async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot host events. Please use a user or host account.' });
    }

    const clientIp = getClientIp(req);
    const isSpam = await checkSuspiciousActivity(req.user.username, clientIp, 'event_submission');
    if (isSpam) {
      return res.status(429).json({ error: 'Too many submissions. Your account has been flagged.' });
    }

    try {
      await runSecurityAnalysis(req, req.body);
    } catch (secError) {
      return res.status(400).json({ error: secError.message });
    }

    const eventData = {
      ...req.body,
      entryFee: req.body.entryFee ? Number(req.body.entryFee) : 0,
      createdBy: req.user.userId,
      status: 'pending'
    };

    if (req.file) {
      eventData.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    const event = new Event(eventData);
    await event.save();

    // Run link security analysis asynchronously
    checkRegistrationLinkSecurity(event, clientIp, req.user).catch(err => console.error("Link analysis error:", err));

    const user = await User.findById(req.user.userId);
    if (user && user.role === 'user') {
      user.role = 'host';
      await user.save();
    }

    res.status(201).json({ message: 'Event submitted successfully. Waiting for admin approval.', event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming events
router.get('/upcoming', async (req, res) => {
  try {
    const events = await Event.find({ 
      status: 'approved', 
      dateTime: { $gt: new Date() } 
    }).sort({ dateTime: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending events — top 3 most-registered approved events
router.get('/trending', async (req, res) => {
  try {
    const events = await Event.find({ status: 'approved' })
      .sort({ registrationCount: -1 })
      .limit(3);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get virtual events
router.get('/virtual', async (req, res) => {
  try {
    const events = await Event.find({ 
      status: 'approved', 
      mode: 'online' 
    }).sort({ dateTime: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register for an event (Tracking)
router.post('/:id/register', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot register for events.' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Increment registration count
    event.registrationCount = (event.registrationCount || 0) + 1;
    await event.save();

    // Log the registration in the Registration model for user activity tracking
    const Registration = require('../models/Registration');
    const registration = new Registration({
      eventId: event._id,
      userId: req.user.userId,
      registrationType: 'individual', // Default for tracking
      organizationName: 'CampusConnect', // Placeholder
      city: 'Tracking',
      state: 'Tracking',
      fullName: req.user.username,
    });
    await registration.save();

    res.json({ 
      success: true, 
      redirectUrl: event.registrationLink,
      message: 'Registration tracked successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'username phoneNumber');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an event
router.put('/:id', auth, upload.single('poster'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to edit this event' });
    }

    // Run security analysis on update
    try {
      await runSecurityAnalysis(req, req.body);
    } catch (secError) {
      return res.status(400).json({ error: secError.message });
    }

    const updateData = {
      ...req.body,
      entryFee: req.body.entryFee ? Number(req.body.entryFee) : event.entryFee,
      status: 'pending',
      updatedAt: Date.now(),
      lastEditedBy: req.user.userId
    };

    if (req.file) {
      if (event.posterUrl) {
        const oldPath = path.join(__dirname, '..', event.posterUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    // Run link security analysis asynchronously
    const clientIp = getClientIp(req);
    checkRegistrationLinkSecurity(updatedEvent, clientIp, req.user).catch(err => console.error("Link analysis error:", err));
    
    res.json({ message: 'Event updated successfully. Pending re-approval.', event: updatedEvent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const events = await Event.find({ status: 'approved' });
    
    // Calculate popularity score and sort
    // Popularity Score = (Registrations × 5) + (Views × 1) + (Likes × 2)
    const sortedEvents = events.map(event => {
      const score = (event.registrationCount * 5) + (event.views * 1) + (event.likes * 2);
      return { ...event._doc, popularityScore: score };
    }).sort((a, b) => b.popularityScore - a.popularityScore);

    res.json(sortedEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Increment views
router.post('/:id/view', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id, 
      { $inc: { views: 1 } }, 
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, views: event.views });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Increment likes
router.post('/:id/like', auth, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id, 
      { $inc: { likes: 1 } }, 
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, likes: event.likes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an event
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Permission check: Creator of the event OR Admin can delete
    const isOwner = event.createdBy.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this event' });
    }

    // 1. Cascade Delete: Registrations
    await Registration.deleteMany({ eventId: event._id });
    const EventRegistration = require('../models/EventRegistration');
    await EventRegistration.deleteMany({ eventId: event._id });

    // 2. Cleanup: Delete poster image if exists
    if (event.posterUrl) {
      const posterPath = path.join(__dirname, '..', event.posterUrl);
      if (fs.existsSync(posterPath)) {
        fs.unlinkSync(posterPath);
      }
    }

    // 3. Cleanup: Activity Logs (Optional but recommended)
    const ActivityLog = require('../models/ActivityLog');
    await ActivityLog.deleteMany({ metadata: { eventId: event._id } });

    // 4. Finally Delete the event
    await Event.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Event and all associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
