const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { checkSuspiciousActivity } = require('../utils/aiMonitor');
const { monitorLogin } = require('../utils/suspiciousLocationMonitor');
const { getClientIp } = require('../utils/ipExtractor');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' }
});

// Check if an admin exists
router.get('/check-admin', async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    res.json({ adminExists: !!adminExists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// First-time Admin Setup
router.post('/setup-admin', async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(403).json({ error: 'Setup already completed. Admin exists.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new User({
      username,
      password: hashedPassword,
      role: 'admin',
      location: 'HQ'
    });
    
    await admin.save();
    
    // Auto-login after setup
    const token = jwt.sign({ userId: admin._id, role: admin.role, username: admin.username }, process.env.JWT_SECRET || 'supersecretjwt', { expiresIn: '24h' });
    res.status(201).json({ message: 'Admin account created successfully', user: { username: admin.username, role: admin.role }, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { username, password, location, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ username, password: hashedPassword, location, role: role || 'user' });
    await user.save();

    const clientIp = getClientIp(req);
    await checkSuspiciousActivity(username, clientIp, 'signup');

    res.status(201).json({ message: 'User created successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, latitude, longitude } = req.body;
    const user = await User.findOne({ username });
    
    const clientIp = getClientIp(req);
    
    if (!user) {
      if (username) await checkSuspiciousActivity(username, clientIp, 'login_failed');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact the administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await checkSuspiciousActivity(username, clientIp, 'login_failed');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { getGeoInfo, formatLocationText } = require('../utils/suspiciousLocationMonitor');
    const geo = await getGeoInfo(clientIp, latitude, longitude);

    if (typeof latitude === 'number' && typeof longitude === 'number' && latitude !== 0 && longitude !== 0 && geo.locationSource !== 'GPS') {
      geo.latitude = Number(latitude);
      geo.longitude = Number(longitude);
      geo.locationSource = 'GPS';
    }

    user.ipAddress = geo.ip;
    user.country = geo.country || 'Unknown';
    user.region = geo.region || geo.state || 'Unknown';
    user.city = geo.city || geo.district || 'Unknown';
    user.district = geo.district;
    user.state = geo.state;
    user.locationSource = geo.locationSource;
    user.latitude = geo.latitude;
    user.longitude = geo.longitude;
    user.lastLogin = new Date();
    user.location = formatLocationText(geo);
    
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role, username: user.username }, process.env.JWT_SECRET || 'supersecretjwt', { expiresIn: '24h' });
    
    await checkSuspiciousActivity(username, clientIp, 'login_success');

    // Fire-and-forget: AI location monitoring (does NOT block the response)
    monitorLogin({
      userId:            user._id.toString(),
      username:          user.username,
      ip:                clientIp,
      userAgent:         req.headers['user-agent'] || '',
      deviceFingerprint: req.headers['x-device-fingerprint'] || '',
      latitude:          typeof latitude === 'number' ? latitude : null,
      longitude:         typeof longitude === 'number' ? longitude : null
    }).catch(() => {});
    
    res.json({ user: { username: user.username, role: user.role, location: user.location }, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
