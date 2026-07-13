import Course from '../modules/courses/course.model.js';

// Chapters gained a per-instructor `order` sequence. Existing chapters default to
// order 0; assign them a stable 1-based sequence per instructor (by creation time)
// so they sort deterministically and can be reordered.
export const backfillCourseOrder = async () => {
  const instructorIds = await Course.distinct('instructor', {
    $or: [{ order: { $exists: false } }, { order: { $lte: 0 } }],
  });

  let updatedCourses = 0;

  for (const instructorId of instructorIds) {
    const courses = await Course.find({ instructor: instructorId })
      .sort({ order: 1, createdAt: 1 })
      .select('_id order');

    let seq = 1;
    for (const course of courses) {
      if (course.order !== seq) {
        await Course.findByIdAndUpdate(course._id, { order: seq });
        updatedCourses += 1;
      }
      seq += 1;
    }
  }

  return { updatedInstructors: instructorIds.length, updatedCourses };
};
