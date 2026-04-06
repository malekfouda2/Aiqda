import Course from '../modules/courses/course.model.js';
import Lesson from '../modules/lessons/lesson.model.js';

export const DEFAULT_LEGACY_LESSON_PUBLISH_BACKFILL_CUTOFF = '2026-04-05T00:00:00.000Z';

const getBackfillCutoffDate = (cutoff = process.env.LEGACY_LESSON_PUBLISH_BACKFILL_CUTOFF || DEFAULT_LEGACY_LESSON_PUBLISH_BACKFILL_CUTOFF) => {
  const cutoffDate = new Date(cutoff);
  if (Number.isNaN(cutoffDate.valueOf())) {
    throw new Error('LEGACY_LESSON_PUBLISH_BACKFILL_CUTOFF must be a valid ISO date.');
  }
  return cutoffDate;
};

// Before lesson-level publishing existed, lessons under published courses were created as drafts.
// This backfill only promotes clearly legacy content: published courses where every lesson is still
// a draft and every lesson was created before the migration cutoff.
export const backfillLegacyLessonPublishState = async (options = {}) => {
  const cutoffDate = getBackfillCutoffDate(options.cutoff);

  const courses = await Course.find({
    isPublished: true,
    createdAt: { $lt: cutoffDate }
  }).select('_id');

  let updatedCourses = 0;
  let updatedLessons = 0;

  for (const course of courses) {
    const lessons = await Lesson.find({ course: course._id })
      .select('_id isPublished createdAt');

    if (lessons.length === 0) {
      continue;
    }

    const allLessonsAreDraft = lessons.every((lesson) => lesson.isPublished === false);
    const allLessonsAreLegacy = lessons.every((lesson) => lesson.createdAt < cutoffDate);

    if (!allLessonsAreDraft || !allLessonsAreLegacy) {
      continue;
    }

    const result = await Lesson.updateMany(
      {
        course: course._id,
        isPublished: false,
        createdAt: { $lt: cutoffDate }
      },
      {
        $set: { isPublished: true }
      }
    );

    if (result.modifiedCount > 0) {
      updatedCourses += 1;
      updatedLessons += result.modifiedCount;
    }
  }

  return {
    checkedCourses: courses.length,
    updatedCourses,
    updatedLessons,
    cutoff: cutoffDate.toISOString(),
  };
};
