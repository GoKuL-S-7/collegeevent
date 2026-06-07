require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes     = require('./routes/auth');
const eventRoutes    = require('./routes/events');
const adminRoutes    = require('./routes/admin');
const securityRoutes = require('./routes/security');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// AI Protection
const aiProtection = require('./middleware/aiProtection');
app.use(aiProtection);

// Routes
app.use('/api/auth',     authRoutes);
app.use('/api/events',   eventRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/security', securityRoutes);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusconnect')
.then(async () => {
  console.log('Connected to MongoDB');
  try {
    const User = require('./models/User');
    const Event = require('./models/Event');

    // Migration: If any user has email but no username, migrate it
    const usersToMigrate = await User.find({ email: { $exists: true } });
    if (usersToMigrate.length > 0) {
      console.log(`Found ${usersToMigrate.length} users to migrate...`);
      for (const user of usersToMigrate) {
        if (!user.username) {
          user.username = user._doc.email; // Fallback to email as username
        }
        user._doc.email = undefined; // Remove email
        await user.save({ validateBeforeSave: false });
      }
      await User.collection.dropIndex('email_1').catch(() => {});
      console.log('User migration complete.');
    }

    // Migration for events
    const eventsToMigrate = await Event.find({ $or: [
      { hostUserId: { $exists: false } },
      { hostPhoneNumber: { $exists: false } },
      { registrationLink: { $exists: false } },
      { hostUserId: "SystemUser" } // Re-migrate those that were set to SystemUser
    ] });
    
    if (eventsToMigrate.length > 0) {
      console.log(`Found ${eventsToMigrate.length} events to migrate correctly...`);
      for (const event of eventsToMigrate) {
        const creator = await User.findById(event.createdBy);
        if (creator) {
          if (!event.hostUserId || event.hostUserId === "SystemUser") event.hostUserId = creator.username;
          if (!event.hostPhoneNumber || event.hostPhoneNumber === "0000000000") event.hostPhoneNumber = creator.phoneNumber || "9876543210";
        } else {
          if (!event.hostUserId) event.hostUserId = "CampusConnectHost";
          if (!event.hostPhoneNumber) event.hostPhoneNumber = "0000000000";
        }
        if (!event.registrationLink) event.registrationLink = "https://campusconnect.india";
        await event.save({ validateBeforeSave: false });
      }
      console.log('Event migration complete.');
    }

    // New Migration: Update User Roles to HOST if they have created events
    const hostIds = await Event.distinct('createdBy');
    const hostsToUpdate = await User.find({
      _id: { $in: hostIds },
      role: 'user'
    });

    if (hostsToUpdate.length > 0) {
      console.log(`Converting ${hostsToUpdate.length} users to HOST role...`);
      for (const user of hostsToUpdate) {
        user.role = 'host';
        await user.save({ validateBeforeSave: false });
        console.log(`Updated user: ${user.username} to HOST`);
      }
      console.log('User role migration complete.');
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
})
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

