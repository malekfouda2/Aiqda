import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import lessonRoutes from './modules/lessons/lessons.routes.js';
import quizRoutes from './modules/quizzes/quizzes.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import videoRoutes from './modules/video/video.routes.js';
import instructorAppRoutes from './modules/instructor-applications/instructorApplications.routes.js';
import studioAppRoutes from './modules/studio-applications/studioApplications.routes.js';
import consultationRoutes from './modules/consultations/consultations.routes.js';
import consultationBookingRoutes from './modules/consultations/consultationBookings.routes.js';
import contactMessageRoutes from './modules/contact-messages/contactMessages.routes.js';
import teamMemberRoutes from './modules/team-members/teamMembers.routes.js';

const app = express();

app.disable('x-powered-by');

const trustProxySetting = (() => {
  if (process.env.TRUST_PROXY != null && process.env.TRUST_PROXY !== '') {
    const numericValue = Number(process.env.TRUST_PROXY);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    if (process.env.TRUST_PROXY === 'true') {
      return true;
    }

    if (process.env.TRUST_PROXY === 'false') {
      return false;
    }

    return process.env.TRUST_PROXY;
  }

  return process.env.NODE_ENV === 'production' ? 1 : false;
})();

app.set('trust proxy', trustProxySetting);
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5005',
  'http://127.0.0.1:5005',
  'https://a2f9d045-a532-4991-b5f1-5e7645823ac8-00-rx0jwqf0xpdj.worf.replit.dev'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.some((allowed) => normalizedOrigin === allowed.replace(/\/$/, ''));

    if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/instructor-applications', instructorAppRoutes);
app.use('/api/studio-applications', studioAppRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/consultation-bookings', consultationBookingRoutes);
app.use('/api/contact-messages', contactMessageRoutes);
app.use('/api/team-members', teamMemberRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Aiqda API is running' });
});

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: err.message });
  }
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ error: 'Invalid resource id' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'MulterError' || err.message?.startsWith('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
