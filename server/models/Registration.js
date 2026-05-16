const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  registrationType: {
    type: String,
    enum: ['team', 'individual'],
    required: true,
  },
  // Team Fields
  teamName: String,
  teamSize: {
    type: Number,
    min: 1,
  },
  teamLeaderName: String,
  teamLeaderPhone: String,
  participants: [{
    name: String,
  }],
  domain: String, // Used by team

  // Individual Fields
  fullName: String,
  phoneNumber: String,
  interestedSession: String,

  // Common Fields
  organizationName: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
});

module.exports = mongoose.model('Registration', registrationSchema);
