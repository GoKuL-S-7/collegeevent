const mongoose = require('mongoose');

const suspiciousActivitySchema = new mongoose.Schema({
  username: { type: String, required: true },
  activityType: { 
    type: String, 
    required: true,
    enum: [
      'VPN_LOGIN', 
      'UNUSUAL_LOCATION_LOGIN', 
      'BRUTE_FORCE_ATTEMPT', 
      'BOT_LIKE_ACTIVITY', 
      'BULK_REGISTRATION', 
      'MALICIOUS_LINK_DETECTION',
      'API_ABUSE'
    ]
  },
  ipAddress: { type: String, required: true },
  location: { 
    city: String,
    country: String,
    isVPN: Boolean
  },
  timestamp: { type: Date, default: Date.now },
  anomalyScore: { type: Number, default: 0 },
  riskLevel: { 
    type: String, 
    enum: ['Normal', 'Warning', 'Critical'],
    default: 'Normal'
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Resolved', 'Ignored'],
    default: 'Pending'
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
  // Enhanced Event Link Analysis Fields
  eventTitle: String,
  organizerName: String,
  submittedUrl: String,
  finalDestinationUrl: String,
  trustScore: { type: Number, default: 100 }, // 100 is perfectly trusted, decreases with suspicion
  suspicionReasons: [String],
  domainAge: String,
  domainReputation: String,
  matchedBrand: String,
  // Webpage Analysis Fields
  scannedTitle: String,
  pageCategory: String,
  webpageStatus: String,
  eventRelevanceScore: { type: Number, default: 0 },
  redirectCount: { type: Number, default: 0 },
  classification: String
});

module.exports = mongoose.model('SuspiciousActivity', suspiciousActivitySchema);
