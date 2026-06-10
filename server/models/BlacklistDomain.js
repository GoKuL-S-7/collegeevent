const mongoose = require('mongoose');

const blacklistDomainSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true },
  category: { type: String, enum: ['phishing', 'malware', 'scam', 'other'], default: 'other' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BlacklistDomain', blacklistDomainSchema);
