const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:    { type: String, required: true },
  sessionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'UserSession' },
  alertType:   {
    type: String,
    required: true,
    enum: [
      'COUNTRY_CHANGE',
      'IMPOSSIBLE_TRAVEL',
      'VPN_DETECTED',
      'TOR_DETECTED',
      'MULTIPLE_IP_CHANGES',
      'NEW_DEVICE',
      'NEW_USER_AGENT',
      'BRUTE_FORCE',
      'SUSPICIOUS_LOCATION'
    ]
  },
  description: { type: String, required: true },
  severity:    { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
  score:       { type: Number, default: 0 },
  // Location at time of alert
  ipAddress:   { type: String },
  country:     { type: String },
  city:        { type: String },
  latitude:    { type: Number },
  longitude:   { type: Number },
  // Extra context
  metadata:    { type: mongoose.Schema.Types.Mixed },
  resolved:    { type: Boolean, default: false },
  resolvedAt:  { type: Date },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
