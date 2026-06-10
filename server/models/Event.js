const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true }, // hackathon, workshop, concert, seminar
  collegeName: { type: String, required: true },
  location: { type: String, required: true },
  mode: { type: String, enum: ['online', 'offline'], required: true },
  entryFee: { type: Number, default: 0 },
  dateTime: { type: Date, required: true },
  description: { type: String, required: true },
  posterUrl: { type: String }, // optional, for simplicity we might just use a placeholder or local storage
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  hostName: { type: String, required: true },
  hostUserId: { type: String, required: true },
  hostPhoneNumber: { type: String, required: true },
  registrationLink: { type: String, required: true },
  registrationCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Link validation fields
  validationStatus: { type: String, enum: ['VALID', 'WARNING', 'SUSPICIOUS', 'INVALID'], default: 'VALID' },
  httpStatusCode: { type: Number },
  responseTime: { type: Number },
  redirectCount: { type: Number }
});

module.exports = mongoose.model('Event', eventSchema);
