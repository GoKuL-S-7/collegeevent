const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username:          { type: String, required: true },
  ipAddress:         { type: String, required: true },
  // Geolocation
  location:          { type: String, default: '' },
  country:           { type: String, default: 'Unknown' },
  region:            { type: String, default: 'Unknown' },
  city:              { type: String, default: 'Unknown' },
  district:          { type: String, default: '' },
  state:             { type: String, default: '' },
  locationSource:    { type: String, default: '' },
  latitude:          { type: Number, default: 0 },
  longitude:         { type: Number, default: 0 },
  // Device
  deviceFingerprint: { type: String, default: '' },
  userAgent:         { type: String, default: '' },
  // Timing
  loginTime:         { type: Date, default: Date.now },
  lastActivity:      { type: Date, default: Date.now },
  // Risk
  riskScore:         { type: Number, default: 0 },
  riskFactors:       [String],
  vpnDetected:       { type: Boolean, default: false },
  createdAt:         { type: Date, default: Date.now }
});

// TTL index – sessions older than 30 days are auto-deleted
userSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('UserSession', userSessionSchema);
