# CampusConnect India

A scalable platform to aggregate and host college events across India.

## Tech Stack
- **Frontend**: Next.js (React), Tailwind CSS
- **Backend**: Node.js, Express, MongoDB
- **Authentication**: JWT, bcrypt, Nodemailer
- **AI Monitoring**: Rule-based bot detection system

## Features
1. **User Platform**: Search events, virtual/trending sections, modern dark UI.
2. **Event Hosting**: Multi-step event creation form.
3. **Admin Dashboard**: Manage users, approve/reject events, view security logs.
4. **Security & AI**: Rate limiting, bot behavior tracking (repeated failed logins, spam event submissions).

## Quick Start

### Backend
1. `cd server`
2. `npm install`
3. Configure `.env` (MONGODB_URI, PORT, JWT_SECRET)
4. `npm start` (or `node server.js`)
*Note: The first time the server starts, it automatically creates an admin account: `admin@campusconnect.in` with password `admin123`.*

### Frontend
1. `cd client`
2. `npm install`
3. `npm run dev`

## Design Aesthetic
- Developed with a premium dark theme (`#0f0f1a` background) with purple/pink gradient accents.
- Responsive design, glassmorphism panels, and clean typography.
