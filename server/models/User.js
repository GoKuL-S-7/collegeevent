const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'host', 'user'],
    default: 'user',
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isSuspicious: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
  },
  ipAddress: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    default: '',
  },
  region: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  latitude: {
    type: Number,
    default: 0,
  },
  longitude: {
    type: Number,
    default: 0,
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
