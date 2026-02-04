import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import lessonRoutes from './modules/lessons/lessons.routes.js';
import quizRoutes from './modules/quizzes/quizzes.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import videoRoutes from './modules/video/video.routes.js';

dotenv.config();

const app = express();

app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5000',
  'https://a2f9d045-a532-4991-b5f1-5e7645823ac8-00-rx0jwqf0xpdj.worf.replit.dev'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Aiqda API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
