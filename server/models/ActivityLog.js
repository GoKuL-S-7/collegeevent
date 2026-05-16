const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  username: { type: String, required: true },
  ipAddress: { type: String, required: true },
  location: { type: String }, // e.g. Country or City
  timestamp: { type: Date, default: Date.now },
  activityType: { type: String, required: true }, // 'login_failed', 'login_success', 'spam_submission'
  status: { type: String, enum: ['flagged', 'normal'], default: 'normal' },
  details: { type: String },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
