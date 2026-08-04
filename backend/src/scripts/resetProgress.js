import 'dotenv/config';
import mongoose from 'mongoose';

import { CourseProgress, LessonProgress } from '../modules/analytics/progress.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiqda';

const main = async () => {
  await mongoose.connect(MONGODB_URI);

  const [lessonResult, courseResult] = await Promise.all([
    LessonProgress.deleteMany({}),
    CourseProgress.deleteMany({}),
  ]);

  console.log(
    `Deleted ${lessonResult.deletedCount} lesson progress records and ${courseResult.deletedCount} course progress records.`
  );
};

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error('Failed to reset progress:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  });
