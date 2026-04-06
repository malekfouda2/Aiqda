import 'dotenv/config';
import app from './app.js';
import mongoose from 'mongoose';
import { autoSeedIfEmpty } from './seed.js';
import { backfillLegacyLessonPublishState } from './startup/legacyLessonPublishBackfill.js';
import { validateRuntimeConfig } from './startup/validateRuntimeConfig.js';

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiqda';

validateRuntimeConfig();

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await autoSeedIfEmpty();
    const backfillResult = await backfillLegacyLessonPublishState();
    if (backfillResult.updatedLessons > 0) {
      console.log(
        `Backfilled ${backfillResult.updatedLessons} legacy lessons across ${backfillResult.updatedCourses} courses.`
      );
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Aiqda Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });
