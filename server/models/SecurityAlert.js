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
      'PROXY_DETECTED',
      'TOR_DETECTED',
      'MULTIPLE_IP_CHANGES',
      'NEW_DEVICE',
      'NEW_USER_AGENT',
      'BRUTE_FORCE',
      'SUSPICIOUS_LOCATION',
      'FAILED_LOGIN_ATTEMPTS',
      'MULTIPLE_ACCOUNTS_SAME_IP',
      'MALICIOUS_LINK_DETECTED',
      'LOCALHOST_LINK_SUBMITTED',
      'URL_SHORTENER_USED',
      'NON_HTTPS_REGISTRATION_URL',
      'DOMAIN_MISMATCH',
      'BLACKLISTED_DOMAIN',
      'LOCALHOST_LINK',
      'PRIVATE_IP_LINK',
      'RAW_IP_LINK',
      'NON_HTTPS_LINK',
      'SHORTENER_LINK',
      'MULTIPLE_FAILED_LOGINS',
      'MISSING_REGISTRATION_PAGE',
      'INVALID_SSL_CERTIFICATE',
      'SHORTENED_LINK',
      'MALICIOUS_DOMAIN'
    ]
  },
  description: { type: String, required: true },
  severity:    { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
  score:       { type: Number, default: 0 },
  // Location at time of alert
  ipAddress:   { type: String },
  location:    { type: String },
  country:     { type: String },
  city:        { type: String },
  district:    { type: String },
  state:       { type: String },
  locationSource: { type: String },
  latitude:    { type: Number },
  longitude:   { type: Number },
  // Link validation status
  validationStatus: { type: String, enum: ['VALID', 'WARNING', 'SUSPICIOUS', 'INVALID'] },
  // Extra context
  metadata:    { type: mongoose.Schema.Types.Mixed },
  resolved:    { type: Boolean, default: false },
  resolvedAt:  { type: Date },
  createdAt:   { type: Date, default: Date.now },
  attemptCount: { type: Number }
});

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
