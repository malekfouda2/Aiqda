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
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
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
