import 'dotenv/config';
import app from './app.js';
import mongoose from 'mongoose';
import { autoSeedIfEmpty } from './seed.js';
import { backfillLegacyLessonPublishState } from './startup/legacyLessonPublishBackfill.js';
import { backfillContentReviewState } from './startup/contentReviewStateBackfill.js';
import { syncSubscriptionPackageRoadmap } from './startup/subscriptionPackageRoadmapMigration.js';
import { startSubscriptionRenewalWorker } from './startup/subscriptionRenewalWorker.js';
import { validateRuntimeConfig } from './startup/validateRuntimeConfig.js';

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiqda';

validateRuntimeConfig();

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await autoSeedIfEmpty();
    const subscriptionRoadmapResult = await syncSubscriptionPackageRoadmap();
    if (
      subscriptionRoadmapResult.billingBackfills > 0
      || subscriptionRoadmapResult.sixMonthBackfills > 0
      || subscriptionRoadmapResult.roadmapPackagesCreated > 0
      || subscriptionRoadmapResult.legacyPackagesArchived > 0
    ) {
      console.log(
        `Subscription package sync completed. Billing backfills: ${subscriptionRoadmapResult.billingBackfills}, six-month backfills: ${subscriptionRoadmapResult.sixMonthBackfills}, roadmap packages created: ${subscriptionRoadmapResult.roadmapPackagesCreated}, legacy packages archived: ${subscriptionRoadmapResult.legacyPackagesArchived}.`
      );
    }
    const backfillResult = await backfillLegacyLessonPublishState();
    if (backfillResult.updatedLessons > 0) {
      console.log(
        `Backfilled ${backfillResult.updatedLessons} legacy lessons across ${backfillResult.updatedCourses} courses.`
      );
    }
    const reviewStateResult = await backfillContentReviewState();
    if (reviewStateResult.coursesReset > 0 || reviewStateResult.lessonsReset > 0) {
      console.log(
        `Reset ${reviewStateResult.coursesReset} chapters and ${reviewStateResult.lessonsReset} content items to draft for the review workflow.`
      );
    }
    const renewalWorker = startSubscriptionRenewalWorker();
    if (renewalWorker.started) {
      console.log(`Subscription renewal worker started (interval ${renewalWorker.intervalMs}ms).`);
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Aiqda Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });
