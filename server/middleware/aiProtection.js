const { trackActionFrequency } = require('../utils/aiMonitor');
const jwt = require('jsonwebtoken');

const aiProtection = async (req, res, next) => {
  // Extract username if available from JWT
  let username = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwt');
      username = decoded.username;
    } catch (e) {
      // Token invalid, treat as anonymous
    }
  }

  // FEATURE 3: Bot-like Fast Action Detection
  // We monitor all POST/PUT/DELETE and sensitive GET requests
  const sensitivePaths = ['/api/events', '/api/auth/signup', '/api/auth/login'];
  const isSensitive = sensitivePaths.some(path => req.path.startsWith(path));
  const isMutation = ['POST', 'PUT', 'DELETE'].includes(req.method);

  if (isMutation || isSensitive) {
    const isBot = await trackActionFrequency(username, req.ip, `${req.method} ${req.path}`);
    if (isBot) {
      // In a real scenario, we might want to block or challenge with CAPTCHA
      // For now, we just flag and let it pass, or return 429 if too extreme
      // res.status(429).json({ error: 'Bot-like activity detected. Please slow down.' });
      // return;
    }
  }

  next();
};

module.exports = aiProtection;
