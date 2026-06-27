import Course from '../modules/courses/course.model.js';
import Lesson from '../modules/lessons/lesson.model.js';

// The Submit-for-Review / admin-publish workflow introduced the `reviewStatus`
// field on courses and lessons. Existing content predates the field, so this
// one-time backfill resets all such content to draft (and unpublishes it) so it
// must be re-submitted by creators and re-published by admins.
//
// It only touches documents missing `reviewStatus`, so it is idempotent: once a
// document has been migrated (or created after deploy) it is never reset again.
export const backfillContentReviewState = async () => {
  const [courseResult, lessonResult] = await Promise.all([
    Course.updateMany(
      { reviewStatus: { $exists: false } },
      { $set: { reviewStatus: 'draft', isPublished: false } }
    ),
    Lesson.updateMany(
      { reviewStatus: { $exists: false } },
      { $set: { reviewStatus: 'draft', isPublished: false } }
    ),
  ]);

  return {
    coursesReset: courseResult.modifiedCount || 0,
    lessonsReset: lessonResult.modifiedCount || 0,
  };
};
