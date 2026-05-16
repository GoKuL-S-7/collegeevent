const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  registrationMethod: {
    type: String,
    default: 'external-link',
  },
});

// To implement the 10-minute duplicate protection, we can check for recent records in the API logic.

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
